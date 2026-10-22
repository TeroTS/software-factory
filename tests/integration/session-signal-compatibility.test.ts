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
import { applySessionSignalCompatibility } from "../../src/mastra/compatibility/session-signal";

const names = ["agent-controller-DO6rGsQm.js", "agent-controller-CTosUZsx.cjs"];
const before =
  "if (!submittedAbortRequested && submittedRunId && submittedActiveRunId && submittedIsRunning) {";
const after = `if (!submittedAbortRequested && submittedRunId && submittedActiveRunId && submittedIsRunning
        && !this.run.isAbortRequested() && this.run.isRunning()
        && this.run.getRunId() === submittedRunId && this.stream.activeRunId() === submittedActiveRunId) {`;
let directory: string;
let originals: Record<string, string>;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-session-signal-patch-"));
  mkdirSync(join(directory, "dist"));
  const installed = resolve("node_modules/@mastra/core");
  cpSync(join(installed, "package.json"), join(directory, "package.json"));
  originals = {};
  for (const name of names) {
    originals[name] = readFileSync(
      join(installed, "dist", name),
      "utf8",
    ).replaceAll(after, before);
    writeFileSync(join(directory, "dist", name), originals[name]);
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("patches ESM and CJS without unrelated changes, idempotently", () => {
  applySessionSignalCompatibility(directory);
  const patched = names.map((name) =>
    readFileSync(join(directory, "dist", name), "utf8"),
  );
  for (const [index, name] of names.entries()) {
    expect(patched[index]).toContain(after);
    expect(patched[index]!.replace(after, before)).toBe(originals[name]);
  }
  applySessionSignalCompatibility(directory);
  expect(
    names.map((name) => readFileSync(join(directory, "dist", name), "utf8")),
  ).toEqual(patched);
});

it("rejects a core version change before writing either module", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "1.79.1" }),
  );
  expect(() => applySessionSignalCompatibility(directory)).toThrow(
    "requires @mastra/core@1.79.0",
  );
  for (const name of names)
    expect(readFileSync(join(directory, "dist", name), "utf8")).toBe(
      originals[name],
    );
});

it.each(
  names.flatMap((name) =>
    ["missing", "duplicate", "mixed", "duplicate-patched"].map((shape) => ({
      name,
      shape,
    })),
  ),
)(
  "rejects $shape anchor in $name before writing either module",
  ({ name, shape }) => {
    const source = originals[name]!;
    const changed =
      shape === "missing"
        ? source.replace(before, "upstream changed")
        : shape === "duplicate"
          ? source + before
          : shape === "mixed"
            ? source + after
            : source.replace(before, after) + after;
    writeFileSync(join(directory, "dist", name), changed);
    expect(() => applySessionSignalCompatibility(directory)).toThrow(
      "Unexpected session signal source",
    );
    for (const file of names)
      expect(readFileSync(join(directory, "dist", file), "utf8")).toBe(
        file === name ? changed : originals[file],
      );
  },
);
