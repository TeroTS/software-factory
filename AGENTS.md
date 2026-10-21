# AGENTS.md

Local TypeScript/npm Mastra Factory Server. Follow existing modules in `src/mastra/`.

## Workflow

Use Node from `.nvmrc`. From the repository root:

```bash
./scripts/setup
./scripts/verify
```

Setup runs `npm ci` and installs Chromium. Linux additionally needs:

```bash
npm exec -- playwright-core install-deps chromium
```

Verification runs formatting → typecheck → tests with coverage → build. No separate linter exists. Useful targets:

```bash
npm test -- tests/startup.test.ts
npm run test:coverage
npm run postinstall     # reapply authored Copilot compatibility changes
```

Build needs network; peer warnings are not failures. Report stalls and ask; do not retry with longer timeouts.

## Safety and Data

- Bind strictly to `127.0.0.1`. Requests receive fixed `local-admin` / organization `local` with administrator capabilities, without caller verification. Never expose through LAN, proxies, or tunnels; never implicitly change identities or add login. HTTP 200 or `/auth/me` alone does not prove browser compatibility.
- Never log/commit secrets, overwrite `.env`, or regenerate an existing encryption key. Keep `FACTORY_CREDENTIAL_ENCRYPTION_KEY` paired with its database. Back up before changing storage; never implicitly migrate, delete, rekey, or merge credential scopes.
- SQLite uses `LIBSQL_URL`, defaulting to `file:./data/factory.db`. Resolve against the real repository root, never `MASTRA_PROJECT_ROOT`: the dev runner points into rebuilt `.mastra`. Preserve source/bundle root-resolution compatibility. `MASTRA_DB_PATH` is unused.
- LocalSandbox executes as the OS user without isolation. Preserve existing sessions, reject escaping session IDs, and keep Factory/check-script configuration shared. Do not broaden inherited command environment variables.

## Compatibility and Generated Files

- Keep the literal `new Mastra(...)` and `prepare()` → constructor → `finalize()` sequence in `src/mastra/index.ts`.
- Never hand-edit or commit `.mastra/`, `src/mastra/public/`, dependencies, databases/journals, or coverage output. Build regenerates the first two.
- Do not skip npm lifecycle scripts. Copilot patches live in `src/mastra/copilot-compatibility.ts`; installation compiles `copilot-catalog.ts` into installed Factory. Keep patches idempotent and fail on dependency version/source drift. Review/remove them before upgrades; never patch installed artifacts manually.
- Preserve selected credential scope and session owner. Never copy personal credentials into organization/global storage, borrow another scope's catalog, or share cross-scope caches. Retain upstream token refresh, model filtering, and fallback behavior. Do not silently change saved defaults.

## Testing

- Changed behavior requires automated tests. Module tests are beside source; real integration/browser tests are in `tests/`. Use real SQLite, filesystems, LocalSandbox, and runnable server boundaries. Isolate temporary databases, ports, sandbox roots, browser contexts, and cleanup from developer state.
- Tests need macOS/Linux, Git, OpenSSL, and Chromium—not developer credentials or `.env`.
- Copilot has no local emulator: only remote HTTP/refresh calls may be doubled. Keep real encrypted SQLite/upstream credential resolution. The HTTPS fixture in `tests/copilot-fixture.ts` uses a temporary trusted certificate; never disable TLS verification or contact GitHub in automated tests.
- CI executes V8 coverage through `./scripts/verify`. Maintain at least 80% statements, branches, functions, and lines without decreasing coverage. Never exclude business logic; test composition through real startup. Reports: `coverage/index.html`, `coverage/lcov.info`.

## Change Rules

- Before story work, read `SPEC.md`, `CONTEXT.md`, and `docs/slices/current-slice.md`. Continue the active slice; keep one story per slice unless explicitly agreed otherwise. Do not rewrite completed notes for tooling maintenance. Use canonical terminology and preserve public interfaces.
- Keep story IDs, status, acceptance decisions, and verification history in the specification/slice note, not README or AGENTS. README covers usage; this file covers durable development constraints.
- Pin direct dependencies exactly and update `package-lock.json`. Preserve strict TypeScript settings; use Prettier.
- New/changed HTTP APIs require reviewed OpenAPI 3 YAML first, then generated backend contracts/models and frontend client. Never duplicate or hand-edit generated interfaces. Upstream owns the current schema; add migrations only when required, tested against real temporary SQLite.

`AGENTS.md` is excluded from normal formatting checks; check it explicitly:

```bash
npm exec -- prettier --check --ignore-path /dev/null AGENTS.md
```
