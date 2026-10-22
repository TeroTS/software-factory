import { getCopilotModelCatalog } from "@mastra/code-sdk/providers/github-copilot";
import type { ModelCatalog } from "@mastra/factory/routes/config";
import { TenantCredentialStore } from "@mastra/factory/routes/tenant-credentials";
import type {
  CredentialRecord,
  ModelCredentialsStorage,
} from "@mastra/factory/storage/domains/credentials/base";

export interface CopilotCatalogContext {
  orgId: string;
  userId: string;
  credentials: ModelCredentialsStorage;
}

type Models = Awaited<ReturnType<ModelCatalog["listAvailableModels"]>>;

export async function withTenantCopilotModels(
  models: Models,
  records: CredentialRecord[] | undefined,
  context: CopilotCatalogContext | undefined,
): Promise<Models> {
  const credential =
    records?.find(
      (record) =>
        record.provider === "github-copilot" && record.scope === "user",
    ) ??
    records?.find(
      (record) =>
        record.provider === "github-copilot" && record.scope === "org",
    );
  if (!context || credential?.credential.type !== "oauth") return models;
  const store = new TenantCredentialStore(
    context.orgId,
    context.userId,
    context.credentials,
    credential.scope === "org" ? "factory" : "user",
  );
  const copilot = await getCopilotModelCatalog({ authStorage: store });
  return [
    ...models.filter((model) => model.provider !== "github-copilot"),
    ...copilot.map((model) => ({
      id: `github-copilot/${model.id}`,
      provider: "github-copilot",
      modelName: model.name,
      hasApiKey: true,
    })),
  ];
}
