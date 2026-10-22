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
  source = replaceOnce(
    source,
    'import { createOpenAICompatible } from "@ai-sdk/openai-compatible";',
    'import { createOpenAICompatible } from "@ai-sdk/openai-compatible";\nimport { createOpenAI } from "@ai-sdk/openai";',
  );
  source = replaceOnce(
    source,
    'const last = input[input.length - 1];\n\t\tif (last?.role && last.role !== "user") return true;',
    'const last = input[input.length - 1];\n\t\tif (last?.role && last.role !== "user" || last?.type === "function_call_output") return true;',
  );
  // shortcut: honor Responses-only catalog entries in the pinned SDK; remove when upstream routes them.
  source = replaceOnce(
    source,
    "\treturn wrapLanguageModel({\n\t\tmodel: copilot.chatModel(modelId),",
    `\tconst resolveResponsesModel = async (params) => {
		const catalog = await getCopilotModelCatalog({ authStorage: options?.authStorage });
		const entry = catalog.find((model) => model.id === modelId);
		if (!entry?.supportedEndpoints.includes("/responses") || entry.supportedEndpoints.includes("/chat/completions")) return;
		params.providerOptions = {
			...params.providerOptions,
			openai: { ...params.providerOptions?.openai, store: false }
		};
		return createOpenAI({
			baseURL: "https://api.githubcopilot.com",
			apiKey: "oauth-placeholder",
			headers,
			fetch: buildGitHubCopilotOAuthFetch({ authStorage: options?.authStorage })
		}).responses(modelId);
	};
	return wrapLanguageModel({
		model: copilot.chatModel(modelId),`,
  );
  source = replaceOnce(
    source,
    "middleware: [createCopilotMiddleware(modelId)]",
    `middleware: [createCopilotMiddleware(modelId), {
			specificationVersion: "v3",
			wrapGenerate: async ({ params, doGenerate }) => {
				const responses = await resolveResponsesModel(params);
				return responses ? responses.doGenerate(params) : doGenerate();
			},
			wrapStream: async ({ params, doStream }) => {
				const responses = await resolveResponsesModel(params);
				return responses ? responses.doStream(params) : doStream();
			}
		}]`,
  );
  writeFileSync(filename, source);
}

export function applyOpenAICopilotCompatibility(openaiDirectory: string): void {
  const { version } = JSON.parse(
    readFileSync(join(openaiDirectory, "package.json"), "utf8"),
  );
  if (version !== "3.0.131") {
    throw new Error(
      "Copilot reasoning patch requires @ai-sdk/openai@3.0.131; review it before upgrading.",
    );
  }
  // shortcut: Copilot renames completed reasoning items; remove when upstream correlates by output index.
  const files = ["index.mjs", "index.js"].map((name) => {
    const filename = join(openaiDirectory, "dist", name);
    let source = readFileSync(filename, "utf8");
    for (const [before, after] of [
      [
        "activeReasoning[value.item.id] = {",
        "activeReasoning[value.item.id] = {\n                  outputIndex: value.output_index,",
      ],
      [
        "const activeReasoningPart = activeReasoning[value.item.id];",
        `const reasoningId = Object.keys(activeReasoning).find((id) => activeReasoning[id].outputIndex === value.output_index);
                const activeReasoningPart = activeReasoning[reasoningId];
                if (!activeReasoningPart) throw new Error("Responses reasoning completion has no matching start");`,
      ],
      [
        "id: `${value.item.id}:${summaryIndex}`,",
        "id: `${reasoningId}:${summaryIndex}`,",
      ],
      [
        "delete activeReasoning[value.item.id];",
        "delete activeReasoning[reasoningId];",
      ],
    ] as const) {
      source = replaceOnce(source, before, after);
    }
    return { filename, source };
  });
  for (const { filename, source } of files) writeFileSync(filename, source);
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
