# software-factory

Local, self-hosted Mastra Factory project, scaffolded with `create-factory@0.3.0 --no-platform`.

## Current delivery

US-01 starts the Factory Server. Admin-token authentication, project-local persistence configuration, the sandbox check script, and GitHub Copilot connection verification remain separate stories in `SPEC.md`.

**Authentication is not enabled yet.** The server binds to `127.0.0.1`. Do not expose it through a proxy or tunnel. The required admin token is validated but will not protect requests until US-02. Factory's authenticated UI workflows are not usable in this intermediate slice.

## Prerequisites

- Node.js 22.19.0 with npm for the reproducible baseline, pinned in `.nvmrc` and used by CI. The package supports newer Node versions.
- Git, available on `PATH`.
- OpenSSL for generating secrets.
- macOS or Linux for the startup test's process-group cleanup.
- Network access for dependency installation; no cloud account is needed to start.

LocalSandbox runs commands as your OS user without isolation. Only use trusted repositories.

## Install

```bash
./scripts/setup
cp .env.example .env
```

`./scripts/setup` runs non-interactive `npm ci` using the committed lockfile. If you use nvm, run `nvm use` first. Do not overwrite an existing `.env`; copying it is needed only before starting the Factory Server, not for verification. Upstream Stagehand/OpenAI dependencies currently produce a Zod peer-version warning; installation still succeeds.

## Environment configuration

Edit `.env` and fill both required variables:

| Variable                            | Value                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `FACTORY_ADMIN_TOKEN`               | A private, random admin token; required now, used for authentication in US-02. |
| `FACTORY_CREDENTIAL_ENCRYPTION_KEY` | A base64-encoded 32-byte key.                                                  |

Generate each secret separately:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

Use the first output for the admin token and the second for the credential encryption key. Never commit or share `.env`. Keep the encryption key stable: losing it makes encrypted credentials unreadable.

Optional defaults are commented in `.env.example`:

- `PORT=4111`
- `MASTRACODE_PUBLIC_URL=http://localhost:4111`

If changing the port, set the public URL to match. Restart after changing `.env`. Missing or blank required variables, or a malformed encryption key, stop startup with a variable-specific error that does not print secrets.

## Start

```bash
npm run dev
```

The Factory Server logs its local URL. Open `http://localhost:4111`, or verify the response from another terminal:

```bash
curl --fail http://localhost:4111
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

The startup test runs the real `npm run dev` with a temporary `.env`, SQLite file, and dynamically selected port, checks the HTML response and logged URL, and stops the process group. It also checks fail-fast startup with either required variable missing. It does not use your `.env` or SQLite database.

Coverage reports: `coverage/index.html` and `coverage/lcov.info`. Statements, branches, functions, and lines must each reach 80%. The upstream framework-composition entry is excluded; hand-written environment validation is included. New behavior modules must remain covered.

`.github/workflows/check.yml` uses `.nvmrc`, `./scripts/setup`, and `./scripts/verify`. No extra CI environment variables or services are required; no deployment pipeline is included. Agent workflow and layout guidance lives in `AGENTS.md`.

## Scaffold provenance

The generator refuses a non-empty target directory. The scaffold was generated in a temporary directory and copied into this repo without its generated `.git`, `.env`, or replacement documentation. Unused cloud/integration configuration, Docker setup, and duplicate bundled agent skills were omitted. Framework initialization retains the upstream `prepare()` → literal `new Mastra(...)` → `finalize()` sequence.
