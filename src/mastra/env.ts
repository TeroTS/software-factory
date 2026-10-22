import { readGitHubConfiguration } from "./github/config.ts";

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const encoded = env.FACTORY_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error("FACTORY_CREDENTIAL_ENCRYPTION_KEY is required");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error(
      "FACTORY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }
  readGitHubConfiguration(env);
}
