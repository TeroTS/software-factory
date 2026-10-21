export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  for (const name of [
    "FACTORY_ADMIN_TOKEN",
    "FACTORY_CREDENTIAL_ENCRYPTION_KEY",
  ]) {
    if (!env[name]?.trim()) {
      throw new Error(`${name} is required`);
    }
  }

  const encoded = env.FACTORY_CREDENTIAL_ENCRYPTION_KEY!.trim();
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error(
      "FACTORY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }
}
