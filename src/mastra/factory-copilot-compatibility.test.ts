import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { applyFactoryCopilotCompatibility } from "./copilot-compatibility";

let directory: string;
let configFile: string;
let toolsFile: string;
let generatedFile: string;
const config = [
  "//#region src/routes/config.ts",
  "async function buildModelCatalog({ controller, authStorage, tenantCredentials, deploymentProviders, listCustomProviders })",
  "const catalog = models.flatMap",
  "const tenant = auth.tenant(c);\n\t\t\t\t\t\tlet tenantCredentials = allTenantCredentials;",
  "const orgId = policy.tenant.orgId ?? tenantOrgId(tenant);",
  "const models = await buildModelCatalog({\n\t\t\t\t\t\t\tcontroller,",
].join("\n");
const tools =
  "controller,\n\t\t\ttenantCredentials: await listSessionScopedCredentials({";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-catalog-patch-"));
  mkdirSync(join(directory, "dist/routes"), { recursive: true });
  mkdirSync(join(directory, "dist/tools"), { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "0.24.0" }),
  );
  configFile = join(directory, "dist/routes/config.js");
  toolsFile = join(directory, "dist/tools/session-tools.js");
  generatedFile = join(directory, "dist/routes/local-copilot-catalog.js");
  writeFileSync(configFile, config);
  writeFileSync(toolsFile, tools);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("wires scoped catalogs into the picker and session tool, preserving the session owner, idempotently", () => {
  applyFactoryCopilotCompatibility(
    directory,
    "export const generated = true;\n",
  );
  const patched = readFileSync(configFile, "utf8");
  const patchedTools = readFileSync(toolsFile, "utf8");
  expect(patched).toContain(
    'import { withTenantCopilotModels } from "./local-copilot-catalog.js";',
  );
  expect(patched).toContain(
    "withTenantCopilotModels(models, tenantCredentials, copilotContext)",
  );
  expect(patched).toContain(
    "catalogTenant = { orgId, userId: policy.tenant.userId }",
  );
  expect(patched).toContain("credentials: options.modelCredentials");
  expect(patchedTools).toContain(
    "userId: policy.tenant.userId, credentials: tenantCatalog.credentials",
  );
  expect(readFileSync(generatedFile, "utf8")).toBe(
    "export const generated = true;\n",
  );
  applyFactoryCopilotCompatibility(
    directory,
    "export const generated = true;\n",
  );
  expect(readFileSync(configFile, "utf8")).toBe(patched);
  expect(readFileSync(toolsFile, "utf8")).toBe(patchedTools);
});

it("rejects an unexpected Factory version without changing any artifacts", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "0.25.0" }),
  );
  expect(() =>
    applyFactoryCopilotCompatibility(directory, "generated"),
  ).toThrow("requires @mastra/factory@0.24.0");
  expect(readFileSync(configFile, "utf8")).toBe(config);
  expect(readFileSync(toolsFile, "utf8")).toBe(tools);
  expect(existsSync(generatedFile)).toBe(false);
});

it.each(["config", "tools"])(
  "rejects %s source drift before writing any artifacts",
  (file) => {
    const target = file === "config" ? configFile : toolsFile;
    writeFileSync(target, "upstream changed");
    const configBefore = readFileSync(configFile, "utf8");
    const toolsBefore = readFileSync(toolsFile, "utf8");
    expect(() =>
      applyFactoryCopilotCompatibility(directory, "generated"),
    ).toThrow("Unexpected Copilot compatibility source");
    expect(readFileSync(configFile, "utf8")).toBe(configBefore);
    expect(readFileSync(toolsFile, "utf8")).toBe(toolsBefore);
    expect(existsSync(generatedFile)).toBe(false);
  },
);
