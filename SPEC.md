# Product Specification

Source: `DECISIONS.md`

## Summary
- A local, self-hosted Mastra Factory project in this repo root (TypeScript, npm), used by one local developer/admin without signing in and bound strictly to `127.0.0.1`. A local identity provider assigns requests a fixed identity without verifying credentials. It uses local SQLite storage via `LibSQLFactoryStorage` under `data/`, `LocalSandbox` for agent execution, and GitHub Copilot as the model provider. No hosted Factory or database services.
- User-approved scope revision: a local identity provider replaces the original Simple Auth requirement and the subsequent `auth: null` approach, which the bundled UI rejects. This supplies identity, not access protection; browser compatibility is verified by the real-server Chromium test.

## Goals
- `npm install` succeeds, and `npm run dev` starts Factory at `http://localhost:4111` without configuration errors.
- Factory opens without signing in or configuring an admin token; requests receive the fixed local identity and the server binds only to `127.0.0.1`.
- Factory state is stored in `data/factory.db` and persists across restarts.
- `LocalSandbox` is selected, uses a session directory under the sandbox root, and can execute commands.
- GitHub Copilot can be connected in the UI with credentials stored encrypted.
- Typecheck and Vitest with coverage pass. Hand-written modules have at least 80% coverage.
- `README.md` documents prerequisites, install, env configuration, start commands, and verification steps.

## Non-Goals
- Credential verification, login UI, external identity services, Mastra platform auth, PostgreSQL, Turso, PlatformSandbox, E2B, Docker, Redis.
- General GitHub App provisioning or access to existing project repositories; Linear/Slack/Jira/GitLab/incident.io integrations.
- AWS Bedrock, GitHub Models (`GITHUB_TOKEN`), and other model providers.
- General end-to-end delivery beyond US-07's single disposable-repository pipeline test; automatic merge.
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

Authoritative state transition: Each request is assigned the same fixed local developer/admin identity through the provider contract, without credential verification or a persisted login session.

Slice boundary: Add a minimal local identity provider in `src/mastra/auth.ts`, implementing the installed upstream Mastra auth contract, and pass it to `MastraFactory` instead of `auth: null`. Keep the server explicitly bound to `127.0.0.1`, the encryption key required, and admin-token variables unused. Keep upstream HTTP schemas and bundled UI unchanged. Include the fixed organization ID `local`, required by upstream Factory project listing. No custom login UI, login endpoint, token adapter, organization-management UI or provisioning, or session storage is added.

Acceptance criteria:
- Startup succeeds without `FACTORY_ADMIN_TOKEN`; `FACTORY_CREDENTIAL_ENCRYPTION_KEY` remains required and is never logged.
- In a fresh browser context against a real server and temporary SQLite file, Factory renders its onboarding heading and enabled "Create my first factory" button without a sign-in redirect, credential form, or auth-configuration error.
- Factory HTML and an existing Factory API endpoint respond without credentials; the existing `/auth/me` reports `authenticated: true` with the fixed `local-admin` identity, organization ID `local`, and no token or session cookie.
- Missing or arbitrary authentication headers/cookies cannot select a different identity; the non-secret identity remains stable across provider instances and server starts.
- Existing developer data is not migrated, deleted, or silently made inaccessible by a change of identity scope. Inspect upstream scoping before implementation; any required compatibility change needs an explicit decision.
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
Status: done — the local developer/admin confirms the Copilot integration works and accepts this story as complete.

Primary actor: Local developer/admin

Trigger: The local developer/admin has opened the local Factory Server and has an active GitHub Copilot subscription.

Happy-path action: In **Settings → Models**, choose GitHub Copilot and complete the browser/device sign-in.

Visible outcome: Factory shows GitHub Copilot as connected, and its live models are selectable as personal and Factory defaults. User acceptance resolves the original model-pack wording in favor of the installed UI's individual-model selection; no named-pack UI is required.

Authoritative state transition: The Copilot credential is stored, encrypted with `FACTORY_CREDENTIAL_ENCRYPTION_KEY`, in the SQLite database.

