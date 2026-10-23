import { createBoardRegistry } from "@mastra/factory/boards";
import { FactoryTransitionService } from "@mastra/factory/rules/transition-service";
import { AuditStorage } from "@mastra/factory/storage/domains/audit/base";
import { WorkItemsStorage } from "@mastra/factory/storage/domains/work-items/base";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createFactoryStorage } from "../../src/mastra/storage";

const body =
  "## What to build\nAdd a fixture marker.\n\n## Acceptance criteria\n- [ ] Marker exists.\n";

it("commits label-based system acceptance and one durable Planning decision without arming autonomy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "factory-approved-ticket-"));
  const database = createFactoryStorage({}, directory);
  const storage = database.registerDomain(new WorkItemsStorage());
  const audit = database.registerDomain(new AuditStorage());
  try {
    await database.init();
    await storage.ensureReady();
    await audit.ensureReady();
    const evidence = {
      policy: "github-labels-v1",
      repository: "TeroTS/factory-smoke-test",
      issueNumber: 12,
      title: "Fixture ticket",
      body,
      labels: ["factory-approved", "ready-for-agent"],
      decision: "eligible",
      reason: null,
    };
    const digest = createHash("sha256")
      .update(JSON.stringify(evidence))
      .digest("hex");
    const { item } = await storage.upsert({
      orgId: "fixture-org",
      factoryProjectId: "fixture-project",
      userId: "fixture-owner",
      input: {
        title: evidence.title,
        board: "work",
        stages: ["intake"],
        externalSource: {
          integrationId: "github",
          type: "issue",
          externalId: "github:42:issue:12",
          url: "https://github.com/TeroTS/factory-smoke-test/issues/12",
        },
        metadata: {
          authorTrusted: false,
          factoryApproval: { ...evidence, digest },
        },
      },
    });
    const service = new FactoryTransitionService({
      storage,
      audit,
      boards: createBoardRegistry(),
      configVersion: "fixture",
    });
    const request = {
      orgId: item.orgId,
      factoryProjectId: item.factoryProjectId,
      workItemId: item.id,
      board: "work",
      stage: "planning",
      expectedRevision: item.revision,
      actor: { type: "system" as const, id: "factory-label-approval" },
      ingress: {
        type: "rule" as const,
        identity: `label-approval:${item.id}:${digest}`,
      },
      cause: "github.label_approval",
    };
    const first = await service.transition(request);
    expect(first.status).toBe("accepted");
    expect(await service.transition(request)).toEqual(first);
    const current = await storage.get({ orgId: item.orgId, id: item.id });
    expect(current?.stages).toEqual(["planning"]);
    expect(current?.acceptedAt).toBeInstanceOf(Date);
    expect(current?.autonomyArmedAt).toBeNull();
    const decisions = await storage.listDeferredDecisions(
      item.orgId,
      item.factoryProjectId,
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({
      type: "invokeSkill",
      role: "plan",
      skillName: "factory-plan",
    });
    expect(decisions[0]?.approvedAt).toBeNull();
    const events = await audit.list({ orgId: item.orgId });
    expect(events.events).toHaveLength(1);
    expect(events.events[0]).toMatchObject({
      actorType: "system",
      actorId: "factory-label-approval",
      action: "factory.work_item.stage_moved",
      metadata: { approvalDigest: digest },
    });
  } finally {
    await database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
