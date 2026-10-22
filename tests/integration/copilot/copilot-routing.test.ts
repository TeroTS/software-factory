import { getOAuthProvider } from "@mastra/code-sdk/auth/storage";
import { createFactorySecretEncryption } from "@mastra/factory";
import { TenantCredentialStore } from "@mastra/factory/routes/tenant-credentials";
import { ModelCredentialsStorage } from "@mastra/factory/storage/domains/credentials/base";
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { applyCopilotCompatibility } from "../../../src/mastra/copilot/copilot-compatibility";
import { createFactoryStorage } from "../../../src/mastra/storage";

const user = { orgId: "local", userId: "local-admin" };
type Model = ReturnType<typeof import("ai").wrapLanguageModel>;
const prompt: Parameters<Model["doGenerate"]>[0]["prompt"] = [
  { role: "user", content: [{ type: "text", text: "Run git status" }] },
];
const usage = { input_tokens: 1, output_tokens: 2, total_tokens: 3 };
let directory: string;
let database: ReturnType<typeof createFactoryStorage>;
let credentials: ModelCredentialsStorage;
let provider: typeof import("@mastra/code-sdk/providers/github-copilot");
let requests: Request[];
let endpoints: Record<"user" | "org", string[]>;
let unavailable: boolean;
let inferenceStatus: number;
let toolCall: boolean;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "factory-copilot-routing-"));
  const sdk = join(directory, "sdk");
  const installed = resolve("node_modules/@mastra/code-sdk");
  mkdirSync(join(sdk, "dist/providers"), { recursive: true });
  cpSync(join(installed, "package.json"), join(sdk, "package.json"));
  for (const filename of ["github-copilot.js", "github-copilot.js.map"]) {
    cpSync(
      join(installed, "dist/providers", filename),
      join(sdk, "dist/providers", filename),
    );
  }
  symlinkSync(join(installed, "dist/auth"), join(sdk, "dist/auth"), "dir");
  symlinkSync(resolve("node_modules"), join(sdk, "node_modules"), "dir");
  applyCopilotCompatibility(sdk);
  provider = await import(
    pathToFileURL(join(sdk, "dist/providers/github-copilot.js")).href
  );
  database = createFactoryStorage({}, directory);
  credentials = database.registerDomain(
    new ModelCredentialsStorage(
      createFactorySecretEncryption({
        primary: { id: "v1", key: randomBytes(32) },
      }),
    ),
  );
  await database.init();
  await credentials.ensureReady();
  for (const scope of ["user", "org"] as const) {
    await credentials.setCredential(
      scope === "user" ? user : { orgId: user.orgId },
      "github-copilot",
      {
        type: "oauth",
        access: `fixture-${scope};proxy-ep=proxy.${scope}.example.test;`,
        refresh: `fixture-${scope}-refresh`,
        expires: Date.now() + 3_600_000,
      },
    );
  }
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VITEST", "");
  requests = [];
  endpoints = { user: ["/chat/completions"], org: ["/responses"] };
  unavailable = false;
  inferenceStatus = 200;
  toolCall = false;
  // Only remote HTTP is doubled; SDK adapters, scoped encrypted SQLite, and OAuth fetch are real.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const request = new Request(url, init);
    requests.push(request);
    request.signal.throwIfAborted();
    const scope = request.headers.get("authorization")?.includes("fixture-user")
      ? "user"
      : "org";
    const path = new URL(request.url).pathname;
    if (path === "/models") {
      if (unavailable) return new Response(null, { status: 503 });
      return Response.json({
        data: [
          {
            id: "gpt-6.1-sol",
            model_picker_enabled: true,
            supported_endpoints: endpoints[scope],
          },
        ],
      });
    }
    if (inferenceStatus !== 200) {
      return Response.json(
        { error: { message: "fixture inference failure" } },
        { status: inferenceStatus },
      );
    }
    const body = z
      .object({ model: z.string(), stream: z.boolean().optional() })
      .parse(await request.clone().json());
    if (
      body.model === "gpt-6.1-sol" &&
      !endpoints[scope].includes(path) &&
      endpoints[scope].length > 0
    ) {
      return Response.json(
        { error: { message: "model is not accessible via /chat/completions" } },
        { status: 400 },
      );
    }
    if (path === "/chat/completions") {
      if (body.stream) {
        return sse([
          {
            id: "chat_fixture",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "fixture result" },
                finish_reason: null,
              },
            ],
          },
          {
            id: "chat_fixture",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          },
        ]);
      }
      return Response.json({
        id: "chat_fixture",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "fixture result" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
    }
    if (path !== "/responses")
      throw new Error(`Unexpected fixture endpoint: ${path}`);
    if (body.stream) {
      return sse([
        {
          type: "response.created",
          response: { id: "resp_fixture", created_at: 1, model: body.model },
        },
        {
          type: "response.output_item.added",
          output_index: 0,
          item: { type: "message", id: "msg_fixture" },
        },
        {
          type: "response.output_text.delta",
          item_id: "msg_fixture",
          delta: "fixture result",
        },
        {
          type: "response.output_item.done",
          output_index: 0,
          item: { type: "message", id: "msg_fixture" },
        },
        { type: "response.completed", response: { usage } },
      ]);
    }
    return Response.json({
      id: "resp_fixture",
      created_at: 1,
      model: body.model,
      status: "completed",
      output: toolCall
        ? [
            {
              type: "function_call",
              id: "fc_fixture",
              call_id: "call_fixture",
              name: "shell",
              arguments: '{"command":"git status"}',
              status: "completed",
            },
          ]
        : [
            {
              type: "message",
              id: "msg_fixture",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: "fixture result",
                  annotations: [],
                },
              ],
            },
          ],
      usage,
    });
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await database?.close();
  rmSync(directory, { recursive: true, force: true });
});

