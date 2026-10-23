import { createBoardRegistry } from "@mastra/factory/boards";
import { FactoryTransitionService } from "@mastra/factory/rules/transition-service";
import { AuditStorage } from "@mastra/factory/storage/domains/audit/base";
import { IntegrationStorage } from "@mastra/factory/storage/domains/integrations/base";
import { FactoryProjectsStorage } from "@mastra/factory/storage/domains/projects/base";
import { SourceControlStorage } from "@mastra/factory/storage/domains/source-control/base";
import { WorkItemsStorage } from "@mastra/factory/storage/domains/work-items/base";
import { createFactoryStorage } from "../../../src/mastra/storage";

export const approvalBody =
  "## What to build\nAdd a fixture marker.\n\n## Acceptance criteria\n- [ ] Marker exists.\n";
export const approvalRepository = {
  id: 42,
  fullName: "TeroTS/factory-smoke-test",
  installationId: 7,
};

export async function openApprovalDatabase(directory: string) {
  const database = createFactoryStorage({}, directory);
  const storage = database.registerDomain(new WorkItemsStorage());
  const projects = database.registerDomain(new FactoryProjectsStorage());
  const audit = database.registerDomain(new AuditStorage());
  const integrations = database.registerDomain(new IntegrationStorage());
  const sourceControls = database.registerDomain(new SourceControlStorage());
  await database.init();
  for (const domain of [storage, projects, audit, integrations, sourceControls])
    await domain.ensureReady();
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({
    storage,
    audit,
    boards,
    configVersion: "fixture",
  });
  return {
    database,
    storage,
    projects,
    audit,
    integrations,
    sourceControl: sourceControls.forIntegration("github"),
    boards,
    transitionService,
  };
}

export async function seedApprovalRepository(
  fixture: Awaited<ReturnType<typeof openApprovalDatabase>>,
) {
  const { sourceControl, projects } = fixture;
  const project = await projects.create({
    orgId: "local",
    userId: "local-admin",
    input: { name: "Approval fixture" },
  });
  const installation = await sourceControl.installations.upsert({
    orgId: "local",
    connectedByUserId: "local-admin",
    externalId: "7",
    accountName: "TeroTS",
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: "local",
    input: {
      installationId: installation.id,
      externalId: "42",
      slug: approvalRepository.fullName,
      defaultBranch: "main",
    },
  });
  const connection = await sourceControl.connections.create({
    orgId: "local",
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: "local-admin",
  });
  const link = await sourceControl.projectRepositories.link({
    orgId: "local",
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: "local-admin",
    sandboxProvider: "custom",
    sandboxWorkdir: "repo",
  });
  return { project, link };
}
