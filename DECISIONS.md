# Local Self-Hosted Mastra Factory Decisions

Status: Draft v1, amended by the user-approved local identity provider decision

Scope amendment: use a local identity provider that assigns every request the same local developer/admin identity without verifying credentials. No login, token, password, session storage, or external identity service is required. The Factory Server must remain bound strictly to `127.0.0.1`. This supersedes both the original Simple Auth requirement and the later `auth: null` approach, which the bundled UI rejects. The provider is not an access-control boundary; anything able to reach the server is treated as the local developer/admin. Compatibility is verified by the real browser regression test.

## Problem Summary

Set up a runnable, self-hosted Mastra Factory project on the local machine. It uses single-user loopback-only access with automatic local identity and no credential verification, local SQLite storage via libSQL, and `LocalSandbox`. No cloud services or Mastra platform resources. Source requirements: `instructions.txt`.

## Goals and Success Criteria

- The project installs with `npm install`.
- `npm run dev` starts the Factory Server locally without configuration errors at `http://localhost:4111`.
- Factory opens without credentials using a local identity provider, and the server listens only on `127.0.0.1`.
- The SQLite database is created automatically under `data/` and persists across restarts.
- `LocalSandbox` is selected, the sandbox root exists and is writable, and the sandbox check script runs a command through `LocalSandbox`.
- Typecheck and Vitest with coverage pass. Hand-written modules have at least 80% coverage.
- `README.md` documents prerequisites, install, env config, start commands, and verification steps.

## Primary Roles / Actors

- **Local developer/admin:** runs and opens the Factory Server locally without signing in.
- **Coding agent session:** runs commands in `LocalSandbox` on the local machine.

## Non-Goals

- Credential verification, login UI, external identity services, Mastra platform auth, PostgreSQL, Turso, PlatformSandbox, E2B, Docker, Redis.
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

- Open Factory directly without signing in; there is one local developer/admin.
- Model provider: GitHub Copilot, connected after startup in **Settings → Models** through the Copilot browser/device sign-in, using the existing Copilot subscription. The default model pack is `github-copilot`. No code or env changes are needed. The README documents the steps.
- Local API clients need no authentication headers.

### Data / State / Ownership

- Storage is `LibSQLFactoryStorage` from `@mastra/libsql`, in the documented `src/mastra/storage.ts` module, with `vector = undefined`.
- `.env.example` sets `LIBSQL_URL=file:./data/factory.db`. The `data/` directory is created automatically at startup if it's missing.
- `data/` (the DB plus its journal/WAL files) is gitignored.
- The sandbox root is the documented default: `MASTRACODE_LOCAL_SANDBOX_ROOT`, falling back to `~/.mastracode/web/sandboxes`. It's created at startup if missing and stays outside the repo.

### Interfaces / Contracts

- Pass a minimal local identity provider implementing the installed Mastra auth contract to `MastraFactory`; keep the Mastra server bound to `127.0.0.1`.
- Assign one fixed, non-secret identity (`local-admin`, display name `Local developer/admin`) independently of supplied headers, tokens, cookies, or query parameters. Authorize that identity through the upstream provider contract. User-approved compatibility addition: include the fixed organization ID `local`, required by Factory's project-list endpoint. Do not impersonate a hosted provider or add organization-management UI, provisioning, or membership management.
- `FACTORY_ADMIN_TOKEN` and `FACTORY_ADMIN_NAME` are not required or used. No login endpoints, session cookies, session storage, provider upgrades, new dependencies, or bundled-UI edits are planned.
- Before wiring the provider, check upstream capability/licensing requirements and identity-based storage scoping. Do not rename, migrate, delete, or silently hide existing developer data. If compatibility requires broader changes, stop and bring the decision back to the user.
- Sandbox: the documented explicit `LocalSandbox` callback in `src/mastra/sandbox.ts`, imported into `src/mastra/index.ts`, replacing the inline sandbox callback.
- No new HTTP API is defined, so no OpenAPI contract is needed.

### Operations / Deployment

- Package manager: npm.
- Port 4111 and `MASTRACODE_PUBLIC_URL=http://localhost:4111` (defaults). Both appear as commented examples in `.env.example`.
- `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is required. It's generated with `openssl rand -base64 32`, and `.env.example` holds a placeholder.
- Tests: Vitest with coverage, scoped to hand-written modules. Generated scaffold code is excluded.
- No CI workflow. Verification runs locally only, and `AGENTS.md` documents that.
- Storage tests run against a real local SQLite database in a temporary file. No mocks or fakes for storage.

## Core Business Rules

- Fail fast at startup if `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is missing, blank, or malformed.
- No credentials or secrets are hardcoded. Secrets are never logged.
- Requests are automatically assigned the local identity without credential verification and are accessible only through the loopback listener. Never expose the server through a proxy, tunnel, or LAN address. Local processes/users able to reach it can access its capabilities, including command execution.

## UX / Workflow Rules

- No Factory sign-in step, custom login UI, or token adapter.

## Data / State / Ownership Decisions

- The SQLite DB under `data/` is the single source of persisted Factory state.
- The credential encryption key must stay paired with the DB. The README warns about this.
- Session directories are `<sandbox root>/<sessionId>`.

## Interface / Contract Expectations

- Upstream Factory HTTP schemas remain unchanged. Its existing `/auth/me` reports the fixed local identity as authenticated, but this represents identity assignment, not proof of the caller's identity. Browser onboarding must load without sign-in; an HTTP 200 alone is insufficient.

## Operational / Deployment Constraints

- Local machine only. Node 25.4.0 and npm 11.7.0 are installed. Git must be installed for sandbox checkouts.
- `.gitignore` covers `.env`, `data/`, build outputs, `node_modules/`, and coverage output.
- Verification commands: `npm install`, typecheck, `npm test` with coverage, and `npm run dev` with unauthenticated curl checks. Also restart the Factory Server and confirm persistence, and run the sandbox check script.

## Assumptions

- The `--no-platform` scaffold can target the current non-empty directory, or can be generated into a temp dir and moved in without clobbering `instructions.txt` and `.git`.
- The generated project includes `@mastra/libsql` and the `MastraFactory` `auth`/`storage`/`sandbox` options, as documented.
- The relative `LIBSQL_URL` resolves against the project root when started via `npm run dev`. If the dev runner changes cwd, resolve it to an absolute path from the project root.
- GitHub Copilot support in Factory is confirmed from the package source (`@mastra/code-sdk` 1.15.0: `githubCopilotOAuthProvider`, `github-copilot` pack), not from the Factory docs.
- Copilot credentials are saved encrypted in SQLite, which requires `FACTORY_CREDENTIAL_ENCRYPTION_KEY`.

## Open Questions

- Full Factory session through `LocalSandbox` (needs a GitHub App plus the GitHub Copilot sign-in): documented as a manual verification step and not performed. The user intends to set up a self-managed GitHub App later, as a separate effort.
- How GitHub App webhooks will reach the local server is undecided. Options: a smee.io relay, a tunnel (cloudflared/ngrok), or reconciliation polling only. Also needed later: the `GITHUB_APP_*` variables, the App permissions and events listed in the Factory GitHub docs, and a classic PAT for `gh` in the sandbox.

## Ready for Spec Generation

- Status: yes
- Reason: Scope, auth, storage, sandbox, env, testing, and verification decisions are locked. The remaining items are implementation-time assumptions and one explicitly deferred manual check. None of them require inventing policy.