function sse(events: unknown[]): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

async function modelFor(
  scope: "user" | "factory" = "factory",
  modelId = "gpt-6.1-sol",
) {
  const store = new TenantCredentialStore(
    user.orgId,
    user.userId,
    credentials,
    scope,
  );
  await store.ensureFresh();
  return provider.githubCopilotProvider(modelId, {
    authStorage: store,
    headers: {
      "x-fixture-header": "preserved",
      authorization: "must-not-be-used",
    },
  }) as Model;
}

it("routes a Responses-only Sol model using the selected Factory credential and Copilot host", async () => {
  const model = await modelFor();
  const result = await model.doGenerate({ prompt });
  expect(result.content).toContainEqual(
    expect.objectContaining({ type: "text", text: "fixture result" }),
  );
  expect(requests.map((request) => request.url)).toEqual([
    "https://api.org.example.test/models",
    "https://api.org.example.test/responses",
  ]);
  const request = requests.at(-1)!;
  expect(request.headers.get("authorization")).toBe(
    "Bearer fixture-org;proxy-ep=proxy.org.example.test;",
  );
  expect(request.headers.get("copilot-integration-id")).toBe("vscode-chat");
  expect(request.headers.get("x-initiator")).toBe("user");
  expect(request.headers.get("x-fixture-header")).toBe("preserved");
  const body = await request.json();
  expect(body).toMatchObject({
    model: "gpt-6.1-sol",
    store: false,
    input: [{ role: "user" }],
  });
  expect(body).not.toHaveProperty("messages");
});

it.each(["user", "factory"] as const)(
  "streams text through the %s scope's supported endpoint",
  async (scope) => {
    const model = await modelFor(scope);
    const { stream } = await model.doStream({ prompt });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(chunks).toContainEqual(
      expect.objectContaining({ type: "text-delta", delta: "fixture result" }),
    );
    expect(chunks).not.toContainEqual(
      expect.objectContaining({ type: "error" }),
    );
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "finish",
        finishReason: expect.objectContaining({ unified: "stop" }),
      }),
    );
    const request = requests.at(-1)!;
    expect(new URL(request.url).pathname).toBe(
      scope === "user" ? "/chat/completions" : "/responses",
    );
    expect(request.headers.get("authorization")).toContain(
      scope === "user" ? "fixture-user" : "fixture-org",
    );
  },
);

