import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import {
  applyCopilotCompatibility,
  applyFactoryCopilotCompatibility,
} from "../src/mastra/copilot/copilot-compatibility.ts";

const catalog = transpileModule(
  readFileSync(
    new URL("../src/mastra/copilot/copilot-catalog.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 },
  },
).outputText;
applyFactoryCopilotCompatibility(
  fileURLToPath(new URL("../node_modules/@mastra/factory/", import.meta.url)),
  catalog,
);
applyCopilotCompatibility(
  fileURLToPath(new URL("../node_modules/@mastra/code-sdk/", import.meta.url)),
);
