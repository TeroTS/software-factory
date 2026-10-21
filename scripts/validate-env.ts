import { validateEnvironment } from "../src/mastra/env.ts";
import { createFactoryStorage } from "../src/mastra/storage.ts";

validateEnvironment(process.env);
const storage = createFactoryStorage(process.env);
await storage.close();
