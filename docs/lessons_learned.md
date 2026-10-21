# Lessons learned

- [2026-10-21 — Keep SQLite outside rebuilt dev output](#2026-10-21--keep-sqlite-outside-rebuilt-dev-output)

## 2026-10-21 — Keep SQLite outside rebuilt dev output

**Context:** Local Factory Server, `mastra@1.35.0`, Node 22.22.3; US-03.

**Impact:** A saved Factory record disappeared after restarting the dev server.

**Symptoms:** The isolated SQLite write/reopen/read test passed, but the real-server restart test returned an empty Factory list.

**Root cause:** The dev runner sets `MASTRA_PROJECT_ROOT` to `.mastra`, not the repository root. Resolving the relative database path there put persistent state inside rebuilt output. The startup precheck also created an unused database at the correct root, so file existence alone was misleading.

**Fix:** Resolve storage relative to the source/bundle location: `src/mastra` and `.mastra/output` are both two levels below the real project root. Keep the default database at `data/factory.db`.

**Verification:** `./scripts/verify` passes: 37 tests, 100% runtime-module coverage, typecheck, formatting, and build. The real test creates a Factory record, sees its name in the browser, restarts, and sees it again in a fresh browser context.

**Prevention / follow-ups:** Keep the API-and-browser persistence assertion; neither file existence nor a standalone storage round trip proves the server uses the right file. Recheck the root-resolution invariant after runner/build-layout upgrades.

**References:** `src/mastra/storage.ts`, `tests/storage.test.ts`, `tests/startup.test.ts`, and `AGENTS.md` → Gotchas and Manual Steps.
