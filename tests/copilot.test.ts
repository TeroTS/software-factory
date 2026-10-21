import { AuthStorage } from "@mastra/code-sdk/auth/storage";
import {
  buildGitHubCopilotOAuthFetch,
  getCopilotModelCatalog,
} from "@mastra/code-sdk/providers/github-copilot";
import { GitHubCopilotGateway } from "@mastra/code-sdk/providers/github-copilot-gateway";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
let storage: AuthStorage;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-copilot-"));
  storage = new AuthStorage(join(directory, "auth.json"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

it("advertises Copilot before sign-in without granting credentials or writing an auth file", async () => {
  const gateway = new GitHubCopilotGateway({ credentialStore: storage });
  const providers = await gateway.fetchProviders();
  expect(providers["github-copilot"]?.models).toEqual(["gpt-4.1"]);
  expect(
    gateway.resolveAuth({
      gatewayId: "github-copilot",
      providerId: "github-copilot",
      modelId: "gpt-4.1",
      routerId: "github-copilot/gpt-4.1",
    }),
  ).toBeUndefined();
  expect(storage.isLoggedIn("github-copilot")).toBe(false);
  expect(readdirSync(directory)).toEqual([]);
});

it("advertises Copilot through the legacy credential-store interface too", async () => {
  const catalog = await getCopilotModelCatalog({
    authStorage: {
      reload: storage.reload.bind(storage),
      get: storage.get.bind(storage),
      getApiKey: storage.getApiKey.bind(storage),
      getStoredApiKey: storage.getStoredApiKey.bind(storage),
    },
  });
  expect(catalog.map((model) => model.id)).toEqual(["gpt-4.1"]);
  expect(readdirSync(directory)).toEqual([]);
});

it("still rejects model requests without an OAuth credential", async () => {
  const copilotFetch = buildGitHubCopilotOAuthFetch({ authStorage: storage });
  await expect(
    copilotFetch("https://api.githubcopilot.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    }),
  ).rejects.toThrow("Not logged in to GitHub Copilot.");
  expect(readdirSync(directory)).toEqual([]);
});
