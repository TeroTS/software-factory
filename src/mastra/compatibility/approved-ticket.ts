import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function applyApprovedTicketCompatibility(
  factoryDirectory: string,
  policyModule: string,
): void {
  const { version } = JSON.parse(
    readFileSync(join(factoryDirectory, "package.json"), "utf8"),
  );
  if (version !== "0.24.0")
    throw new Error(
      "Label approval patch requires @mastra/factory@0.24.0; review it before upgrading.",
    );
  const patches: [string, string, string][] = [
    [
      "dist/rules/transition-service.js",
      "import { assertFactoryDecisionTarget",
      'import { hasLabelAcceptance, isLabelApprovalRequest } from "../integrations/github/approved-ticket.js";\nimport { assertFactoryDecisionTarget',
    ],
    [
      "dist/rules/transition-service.js",
      "const policy = boardTransitionPolicyResultSchema.parse(",
      'const labelApproval = isLabelApprovalRequest(request, item);\n\t\t\t\tconst policy = labelApproval ? { type: "allow", accept: true } : boardTransitionPolicyResultSchema.parse(',
    ],
    [
      "dist/rules/transition-service.js",
      'if (policy?.type === "reject") return {',
      'if (request.cause === "github.label_approval" && !labelApproval) return { outcome: "rejected", code: "forbidden", reason: "Label approval requires an eligible Intake issue and matching system evidence." };\n\t\t\t\tif (policy?.type === "reject") return {',
    ],
    [
      "dist/rules/transition-service.js",
      "policy?.accept && !isHumanTransition(request)",
      "policy?.accept && !isHumanTransition(request) && !labelApproval",
    ],
    [
      "dist/rules/transition-service.js",
      "entersWorking && externallyAuthoredWorkItem(item)",
      "entersWorking && externallyAuthoredWorkItem(item) && !hasLabelAcceptance(item)",
    ],
    [
      "dist/rules/transition-service.js",
      "cause: request.cause,\n\t\t\t\tconfigVersion:",
      "cause: request.cause,\n\t\t\t\t...item && isLabelApprovalRequest(request, item) ? { approvalDigest: item.metadata.factoryApproval.digest } : {},\n\t\t\t\tconfigVersion:",
    ],
    [
      "dist/rules/dispatcher.js",
      "import { FACTORY_RULE_STAGES",
      'import { hasLabelAcceptance } from "../integrations/github/approved-ticket.js";\nimport { FACTORY_RULE_STAGES',
    ],
    [
      "dist/rules/dispatcher.js",
      "if (item && externallyAuthoredWorkItem(item)) return true;",
      "if (item && externallyAuthoredWorkItem(item) && !hasLabelAcceptance(item)) return true;",
    ],
    [
      "dist/routes/surface.js",
      "configVersion: deps.configVersion,\n\t\t\tworkItems:",
      "configVersion: deps.configVersion,\n\t\t\ttransitionService: deps.factoryTransitionService,\n\t\t\tworkItems:",
    ],
    [
      "dist/factory.js",
      "integration.workers(buildIntegrationContext({\n\t\t\tcontroller:",
      "integration.workers(buildIntegrationContext({\n\t\t\tfactoryTransitionService: transitionService,\n\t\t\tcontroller:",
    ],
    [
      "dist/integrations/github/rules.js",
      "configVersion: context.runtime.configVersion,\n\t\tboards:",
      "configVersion: context.runtime.configVersion,\n\t\ttransitionService: context.runtime.transitionService,\n\t\tboards:",
    ],
    [
      "dist/integrations/github/integration.js",
      "if (issue.pull_request) return void 0;\n\t\t\treturn {\n\t\t\t\ttitle: issue.title,",
      "if (issue.pull_request) return void 0;\n\t\t\treturn {\n\t\t\t\tbody: issue.body,\n\t\t\t\ttitle: issue.title,",
    ],
    [
      "dist/integrations/github/issue-reconciler.js",
      "import { workItemPhaseSemantics",
      'import { reconcileApprovedTicket } from "./approved-ticket.js";\nimport { workItemPhaseSemantics',
    ],
    [
      "dist/integrations/github/issue-reconciler.js",
      "if (!state) continue;",
      "if (!state) {\n\t\t\t\t\t\tfor (const item of items) await reconcileApprovedTicket(options, repository, issueNumber, item.id, item.orgId, void 0);\n\t\t\t\t\t\tcontinue;\n\t\t\t\t\t}",
    ],
    [
      "dist/integrations/github/issue-reconciler.js",
      "summary.updated += 1;\n\t\t\t\t\t}\n\t\t\t\t} catch (error)",
      "summary.updated += 1;\n\t\t\t\t\t}\n\t\t\t\t\tfor (const item of items) await reconcileApprovedTicket(options, repository, issueNumber, item.id, item.orgId, state);\n\t\t\t\t} catch (error)",
    ],
  ];
  const sources = new Map<string, string>();
  for (const [relative, before, after] of patches) {
    const filename = join(factoryDirectory, relative);
    const source = (
      sources.get(filename) ?? readFileSync(filename, "utf8")
    ).replaceAll(after, before);
    if (source.split(before).length !== 2)
      throw new Error(
        `Unexpected label approval source in ${relative}; patch was not applied.`,
      );
    sources.set(filename, source.replace(before, after));
  }
  // Validate every source before writing, so dependency drift cannot leave a partial patch.
  for (const [filename, source] of sources) writeFileSync(filename, source);
  writeFileSync(
    join(factoryDirectory, "dist/integrations/github/approved-ticket.js"),
    policyModule,
  );
}
