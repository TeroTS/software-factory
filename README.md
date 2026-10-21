# software-factory

Local, self-hosted Mastra Factory project, scaffolded with `create-factory@0.3.0 --no-platform`.

## Current delivery

US-01 starts the Factory Server. US-02's intended single-user access without signing in is **blocked**: the bundled UI displays "This MastraCode server has no authentication provider configured" when auth is disabled. The new browser regression test fails on this error; successful HTML/API responses alone do not mean Factory is usable. Project-local persistence configuration, the sandbox check script, and GitHub Copilot connection verification remain separate stories in `SPEC.md`.

**Authentication is intentionally disabled.** The server binds strictly to `127.0.0.1`. No admin token or login is needed. Never expose it through a proxy, tunnel, or LAN address. Local processes/users able to reach it can access its capabilities, including command execution; loopback is not complete isolation.

## Prerequisites

- Node.js 22.19.0 with npm for the reproducible baseline, pinned in `.nvmrc` and used by CI. The package supports newer Node versions.
- Git, available on `PATH`.
- OpenSSL for generating secrets.
- macOS or Linux for the startup test's process-group cleanup.
- Chromium for the browser test; `./scripts/setup` installs the version matched to the pinned Playwright library. On Linux, install its system libraries with `npm exec -- playwright-core install-deps chromium` (may require administrator privileges).
- Network access for dependency installation; no cloud account is needed to start.

LocalSandbox runs commands as your OS user without isolation. Only use trusted repositories.

## Install

```bash
./scripts/setup
cp .env.example .env
```

`./scripts/setup` runs non-interactive `npm ci` using the committed lockfile, then downloads Chromium for browser tests. If you use nvm, run `nvm use` first. Do not overwrite an existing `.env`; copying it is needed only before starting the Factory Server, not for verification. Upstream Stagehand/OpenAI dependencies currently produce a Zod peer-version warning; installation still succeeds.

## Environment configuration

Edit `.env` and fill the one required variable:

| Variable                            | Value                         |
| ----------------------------------- | ----------------------------- |
| `FACTORY_CREDENTIAL_ENCRYPTION_KEY` | A base64-encoded 32-byte key. |

Generate the credential encryption key:

```bash
openssl rand -base64 32
```

Never commit or share `.env`. Keep the encryption key stable: losing it makes encrypted credentials unreadable. `FACTORY_ADMIN_TOKEN` and `FACTORY_ADMIN_NAME` are not used; remove them from an existing `.env` if present.

Optional defaults are commented in `.env.example`:

- `PORT=4111`
- `MASTRACODE_PUBLIC_URL=http://localhost:4111`

If changing the port, set the public URL to match. Restart after changing `.env`. A missing, blank, or malformed encryption key stops startup with a variable-specific error that does not print secrets.

## Start

```bash
npm run dev
```

The Factory Server logs its local URL. Open `http://localhost:4111`, or verify the response from another terminal:

```bash
curl --fail http://localhost:4111
```

The API responds without credentials, but the browser currently stops at the upstream auth-configuration error instead of loading usable Factory content. Verify the API response:

```bash
curl --fail http://localhost:4111/api/agents
```

Stop with Ctrl-C. No PostgreSQL, Redis, Docker, or Mastra platform provisioning is required.

Storage still uses the upstream local SQLite path; US-03 will move configuration to `data/factory.db` and verify persistence. To keep this intermediate server separate from any existing Mastra Code database, set `MASTRA_DB_PATH` in your shell to a dedicated absolute SQLite filename in an existing writable directory.

## Tests and coverage

```bash
./scripts/verify
```

This is the same verification CI runs: formatting → typecheck → tests with coverage → build. It stops at the first failure. No separate linter is configured. Verification needs no `.env`, external database service, or cloud authentication. Build copies the upstream Factory UI into ignored `src/mastra/public/` and creates ignored `.mastra/` output, including installed dependencies; this step may need network access.

Fast and individual checks:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
npm run typecheck
npm run format:check
npm run build
```

Single-file, module, and test-case targets:

```bash
npm test -- src/mastra/env.test.ts
npm run test:unit -- src/mastra
npm test -- src/mastra/env.test.ts -t "accepts valid configuration"
```

For the startup test alone:

```bash
npm test -- tests/startup.test.ts
```

The startup test runs the real `npm run dev` without an admin token, using a temporary `.env`, SQLite file, and dynamically selected port. It checks HTML and API responses without credentials, auth-disabled status, the logged loopback URL, and refusal of connections to non-loopback IPv4 addresses when available. A fresh Chromium context must then show Factory onboarding and its enabled start button, with no sign-in redirect or password field; this currently fails on the upstream auth-disabled error screen. Browser and server processes are cleaned up even on failure. The test also checks fail-fast startup without the credential encryption key. It does not use your `.env`, SQLite database, or browser profile.

Coverage reports: `coverage/index.html` and `coverage/lcov.info`. Statements, branches, functions, and lines must each reach 80%. The upstream framework-composition entry is excluded; hand-written environment validation is included. New behavior modules must remain covered.

`.github/workflows/check.yml` uses `.nvmrc`, `./scripts/setup`, and `./scripts/verify`. No extra CI environment variables or services are required; no deployment pipeline is included. Agent workflow and layout guidance lives in `AGENTS.md`.

## Scaffold provenance

The generator refuses a non-empty target directory. The scaffold was generated in a temporary directory and copied into this repo without its generated `.git`, `.env`, or replacement documentation. Unused cloud/integration configuration, Docker setup, and duplicate bundled agent skills were omitted. Framework initialization retains the upstream `prepare()` → literal `new Mastra(...)` → `finalize()` sequence.
