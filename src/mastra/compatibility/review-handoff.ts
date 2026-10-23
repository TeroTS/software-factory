import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function applyReviewHandoffCompatibility(
  factoryDirectory: string,
): void {
  const { version } = JSON.parse(
    readFileSync(join(factoryDirectory, "package.json"), "utf8"),
  );
  if (version !== "0.24.0") {
    throw new Error(
      "Review handoff patch requires @mastra/factory@0.24.0; review it before upgrading.",
    );
  }
  const before = `const open = (await listSessionOpenRuns(session)).filter((entry) => entry.bindingId === binding.id);
							if (open.length === 0) break;
							if (open.some((entry) => isOpenRunLiveElsewhere(entry, this.#ownerId))) throw new FactoryDispatchError("session_unavailable", \`Factory binding \${binding.id} has a run in flight on another dispatcher.\`);
							if (!runStillActive()) break;`;
  // shortcut: serialize reviewer handoff until upstream rebuilds role-specific tools on active delivery.
  const after = `const open = (await listSessionOpenRuns(session)).filter((entry) => entry.bindingId === binding.id || decision.role === "review" && !decision.cancelInFlight && entry.threadId === binding.threadId);
							const reviewHandoff = decision.role === "review" && !decision.cancelInFlight && runStillActive();
							if (open.length === 0 && !reviewHandoff) break;
							if (open.some((entry) => isOpenRunLiveElsewhere(entry, this.#ownerId))) throw new FactoryDispatchError("session_unavailable", \`Factory binding \${binding.id} has a run in flight on another dispatcher.\`);
							if (!reviewHandoff && !runStillActive()) break;`;
  const filename = join(factoryDirectory, "dist/rules/dispatcher.js");
  const deliveryBefore = `contents: kickoffContents
						}, {
							requestContext,
							requireDelivery: true`;
  const deliveryAfter = `contents: kickoffContents
						}, {
							requestContext,
							ifActive: decision.role === "review" ? { behavior: "discard" } : void 0,
							requireDelivery: true`;
  let source = readFileSync(filename, "utf8");
  for (const [original, patched] of [
    [before, after],
    [deliveryBefore, deliveryAfter],
  ] as const) {
    const normalized = source.replaceAll(patched, original);
    if (normalized.split(original).length !== 2) {
      throw new Error(
        "Unexpected review handoff source; patch was not applied.",
      );
    }
    source = normalized.replace(original, patched);
  }
  writeFileSync(filename, source);
}
