import { getOAuthProvider } from "@mastra/code-sdk/auth/storage";
import type { OAuthCredential } from "@mastra/code-sdk/auth/types";
import { createFactorySecretEncryption } from "@mastra/factory";
import type { ModelCatalog } from "@mastra/factory/routes/config";
import { ModelCredentialsStorage } from "@mastra/factory/storage/domains/credentials/base";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withTenantCopilotModels } from "../../../src/mastra/copilot/copilot-catalog";
import { createFactoryStorage } from "../../../src/mastra/storage";

const user = { orgId: "local", userId: "local-admin" };
const org = { orgId: "local" };
const models: Awaited<ReturnType<ModelCatalog["listAvailableModels"]>> = [
  {
    id: "github-copilot/gpt-4.1",
    provider: "github-copilot",
    modelName: "gpt-4.1",
    hasApiKey: false,
  },
  {
    id: "other/model",
    provider: "other",
    modelName: "model",
    hasApiKey: false,
  },
];
let directory: string;
let database: ReturnType<typeof createFactoryStorage>;
let credentials: ModelCredentialsStorage;

function token(
  access: string,
  expires = Date.now() + 3_600_000,
): OAuthCredential {
  return { type: "oauth", access, refresh: "fixture-only-refresh", expires };
}

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "factory-copilot-catalog-"));
  database = createFactoryStorage({}, directory);
  credentials = database.registerDomain(
    new ModelCredentialsStorage(
      createFactorySecretEncryption({
        primary: { id: "v1", key: randomBytes(32) },
      }),
    ),
  );
  await database.init();
  await credentials.ensureReady();
  // No GitHub emulator exists: only the remote HTTP response is doubled; storage/refresh are real.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const authorization = new Headers(init?.headers).get("Authorization");
    const scope = authorization === "Bearer fixture-user" ? "user" : "org";
    return new Response(
      JSON.stringify({
        data: [
          {
            id: `${scope}-model`,
            name: `${scope} model`,
            model_picker_enabled: true,
          },
        ],
      }),
    );
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
  rmSync(directory, { recursive: true, force: true });
});

it.each(["user", "org"] as const)(
  "uses only the selected %s OAuth credential and preserves other providers",
  async (scope) => {
    await credentials.setCredential(
      user,
      "github-copilot",
      token("fixture-user"),
    );
    await credentials.setCredential(
      org,
      "github-copilot",
      token("fixture-org"),
    );
    const records = (
      await credentials.listCredentials(user.orgId, user.userId)
    ).filter((record) => record.scope === scope);
    const catalog = await withTenantCopilotModels(models, records, {
      ...user,
      credentials,
    });
    expect(catalog).toEqual([
      models[1],
      {
        id: `github-copilot/${scope}-model`,
        provider: "github-copilot",
        modelName: `${scope} model`,
        hasApiKey: true,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer fixture-${scope}`,
        }),
      }),
    );
  },
);

it("prefers the user's credential only when both scopes are allowed by the caller", async () => {
  await credentials.setCredential(
    user,
    "github-copilot",
    token("fixture-user"),
  );
  await credentials.setCredential(org, "github-copilot", token("fixture-org"));
  const records = await credentials.listCredentials(user.orgId, user.userId);
  const catalog = await withTenantCopilotModels(models, records, {
    ...user,
    credentials,
  });
  expect(catalog.at(-1)?.id).toBe("github-copilot/user-model");
});

it("does not fetch without a tenant context or matching OAuth credential", async () => {
  expect(await withTenantCopilotModels(models, undefined, undefined)).toBe(
    models,
  );
  expect(
    await withTenantCopilotModels(models, undefined, { ...user, credentials }),
  ).toBe(models);
  await credentials.setCredential(user, "other", {
    type: "api_key",
    key: "fixture-other",
  });
  await credentials.setCredential(org, "github-copilot", {
    type: "api_key",
    key: "fixture-not-oauth",
  });
  const records = await credentials.listCredentials(user.orgId, user.userId);
  expect(
    await withTenantCopilotModels(models, records, { ...user, credentials }),
  ).toBe(models);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not borrow an org catalog for an empty personal scope or a different organization", async () => {
  await credentials.setCredential(org, "github-copilot", token("fixture-org"));
  const personal = (
    await credentials.listCredentials(user.orgId, user.userId)
  ).filter((record) => record.scope === "user");
  const foreign = await credentials.listCredentials("foreign", user.userId);
  expect(
    await withTenantCopilotModels(models, personal, { ...user, credentials }),
  ).toBe(models);
  expect(
    await withTenantCopilotModels(models, foreign, {
      ...user,
      orgId: "foreign",
      credentials,
    }),
  ).toBe(models);
  expect(fetch).not.toHaveBeenCalled();
});

it("refreshes an expired organization credential through upstream storage without changing the user's token", async () => {
  await credentials.setCredential(
    user,
    "github-copilot",
    token("fixture-user"),
  );
  await credentials.setCredential(
    org,
    "github-copilot",
    token("fixture-expired", 0),
  );
  const provider = getOAuthProvider("github-copilot")!;
  const refresh = vi
    .spyOn(provider, "refreshToken")
    .mockResolvedValue(token("fixture-org"));
  const records = (
    await credentials.listCredentials(user.orgId, user.userId)
  ).filter((record) => record.scope === "org");
  const catalog = await withTenantCopilotModels(models, records, {
    ...user,
    credentials,
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(catalog.at(-1)?.id).toBe("github-copilot/org-model");
  expect(await credentials.getCredential(user, "github-copilot")).toMatchObject(
    { access: "fixture-user" },
  );
  expect(await credentials.getCredential(org, "github-copilot")).toMatchObject({
    access: "fixture-org",
  });
});

it("keeps the upstream fallback when token refresh fails without borrowing the user's credential", async () => {
  await credentials.setCredential(
    user,
    "github-copilot",
    token("fixture-user"),
  );
  await credentials.setCredential(
    org,
    "github-copilot",
    token("fixture-expired", 0),
  );
  vi.spyOn(
    getOAuthProvider("github-copilot")!,
    "refreshToken",
  ).mockRejectedValue(new Error("fixture refresh failure"));
  const records = (
    await credentials.listCredentials(user.orgId, user.userId)
  ).filter((record) => record.scope === "org");
  const catalog = await withTenantCopilotModels(models, records, {
    ...user,
    credentials,
  });
  expect(catalog.at(-1)?.id).toBe("github-copilot/gpt-4.1");
  expect(fetch).not.toHaveBeenCalled();
});
