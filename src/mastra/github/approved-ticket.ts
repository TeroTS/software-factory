import type { FactoryTransitionRequest } from "@mastra/factory/rules/transition-service";
import type { FactoryTransitionService } from "@mastra/factory/rules/transition-service";
import type {
  ReconcileIssueState,
  ReconcileRepository,
} from "@mastra/factory/integrations/github/rules";
import type {
  WorkItemRow,
  WorkItemsStorage,
} from "@mastra/factory/storage/domains/work-items/base";
import { WorkItemUpdateConflictError } from "@mastra/factory/storage/domains/work-items/base";
import { createHash } from "node:crypto";
import { z } from "zod";

export const APPROVAL_REPOSITORY = "TeroTS/factory-smoke-test";
const POLICY = "github-labels-v1";
const ACTOR = "factory-label-approval";

export interface ApprovalIssue extends ReconcileIssueState {
  body?: string | null;
}

const evidenceSchema = z.object({
  policy: z.literal(POLICY),
  repository: z.literal(APPROVAL_REPOSITORY),
  issueNumber: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  labels: z.array(z.string()),
  decision: z.enum(["eligible", "waiting"]),
  reason: z.string().nullable(),
  digest: z.string(),
});

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hasSection(body: string, name: string): boolean {
  const prose = body.replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|$(?![\s\S]))/gm,
    "",
  );
  const sections = [
    ...prose.matchAll(
      /^#{1,6}\s+(.+?)\s*#*\s*\r?\n([\s\S]*?)(?=^#{1,6}\s|$(?![\s\S]))/gm,
    ),
  ];
  return sections.some(
    (section) =>
      section[1]?.trim().toLowerCase() === name &&
      Boolean(
        section[2]
          ?.replace(/<!--[\s\S]*?-->/g, "")
          .replace(/^\s*[-*]\s*(?:\[[ xX]\])?\s*/gm, "")
          .trim(),
      ),
  );
}

export function approvalReason(
  repository: string,
  state: ApprovalIssue | undefined,
): string | null {
  if (repository !== APPROVAL_REPOSITORY)
    return "Repository is not allowed for automatic approval.";
  if (!state) return "Current GitHub issue data is unavailable.";
  if (state.state !== "open") return "GitHub issue is not open.";
  if (
    !state.labels?.includes("ready-for-agent") ||
    !state.labels.includes("factory-approved")
  )
    return "Both ready-for-agent and factory-approved labels are required.";
  if (state.labels.includes("needs-triage"))
    return "Remove the conflicting needs-triage or factory-approved label.";
  const body = state.body ?? "";
  if (
    !hasSection(body, "what to build") ||
    !hasSection(body, "acceptance criteria")
  )
    return "Nonempty What to build and Acceptance criteria sections are required.";
  return null;
}

function eligibleEvidence(
  item: Pick<WorkItemRow, "externalSource" | "metadata">,
): boolean {
  const parsed = evidenceSchema.safeParse(item.metadata?.factoryApproval);
  if (!parsed.success) return false;
  const { digest: expected, ...evidence } = parsed.data;
  const source = item.externalSource;
  return (
    evidence.decision === "eligible" &&
    evidence.reason === null &&
    digest(evidence) === expected &&
    source?.integrationId === "github" &&
    source.type === "issue" &&
    source.url ===
      `https://github.com/${APPROVAL_REPOSITORY}/issues/${evidence.issueNumber}` &&
    (source.externalId === `github-issue:${evidence.issueNumber}` ||
      new RegExp(`^github:\\d+:issue:${evidence.issueNumber}$`).test(
        source.externalId,
      )) &&
    approvalReason(evidence.repository, {
      ...evidence,
      state: "open",
      url: source.url,
    }) === null
  );
}

export function isLabelApprovalRequest(
  request: FactoryTransitionRequest,
  item: WorkItemRow,
): boolean {
  return (
    request.actor.type === "system" &&
    request.actor.id === ACTOR &&
    request.ingress.type === "rule" &&
    request.cause === "github.label_approval" &&
    request.board === "work" &&
    request.stage === "planning" &&
    item.board === "work" &&
    item.acceptedAt === null &&
    item.stages.length === 1 &&
    item.stages[0] === "intake" &&
    eligibleEvidence(item)
  );
}

export function hasLabelAcceptance(item: WorkItemRow): boolean {
  return item.acceptedAt !== null && eligibleEvidence(item);
}

export async function reconcileApprovedTicket(
  options: {
    storage: WorkItemsStorage;
    transitionService?: FactoryTransitionService;
  },
  repository: ReconcileRepository,
  issueNumber: number,
  itemId: string,
  orgId: string,
  state: ApprovalIssue | undefined,
): Promise<void> {
  if (repository.fullName !== APPROVAL_REPOSITORY) return;
  let item = await options.storage.get({ orgId, id: itemId });
  if (
    !item ||
    item.acceptedAt !== null ||
    item.board !== "work" ||
    item.stages.length !== 1 ||
    item.stages[0] !== "intake"
  )
    return;
  const source = item.externalSource;
  if (
    source?.integrationId !== "github" ||
    source.type !== "issue" ||
    source.url !==
      `https://github.com/${APPROVAL_REPOSITORY}/issues/${issueNumber}`
  )
    return;
  const labels = state?.labels ?? item.metadata?.labels;
  if (
    !item.metadata?.factoryApproval &&
    (!Array.isArray(labels) ||
      !labels.some(
        (label) => label === "ready-for-agent" || label === "factory-approved",
      ))
  )
    return;
  let reason = approvalReason(repository.fullName, state);
  if (state && state.url !== source.url)
    reason = "GitHub issue identity does not match the imported ticket.";
  const evidence = {
    policy: POLICY,
    repository: repository.fullName,
    issueNumber,
    title: state?.title ?? item.title,
    body: state?.body ?? "",
    labels: [...(state?.labels ?? [])].sort(),
    decision: reason ? "waiting" : "eligible",
    reason,
  };
  const fingerprint = digest(evidence);
  const previous = evidenceSchema.safeParse(item.metadata?.factoryApproval);
  if (!previous.success || previous.data.digest !== fingerprint) {
    try {
      const updated = await options.storage.update({
        orgId,
        id: item.id,
        userId: ACTOR,
        expectedRevision: item.revision,
        patch: {
          title: evidence.title,
          metadata: { factoryApproval: { ...evidence, digest: fingerprint } },
        },
      });
      if (!updated) return;
      item = updated.item;
    } catch (error) {
      if (error instanceof WorkItemUpdateConflictError) return;
      throw error;
    }
  }
  if (reason) return;
  if (!options.transitionService)
    throw new Error(
      "Label approval requires the shared Factory transition service.",
    );
  const result = await options.transitionService.transition({
    orgId,
    factoryProjectId: item.factoryProjectId,
    workItemId: item.id,
    board: "work",
    stage: "planning",
    expectedRevision: item.revision,
    actor: { type: "system", id: ACTOR },
    ingress: {
      type: "rule",
      identity: `label-approval:${item.id}:${fingerprint}`,
    },
    cause: "github.label_approval",
  });
  if (result.status === "rejected" && result.code !== "stale")
    throw new Error(`Label approval failed: ${result.reason}`);
}
