import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function applyCopilotCompatibility(sdkDirectory: string): void {
  const { version } = JSON.parse(
    readFileSync(join(sdkDirectory, "package.json"), "utf8"),
  );
  if (version !== "1.15.0") {
    throw new Error(
      "Copilot compatibility patch requires @mastra/code-sdk@1.15.0; review it before upgrading.",
    );
  }
  const filename = join(sdkDirectory, "dist/providers/github-copilot.js");
  let source = readFileSync(filename, "utf8");
  // shortcut: seed the pinned SDK's discovery catalog; remove when upstream supports sign-in without models.
  for (const condition of [
    '!credential || credential.type !== "oauth"',
    "!accessToken",
  ]) {
    const before = `if (${condition}) return [];`;
    const after = `if (${condition}) return COPILOT_FALLBACK_MODELS;`;
    source = replaceOnce(source, before, after);
  }
  writeFileSync(filename, source);
}

export function applyFactoryCopilotCompatibility(
  factoryDirectory: string,
  catalogJavaScript: string,
): void {
  const { version } = JSON.parse(
    readFileSync(join(factoryDirectory, "package.json"), "utf8"),
  );
  if (version !== "0.24.0") {
    throw new Error(
      "Copilot catalog patch requires @mastra/factory@0.24.0; review it before upgrading.",
    );
  }
  const configFile = join(factoryDirectory, "dist/routes/config.js");
  const toolsFile = join(factoryDirectory, "dist/tools/session-tools.js");
  let config = readFileSync(configFile, "utf8");
  for (const [before, after] of [
    [
      "//#region src/routes/config.ts",
      'import { withTenantCopilotModels } from "./local-copilot-catalog.js";\n//#region src/routes/config.ts',
    ],
    [
      "async function buildModelCatalog({ controller, authStorage, tenantCredentials, deploymentProviders, listCustomProviders })",
      "async function buildModelCatalog({ controller, authStorage, tenantCredentials, deploymentProviders, listCustomProviders, copilotContext })",
    ],
    [
      "const catalog = models.flatMap",
      "const scopedModels = await withTenantCopilotModels(models, tenantCredentials, copilotContext);\n\tconst catalog = scopedModels.flatMap",
    ],
    [
      "const tenant = auth.tenant(c);\n\t\t\t\t\t\tlet tenantCredentials = allTenantCredentials;",
      "const tenant = auth.tenant(c);\n\t\t\t\t\t\tlet catalogTenant = tenant;\n\t\t\t\t\t\tlet tenantCredentials = allTenantCredentials;",
    ],
    [
      "const orgId = policy.tenant.orgId ?? tenantOrgId(tenant);",
      "const orgId = policy.tenant.orgId ?? tenantOrgId(tenant);\n\t\t\t\t\t\t\t\tcatalogTenant = { orgId, userId: policy.tenant.userId };",
    ],
    [
      "const models = await buildModelCatalog({\n\t\t\t\t\t\t\tcontroller,",
      "const models = await buildModelCatalog({\n\t\t\t\t\t\t\tcontroller,\n\t\t\t\t\t\t\tcopilotContext: catalogTenant && options.modelCredentials ? { orgId: tenantOrgId(catalogTenant), userId: catalogTenant.userId, credentials: options.modelCredentials } : void 0,",
    ],
  ] as const) {
    config = replaceOnce(config, before, after);
  }
  const tools = replaceOnce(
    readFileSync(toolsFile, "utf8"),
    "controller,\n\t\t\ttenantCredentials: await listSessionScopedCredentials({",
    "controller,\n\t\t\tcopilotContext: { orgId, userId: policy.tenant.userId, credentials: tenantCatalog.credentials },\n\t\t\ttenantCredentials: await listSessionScopedCredentials({",
  );
  // Validate every anchor before changing any installed artifact.
  writeFileSync(configFile, config);
  writeFileSync(toolsFile, tools);
  writeFileSync(
    join(factoryDirectory, "dist/routes/local-copilot-catalog.js"),
    catalogJavaScript,
  );
}

function replaceOnce(source: string, before: string, after: string): string {
  const normalized = source.replace(after, before);
  if (normalized.split(before).length !== 2) {
    throw new Error(
      "Unexpected Copilot compatibility source; patch was not applied.",
    );
  }
  return normalized.replace(before, after);
}
