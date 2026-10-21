# Product Specification

Source: `DECISIONS.md`

## Summary
- A local, self-hosted Mastra Factory project in this repo root (TypeScript, npm), used by one local developer/admin without authentication and bound strictly to `127.0.0.1`. It uses local SQLite storage via `LibSQLFactoryStorage` under `data/`, `LocalSandbox` for agent execution, and GitHub Copilot as the model provider. No cloud services.
- User-approved scope revision: single-user loopback-only access replaces the original Simple Auth requirement.

## Goals
- `npm install` succeeds, and `npm run dev` starts Factory at `http://localhost:4111` without configuration errors.
- Factory opens without signing in or configuring an admin token; authentication is explicitly disabled and the server binds only to `127.0.0.1`.
- Factory state is stored in `data/factory.db` and persists across restarts.
- `LocalSandbox` is selected, uses a session directory under the sandbox root, and can execute commands.
- GitHub Copilot can be connected in the UI with credentials stored encrypted.
- Typecheck and Vitest with coverage pass. Hand-written modules have at least 80% coverage.
- `README.md` documents prerequisites, install, env configuration, start commands, and verification steps.

## Non-Goals
- Authentication/login UI, Mastra platform auth, PostgreSQL, Turso, PlatformSandbox, E2B, Docker, Redis.
- GitHub App setup, Linear/Slack/Jira/GitLab/incident.io integrations.
- AWS Bedrock, GitHub Models (`GITHUB_TOKEN`), and other model providers.
- A full end-to-end Factory session (issue → plan → PR).
- RBAC, multiple users, LAN/tunnel exposure, production deployment.
- CI pipeline.

## User Stories

### US-01: Start the local Factory Server
Primary actor: Local developer/admin

Trigger: The local developer/admin has cloned the repo, run `npm install`, and copied `.env.example` to `.env` with the required values filled in.

Happy-path action: Run `npm run dev`.

Visible outcome: The Factory Server logs its local URL, and `http://localhost:4111` responds.

Authoritative state transition: Factory Server goes from not running to running with the validated local configuration.

Slice boundary: Scaffold with `npm create factory@latest` `--no-platform` into the repo root, keeping `.git` and `instructions.txt`. Add env validation for `FACTORY_CREDENTIAL_ENCRYPTION_KEY`, `.env.example`, `.gitignore`, the Vitest + coverage setup, and the README sections for prerequisites, install, env configuration, and start. Unit tests cover env validation.

Acceptance criteria:
- `npm install`, typecheck, and `npm run dev` succeed with a valid `.env`, and `http://localhost:4111` responds.
- Startup fails fast with a clear error naming the missing variable when `FACTORY_CREDENTIAL_ENCRYPTION_KEY` is unset. Secret values are never logged.
- `.env.example` lists every required variable with a safe placeholder. It shows `PORT` and `MASTRACODE_PUBLIC_URL` as commented defaults, and the README gives `openssl rand -base64 32` for generating the key.
- `.gitignore` covers `.env`, `data/`, build outputs, `node_modules/`, and coverage output.
- No secrets are hardcoded in source.

Deferred follow-ups:
- US-02, US-03, US-04, US-05.

### US-02: Open Factory locally without signing in
Primary actor: Local developer/admin

Trigger: The Factory Server is running and the local developer/admin opens its loopback URL.

Happy-path action: Open Factory without supplying credentials.

Visible outcome: Factory content and API responses load without a login step.

Authoritative state transition: The local request completes without establishing an authenticated identity or session.

Slice boundary: Keep `auth: null` in `MastraFactory` and bind the server explicitly to `127.0.0.1`. Remove the unused admin-token requirement from environment validation and setup documentation. No custom login UI, token adapter, or new HTTP API is added.

Acceptance criteria:
- Startup succeeds without `FACTORY_ADMIN_TOKEN`; `FACTORY_CREDENTIAL_ENCRYPTION_KEY` remains required and is never logged.
- Factory HTML and an existing Factory API endpoint respond without credentials; the upstream auth status reports authentication disabled.
- The server listens only on `127.0.0.1`, not LAN or wildcard addresses.
- The README warns against proxies, tunnels, and LAN exposure and explains that local processes/users able to reach the server can access its capabilities, including command execution.

Deferred follow-ups:
- None.

### US-03: Factory data persists across restarts
Primary actor: Local developer/admin

