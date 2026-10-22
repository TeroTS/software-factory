# Lessons learned

- [2026-10-23 — Correlate Copilot reasoning by output index](#2026-10-23--correlate-copilot-reasoning-by-output-index)
- [2026-10-21 — Keep SQLite outside rebuilt dev output](#2026-10-21--keep-sqlite-outside-rebuilt-dev-output)

## 2026-10-23 — Correlate Copilot reasoning by output index

**Context:** Local Factory, Sol through Copilot Responses, `@ai-sdk/openai@3.0.131`; US-07.

**Impact:** Automated Planning repeatedly crashed before handing work to Building, despite a successful manual command-only session.

**Symptoms:** `Cannot read properties of undefined (reading 'summaryParts')` in the Responses stream transformer.

**Root cause:** A live tool-follow-up diagnostic showed Copilot changing a reasoning item's ID between its added and done events. The adapter stored reasoning under the starting ID and looked up completion by the changed ID. Earlier fixtures covered text/tools but not reasoning-event identity changes.

**Fix:** Extend the existing version/source-checked install-time patch to correlate reasoning completion by output index in both ESM and CJS. Keep the original stream ID for balanced start/end events and the final ID/encrypted content in completion metadata. Reject unmatched output indices explicitly; do not silently discard reasoning or pair unrelated items.

**Verification:** A synthetic HTTP regression with real scoped encrypted SQLite reproduced the exact crash before the fix. Afterward, `npm run test:coverage` passed 143 tests at 100% coverage; formatting, typecheck, and build passed. The live retry completed its stream without the exception, then correctly stopped on a separate planner-generated validation error. That is not pipeline acceptance.

**Prevention / follow-ups:** Test renamed IDs, empty/nonempty summaries, final metadata, and missing-start rejection; validate both module formats and fail before partial patching on source/version drift. Keep live diagnostics limited to event identity/type metadata, never tokens, model text, or encrypted payloads. Check actual command output rather than trusting the agent's error summary: in this retry, heading checks passed and a hard-coded 29-byte assertion failed because the requested content is 30 bytes.

**References:** `src/mastra/copilot/copilot-compatibility.ts`, `scripts/apply-copilot-compatibility.ts`, `tests/integration/copilot/copilot-routing.test.ts`, `tests/integration/copilot/openai-compatibility.test.ts`, `docs/slices/current-slice.md`.

## 2026-10-21 — Keep SQLite outside rebuilt dev output

**Context:** Local Factory Server, `mastra@1.35.0`, Node 22.22.3; US-03.

**Impact:** A saved Factory record disappeared after restarting the dev server.

**Symptoms:** The isolated SQLite write/reopen/read test passed, but the real-server restart test returned an empty Factory list.

**Root cause:** The dev runner sets `MASTRA_PROJECT_ROOT` to `.mastra`, not the repository root. Resolving the relative database path there put persistent state inside rebuilt output. The startup precheck also created an unused database at the correct root, so file existence alone was misleading.

**Fix:** Resolve storage relative to the source/bundle location: `src/mastra` and `.mastra/output` are both two levels below the real project root. Keep the default database at `data/factory.db`.

**Verification:** `./scripts/verify` passes: 37 tests, 100% runtime-module coverage, typecheck, formatting, and build. The real test creates a Factory record, sees its name in the browser, restarts, and sees it again in a fresh browser context.

**Prevention / follow-ups:** Keep the API-and-browser persistence assertion; neither file existence nor a standalone storage round trip proves the server uses the right file. Recheck the root-resolution invariant after runner/build-layout upgrades.

**References:** `src/mastra/storage.ts`, `tests/storage.test.ts`, `tests/startup.test.ts`, and `AGENTS.md` → Gotchas and Manual Steps.
