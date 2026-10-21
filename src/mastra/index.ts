import { homedir } from "node:os";
import { join } from "node:path";
import { Mastra } from "@mastra/core/mastra";
import {
  createFactorySecretEncryption,
  LocalFactorySandbox,
  MastraFactory,
} from "@mastra/factory";
import { createLocalIdentityProvider } from "./auth";
import { validateEnvironment } from "./env";
import { createFactoryStorage, vector } from "./storage";

validateEnvironment(process.env);

export const factory = new MastraFactory({
  auth: createLocalIdentityProvider(),
  secretEncryption: createFactorySecretEncryption({
    primary: {
      id: "v1",
      key: Buffer.from(
        process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY!.trim(),
        "base64",
      ),
    },
  }),
  storage: createFactoryStorage(process.env),
  vector,
  sandbox: new LocalFactorySandbox({
    root:
      process.env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() ||
      join(homedir(), ".mastracode", "web", "sandboxes"),
    env: { HOME: homedir() },
  }),
  publicUrl: process.env.MASTRACODE_PUBLIC_URL,
});

const preparedArgs = await factory.prepare();

// Mastra's bundler requires this literal constructor in the entry module.
export const mastra = new Mastra({
  ...preparedArgs,
  server: { ...preparedArgs.server, host: "127.0.0.1" },
  storage: preparedArgs.storage,
  pubsub: preparedArgs.pubsub,
  workers: preparedArgs.workers,
  workflows: preparedArgs.workflows,
});

await factory.finalize();
