import { createPrivateKey } from "node:crypto";
import {
  normalizePrivateKey,
  type GithubIntegrationConfig,
} from "@mastra/factory/integrations/github/integration";

const variables = [
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_SLUG",
  "FACTORY_STATE_SECRET",
] as const;

export interface GitHubConfiguration {
  integration: GithubIntegrationConfig;
  stateSecret: string;
}

export function readGitHubConfiguration(
  env: NodeJS.ProcessEnv,
): GitHubConfiguration | undefined {
  if (!variables.some((name) => env[name]?.trim())) return undefined;
  for (const name of variables) {
    if (!env[name]?.trim()) {
      throw new Error(
        `${name} is required when GitHub App configuration is supplied`,
      );
    }
  }
  const appId = env.GITHUB_APP_ID!.trim();
  if (!/^[1-9]\d*$/.test(appId)) {
    throw new Error("GITHUB_APP_ID must be a positive numeric App ID");
  }
  let privateKey: string;
  try {
    privateKey = normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY!.trim());
    if (createPrivateKey(privateKey).asymmetricKeyType !== "rsa")
      throw new Error();
  } catch {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY must be a valid unencrypted RSA private key",
    );
  }
  const stateSecret = env.FACTORY_STATE_SECRET!.trim();
  const decoded = Buffer.from(stateSecret, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== stateSecret) {
    throw new Error(
      "FACTORY_STATE_SECRET must be a base64-encoded 32-byte key",
    );
  }
  return {
    integration: {
      appId,
      privateKey,
      clientId: env.GITHUB_APP_CLIENT_ID!.trim(),
      clientSecret: env.GITHUB_APP_CLIENT_SECRET!.trim(),
      slug: env.GITHUB_APP_SLUG!.trim(),
    },
    stateSecret,
  };
}