Slice boundary: User-approved compatibility revision: add a reproducible, version-checked install-time patch for `@mastra/code-sdk@1.15.0` so its existing Copilot fallback catalog is available before sign-in. User-approved organization-admin revision: implement the installed upstream organizations-provider contract so only fixed user `local-admin` is administrator of existing organization `local`; reject all other user/organization IDs and do not provision or migrate data. User-approved catalog revision: use the selected personal/organization Copilot credential to fetch its live model catalog, reusing upstream token refresh and model filtering without server-global credential copying or cross-scope catalog sharing. Keep upstream HTTP schemas, bundled UI, credential checks, encrypted SQLite persistence, fixed identity IDs, and environment variables unchanged. Document personal and Factory-wide provider connection steps and keeping the encryption key paired with `data/`. Automated checks prove discovery and credential gating; actual GitHub sign-in and connection usability after restart remain manual acceptance checks.

Acceptance criteria:
- A clean install applies the compatibility patch idempotently and fails clearly on an unexpected SDK version or source shape.
- Before sign-in, the real Factory Settings → Your models and Factory models pages offer enabled GitHub Copilot sign-in buttons, but models are not usable without credentials. The existing provider endpoint reports organization-admin capability only for the fixed local identity, and organization credential operations succeed without changing personal credentials.
- The Copilot sign-in completes and the provider shows as connected.
- Personal and Factory model pickers show the live Copilot models allowed for their selected credential scope, not only the discovery fallback. Missing credentials never borrow another scope's catalog; upstream network-failure fallback and token-refresh behavior remain intact.
- After a Factory Server restart, the Copilot connection is still usable.
- No missing-encryption warning appears in the Factory Server logs.

Deferred follow-ups:
- US-06.

### US-06: Run a checkout-and-command smoke test in LocalSandbox
Status: done — the manual session recorded actual `git status` output on `factory/item-0682d782-7ac8-4783-8fc7-95667dd27ed3`; local inspection found a clean checkout at initial commit `d460b83`. Subsequent live GitHub checks confirmed the App installation selects only `TeroTS/factory-smoke-test`, `main` remains at `d460b83b2282bac0fa6eb32a9337956b70733dde`, and no pull requests exist. The user also confirmed live Sol execution after the routing fix in `5cccfc6`. Automated checks passed with 120 tests, 100% coverage, formatting, typecheck, and build; this did not test automated pipeline progression.

Primary actor: Coding agent session

Trigger: The local developer/admin manually starts a work item on the connected disposable private GitHub repository.

Happy-path action: Factory checks out the repository into a LocalSandbox session directory, and the agent runs `git status` there using the existing Factory-scoped GitHub Copilot connection.

Visible outcome: The session directory contains the repository checkout and the session displays actual command output, without code changes, commits, pushes, or pull requests from the smoke-test run.

Authoritative state transition: A session sandbox goes from not started to started with the checkout and command execution recorded for that coding agent session.

Slice boundary: Reuse the installed upstream GitHub App integration, connection UI, work-item flow, and LocalSandbox. GitHub App configuration is optional for ordinary startup but all-or-nothing when supplied, including a stable OAuth state secret. The user creates the App and enters secrets locally; the assistant implements wiring and tests without receiving secrets. Use one personal-account App installed only on `TeroTS/factory-smoke-test` (App slug `factory-example`). Keep loopback-only binding, existing identity IDs, encrypted SQLite, and Copilot credential scopes unchanged. Use manual start and upstream polling; no webhook delivery, relay, tunnel, custom API/UI, additional model provider, or classic PAT is required.

Acceptance criteria:
- Existing startup and Copilot functionality still work without GitHub App configuration.
- Partial/invalid App configuration fails fast with variable-specific errors that never print secret values.
- With complete valid configuration, the real local server reports the existing GitHub integration enabled, keeps its browser callback on loopback, and validates signed OAuth state. No repository access or paid provider calls are needed for automated startup checks.
- The user installs/connects only the selected disposable repository and manually starts the work item; the real checkout and Copilot `git status` output are observed in the session.
- The smoke test does not alter repository code, create commits, push, or open a pull request. An initial README commit created while provisioning the repository is allowed.
- Denied repository access, clone failures, or model failures do not count as success, and existing state/sandboxes are not silently deleted or re-scoped.
- Setup instructions are kept in focused GitHub setup documentation, not delivery tracking in README or AGENTS. Automated local checks preserve coverage; actual GitHub authorization and Copilot execution require human-assisted acceptance.

Deferred follow-ups:
- Code changes, commits, pushes, and pull requests remain outside US-06; US-07 separately authorizes one limited pipeline test. Webhook delivery and broader repository access remain out of scope.