Trigger: The local developer/admin has created Factory data, such as a Factory in the UI, and restarts the Factory Server.

Happy-path action: Stop the Factory Server and run `npm run dev` again.

Visible outcome: The previously created Factory data is still listed after restart.

Authoritative state transition: Factory state is persisted in the SQLite file at `LIBSQL_URL` (default `file:./data/factory.db`) and reloaded on startup.

Slice boundary: The documented `src/mastra/storage.ts` with `LibSQLFactoryStorage` and `vector = undefined`, imported into `src/mastra/index.ts`. `data/` is created automatically when missing, and the DB path resolves against the project root. The README adds a persistence verification section. Tests cover directory creation and path resolution. They also cover a write/reopen/read round trip through `LibSQLFactoryStorage` against a real temporary SQLite file, with no mocks or fakes.

Acceptance criteria:
- On a first run with no `data/` directory, the directory and `factory.db` are created automatically.
- Data created before a restart is present after the restart.
- The DB and its journal/WAL files are ignored by Git.
- If the storage location can't be created or written, startup fails with a clear error.

Deferred follow-ups:
- None.

### US-04: Run a command in LocalSandbox
Primary actor: Local developer/admin

Trigger: The local developer/admin wants to confirm local sandbox execution works.

Happy-path action: Run the standalone sandbox check script (an npm script). It uses the same `LocalSandbox` configuration as Factory and runs `git --version` in a session directory.

Visible outcome: The script prints the command output and the session directory under the sandbox root.

Authoritative state transition: A session directory `<sandbox root>/<sessionId>` is created and a command runs there on the local machine.

Slice boundary: The documented `src/mastra/sandbox.ts` `LocalSandbox` callback, imported into `src/mastra/index.ts` in place of the inline sandbox callback. The root is `MASTRACODE_LOCAL_SANDBOX_ROOT`, falling back to `~/.mastracode/web/sandboxes`, and is created when missing. The sandbox check script uses that same callback. The README adds a sandbox verification section. Unit tests cover root resolution and creation.

Acceptance criteria:
- The sandbox check script exits 0 and prints the `git --version` output.
- The sandbox root is created if missing and is writable. The script fails with a clear error if it isn't.
- Factory uses the explicit `LocalSandbox` callback and selects no remote provider.
- Hand-written modules (storage, sandbox, env validation) have at least 80% test coverage.

Deferred follow-ups:
- US-06.

### US-05: Connect GitHub Copilot as the model provider
Primary actor: Local developer/admin

Trigger: The local developer/admin has opened the local Factory Server and has an active GitHub Copilot subscription.

Happy-path action: In **Settings → Models**, choose GitHub Copilot and complete the browser/device sign-in.

Visible outcome: Factory shows GitHub Copilot as connected, and the `github-copilot` model pack is selectable as the default.

Authoritative state transition: The Copilot credential is stored, encrypted with `FACTORY_CREDENTIAL_ENCRYPTION_KEY`, in the SQLite database.

Slice boundary: No code or env changes. The README adds the connection steps and a warning to keep the credential encryption key paired with `data/`. Verified manually.

Acceptance criteria:
- The Copilot sign-in completes and the provider shows as connected.
- After a Factory Server restart, the Copilot connection is still usable.
- No missing-encryption warning appears in the Factory Server logs.

Deferred follow-ups:
- US-06.

### US-06: Run a full Factory session in LocalSandbox (deferred)
Primary actor: Coding agent session

Trigger: A work item is started on a connected GitHub repository.

Happy-path action: Factory checks out the repository into a LocalSandbox session directory and the agent runs commands there using GitHub Copilot.

Visible outcome: The session directory contains the repository checkout, and the session shows command output.

Authoritative state transition: A session sandbox goes from not started to started, with the checkout in `<sandbox root>/<sessionId>`.

Slice boundary: This needs a GitHub App configured with `GITHUB_APP_*` variables, which is currently a non-goal. Documented as a manual verification step only.

Acceptance criteria:
- The README documents the manual steps and their prerequisites.
- Not performed in this delivery.

Deferred follow-ups:
- None.

## Open Questions
- US-06 is deferred until a self-managed GitHub App is set up later.
- Webhook delivery to the local server for that App is undecided: a smee.io relay, a tunnel, or reconciliation polling only.
