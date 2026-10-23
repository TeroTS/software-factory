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
import { applyReviewHandoffCompatibility } from "../../src/mastra/compatibility/review-handoff";

const before = `const open = (await listSessionOpenRuns(session)).filter((entry) => entry.bindingId === binding.id);
							if (open.length === 0) break;
							if (open.some((entry) => isOpenRunLiveElsewhere(entry, this.#ownerId))) throw new FactoryDispatchError("session_unavailable", \`Factory binding \${binding.id} has a run in flight on another dispatcher.\`);
							if (!runStillActive()) break;`;
const after = `const open = (await listSessionOpenRuns(session)).filter((entry) => entry.bindingId === binding.id || decision.role === "review" && !decision.cancelInFlight && entry.threadId === binding.threadId);
							const reviewHandoff = decision.role === "review" && !decision.cancelInFlight && runStillActive();
							if (open.length === 0 && !reviewHandoff) break;
							if (open.some((entry) => isOpenRunLiveElsewhere(entry, this.#ownerId))) throw new FactoryDispatchError("session_unavailable", \`Factory binding \${binding.id} has a run in flight on another dispatcher.\`);
							if (!reviewHandoff && !runStillActive()) break;`;
const deliveryBefore = `contents: kickoffContents
						}, {
							requestContext,
							requireDelivery: true`;
const deliveryAfter = `contents: kickoffContents
						}, {
							requestContext,
							ifActive: decision.role === "review" ? { behavior: "discard" } : void 0,
							requireDelivery: true`;
const patches = [
  [before, after],
  [deliveryBefore, deliveryAfter],
] as const;
let directory: string;
let filename: string;
let original: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-review-handoff-patch-"));
  mkdirSync(join(directory, "dist/rules"), { recursive: true });
  const installed = resolve("node_modules/@mastra/factory");
  cpSync(join(installed, "package.json"), join(directory, "package.json"));
  filename = join(directory, "dist/rules/dispatcher.js");
  original = readFileSync(join(installed, "dist/rules/dispatcher.js"), "utf8");
  for (const [before, after] of patches)
    original = original.replaceAll(after, before);
  writeFileSync(filename, original);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("patches only reviewer serialization, idempotently", () => {
  applyReviewHandoffCompatibility(directory);
  const patched = readFileSync(filename, "utf8");
  let normalized = patched;
  for (const [before, after] of patches) {
    expect(patched).toContain(after);
    normalized = normalized.replace(after, before);
  }
  expect(normalized).toBe(original);
  applyReviewHandoffCompatibility(directory);
  expect(readFileSync(filename, "utf8")).toBe(patched);
});

it("rejects a Factory version change without writing", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "0.24.1" }),
  );
  expect(() => applyReviewHandoffCompatibility(directory)).toThrow(
    "requires @mastra/factory@0.24.0",
  );
  expect(readFileSync(filename, "utf8")).toBe(original);
});

it.each(
  patches.flatMap(([before, after], anchor) =>
    ["missing", "duplicate", "mixed", "duplicate-patched"].map((shape) => ({
      before,
      after,
      anchor,
      shape,
    })),
  ),
)(
  "rejects $shape source anchor $anchor without writing",
  ({ before, after, shape }) => {
    const changed =
      shape === "missing"
        ? original.replace(before, "upstream changed")
        : shape === "duplicate"
          ? original + before
          : shape === "mixed"
            ? original + after
            : original.replace(before, after) + after;
    writeFileSync(filename, changed);
    expect(() => applyReviewHandoffCompatibility(directory)).toThrow(
      "Unexpected review handoff source",
    );
    expect(readFileSync(filename, "utf8")).toBe(changed);
  },
);
