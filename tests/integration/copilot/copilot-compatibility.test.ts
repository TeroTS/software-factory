import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { applyCopilotCompatibility } from "../../../src/mastra/copilot/copilot-compatibility";

let directory: string;
let sourceFile: string;
let original: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-copilot-patch-"));
  const providerDirectory = join(directory, "dist/providers");
  mkdirSync(providerDirectory, { recursive: true });
  cpSync(
    resolve("node_modules/@mastra/code-sdk/package.json"),
    join(directory, "package.json"),
  );
  sourceFile = join(providerDirectory, "github-copilot.js");
  original = withoutRouting(
    readFileSync(
      resolve("node_modules/@mastra/code-sdk/dist/providers/github-copilot.js"),
      "utf8",
    ),
  )
    .replace(
      'if (!credential || credential.type !== "oauth") return COPILOT_FALLBACK_MODELS;',
      'if (!credential || credential.type !== "oauth") return [];',
    )
    .replace(
      "if (!accessToken) return COPILOT_FALLBACK_MODELS;",
      "if (!accessToken) return [];",
    );
  writeFileSync(sourceFile, original);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function withoutRouting(source: string): string {
  return source
    .replace('import { createOpenAI } from "@ai-sdk/openai";\n', "")
    .replace(
      /\tconst resolveResponsesModel = async \(params\) => \{[\s\S]*?\n\t\};\n/,
      "",
    )
    .replace(
      /middleware: \[createCopilotMiddleware\(modelId\), \{[\s\S]*?\n\t\t\}\]/,
      "middleware: [createCopilotMiddleware(modelId)]",
    )
    .replace(
      'last?.role && last.role !== "user" || last?.type === "function_call_output"',
      'last?.role && last.role !== "user"',
    );
}

it("patches discovery and endpoint routing without changing unrelated code, idempotently", () => {
  applyCopilotCompatibility(directory);
  const patched = readFileSync(sourceFile, "utf8");
  expect(patched).toContain('import { createOpenAI } from "@ai-sdk/openai";');
  expect(patched).toContain(
    'entry.supportedEndpoints.includes("/chat/completions")',
  );
  expect(patched).toContain("responses.doGenerate(params)");
  expect(patched).toContain("responses.doStream(params)");
  expect(patched).toContain('last?.type === "function_call_output"');
  expect(withoutRouting(patched)).toBe(
    original
      .replace(
        'if (!credential || credential.type !== "oauth") return [];',
        'if (!credential || credential.type !== "oauth") return COPILOT_FALLBACK_MODELS;',
      )
      .replace(
        "if (!accessToken) return [];",
        "if (!accessToken) return COPILOT_FALLBACK_MODELS;",
      ),
  );
  applyCopilotCompatibility(directory);
  expect(readFileSync(sourceFile, "utf8")).toBe(patched);
});

it("rejects an SDK version change without modifying its source", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "1.16.0" }),
  );
  expect(() => applyCopilotCompatibility(directory)).toThrow(
    "requires @mastra/code-sdk@1.15.0",
  );
  expect(readFileSync(sourceFile, "utf8")).toBe(original);
});

it.each(
  [
    "if (!accessToken) return [];",
    'import { createOpenAICompatible } from "@ai-sdk/openai-compatible";',
    'const last = input[input.length - 1];\n\t\tif (last?.role && last.role !== "user") return true;',
    "\treturn wrapLanguageModel({\n\t\tmodel: copilot.chatModel(modelId),",
    "middleware: [createCopilotMiddleware(modelId)]",
  ].flatMap((anchor) =>
    ["missing", "duplicate"].map((shape) => ({ anchor, shape })),
  ),
)(
  "rejects $shape anchor $anchor without partially patching the source",
  ({ anchor, shape }) => {
    const changed =
      shape === "missing"
        ? original.replace(anchor, "throw new Error('changed');")
        : original + anchor;
    writeFileSync(sourceFile, changed);
    expect(() => applyCopilotCompatibility(directory)).toThrow(
      "Unexpected Copilot compatibility source",
    );
    expect(readFileSync(sourceFile, "utf8")).toBe(changed);
  },
);
