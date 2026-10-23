import { createBoardRegistry } from "@mastra/factory/boards";
import { FactoryTransitionService } from "@mastra/factory/rules/transition-service";
import { resolveGithubRules } from "@mastra/factory/integrations/github/default-rules";
import { createGithubIssueReconciler } from "@mastra/factory/integrations/github/issue-reconciler";
import type { WorkItemRow } from "@mastra/factory/storage/domains/work-items/base";
import { createHash } from "node:crypto";
import type { FactoryTransitionRequest } from "@mastra/factory/rules/transition-service";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasLabelAcceptance,
  isLabelApprovalRequest,
  reconcileApprovedTicket,
  type ApprovalIssue,
} from "../../src/mastra/github/approved-ticket";
import {
  approvalBody,
  approvalRepository,
  openApprovalDatabase,
  seedApprovalRepository,
} from "./fixtures/approval-database";

describe.each(["authored policy", "installed reconciliation"])(
  "%s",
  (boundary) => {
    let directory: string;
    let fixture: Awaited<ReturnType<typeof openApprovalDatabase>>;
    let projectId: string;
    let itemId: string;
    let state: ApprovalIssue | undefined;

    function options() {
      return {
        ...fixture,
        integrationStorage: fixture.integrations.forIntegration("github"),
        configVersion: "fixture",
        github: {
          rules: resolveGithubRules(),
          getRepositoryCollaboratorPermission: async () => "read" as const,
        },
      };
    }
    function sweep() {
      return boundary === "authored policy"
        ? reconcileApprovedTicket(
            options(),
            approvalRepository,
            12,
            itemId,
            "local",
            state,
          )
        : createGithubIssueReconciler(
            options(),
            async () => state,
          )([approvalRepository]);
    }
    function current() {
      return fixture.storage.get({ orgId: "local", id: itemId });
    }

    beforeEach(async () => {
      directory = mkdtempSync(join(tmpdir(), "factory-approval-reconcile-"));
      fixture = await openApprovalDatabase(directory);
      const { project } = await seedApprovalRepository(fixture);
      projectId = project.id;
      state = {
        title: "Approved fixture",
        url: `https://github.com/${approvalRepository.fullName}/issues/12`,
        body: approvalBody,
        state: "open",
        labels: ["ready-for-agent", "factory-approved"],
        author: "outsider",
      };
      const { item } = await fixture.storage.upsert({
        orgId: "local",
        userId: "local-admin",
        factoryProjectId: projectId,
        input: {
          title: state.title,
          board: "work",
          stages: ["intake"],
          externalSource: {
            integrationId: "github",
            type: "issue",
            externalId: "github:42:issue:12",
            url: state.url,
          },
          metadata: { labels: [], author: "outsider", authorTrusted: false },
        },
      });
      itemId = item.id;
    });
    afterEach(async () => {
      await fixture.database.close();
      rmSync(directory, { recursive: true, force: true });
    });

    it("accepts labeled publisher output regardless of author trust and keeps one Planning decision across concurrent polls/restart", async () => {
      await Promise.all([sweep(), sweep()]);
      expect(await current()).toMatchObject({
        stages: ["planning"],
        metadata: {
          authorTrusted: false,
          factoryApproval: { decision: "eligible", body: approvalBody },
        },
      });
      expect((await current())?.acceptedAt).toBeInstanceOf(Date);
      const accepted = await current();
      if (!accepted) throw new Error("Missing accepted fixture");
      expect(hasLabelAcceptance(accepted)).toBe(true);
      const request: FactoryTransitionRequest = {
        orgId: accepted.orgId,
        factoryProjectId: accepted.factoryProjectId,
        workItemId: accepted.id,
        board: "work",
        stage: "planning",
        expectedRevision: accepted.revision,
        actor: { type: "system", id: "factory-label-approval" },
        ingress: { type: "rule", identity: "fixture-predicate" },
        cause: "github.label_approval",
      };
      expect(
        isLabelApprovalRequest(request, {
          ...accepted,
          acceptedAt: null,
          stages: ["intake"],
        }),
      ).toBe(true);
      expect(isLabelApprovalRequest(request, accepted)).toBe(false);
      expect(hasLabelAcceptance({ ...accepted, metadata: null })).toBe(false);
      expect(hasLabelAcceptance({ ...accepted, acceptedAt: null })).toBe(false);
      expect(
        hasLabelAcceptance({ ...accepted, title: "Edited after acceptance" }),
      ).toBe(true);
      const intake = { ...accepted, acceptedAt: null, stages: ["intake"] };
      const source = accepted.externalSource!;
      for (const changes of [
        { actor: { type: "human", id: "local-admin" } },
        { actor: { type: "system", id: "some-other-policy" } },
        { ingress: { type: "human", identity: "wrong-ingress" } },
        { cause: "wrong-cause" },
        { board: "review" },
        { stage: "execute" },
      ] satisfies Partial<FactoryTransitionRequest>[]) {
        expect(isLabelApprovalRequest({ ...request, ...changes }, intake)).toBe(
          false,
        );
      }
      for (const changes of [
        { board: "review" },
        { stages: [] },
        { stages: ["triage"] },
        { externalSource: null },
        { externalSource: { ...source, integrationId: "gitlab" } },
        { externalSource: { ...source, type: "pull-request" } },
        {
          externalSource: {
            ...source,
            url: "https://github.com/elsewhere/repo/issues/12",
          },
        },
        { externalSource: { ...source, externalId: "wrong-source" } },
      ] satisfies Partial<WorkItemRow>[]) {
        expect(isLabelApprovalRequest(request, { ...intake, ...changes })).toBe(
          false,
        );
      }
      expect(
        isLabelApprovalRequest(request, {
          ...intake,
          externalSource: { ...source, externalId: "github-issue:12" },
        }),
      ).toBe(true);
      const original = accepted.metadata?.factoryApproval;
      if (!original || typeof original !== "object")
        throw new Error("Missing approval evidence");
      for (const changes of [
        { decision: "waiting" },
        { reason: "blocked" },
        { digest: "tampered" },
      ]) {
        expect(
          isLabelApprovalRequest(request, {
            ...intake,
            metadata: { factoryApproval: { ...original, ...changes } },
          }),
        ).toBe(false);
      }
      const withoutLabels = {
        policy: "github-labels-v1",
        repository: approvalRepository.fullName,
        issueNumber: 12,
        title: accepted.title,
        body: approvalBody,
        labels: [],
        decision: "eligible",
        reason: null,
      };
      expect(
        isLabelApprovalRequest(request, {
          ...intake,
          metadata: {
            factoryApproval: {
              ...withoutLabels,
              digest: createHash("sha256")
                .update(JSON.stringify(withoutLabels))
                .digest("hex"),
            },
          },
        }),
      ).toBe(false);
      await fixture.database.close();
      fixture = await openApprovalDatabase(directory);
      await sweep();
      const decisions = (
        await fixture.storage.listDeferredDecisions("local", projectId)
      ).filter((entry) => entry.decision.type === "invokeSkill");
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toMatchObject({
        status: "pending",
        decision: { type: "invokeSkill", role: "plan" },
      });
      expect(
        (await fixture.audit.list({ orgId: "local" })).events.filter(
          (event) => event.action === "factory.work_item.stage_moved",
        ),
      ).toHaveLength(1);
    });
    it.each([
      { labels: ["ready-for-agent"] },
      { labels: ["factory-approved"] },
      { labels: ["ready-for-agent", "factory-approved", "needs-triage"] },
      { body: "incomplete" },
      { url: "https://github.com/elsewhere/repo/issues/12" },
    ])(
      "keeps invalid publisher output in Intake with a visible reason: %j",
      async (changes) => {
        state = { ...state!, ...changes };
        await sweep();
        expect(await current()).toMatchObject({
          stages: ["intake"],
          acceptedAt: null,
          metadata: {
            factoryApproval: {
              decision: "waiting",
              reason: expect.any(String),
            },
          },
        });
        expect(
          (
            await fixture.storage.listDeferredDecisions("local", projectId)
          ).filter((entry) => entry.decision.type === "invokeSkill"),
        ).toEqual([]);
      },
    );
    it("records unavailable current GitHub data rather than accepting cached labels", async () => {
      state = { ...state!, body: "incomplete" };
      await sweep();
      state = undefined;
      await sweep();
      expect(await current()).toMatchObject({
        stages: ["intake"],
        metadata: {
          factoryApproval: {
            reason: "Current GitHub issue data is unavailable.",
          },
        },
      });
    });
    it("leaves ordinary tickets untouched by automatic acceptance", async () => {
      state = { ...state!, labels: [] };
      await sweep();
      expect(await current()).toMatchObject({
        stages: ["intake"],
        acceptedAt: null,
      });
      expect((await current())?.metadata?.factoryApproval).toBeUndefined();
    });
    it("reevaluates after incomplete content is corrected without requiring a label change", async () => {
      state = { ...state!, body: "incomplete" };
      await sweep();
      state = { ...state!, body: approvalBody };
      await sweep();
      expect((await current())?.stages).toEqual(["planning"]);
    });
    it("does not automatically reaccept a previously accepted ticket parked in Intake", async () => {
      await sweep();
      await fixture.storage.update({
        orgId: "local",
        id: itemId,
        userId: "local-admin",
        patch: { stages: ["intake"], metadata: { selfReviewNeedsHuman: true } },
      });
      state = { ...state!, title: "Updated parked ticket" };
      await sweep();
      expect((await current())?.stages).toEqual(["intake"]);
      expect(
        (
          await fixture.storage.listDeferredDecisions("local", projectId)
        ).filter((entry) => entry.decision.type === "invokeSkill"),
      ).toHaveLength(1);
    });
    it("preserves the ordinary non-bug manual acceptance gate and rejects a forged system cause", async () => {
      const item = await current();
      if (!item) throw new Error("Missing fixture ticket");
      const request: FactoryTransitionRequest = {
        orgId: "local",
        factoryProjectId: projectId,
        workItemId: itemId,
        board: "work",
        stage: "intake",
        expectedRevision: item.revision,
        actor: { type: "agent", bindingId: "fixture-triage", role: "triage" },
        ingress: { type: "toolResult", identity: "classify" },
        cause: "fixture",
        triageType: "maintenance",
      };
      expect((await fixture.transitionService.transition(request)).status).toBe(
        "accepted",
      );
      const classified = await current();
      const denied = await fixture.transitionService.transition({
        ...request,
        triageType: undefined,
        stage: "planning",
        expectedRevision: classified!.revision,
        actor: { type: "system", id: "factory-label-approval" },
        ingress: { type: "rule", identity: "forged" },
        cause: "ordinary_rule",
      });
      expect(denied).toMatchObject({
        status: "rejected",
        code: "approval_required",
      });
      const accepted = await fixture.transitionService.transition({
        ...request,
        triageType: undefined,
        stage: "planning",
        expectedRevision: classified!.revision,
        actor: { type: "human", id: "local-admin" },
        ingress: { type: "human", identity: "manual" },
      });
      expect(accepted.status).toBe("accepted");
    });
    it("rejects a reserved label-approval transition without evidence even before classification", async () => {
      const item = await current();
      if (!item) throw new Error("Missing fixture");
      const result = await fixture.transitionService.transition({
        orgId: "local",
        factoryProjectId: projectId,
        workItemId: itemId,
        board: "work",
        stage: "planning",
        expectedRevision: item.revision,
        actor: { type: "system", id: "factory-label-approval" },
        ingress: { type: "rule", identity: "unproven-label-approval" },
        cause: "github.label_approval",
      });
      expect(result).toMatchObject({ status: "rejected", code: "forbidden" });
      expect((await current())?.stages).toEqual(["intake"]);
    });
    it("fails visibly when the shared transition service is missing", async () => {
      await expect(
        reconcileApprovedTicket(
          { storage: fixture.storage },
          approvalRepository,
          12,
          itemId,
          "local",
          state,
        ),
      ).rejects.toThrow("shared Factory transition service");
      expect((await current())?.stages).toEqual(["intake"]);
    });
    it("records a rejected transition without repeatedly queuing work", async () => {
      fixture.transitionService = new FactoryTransitionService({
        storage: fixture.storage,
        audit: fixture.audit,
        configVersion: "fixture",
        boards: createBoardRegistry({ includeDefaultBoards: false }),
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          reconcileApprovedTicket(
            options(),
            approvalRepository,
            12,
            itemId,
            "local",
            state,
          ),
        ).rejects.toThrow("Label approval failed");
      }
      expect((await current())?.acceptedAt).toBeNull();
      expect(
        await fixture.storage.listDeferredDecisions("local", projectId),
      ).toEqual([]);
      expect(
        (await fixture.audit.list({ orgId: "local" })).events,
      ).toHaveLength(1);
    });
    it("recovers a real revision race between evidence and transition on the next sweep", async () => {
      const transition = fixture.transitionService.transition.bind(
        fixture.transitionService,
      );
      vi.spyOn(fixture.transitionService, "transition").mockImplementationOnce(
        async (request) => {
          await fixture.storage.update({
            orgId: "local",
            id: itemId,
            userId: "local-admin",
            patch: { metadata: { concurrentChange: true } },
          });
          return transition(request);
        },
      );
      await reconcileApprovedTicket(
        options(),
        approvalRepository,
        12,
        itemId,
        "local",
        state,
      );
      expect((await current())?.acceptedAt).toBeNull();
      await reconcileApprovedTicket(
        options(),
        approvalRepository,
        12,
        itemId,
        "local",
        state,
      );
      expect((await current())?.acceptedAt).toBeInstanceOf(Date);
    });
    it("handles a real deletion racing evidence persistence without accepting a missing card", async () => {
      const update = fixture.storage.update.bind(fixture.storage);
      vi.spyOn(fixture.storage, "update").mockImplementationOnce(
        async (request) => {
          await fixture.storage.delete({ orgId: "local", id: itemId });
          return update(request);
        },
      );
      await reconcileApprovedTicket(
        options(),
        approvalRepository,
        12,
        itemId,
        "local",
        state,
      );
      expect(await current()).toBeNull();
    });
    it("propagates real storage failures without acceptance", async () => {
      const update = fixture.storage.update.bind(fixture.storage);
      vi.spyOn(fixture.storage, "update").mockImplementationOnce(
        async (request) => {
          await fixture.database.close();
          return update(request);
        },
      );
      await expect(
        reconcileApprovedTicket(
          options(),
          approvalRepository,
          12,
          itemId,
          "local",
          state,
        ),
      ).rejects.toThrow();
    });
    it("ignores a card with a foreign source even when its labels are approved", async () => {
      const foreign = await fixture.storage.upsert({
        orgId: "local",
        userId: "local-admin",
        factoryProjectId: projectId,
        input: {
          title: "Foreign",
          board: "work",
          stages: ["intake"],
          externalSource: {
            integrationId: "github",
            type: "issue",
            externalId: "github:43:issue:12",
            url: "https://github.com/elsewhere/repo/issues/12",
          },
        },
      });
      await reconcileApprovedTicket(
        options(),
        approvalRepository,
        12,
        foreign.item.id,
        "local",
        state,
      );
      expect(
        (await fixture.storage.get({ orgId: "local", id: foreign.item.id }))
          ?.acceptedAt,
      ).toBeNull();
    });
    it("does not touch other repositories or missing cards", async () => {
      await reconcileApprovedTicket(
        options(),
        { ...approvalRepository, fullName: "elsewhere/repo" },
        12,
        itemId,
        "local",
        state,
      );
      await reconcileApprovedTicket(
        options(),
        approvalRepository,
        12,
        "missing",
        "local",
        state,
      );
      expect((await current())?.metadata?.factoryApproval).toBeUndefined();
    });
  },
);
