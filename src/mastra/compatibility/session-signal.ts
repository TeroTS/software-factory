import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function applySessionSignalCompatibility(coreDirectory: string): void {
  const { version } = JSON.parse(
    readFileSync(join(coreDirectory, "package.json"), "utf8"),
  );
  if (version !== "1.79.0") {
    throw new Error(
      "Session signal patch requires @mastra/core@1.79.0; review it before upgrading.",
    );
  }
  const before =
    "if (!submittedAbortRequested && submittedRunId && submittedActiveRunId && submittedIsRunning) {";
  // shortcut: recheck after async setup; remove when upstream fixes active-to-idle signal delivery.
  const after = `if (!submittedAbortRequested && submittedRunId && submittedActiveRunId && submittedIsRunning
        && !this.run.isAbortRequested() && this.run.isRunning()
        && this.run.getRunId() === submittedRunId && this.stream.activeRunId() === submittedActiveRunId) {`;
  const files = [
    "agent-controller-DO6rGsQm.js",
    "agent-controller-CTosUZsx.cjs",
  ].map((name) => {
    const filename = join(coreDirectory, "dist", name);
    const source = readFileSync(filename, "utf8").replaceAll(after, before);
    if (source.split(before).length !== 2) {
      throw new Error(
        "Unexpected session signal source; patch was not applied.",
      );
    }
    return { filename, source: source.replace(before, after) };
  });
  for (const { filename, source } of files) writeFileSync(filename, source);
}
