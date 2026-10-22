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
  original = readFileSync(
    resolve("node_modules/@mastra/code-sdk/dist/providers/github-copilot.js"),
    "utf8",
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

it("patches only the two unauthenticated returns and is idempotent", () => {
  applyCopilotCompatibility(directory);
  const patched = readFileSync(sourceFile, "utf8");
  expect(patched).toBe(
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

it.each(["missing", "duplicate"])(
  "rejects a %s anchor without partially patching the source",
  (shape) => {
    const anchor = "if (!accessToken) return [];";
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
