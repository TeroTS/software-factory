# Current Slice

Status: done

## Slice Goal

- The local developer/admin restarts Factory and still sees the previously created Factory data.

## Slice Boundary

- After Factory data exists, the local developer/admin stops and restarts the Factory Server; the same data is listed after startup because it is written to and reopened from the project-local SQLite file at `LIBSQL_URL`, defaulting to `file:./data/factory.db`.
- Implement only US-03. Preserve the fixed local identity/organization, loopback binding, encryption key, and upstream Factory HTTP schemas and UI.

## Stories In Scope

- `US-03 Factory data persists across restarts`

## Stories Completed In This Slice

- `US-03 Factory data persists across restarts`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- None. Existing upstream Factory project operations and `LibSQLFactoryStorage` interfaces are used without authored HTTP endpoints or schema changes.

## Decision Inputs

- None. SPEC.md defines the storage behavior needed for this slice.

## Shared State Required Now

- One persistent SQLite file from `LIBSQL_URL`; default `data/factory.db` under the Factory project root.
- Resolve relative paths against the project root, including when the runner's working directory differs. Anchor to the source/bundle location: both `src/mastra` and `.mastra/output` sit two levels below the project root. Do not use the dev runner's misleading `MASTRA_PROJECT_ROOT`, which points at rebuilt `.mastra` and lost the seeded record in the real restart test.
- Create the parent directory when missing; reject non-local or in-memory storage and fail clearly when the directory or file cannot be written.
- Keep existing user `local-admin`, organization `local`, and credential encryption key unchanged. No legacy database is automatically moved, copied, rekeyed, or deleted.

## Operations / Endpoints / Surfaces In This Slice

- Add `src/mastra/storage.ts` for local URL/path resolution, parent creation, write checks, `LibSQLFactoryStorage`, and exported `vector = undefined`; import it into `src/mastra/index.ts` instead of inline upstream-path storage.
- Document `LIBSQL_URL` in `.env.example`, persistence verification and existing-data handling in `README.md`, and updated repository guidance in `AGENTS.md`.
- Reuse existing upstream Factory project creation/listing operations as test setup and verification; no provider connection or agent run is needed.
- Extend the real-server/browser test to create a named Factory record as its precondition, restart the server against the same SQLite file, and observe that name in the real UI afterward. Keep US-02's positive onboarding assertions before creating data.

## Tests Required

- Unit tests resolve the default, relative, absolute, and encoded local paths and reject unsupported/empty storage URLs without opening a database.
- Real filesystem integration tests create a missing parent directory/database, respect project-root resolution rather than process cwd, and clearly reject blocked/unwritable directory or file paths.
- Real `LibSQLFactoryStorage` write/close/reopen/read round trip against a temporary SQLite file using an upstream Factory domain, not mocks or fakes.
- Real startup failure when the configured storage cannot be created or written, without printing the encryption key.
- Real end-to-end test starts with no `data/` directory, verifies default `data/factory.db` creation, creates a named Factory record through the existing upstream API, confirms it exists, restarts, and observes the saved record in a fresh browser context and API response.
- Verify database and journal/WAL paths stay ignored by Git; retain browser/server cleanup, isolated state, identity stability, and loopback checks.
- `./scripts/verify` passes; runtime-module coverage does not decrease from 100% statements, branches, functions, and lines. New storage logic must be covered.

## Not Now

- US-04 sandbox callback/check script, US-05 Copilot sign-in, and US-06 full Factory session.
- Auth changes, organization management, upstream UI patches, authored HTTP endpoints, custom database schemas or migrations, remote databases, and new dependencies.
- Automatic migration from the upstream database location or legacy user scopes. Existing data must be backed up and explicitly selected with `LIBSQL_URL` or transitioned by an agreed separate action, never silently moved.

## Done When

- First startup creates the project-local data directory and SQLite file automatically.
- After restarting, the local developer/admin sees the named saved Factory record in the real browser; storage round-trip and failure tests also pass.
- Relative database paths resolve consistently against the project root; unwritable storage fails clearly before the server becomes usable.
- Database/journal/WAL files remain ignored; documentation explains `LIBSQL_URL`, restart verification, and existing-data precautions.
- Full verification passes without coverage loss or changes to deferred stories.

## Completion Summary

- The local developer/admin's named Factory record remains listed in both the real API and a fresh Chromium context after stopping and restarting Factory. The test uses a temporary project with no initial `data/` directory and verifies automatic default database creation.
- `LIBSQL_URL` selects local SQLite, defaulting to project-root `data/factory.db`. Parent creation and directory/file write checks fail clearly during `npm run dev`'s precheck and are repeated by runtime composition. No file is truncated, no legacy database is copied or deleted, and the existing local identity, organization, encryption-key validation, and retention settings are preserved.
- Real storage integration tests cover `LibSQLFactoryStorage` with the upstream Factory projects domain across write/close/reopen/read, filesystem permission and path failures, and Git ignore rules for default/custom database and journal paths. Path unit tests cover default/relative/absolute/encoded paths and unsupported URLs without filesystem writes.
- The real restart test exposed the dev runner's misleading `MASTRA_PROJECT_ROOT` value, which points into rebuilt `.mastra`; source/bundle-relative anchoring fixes the loss. The regression and prevention are recorded in `AGENTS.md` and `docs/lessons_learned.md`.
- `.env.example` and README document storage selection, repeatable persistence verification, the changed default location, and explicit existing-data precautions. `MASTRA_DB_PATH` no longer selects the Factory database. No authored API, dependency, custom schema, or migration was added.
- `./scripts/verify` passes on Node 22.22.3: formatting, typecheck, 37 tests, coverage, and build. Statements, branches, functions, and lines remain at 100% for hand-written runtime modules. Hosted CI and provider/agent sessions were not run; no developer database was used for verification.

## Next Slice Recommendation

- `US-04 Run a command in LocalSandbox` is the next explicit story. Reconcile the installed `LocalFactorySandbox` API with the story's older callback wording before implementation.
- Keep US-05 GitHub Copilot credential persistence and deferred US-06 full Factory session in view; neither is part of this slice.
