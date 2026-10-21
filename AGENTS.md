# AGENTS.md

## Project

A single TypeScript/npm Factory project for a local, self-hosted Mastra Factory Server. US-01 through US-04 are complete: startup, browser-verified local access without signing in, project-local SQLite persistence across restarts, and standalone LocalSandbox command verification. US-05 is active: a tested SDK discovery compatibility patch exposes Copilot sign-in; the fixed local identity now supports organization administration. The user reports personal Copilot use and Factory-wide sign-in work. Credential-scoped live catalogs are verified; actual model execution after restart and the model-pack/default-model specification mismatch remain unresolved.

## Repo Layout

- `src/mastra/`: Factory Server composition and runtime modules. Keep new feature modules here; add shared helpers only when needed.
- `src/mastra/*.test.ts`: fast unit tests beside their modules.
- `tests/`: real integration/end-to-end tests; startup uses temporary SQLite files and a real Factory Server.
- `scripts/`: setup, verification, and startup environment validation.
- `SPEC.md`: accepted stories and scope; `CONTEXT.md`: canonical domain vocabulary.
- `docs/slices/current-slice.md`: the single current slice brief; history stays in git.
- Root configuration: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.nvmrc`.
- `.github/workflows/check.yml`: CI uses the same setup and verification commands as local development.

## Golden Path

Use Node from `.nvmrc` (22.19.0; `nvm use` if nvm is installed). Run from the repo root:

```bash
./scripts/setup
./scripts/verify
```

Setup runs `npm ci` and installs pinned Playwright Chromium; Linux additionally needs `npm exec -- playwright-core install-deps chromium` (also run by CI). Verification runs format-check → typecheck → tests with coverage → build, stopping on the first failure. No separate linter is configured; do not invent a lint command or add a linter just for this workflow. Both entrypoints are non-interactive and also resolve the repo root when called from another directory.

## Common Commands

| Task | Command |
| --- | --- |
| Install | `./scripts/setup` (`npm ci`) |
| Build | `npm run build` |
| All tests | `npm test` |
| Unit tests | `npm run test:unit` |
| Integration/end-to-end tests | `npm run test:integration` |
| Coverage | `npm run test:coverage` |
| Sandbox check | `npm run check:sandbox` |
| Lint | Not configured; existing static checks are formatting and typecheck |
| Format | `npm run format` |
| Format-check | `npm run format:check` |
| Typecheck | `npm run typecheck` |
| Full CI verification | `./scripts/verify` |

Single-file, module, and case targets:

```bash
npm test -- src/mastra/env.test.ts
npm run test:unit -- src/mastra
npm test -- src/mastra/env.test.ts -t "accepts valid configuration"
npm test -- tests/startup.test.ts
```

## Delivery and Code Rules

- Read `SPEC.md` and `docs/slices/current-slice.md` before story work. Continue an active slice; replace a completed note before starting the next story. Keep one story per slice unless an explicit exception is recorded. Do not rewrite the completed note for tooling-only maintenance.
- New behavior needs automated tests. Use the smallest existing pattern; do not add speculative layers or dependencies.
- Pure deterministic logic may use unit tests. Persistence and external-service boundaries must use real local runtime dependencies when runnable; coded doubles are fallback only when none exists, and that exception must be documented here.
- SQLite is embedded: setup needs no Docker, database service, cloud login, or local `.env` for verification. Keep integration tests separate from unit tests and isolate files/ports from the developer's state.
- Maintain at least 80% statements, branches, functions, and lines in coverage; do not exclude business logic. The framework-composition entry is currently excluded and exercised by the real startup test.
- No authored HTTP endpoints or migrations exist yet. For new/changed HTTP APIs, write and review OpenAPI 3 YAML first, then generate server contracts/models and the frontend client. Do not hand-edit generated artifacts or duplicate generated interfaces.
- Add migrations only with a story requiring schema changes; test them against real temporary SQLite files. Upstream Factory owns its current schema.
- Pin direct dependencies exactly and update `package-lock.json` with dependency changes. Use `npm ci` for setup; do not use unpinned generators to recreate this project.
- `npm run build` regenerates ignored `src/mastra/public/` (upstream Factory UI) and `.mastra/` (bundled server/output dependencies). Do not hand-edit or commit these outputs. Keep Mastra's literal `new Mastra(...)` constructor in `src/mastra/index.ts`.

## Gotchas and Manual Steps

- Only starting the Factory Server needs `.env`: copy `.env.example` without overwriting an existing `.env`, then fill `FACTORY_CREDENTIAL_ENCRYPTION_KEY`. `LIBSQL_URL` defaults to `file:./data/factory.db`; parents are created automatically. No admin token is required or used. Generate the encryption key with `openssl rand -base64 32`; never log or commit secrets.
- `src/mastra/auth.ts` assigns every request fixed user `local-admin` and organization `local` without credential verification or sessions. Its upstream organizations-provider capability returns only that existing organization and grants administration only to that exact user/organization pair, without provisioning. This enables all upstream organization-admin actions, not only provider connection; anything reaching loopback receives that identity. This is identity assignment, not access protection, even though `/auth/me` reports `authenticated: true`. Keep the server bound strictly to `127.0.0.1`, normally port 4111; never expose it through a proxy, tunnel, or LAN address. Anything that can reach it is treated as the local developer/admin. Do not rename the fixed identity or introduce login implicitly.
- Factory accepting an auth provider does not mean its bundled login UI supports that provider. In the installed `@mastra/factory@0.24.0`, the UI lacks SimpleAuth token sign-in and rejects `auth: null` with an auth-configuration error. HTTP 200 plus auth-disabled status does not prove UI usability; require the real browser test. Check provider, login-route, and UI compatibility before changing authentication; recheck after upgrades.
- Factory storage is configured only by `LIBSQL_URL` in `src/mastra/storage.ts`, not `MASTRA_DB_PATH`. Default `data/factory.db` is project-local; old upstream databases are not automatically copied or migrated. Back up and explicitly select an existing file with `LIBSQL_URL` before reusing it, keeping its encryption key. Organization scope remains `local`, but legacy per-user settings/credentials under user `local` are separate from `local-admin`; do not migrate, rekey, or delete developer data implicitly.
- In the installed dev runner, `MASTRA_PROJECT_ROOT` points to `.mastra`, which is rebuilt on restart. Never use it as the database root. Both `src/mastra` and `.mastra/output` are two levels below the real project root; the storage resolver anchors there and the real restart/browser test guards this behavior.
- `src/mastra/sandbox.ts` exports the shared LocalSandbox callback used by Factory and `npm run check:sandbox`. The installed Factory accepts callbacks (labeled `custom` by its adapter); returned sandboxes are still provider `local`, not remote. Root creation/write checks run at configuration time; session directories are created on start. Commands receive HOME and upstream's default PATH, not the full host environment. Keep existing sessions intact; the check leaves its uniquely named directory for inspection. Tests must set `MASTRACODE_LOCAL_SANDBOX_ROOT` to a temporary root rather than use developer sessions.
- Startup integration tests require macOS/Linux process groups and Playwright Chromium. They create a temporary `.env` and project-local SQLite file, use a dynamic port and fresh browser contexts, and verify a named Factory record after restart. Filesystem and storage round-trip integration tests also use temporary files and real SQLite. No provider sign-in is required; browser/server cleanup runs on failure.
- Build copies the bundled Factory UI and installs output dependencies, so verification may require network access. Initial setup/build/tests can take longer than warm runs. Do not infer failure from elapsed time or automatically retry with a longer timeout; if output stalls, report status and ask.
- npm `postinstall` runs `scripts/apply-copilot-compatibility.ts`, backed by `src/mastra/copilot-compatibility.ts`. It reproducibly patches only the two unauthenticated catalog returns in `@mastra/code-sdk@1.15.0` to its existing `gpt-4.1` fallback, making Copilot discoverable without granting credentials. Do not skip lifecycle scripts or manually patch installed/generated artifacts. The hook also version-checks `@mastra/factory@0.24.0`, uses the existing TypeScript compiler to generate `src/mastra/copilot-catalog.ts` inside installed Factory, and wires it into the existing picker and session-switch catalog. The helper uses upstream `TenantCredentialStore` with the selected scope/session owner for token refresh and live model discovery, never global credential copying. Version/source drift must fail installation; review/remove both compatibility patches on upgrades. Tests cover patch idempotence/drift, AuthStorage, real encrypted SQLite, and real server/browser discovery across restart.
- GitHub Copilot has no runnable local emulator. Catalog tests may double only remote HTTP/refresh behavior: unit tests keep real encrypted SQLite and upstream credential resolution; the startup test uses an isolated HTTPS catalog fixture with a temporary trusted certificate via child-process `NODE_EXTRA_CA_CERTS`. Never disable TLS verification, contact GitHub, or use developer credentials in automated tests.
- Settings is Factory-scoped and hidden by repository onboarding when no Factory exists. Use an existing Factory or explicitly approved empty record through the existing projects API. Personal provider sign-in is under `/factories/<factoryId>/settings/personal-models`; organization credentials are managed separately under `settings/models`, enabled by the fixed local administrator capability. Never copy/migrate personal credentials to organization scope implicitly. Unit tests reject other user/organization IDs; the real-server test verifies both settings pages and organization credential mutation while preserving personal credentials across restart. The UI selects individual default models, not SDK model packs; do not claim US-05 complete without resolving that spec mismatch and actual sign-in verification.
- Upstream Stagehand/OpenAI dependencies emit a Zod peer warning; a zero exit status is still success.

## Domain Vocabulary

- Read `CONTEXT.md` before naming domain concepts.
- Use its canonical terms consistently in code, tests, documentation, and
  user-facing output.
- Resolve terminology conflicts before adding or renaming terms.
- Treat the accepted specification as authoritative for behavior and
  `CONTEXT.md` as authoritative for naming.
- Preserve public-interface compatibility; do not silently rename established
  CLI, JSON, or API fields.
- Use accepted spec/model terms for exported domain-facing code; do not invent
  alternate business synonyms at module boundaries. Technical names remain
  appropriate for adapters, framework glue, and private helpers. Resolve awkward
  domain terms in the specification/vocabulary instead of forking them in code.
