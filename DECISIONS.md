# Local Self-Hosted Mastra Factory Decisions

Status: Draft v1

## Problem Summary

Set up a runnable, self-hosted Mastra Factory project on the local machine. It uses Mastra Simple Auth, local SQLite storage via libSQL, and `LocalSandbox`. No cloud services or Mastra platform resources. Source requirements: `instructions.txt`.

## Goals and Success Criteria

- The project installs with `npm install`.
- `npm run dev` starts the Factory Server locally without configuration errors at `http://localhost:4111`.
- Simple Auth is enforced. Requests to protected routes without a token are rejected, and requests with a valid token succeed.
- The SQLite database is created automatically under `data/` and persists across restarts.
- `LocalSandbox` is selected, the sandbox root exists and is writable, and a standalone check runs a command through `LocalSandbox`.
- Typecheck and Vitest with coverage pass. Hand-written modules have at least 80% coverage.
- `README.md` documents prerequisites, install, env config, start commands, and verification steps.

## Primary Roles / Actors

- **Local developer/admin:** runs the server and signs in with the admin token.
- **Coding agent session:** runs commands in `LocalSandbox` on the local machine.

## Non-Goals

- Mastra platform auth, PostgreSQL, Turso, PlatformSandbox, E2B, Docker, Redis.
- GitHub App setup, Linear/Slack/Jira/GitLab/incident.io integrations.
- AWS Bedrock, GitHub Models (`GITHUB_TOKEN`), and other model providers.
- A full end-to-end Factory session (issue → plan → PR).
- RBAC, multiple users, LAN/tunnel exposure, production deployment.
- CI pipeline.

## Locked Decisions

### Product / Scope

- Scaffold with `npm create factory@latest . -- --no-platform` (or the documented equivalent targeting this directory) into the repo root. This repo is the Factory project. Target repos for agent work live elsewhere.
- Replace the existing root `README.md` with setup documentation. Keep `instructions.txt`.
- Use TypeScript and the generated project structure. Only the documented auth, storage, and sandbox wiring is changed.

### UX / Workflow

- Sign in to the Factory/Studio login screen with the Simple Auth admin token.
- Model provider: GitHub Copilot, connected after startup in **Settings → Models** through the Copilot browser/device sign-in, using the existing Copilot subscription. The default model pack is `github-copilot`. No code or env changes are needed. The README documents the steps.
- API clients send `Authorization: Bearer <token>`.

### Data / State / Ownership

- Storage is `LibSQLFactoryStorage` from `@mastra/libsql`, in the documented `src/mastra/storage.ts` module, with `vector = undefined`.
- `.env.example` sets `LIBSQL_URL=file:./data/factory.db`. The `data/` directory is created automatically at startup if it's missing.
- `data/` (the DB plus its journal/WAL files) is gitignored.
- The sandbox root is the documented default: `MASTRACODE_LOCAL_SANDBOX_ROOT`, falling back to `~/.mastracode/web/sandboxes`. It's created at startup if missing and stays outside the repo.

### Interfaces / Contracts

- Auth uses `SimpleAuth` from `@mastra/core/server`, passed to the `auth` option of `MastraFactory`.
- One admin user is built from the env:
  - `FACTORY_ADMIN_TOKEN` (required) is the token.
  - `FACTORY_ADMIN_NAME` (optional) is the display name.
- Sandbox: the documented explicit `LocalSandbox` callback in `src/mastra/sandbox.ts`, imported into `src/mastra/index.ts`, replacing the inline sandbox callback.
- No new HTTP API is defined, so no OpenAPI contract is needed.

### Operations / Deployment

- Package manager: npm.
- Port 4111 and `MASTRACODE_PUBLIC_URL=http://localhost:4111` (defaults). Both appear as commented examples in `.env.example`.
- `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is required. It's generated with `openssl rand -base64 32`, and `.env.example` holds a placeholder.
- Tests: Vitest with coverage, scoped to hand-written modules. Generated scaffold code is excluded. No CI workflow.

## Core Business Rules

- Fail fast at startup if `FACTORY_ADMIN_TOKEN` or `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is missing.
- No credentials or secrets are hardcoded. Secrets are never logged.
- Protected Factory endpoints require a valid Simple Auth token.

## UX / Workflow Rules

- Use the documented Factory sign-in flow through Studio auth. No custom login UI.

## Data / State / Ownership Decisions

- The SQLite DB under `data/` is the single source of persisted Factory state.
- The encryption key must stay paired with the DB. The README warns about this.
- Per-session sandbox working directories are `<sandbox root>/<sessionId>`.

## Interface / Contract Expectations

- Simple Auth default headers: `Authorization` (with or without `Bearer`) and `X-Playground-Access`.
- Default public/protected path patterns are unchanged.

## Operational / Deployment Constraints

- Local machine only. Node 25.4.0 and npm 11.7.0 are installed. Git must be installed for sandbox checkouts.
- `.gitignore` covers `.env`, `data/`, build outputs, `node_modules/`, and coverage output.
- Verification commands: `npm install`, typecheck, `npm test` with coverage, and `npm run dev` with curl auth checks. Also restart the server and confirm persistence, and run the standalone LocalSandbox check script.

## Assumptions

- The `--no-platform` scaffold can target the current non-empty directory, or can be generated into a temp dir and moved in without clobbering `instructions.txt` and `.git`.
- The generated project includes `@mastra/libsql` and the `MastraFactory` `auth`/`storage`/`sandbox` options, as documented.
- The relative `LIBSQL_URL` resolves against the project root when started via `npm run dev`. If the dev runner changes cwd, resolve it to an absolute path from the project root.
- `SimpleAuth` user objects (`id`, `name`) are enough for Factory's user handling.
- GitHub Copilot support in Factory is confirmed from the package source (`@mastra/code-sdk` 1.15.0: `githubCopilotOAuthProvider`, `github-copilot` pack), not from the Factory docs.
- Copilot credentials are saved encrypted in SQLite, which requires `FACTORY_CREDENTIAL_ENCRYPTION_KEY`.

## Open Questions

- Full Factory session through `LocalSandbox` (needs a GitHub App plus the GitHub Copilot sign-in): documented as a manual verification step and not performed. The user intends to set up a self-managed GitHub App later, as a separate effort.
- How GitHub App webhooks will reach the local server is undecided. Options: a smee.io relay, a tunnel (cloudflared/ngrok), or reconciliation polling only. Also needed later: the `GITHUB_APP_*` variables, the App permissions and events listed in the Factory GitHub docs, and a classic PAT for `gh` in the sandbox.

## Ready for Spec Generation

- Status: yes
- Reason: Scope, auth, storage, sandbox, env, testing, and verification decisions are locked. The remaining items are implementation-time assumptions and one explicitly deferred manual check. None of them require inventing policy.
