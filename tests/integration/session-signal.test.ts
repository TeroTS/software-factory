import { Agent } from "@mastra/core/agent";
import { AgentController, type Session } from "@mastra/core/agent-controller";
import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import {
  LocalFilesystem,
  LocalSandbox,
  Workspace,
} from "@mastra/core/workspace";
import { MASTRACODE_WORKSPACE_TOOLS } from "@mastra/code-sdk/agents/tool-availability";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { MockLanguageModelV3 } from "ai/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let directory: string;
let storage: LibSQLStore;
let controller: AgentController;
let session: Session;
let model: MockLanguageModelV3;
let firstResponse: ReturnType<typeof deferred>;
let subscription: ReturnType<typeof deferred>;
let subscriptionEntered: ReturnType<typeof deferred>;
let ended: number;
let contexts: unknown[];
let runTools: boolean;
let executedIdentity: unknown;
const require = createRequire(import.meta.url);
const context = new RequestContext();
context.set("user", { userId: "fixture-owner", orgId: "fixture-org" });

describe.each(["ESM", "CJS"])("%s signal delivery", (format) => {
  beforeEach(async () => {
    const { Agent: RuntimeAgent } =
      format === "ESM"
        ? { Agent }
        : (require("@mastra/core/agent") as typeof import("@mastra/core/agent"));
    const { AgentController: RuntimeController } =
      format === "ESM"
        ? { AgentController }
        : (require("@mastra/core/agent-controller") as typeof import("@mastra/core/agent-controller"));
    const workspaceTypes =
      format === "ESM"
        ? { Workspace, LocalFilesystem, LocalSandbox }
        : (require("@mastra/core/workspace") as typeof import("@mastra/core/workspace"));
    directory = mkdtempSync(join(tmpdir(), "factory-session-signal-"));
    storage = new LibSQLStore({
      id: "signal-test",
      url: `file:${join(directory, "memory.db")}`,
    });
    firstResponse = deferred();
    subscription = deferred();
    subscriptionEntered = deferred();
    contexts = [];
    ended = 0;
    runTools = false;
    executedIdentity = undefined;
    // Only model output is synthetic; controller, signals, workspace, and SQLite are real.
    model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream({
          async start(stream) {
            stream.enqueue({ type: "stream-start", warnings: [] });
            if (model.doStreamCalls.length === 1) await firstResponse.promise;
            const toolCalls = runTools && model.doStreamCalls.length === 2;
            if (toolCalls) {
              for (const [toolName, input] of [
                ["inspect_context", "{}"],
                [
                  "write_file",
                  JSON.stringify({
                    path: "signal-edit.txt",
                    content: "fixture edit\n",
                    overwrite: false,
                  }),
                ],
                [
                  "execute_command",
                  JSON.stringify({
                    description: "Write isolated fixture marker",
                    command: "printf 'fixture marker\\n' > signal-marker.txt",
                  }),
                ],
              ] as const) {
                stream.enqueue({
                  type: "tool-call",
                  toolCallId: toolName,
                  toolName,
                  input,
                });
              }
            } else {
              stream.enqueue({ type: "text-start", id: "text" });
              stream.enqueue({
                type: "text-delta",
                id: "text",
                delta: "fixture",
              });
              stream.enqueue({ type: "text-end", id: "text" });
            }
            stream.enqueue({
              type: "finish",
              finishReason: {
                unified: toolCalls ? "tool-calls" : "stop",
                raw: toolCalls ? "tool_calls" : "stop",
              },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
            });
            stream.close();
          },
        }),
      }),
    });
    const memory = new Memory({ storage, options: { generateTitle: false } });
    const workspace = new workspaceTypes.Workspace({
      filesystem: new workspaceTypes.LocalFilesystem({ basePath: directory }),
      sandbox: new workspaceTypes.LocalSandbox({ workingDirectory: directory }),
      tools: MASTRACODE_WORKSPACE_TOOLS,
    });
    const agent = new RuntimeAgent({
      id: "signal-agent",
      name: "Signal agent",
      instructions: "Fixture only",
      model,
      memory,
    });
    controller = new RuntimeController({
      id: "signal-controller",
      agent,
      memory,
      storage,
      modes: [
        { id: "build", name: "Build" },
        {
          id: "restricted",
          name: "Restricted",
          availableTools: ["inspect_context", "task_check"],
        },
      ],
      workspace: ({ requestContext }) =>
        requestContext.get("controller") ? workspace : undefined,
      tools: ({ requestContext }) => {
        contexts.push(requestContext.get("user"));
        return {
          inspect_context: createTool({
            id: "inspect_context",
            description: "Inspect fixture context",
            inputSchema: z.object({}),
            execute: async (_input, execution) => {
              executedIdentity = execution.requestContext?.get("user");
              return { ok: true };
            },
          }),
        };
      },
    });
    await controller.init();
    session = await controller.createSession({
      id: "fixture-session",
      resourceId: "fixture-resource",
      ownerId: "fixture-owner",
    });
    session.subscribe((event) => {
      if (event.type === "agent_end") ended += 1;
    });
  });

  afterEach(async () => {
    firstResponse.resolve();
    subscription.resolve();
    vi.restoreAllMocks();
    await expect.poll(() => controller.listActiveThreadRuns().length).toBe(0);
    await controller.destroy();
    await storage.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function startFirstRun(): Promise<string | undefined> {
    const started = await session.sendSignal(
      { content: "first" },
      { requestContext: context, requireDelivery: true },
    ).accepted;
    await expect.poll(() => model.doStreamCalls.length).toBe(1);
    return started.runId;
  }

  function pauseSubscription(): void {
    const original = session.thread.ensureSubscription.bind(session.thread);
    vi.spyOn(session.thread, "ensureSubscription").mockImplementationOnce(
      async (...args) => {
        subscriptionEntered.resolve();
        await subscription.promise;
        return original(...args);
      },
    );
  }

  async function queueAcrossEnd(
    options?: Parameters<Session["sendSignal"]>[1],
  ): Promise<ReturnType<Session["sendSignal"]>> {
    await startFirstRun();
    pauseSubscription();
    const second = session.sendSignal(
      { content: "second" },
      { requestContext: context, requireDelivery: true, ...options },
    );
    await subscriptionEntered.promise;
    firstResponse.resolve();
    await expect.poll(() => ended).toBe(1);
    return second;
  }

  it("retains controller/workspace tools and identity when an active delivery becomes an idle wake", async () => {
    const second = await queueAcrossEnd();
    subscription.resolve();
    expect(await second.accepted).toMatchObject({ action: "wake" });
    await expect.poll(() => ended).toBe(2);
    const names = model.doStreamCalls.map((call) =>
      call.tools?.map((tool) => tool.name),
    );
    expect(names[1]).toEqual(names[0]);
    expect(names[1]).toEqual(
      expect.arrayContaining([
        "inspect_context",
        "task_check",
        "write_file",
        "execute_command",
      ]),
    );
    expect(contexts).toEqual([
      { userId: "fixture-owner", orgId: "fixture-org" },
      { userId: "fixture-owner", orgId: "fixture-org" },
    ]);
  });

  it("executes scoped controller tools and a real sandbox command after the handoff", async () => {
    runTools = true;
    for (const toolName of ["inspect_context", "write_file", "execute_command"])
      await session.permissions.setForTool({ toolName, policy: "allow" });
    const second = await queueAcrossEnd();
    subscription.resolve();
    await second.accepted;
    await expect.poll(() => ended).toBe(2);
    expect(readFileSync(join(directory, "signal-marker.txt"), "utf8")).toBe(
      "fixture marker\n",
    );
    expect(readFileSync(join(directory, "signal-edit.txt"), "utf8")).toBe(
      "fixture edit\n",
    );
    expect(executedIdentity).toEqual({
      userId: "fixture-owner",
      orgId: "fixture-org",
    });
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it("delivers into a still-active run without rebuilding its toolsets", async () => {
    const runId = await startFirstRun();
    const delivered = await session.sendSignal(
      { content: "active" },
      { requestContext: context, requireDelivery: true },
    ).accepted;
    expect(delivered).toMatchObject({ action: "deliver", runId });
    expect(contexts).toHaveLength(1);
    firstResponse.resolve();
    await expect.poll(() => ended).toBe(1);
    expect(
      model.doStreamCalls.every((call) =>
        call.tools?.some((tool) => tool.name === "inspect_context"),
      ),
    ).toBe(true);
  });

  it.each(["persist", "discard"] as const)(
    "preserves explicit idle %s without starting a run",
    async (behavior) => {
      const second = await queueAcrossEnd({ ifIdle: { behavior } });
      subscription.resolve();
      expect(await second.accepted).toMatchObject({ action: behavior });
      expect(model.doStreamCalls).toHaveLength(1);
      expect(ended).toBe(1);
    },
  );

  it("applies current mode restrictions and denied tools to the fresh run", async () => {
    const second = await queueAcrossEnd();
    await session.mode.switch({ modeId: "restricted" });
    await session.permissions.setForTool({
      toolName: "inspect_context",
      policy: "deny",
    });
    subscription.resolve();
    await second.accepted;
    await expect.poll(() => ended).toBe(2);
    expect(model.doStreamCalls[1]?.tools?.map((tool) => tool.name)).toEqual([
      "task_check",
    ]);
  });

  it("does not start a fresh run if aborted during asynchronous setup", async () => {
    await startFirstRun();
    pauseSubscription();
    const second = session.sendSignal(
      { content: "cancelled" },
      { requestContext: context, requireDelivery: true },
    );
    const rejected = expect(second.accepted).rejects.toThrow("cancelled");
    await subscriptionEntered.promise;
    session.abort();
    firstResponse.resolve();
    subscription.resolve();
    await rejected;
    expect(model.doStreamCalls).toHaveLength(1);
  });
});
