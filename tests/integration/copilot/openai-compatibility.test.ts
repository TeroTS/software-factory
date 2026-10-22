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
import { applyOpenAICopilotCompatibility } from "../../../src/mastra/copilot/copilot-compatibility";

const names = ["index.mjs", "index.js"] as const;
const anchors = [
  "activeReasoning[value.item.id] = {",
  "const activeReasoningPart = activeReasoning[value.item.id];",
  "id: `${value.item.id}:${summaryIndex}`,",
  "delete activeReasoning[value.item.id];",
];
let directory: string;
let originals: Record<string, string>;

function originalSource(source: string): string {
  return source
    .replace(
      "activeReasoning[value.item.id] = {\n                  outputIndex: value.output_index,",
      anchors[0]!,
    )
    .replace(
      /const reasoningId = Object.keys\(activeReasoning\)\.find\(\(id\) => activeReasoning\[id\]\.outputIndex === value.output_index\);\n                const activeReasoningPart = activeReasoning\[reasoningId\];\n                if \(!activeReasoningPart\) throw new Error\("Responses reasoning completion has no matching start"\);/,
      anchors[1]!,
    )
    .replace("id: `${reasoningId}:${summaryIndex}`,", anchors[2]!)
    .replace("delete activeReasoning[reasoningId];", anchors[3]!);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-copilot-reasoning-patch-"));
  mkdirSync(join(directory, "dist"));
  const installed = resolve("node_modules/@ai-sdk/openai");
  cpSync(join(installed, "package.json"), join(directory, "package.json"));
  originals = {};
  for (const name of names) {
    originals[name] = originalSource(
      readFileSync(join(installed, "dist", name), "utf8"),
    );
    writeFileSync(join(directory, "dist", name), originals[name]);
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("patches ESM and CJS reasoning correlation without unrelated edits, idempotently", () => {
  applyOpenAICopilotCompatibility(directory);
  const patched = names.map((name) =>
    readFileSync(join(directory, "dist", name), "utf8"),
  );
  for (const [index, name] of names.entries()) {
    const source = patched[index]!;
    expect(source).toContain("outputIndex: value.output_index,");
    expect(source).toContain(
      "activeReasoning[id].outputIndex === value.output_index",
    );
    expect(source).toContain("id: `${reasoningId}:${summaryIndex}`,");
    expect(source).toContain("delete activeReasoning[reasoningId];");
    expect(originalSource(source)).toBe(originals[name]);
  }
  applyOpenAICopilotCompatibility(directory);
  expect(
    names.map((name) => readFileSync(join(directory, "dist", name), "utf8")),
  ).toEqual(patched);
});

it("rejects an adapter version change before writing either module", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "3.0.132" }),
  );
  expect(() => applyOpenAICopilotCompatibility(directory)).toThrow(
    "requires @ai-sdk/openai@3.0.131",
  );
  for (const name of names)
    expect(readFileSync(join(directory, "dist", name), "utf8")).toBe(
      originals[name],
    );
});

it.each(
  names.flatMap((name) =>
    anchors.flatMap((anchor) =>
      ["missing", "duplicate"].map((shape) => ({ name, anchor, shape })),
    ),
  ),
)(
  "rejects $shape anchor $anchor in $name before writing either module",
  ({ name, anchor, shape }) => {
    const source = originals[name]!;
    const changed =
      shape === "missing"
        ? source.replace(anchor, "upstream changed")
        : source + anchor;
    writeFileSync(join(directory, "dist", name), changed);
    expect(() => applyOpenAICopilotCompatibility(directory)).toThrow(
      "Unexpected Copilot compatibility source",
    );
    for (const file of names) {
      expect(readFileSync(join(directory, "dist", file), "utf8")).toBe(
        file === name ? changed : originals[file],
      );
    }
  },
);
