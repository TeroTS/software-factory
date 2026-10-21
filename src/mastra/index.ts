import { homedir } from "node:os";
import { join } from "node:path";
import { Mastra } from "@mastra/core/mastra";
import { getDatabasePath } from "@mastra/code-sdk/utils/project";
import { DEFAULT_RETENTION } from "@mastra/code-sdk/utils/storage-maintenance";
import {
  createFactorySecretEncryption,
  LocalFactorySandbox,
  MastraFactory,
} from "@mastra/factory";
import { LibSQLFactoryStorage } from "@mastra/libsql";
import { validateEnvironment } from "./env";

validateEnvironment(process.env);

export const factory = new MastraFactory({
  // US-02 adds Simple Auth; this intermediate slice must remain local-only.
  auth: null,
  secretEncryption: createFactorySecretEncryption({
    primary: {
      id: "v1",
      key: Buffer.from(
        process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY!.trim(),
        "base64",
      ),
    },
  }),
  storage: new LibSQLFactoryStorage({
    id: "mastra-code-storage",
    url: `file:${getDatabasePath()}`,
    retention: DEFAULT_RETENTION,
  }),
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