### US-07: Run one automated file-to-PR pipeline test
Status: active — recovered-run attempt blocked in Building, not a clean unattended pass. The initial Responses `summaryParts` failure was fixed with the user-approved, tested install-time compatibility patch (143 tests, 100% coverage, formatting, typecheck, build). The first retry stopped on the planner's incorrect 29-byte assertion. The user then authorized one corrective message in the same Planning session: assert 30 bytes without changing the required content. The agent validated that correction and automatically transitioned to Building at `2026-10-22T21:38:52.681Z`; no manual stage advance or implementation occurred. Building's automatic kickoff encountered a missing suspended-run error, retried, then the agent reported missing editing/execution/transition tools and stopped. Its dispatcher decision says `succeeded`, but no implementation, self-review, commit, push, or PR resulted. Evidence and the local plan are retained; automation is off. A subsequently approved, tested install-time fix for `@mastra/core@1.79.0` now rechecks run liveness after asynchronous signal setup, preventing a reproduced tools/context-loss race; 167 tests and 100% coverage pass. No live workflow retry was made after that fix; the separate suspended-run error remains unresolved. US-07 remains unaccepted; details and verification are in `docs/slices/current-slice.md`.

Primary actor: Local developer/admin

Trigger: The developer/admin admits one test work item into the connected disposable repository's workflow after verifying permissions and enabling only the required upstream automation settings.

Happy-path action: Factory's configured rules start and advance the coding agent sessions through planning, implementation, validation, independent self-review, and pull request creation without manual session starts or chat follow-ups.

Visible outcome: One unmerged pull request adds only `PIPELINE_TEST.md` containing exactly `Factory pipeline test passed.` followed by a newline; recorded commands and workflow activity prove the automated work and review occurred.

Authoritative state transition: One accepted work item advances through automated run bindings to a reviewed branch and linked open pull request. The default branch remains unchanged; an open PR is not Done.

Slice boundary: Reuse the installed upstream UI, contracts, rules, polling, Copilot, encrypted SQLite, and LocalSandbox. Use only `TeroTS/factory-smoke-test`, one work item, and one PR. The developer/admin approves Contents and Pull requests read/write permissions on the existing App installation without broadening repository selection. Upstream non-bug acceptance remains required: if intake classifies this documentation task as non-bug, the human moves it into Planning once; this is a launch/acceptance gate, not a successful fully unattended intake test. Do not misclassify the task or patch away the gate. No new API, UI, provider, PAT, or orchestration engine is planned.

Acceptance criteria:
- Back up existing local storage before changing Factory state; preserve the database/key pair, identity, credentials, defaults, existing cards, and sessions.
- Verify the installation still selects only the disposable repository, effective write permissions are approved, and the default-branch SHA/PR baseline is recorded before triggering work.
- Inspect existing cards and automation policy before enabling factory-wide settings. Do not unintentionally run existing work; if isolation cannot be achieved with existing controls, stop for a decision rather than moving/deleting existing cards.
- Record the original settings. Enable auto-start, auto-approve plans, and self-review only for the test's isolated Factory; leave publish-review-checks off unless separately approved. Restore the changed settings after success, failure, or an unexpected retry loop.
- Trigger exactly one work item; after any required human acceptance into Planning, use no manual Start session or chat instructions to advance it. The user-approved corrective-message retry is explicitly a recovered-run exception, not evidence of a clean unattended pass.
- Actual tool records prove checkout, the exact file contents and single-file diff, successful validation, commit, push, independent self-review verdict for the pushed head, and creation of the one linked PR.
- The PR is left open and unmerged, with no auto-merge enabled; `main` remains at its recorded SHA. Subsequent polling produces no duplicate work items, sessions, commits, or PRs.
- Permission errors, clone/model/validation/review failures, and approval gates are visible, retain evidence, and do not count as success. Agent summaries or board movement alone are insufficient.
- Live GitHub/Copilot execution is a human-assisted acceptance check, not an automated test using developer credentials. Any authored runtime change discovered to be necessary requires regression tests and existing coverage standards; stop before changing contracts or bypassing upstream policy.

Deferred follow-ups:
- A separate failing-validation/retry scenario after the first successful run; do not add a second test card in this slice.
- Fully unattended non-bug intake, merge/deployment, broader repository access, webhooks/tunnels, and production readiness.

## Open Questions
- US-07 is blocked on human approval of the App's Contents and Pull requests write permissions. Verify whether existing controls can isolate the test without affecting the existing manual smoke-test card.
