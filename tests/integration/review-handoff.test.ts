import type { MastraCodeState } from "@mastra/code-sdk/schema";
import { Agent } from "@mastra/core/agent";
import { AgentController } from "@mastra/core/agent-controller";
import { RequestContext } from "@mastra/core/request-context";
import { Tool } from "@mastra/core/tools";
import { LocalFilesystem, Workspace } from "@mastra/core/workspace";
import { createBoardRegistry } from "@mastra/factory/boards";
import { FactoryDecisionDispatcher } from "@mastra/factory/rules/dispatcher";
import { FactoryPhaseStateProcessor } from "@mastra/factory/rules/processor";
import { createFactoryTransitionTools } from "@mastra/factory/rules/tools";
import { FactoryTransitionService } from "@mastra/factory/rules/transition-service";
import { WorkItemsStorage } from "@mastra/factory/storage/domains/work-items/base";
import { Memory } from "@mastra/memory";
import { MockLanguageModelV3 } from "ai/test";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { createFactoryStorage } from "../../src/mastra/storage";

it.each([
  "active builder",
  "transition resume",
  "pending terminal hook",
  "superseded reviewer",
  "denied verdict",
  "overdue builder",
  "foreign run owner",
  "cancel in flight",
] as const)(
  "handles %s without reusing builder tools or bypassing policy",
  async (schedule) => {
    const directory = mkdtempSync(join(tmpdir(), "factory-review-handoff-"));
    const database = createFactoryStorage({}, directory);
    const workItems = database.registerDomain(new WorkItemsStorage());
    const boards = createBoardRegistry();
    const phase = new FactoryPhaseStateProcessor({
      storage: workItems,
      boards,
      configVersion: "fixture",
    });
    let finishBuilder!: () => void;
    const builderGate = new Promise<void>((resolve) => {
      finishBuilder = resolve;
    });
    let committed!: () => void;
    const transitionCommitted = new Promise<void>((resolve) => {
      committed = resolve;
    });
    let returnTool!: () => void;
    const toolGate = new Promise<void>((resolve) => {
      returnTool = resolve;
    });
    let terminalEntered!: () => void;
    const terminalSeen = new Promise<void>((resolve) => {
      terminalEntered = resolve;
    });
    let finishTerminal!: () => void;
    const terminalGate = new Promise<void>((resolve) => {
      finishTerminal = resolve;
    });
    let deliveryObserved!: () => void;
    const deliverySetup = new Promise<void>((resolve) => {
      deliveryObserved = resolve;
    });
    let inFlight: Promise<void> | undefined;
    let releaseOwnership: (() => void) | undefined;
    let verdictSent = false;
    const requests: {
      reviewer: boolean;
      reviewerPhase: boolean;
      tools: string[];
    }[] = [];
    const isReviewerPrompt = (prompt: unknown): boolean =>
      JSON.stringify(prompt).includes(
        schedule === "transition resume"
          ? "# Factory Self-review"
          : "Review fixture",
      );
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        const request = {
          reviewer: isReviewerPrompt(options.prompt),
          reviewerPhase: JSON.stringify(options.prompt).includes(
            "Role: review",
          ),
          tools: options.tools?.map((tool) => tool.name) ?? [],
        };
        requests.push(request);
        return {
          stream: new ReadableStream({
            async start(stream) {
              stream.enqueue({ type: "stream-start", warnings: [] });
              if (model.doStreamCalls.length === 1) await builderGate;
              const transition =
                schedule === "transition resume" &&
                model.doStreamCalls.length === 1;
              const review =
                request.reviewer &&
                !verdictSent &&
                options.tools?.some(
                  (tool) => tool.name === "factory_record_review_verdict",
                );
              if (transition || review) {
                verdictSent ||= Boolean(review);
                stream.enqueue({
                  type: "tool-call",
                  toolCallId: transition
                    ? "fixture-transition"
                    : "fixture-verdict",
                  toolName: transition
                    ? "factory_transition_work_item"
                    : "factory_record_review_verdict",
                  input: JSON.stringify(
                    transition
                      ? {
                          stage: "review",
                          expectedRevision: 1,
                          rationale: "Fixture ready for review",
                        }
                      : {
                          verdict: "approve",
                          reviewedHeadSha: "a".repeat(40),
                          findings: "Fixture independent review passed.",
                        },
                  ),
                });
              } else {
                stream.enqueue({ type: "text-start", id: "text" });
                stream.enqueue({
                  type: "text-delta",
                  id: "text",
                  delta: "Fixture complete",
                });
                stream.enqueue({ type: "text-end", id: "text" });
              }
              stream.enqueue({
                type: "finish",
                finishReason: {
                  unified: transition || review ? "tool-calls" : "stop",
                  raw: "stop",
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
        };
      },
    });
    const storage = database.getMastraStorage();
    const memory = new Memory({ storage, options: { generateTitle: false } });
    const transitionService = new FactoryTransitionService({
      storage: workItems,
      boards,
      configVersion: "fixture",
      selfReviewEnabled: async () => true,
    });
    const transition = transitionService.transition.bind(transitionService);
    vi.spyOn(transitionService, "transition").mockImplementationOnce(
      async (request) => {
        const result = await transition(request);
        expect(result.status).toBe("accepted");
        committed();
        await toolGate;
        return result;
      },
    );
    mkdirSync(join(directory, "skills/factory-self-review"), {
      recursive: true,
    });
    cpSync(
      resolve(
        "node_modules/@mastra/factory/factory-skills/factory-self-review/SKILL.md",
      ),
      join(directory, "skills/factory-self-review/SKILL.md"),
    );
    const controller = new AgentController<MastraCodeState>({
      id: "fixture",
      storage,
      memory,
      agent: new Agent({
        id: "fixture",
        name: "Fixture",
        model,
        memory,
        instructions: "Fixture only",
        inputProcessors: async () => [phase],
      }),
      modes: [{ id: "build", name: "Build" }],
      workspace: new Workspace({
        filesystem: new LocalFilesystem({ basePath: directory }),
        skills: ["skills"],
      }),
      tools: async ({ requestContext }) => {
        const tools = await createFactoryTransitionTools({
          requestContext,
          storage: workItems,
          boards,
          transitionService,
        });
        return Object.fromEntries(
          Object.entries(tools).map(([name, tool]) => {
            if (!(tool instanceof Tool))
              throw new Error("Expected a real Factory tool");
            return [name, tool];
          }),
        );
      },
      initialState: {
        factoryProjectId: "fixture-project",
        factoryOrgId: "fixture-org",
      },
    });
    const scope = {
      orgId: "fixture-org",
      factoryProjectId: "fixture-project",
      userId: "fixture-owner",
    };
    const dispatcher = new FactoryDecisionDispatcher({
      controller,
      storage: workItems,
      boards,
      transitionService,
      isAutoRunEnabled: async () => true,
      skillCompletionObservationTimeoutMs: 2000,
      prepareBinding: async ({ item, role }) => {
        const session = await controller.getSession("fixture-session");
        if (!session) throw new Error("Fixture session missing");
        const prepared = await workItems.prepareRunStart({
          ...scope,
          workItem: { id: item.id, input: { title: item.title } },
          role,
          session: {
            sessionId: session.identity.getId(),
            threadId: session.thread.requireId(),
            branch: "fixture-branch",
          },
          resourceId: session.identity.getResourceId(),
          kickoffKey: "reviewer",
          kickoffMessage: null,
        });
        await workItems.markPendingStart(prepared.binding.id, "sent");
      },
    });
    try {
      await database.init();
      await workItems.ensureReady();
      await controller.init();
      const session = await controller.createSession({
        id: "fixture-session",
        ownerId: scope.userId,
        resourceId: "fixture-resource",
      });
      const context = new RequestContext();
      context.set("user", {
        workosId: scope.userId,
        organizationId: scope.orgId,
      });
      const agent = controller.getCurrentAgent(session);
      const claim = await agent.claimThreadOwnership({
        threadId: session.thread.requireId(),
        resourceId: session.identity.getResourceId(),
        streamOptions: () =>
          session.machinery.buildStreamOptions({
            threadId: session.thread.requireId(),
            requestContext: context,
          }),
      });
      expect(claim.claimed).toBe(true);
      releaseOwnership = claim.unsubscribe;
      const sessionRef = {
        sessionId: session.identity.getId(),
        threadId: session.thread.requireId(),
        branch: "fixture-branch",
      };
      const builder = await workItems.prepareRunStart({
        ...scope,
        workItem: {
          input: { title: "Fixture", board: "work", stages: ["execute"] },
        },
        role: "work",
        session: sessionRef,
        resourceId: session.identity.getResourceId(),
        kickoffKey: "builder",
        kickoffMessage: null,
      });
      await workItems.markPendingStart(builder.binding.id, "sent");
      for (const toolName of [
        "factory_transition_work_item",
        "factory_record_review_verdict",
      ]) {
        await session.permissions.setForTool({
          toolName,
          policy:
            schedule === "denied verdict" &&
            toolName === "factory_record_review_verdict"
              ? "deny"
              : "allow",
        });
      }
      await session.sendSignal(
        { content: "Build fixture" },
        { requestContext: context, requireDelivery: true },
      ).accepted;
      await expect.poll(() => model.doStreamCalls.length).toBe(1);
      expect(
        model.doStreamCalls[0]?.tools?.map((tool) => tool.name),
      ).not.toContain("factory_record_review_verdict");
      if (schedule === "transition resume") {
        finishBuilder();
        await transitionCommitted;
      } else {
        await workItems.update({
          ...scope,
          id: builder.item.id,
          patch: { stages: ["review"] },
        });
        const reviewer = await workItems.prepareRunStart({
          ...scope,
          workItem: { id: builder.item.id, input: { title: "Fixture" } },
          role: "review",
          session: sessionRef,
          resourceId: session.identity.getResourceId(),
          kickoffKey: "reviewer",
          kickoffMessage: null,
        });
        await workItems.markPendingStart(reviewer.binding.id, "sent");
        const queued = await workItems.commitRuleEvaluation({
          ...scope,
          workItemId: builder.item.id,
          ingress: { identity: "review-dispatch", triggerType: "fixture" },
          configVersion: "fixture",
          expectedRevision: reviewer.item.revision,
          actor: { type: "human", id: scope.userId },
          outcome: { status: "accepted" },
          decisions: [
            {
              type: "invokeSkill",
              role: "review",
              idempotencyKey: "reviewer-kickoff",
              prompt: "Review fixture",
              ...(schedule === "cancel in flight"
                ? { cancelInFlight: true }
                : {}),
            },
          ],
          causalChain: [],
          now: new Date(),
          consentedBy: scope.userId,
        });
        expect(queued.status).toBe("committed");
      }
      if (schedule === "pending terminal hook") {
        let held = false;
        session.onBeforeAgentEnd(async (event) => {
          if (event.reason !== "complete" || held) return;
          held = true;
          terminalEntered();
          await terminalGate;
        });
        finishBuilder();
        await terminalSeen;
        await expect
          .poll(() => controller.listActiveThreadRuns().length)
          .toBe(0);
        expect(session.run.isRunning()).toBe(true);
      }
      if (schedule === "foreign run owner") {
        await session.thread.setSetting({
          key: "factoryOpenRuns",
          value: [
            {
              kickoffId: "foreign-kickoff",
              bindingId: builder.binding.id,
              role: "work",
              startedBy: scope.userId,
              ...scope,
              workItemId: builder.item.id,
              ...sessionRef,
              ownerId: "another-dispatcher",
              heartbeatAt: Date.now(),
            },
          ],
        });
      }
      const aborts = vi.spyOn(session, "abort");
      const send = session.sendSignal.bind(session);
      vi.spyOn(session, "sendSignal").mockImplementation((...args) => {
        const result = send(...args);
        deliveryObserved();
        return result;
      });
      const list = controller.listActiveThreadRuns.bind(controller);
      vi.spyOn(controller, "listActiveThreadRuns").mockImplementation(() => {
        const result = list();
        deliveryObserved();
        return result;
      });
      inFlight = dispatcher.runOnce();
      await deliverySetup;
      if (schedule === "superseded reviewer") {
        await workItems.update({
          ...scope,
          id: builder.item.id,
          patch: { stages: ["execute"] },
        });
        await workItems.prepareRunStart({
          ...scope,
          workItem: { id: builder.item.id, input: { title: "Fixture" } },
          role: "work",
          session: sessionRef,
          resourceId: session.identity.getResourceId(),
          kickoffKey: "new-builder",
          kickoffMessage: null,
        });
      }
      if (schedule === "overdue builder") await inFlight;
      finishBuilder();
      returnTool();
      finishTerminal();
      await inFlight;
      await expect.poll(() => controller.listActiveThreadRuns().length).toBe(0);
      const reviewerCalls = requests.filter((call) => call.reviewer);
      if (schedule === "cancel in flight")
        expect(aborts).toHaveBeenCalledOnce();
      else expect(aborts).not.toHaveBeenCalled();
      for (const [, options] of vi.mocked(session.sendSignal).mock.calls) {
        expect(options?.ifActive).toEqual({ behavior: "discard" });
      }
      const item = await workItems.get({
        orgId: scope.orgId,
        id: builder.item.id,
      });
      if (
        schedule === "superseded reviewer" ||
        schedule === "overdue builder" ||
        schedule === "foreign run owner"
      ) {
        expect(reviewerCalls).toHaveLength(0);
        expect(item?.metadata?.selfReviewVerdict).toBeUndefined();
        const decisions = await workItems.listDeferredDecisions(
          scope.orgId,
          scope.factoryProjectId,
          { workItemId: builder.item.id },
        );
        expect(decisions).toHaveLength(1);
        if (schedule === "superseded reviewer")
          expect(decisions[0]?.status).toBe("superseded");
        else
          expect(decisions[0]?.failureCode).toBe(
            schedule === "overdue builder"
              ? "run_overdue"
              : "session_unavailable",
          );
        return;
      }
      expect(reviewerCalls.length).toBeGreaterThan(0);
      for (const call of reviewerCalls) {
        expect(call.reviewerPhase).toBe(true);
        if (schedule === "denied verdict")
          expect(call.tools).not.toContain("factory_record_review_verdict");
        else expect(call.tools).toContain("factory_record_review_verdict");
      }
      if (schedule === "denied verdict") {
        expect(item?.metadata?.selfReviewVerdict).toBeUndefined();
        return;
      }
      expect(item?.metadata).toMatchObject({
        selfReviewVerdict: "approve",
        selfReviewedHeadSha: "a".repeat(40),
      });
      expect(item?.stages).toEqual(["review"]);
    } finally {
      finishBuilder();
      returnTool();
      finishTerminal();
      await inFlight;
      await dispatcher.stop();
      releaseOwnership?.();
      await controller.destroy();
      await database.close();
      vi.restoreAllMocks();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