it("preserves function-tool arguments, tool-call output, and follow-up input on Responses", async () => {
  toolCall = true;
  const model = await modelFor();
  const result = await model.doGenerate({
    prompt,
    tools: [
      {
        type: "function",
        name: "shell",
        inputSchema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
          additionalProperties: false,
        },
      },
    ],
    toolChoice: { type: "tool", toolName: "shell" },
  });
  expect(result.content).toContainEqual(
    expect.objectContaining({
      type: "tool-call",
      toolCallId: "call_fixture",
      toolName: "shell",
      input: '{"command":"git status"}',
    }),
  );
  const body = await requests.at(-1)!.json();
  expect(body).toMatchObject({
    tools: expect.arrayContaining([
      expect.objectContaining({
        type: "function",
        name: "shell",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
          additionalProperties: false,
        },
      }),
    ]),
    tool_choice: { type: "function", name: "shell" },
  });
  toolCall = false;
  await model.doGenerate({
    prompt: [
      ...prompt,
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_fixture",
            toolName: "shell",
            input: { command: "git status" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_fixture",
            toolName: "shell",
            output: { type: "text", value: "working tree clean" },
          },
        ],
      },
    ],
  });
  const followUp = requests.at(-1)!;
  expect(followUp.headers.get("x-initiator")).toBe("agent");
  expect(await followUp.json()).toMatchObject({
    input: expect.arrayContaining([
      {
        type: "function_call_output",
        call_id: "call_fixture",
        output: "working tree clean",
      },
    ]),
  });
});

it.each([
  ["both endpoints", ["/chat/completions", "/responses"]],
  ["missing endpoint metadata", []],
] as const)(
  "keeps the existing Chat Completions adapter with %s",
  async (_name, supported) => {
    endpoints.org = [...supported];
    await (await modelFor()).doGenerate({ prompt });
    expect(new URL(requests.at(-1)!.url).pathname).toBe("/chat/completions");
    expect(await requests.at(-1)!.json()).toMatchObject({
      messages: [{ role: "user", content: "Run git status" }],
    });
  },
);

it("keeps upstream catalog-failure fallback without switching the requested model", async () => {
  unavailable = true;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await (await modelFor("factory", "gpt-4.1")).doGenerate({ prompt });
  expect(new URL(requests.at(-1)!.url).pathname).toBe("/chat/completions");
  expect(await requests.at(-1)!.json()).toMatchObject({ model: "gpt-4.1" });
  expect(console.warn).toHaveBeenCalled();
});

it("does not borrow Factory credentials when the personal scope is empty", async () => {
  await credentials.removeCredential(user, "github-copilot");
  await expect((await modelFor("user")).doGenerate({ prompt })).rejects.toThrow(
    "Not logged in to GitHub Copilot",
  );
  expect(requests).toEqual([]);
});

it("refreshes only the selected scope before routing and authenticating", async () => {
  await credentials.setCredential({ orgId: user.orgId }, "github-copilot", {
    type: "oauth",
    access: "fixture-expired",
    refresh: "fixture-org-refresh",
    expires: 0,
  });
  const refresh = vi
    .spyOn(getOAuthProvider("github-copilot")!, "refreshToken")
    .mockResolvedValue({
      type: "oauth",
      access: "fixture-org;proxy-ep=proxy.org.example.test;",
      refresh: "fixture-org-refresh",
      expires: Date.now() + 3_600_000,
    });
  await (await modelFor()).doGenerate({ prompt });
  expect(refresh).toHaveBeenCalledOnce();
  expect(
    requests.every((request) =>
      request.headers.get("authorization")?.includes("fixture-org"),
    ),
  ).toBe(true);
  expect(await credentials.getCredential(user, "github-copilot")).toMatchObject(
    { access: "fixture-user;proxy-ep=proxy.user.example.test;" },
  );
});

it("surfaces Responses authentication failures without retrying Chat Completions", async () => {
  inferenceStatus = 401;
  await expect((await modelFor()).doGenerate({ prompt })).rejects.toThrow();
  expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
    "/models",
    "/responses",
  ]);
});

it("preserves cancellation on the Responses request", async () => {
  const controller = new AbortController();
  controller.abort(new Error("fixture canceled"));
  await expect(
    (await modelFor()).doGenerate({ prompt, abortSignal: controller.signal }),
  ).rejects.toThrow("fixture canceled");
  expect(requests.at(-1)!.signal.aborted).toBe(true);
});
