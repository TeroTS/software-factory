# AGENTS.md

## Project

A single TypeScript/npm Factory project for a local, self-hosted Mastra Factory Server. US-01 and US-02 are complete: startup and single-user loopback-only access without authentication. Project-local persistence and sandbox verification remain later stories.

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

Setup runs `npm ci`; verification runs format-check → typecheck → tests with coverage → build, stopping on the first failure. No separate linter is configured; do not invent a lint command or add a linter just for this workflow. Both entrypoints are non-interactive and also resolve the repo root when called from another directory.

## Common Commands

| Task | Command |
| --- | --- |
| Install | `./scripts/setup` (`npm ci`) |
| Build | `npm run build` |
| All tests | `npm test` |
| Unit tests | `npm run test:unit` |
| Integration/end-to-end tests | `npm run test:integration` |
| Coverage | `npm run test:coverage` |
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

- Only starting the Factory Server needs `.env`: copy `.env.example` without overwriting an existing `.env`, then fill `FACTORY_CREDENTIAL_ENCRYPTION_KEY`. No admin token is required or used. Generate the encryption key with `openssl rand -base64 32`; never log or commit secrets.
- Authentication is intentionally disabled (`auth: null`) for one local developer/admin. Keep the server bound strictly to `127.0.0.1`, normally port 4111; never expose it through a proxy, tunnel, or LAN address. Local processes/users that can reach it can access its capabilities, including command execution. Do not add authentication implicitly during maintenance.
- Factory accepting an auth provider does not mean its bundled login UI supports that provider. In the installed `@mastra/factory@0.24.0`, the UI lacks SimpleAuth token sign-in. Check provider, login-route, and UI compatibility before changing authentication; recheck after upgrades.
- Storage still uses the upstream local path. `MASTRA_DB_PATH` can point to a dedicated absolute SQLite filename in an existing writable directory until US-03 lands.
- Startup integration tests require macOS/Linux process groups. They create a temporary `.env` and SQLite file and use a dynamic port; no browser or provider sign-in is required.
- Build copies the bundled Factory UI and installs output dependencies, so verification may require network access. Initial setup/build/tests can take longer than warm runs. Do not infer failure from elapsed time or automatically retry with a longer timeout; if output stalls, report status and ask.
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
