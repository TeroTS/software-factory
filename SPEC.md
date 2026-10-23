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
- General end-to-end delivery beyond US-07's pipeline test and US-08's deterministic label-based intake; automatic merge.
- Dependency scheduling and GitHub edit-history reconstruction.
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

Status: done — the local developer/admin confirms the pipeline is working and explicitly accepts and closes US-07. Acceptance is based on the recovered independent-review-to-PR outcome and verified issue-backed completion. The user accepts the documented recovery, card-replacement, polling-verification, and later merge qualifications; this does not claim a clean unattended original-card run. Earlier status statements below are retained as historical observations.

Earlier original-card outcome: partially recovered run blocked at independent self-review, not a clean unattended pass. Following the tested Responses and session-handoff compatibility fixes and the approved 29 → 30-byte assertion correction, the latest user-authorized retry resumed the same Building card/session. The agent validated the unchanged exact content, committed/pushed `aacb75fee0c87017673d1502e2b099c55472b500` adding only `PIPELINE_TEST.md`, and automatically transitioned to Review at `2026-10-22T22:12:38.413Z`. Automatic self-review then encountered another missing suspended-run error and stopped under its role guard: the latest phase snapshot still said builder (`role: work`), despite an active review binding. No independent verdict or PR exists; dispatcher `succeeded` is not acceptance. Read-only live GitHub checks confirm exactly 30 bytes, one added file/commit, and unchanged `main`; automation is off and normal polling restored. No manual stage advances or implementation by the observer occurred. Prior automated verification remains 167 tests and 100% coverage; no suite rerun during this live retry. US-07 remains unaccepted; full history/evidence is in `docs/slices/current-slice.md`.

Follow-up: the user enabled auto-start, auto-approve plans, and self-review and created a separate card, `ff4d97ec-5085-4443-870e-92294445ad7a`. Its reviewer phase is correct, but the agent reports a missing verdict tool. An isolated regression reproduced stale builder tools during active handoff; the authorized version-checked dispatcher compatibility fix now waits for a fresh reviewer run without widening tools or bypassing policy. The final 18 targeted checks and typecheck pass. An earlier full run passed 184 tests with 100% coverage. The final verbose rerun records 184 passing cases with the remaining startup/browser case interrupted by the 120-second outer limit, before its existing 300-second test deadline; final full coverage remains unverified. A bounded diagnostic subsequently traced three successful server generations and advancing browser/model checks before a fourth startup at about 90 seconds, supporting cumulative real startup/shutdown time rather than a frozen browser operation; no longer timeout or retained test change was used. Following an authorized database/key backup and brief server stop, build passed and the loopback server was restarted with unchanged card/settings. Live acceptance remains pending; no live retry or verdict was supplied. Automation remains enabled at the user's request; publish-review-checks stays off. This does not establish the cause of the original missing-suspended-run failure or accept US-07.

Verification and first authorized follow-up (2026-10-23): the unchanged startup/browser test completed in 105.232 seconds under its existing 300-second deadline using Node `22.19.0`. Formatting, explicit AGENTS formatting, typecheck, and the final full suite pass: 185 tests, 100% statements/branches/functions/lines coverage. The prior build pass remains applicable; no application changes were made. After a fresh SQLite/key backup and successful read-only GitHub preflight, exactly one recovery dispatched `factory-self-review` for existing card `ff4d97ec-5085-4443-870e-92294445ad7a`. Its fresh Review phase was correct, but sandbox Git authentication failed during remote inspection. The reviewer stopped without a verdict or PR; dispatcher `succeeded` is not acceptance. Final independent GitHub checks confirm the unchanged pushed head `aba78f81ab471a18f4ea5806ef025b429b19eb0b`, exact single-file/30-byte diff, baseline `main`, and zero PRs. Card remains Review revision 8 with no verdict; no new card, second recovery, manual stage advance, or credential/application change occurred. Existing user-enabled automation remains `(on, on, on, off)`. US-07 remains blocked and unaccepted; details are in the slice note.

Latest authorized recovery (2026-10-23): backed up SQLite/key state and rechecked the selected repository, permissions, branch, and zero-PR baseline, then dispatched exactly one further recovery of the same current card. Its first tool call, `github_refresh_token`, succeeded; actual sandbox Git authentication subsequently worked. Independent review inspected and tested the unchanged pushed head `aba78f81ab471a18f4ea5806ef025b429b19eb0b`, then recorded an authenticated `approve` verdict with its actual test report at `08:34:44.713Z`. The normal governed builder handoff opened [PR #1](https://github.com/TeroTS/factory-smoke-test/pull/1) at `08:35:30Z`, after the verdict, from that exact head. GitHub verifies one commit adding only the exact 30-byte `PIPELINE_TEST.md`; `main` is unchanged, the PR is open/unmerged, and auto-merge is off. Factory automatically linked the PR to the existing session. No new card, file edits, commits, pushes, stage advances, application changes, or observer-authored verdict occurred. Card remains Review revision 10; user-enabled automation/settings/default scope and `.env` are unchanged. Two completed hourly polling cycles have not been verified; the recovered outcome does not establish a clean unattended US-07 pass or prove why the earlier live token was rejected.

Separate user merge observation (2026-10-23): the user subsequently merged PR #1 at `09:04:49Z`; GitHub confirms merge/new `main` commit `fa9b3796eefaf6e9d782dbe8291eb2597e10cd3a` and exact marker bytes. This extends beyond the original unmerged/unchanged-main test boundary. At `09:08:41Z`, Factory still shows the local Work card in Review revision 10. Installed polling only considers externally sourced PR cards; this local card has no external source, and session PR linkage alone does not qualify it. No manual stage change or application fix was made. The recovered review-to-PR evidence stands, but automatic merge-to-Done was not achieved on this local-card path; details are in the slice note.

User-approved issue-backed follow-up (2026-10-23): separately authorize exactly one new smoke-test GitHub issue in `TeroTS/factory-smoke-test`, created through the local developer/admin's existing GitHub CLI account rather than the App bot. The task adds only `ISSUE_PIPELINE_TEST.md` containing `Factory issue pipeline test passed.` followed by one newline, preserving the existing marker and other files. Observe normal one-minute issue ingestion, external issue identity, required acceptance gates, implementation, independent reviewed-head approval, and one PR with `Closes #<issue number>`. Leave merging to the user; no auto-merge, default-branch edits, new provider/PAT, synthetic events, manual implementation/verdict, or application change is authorized. Existing cards/sessions/settings/credentials remain intact; back up the database/key pair first. This is an explicitly approved additional live test, not retroactive acceptance of the original single-local-card run. If upstream policy requires human acceptance, stop at that gate and report it rather than bypassing it. Status: issue created/imported; awaiting human acceptance into Planning. Backed up SQLite/key privately at `~/.factory-issue-test-backup.2fkoowi3/`; preflight verified selected repository/write permissions, baseline `main` `fa9b3796eefaf6e9d782dbe8291eb2597e10cd3a`, no existing issues, and only previously merged PR #1. Created [issue #2](https://github.com/TeroTS/factory-smoke-test/issues/2) as human `TeroTS` at `09:26:56Z`; issue polling materialized Work card `095a0075-a3c3-4c5d-bde5-127b3604c2be` at `09:27:50Z` with external type `issue`, repository-scoped issue identity, and trusted-author metadata. At `09:29:00Z` it remains in Intake revision 2 with no session/acceptance and no new PR. Requested that the user move this maintenance card to Planning once; no stage was forced, session started, or model kickoff sent. Original card, `.env`, defaults/scopes, and settings are unchanged. Actual required content length is 36 bytes; implementation/review/PR linkage remain unverified.

Issue-backed follow-up outcome (2026-10-23): user reports the PR merged, issue closed, and task automatically Done; read-only checks confirm [PR #3](https://github.com/TeroTS/factory-smoke-test/pull/3) contains `Closes #2`, changes only `ISSUE_PIPELINE_TEST.md`, and was created at `09:44:30Z` from reviewed head `fe65ce26d330a7563915a30fe98ae2281e5d06a8`, after authenticated reviewer approval at `09:44:03.602Z`. The user merged it at `09:46:10Z`; GitHub closed issue #2 at `09:46:12Z`. Issue reconciliation automatically transitioned the corresponding Work card to Done at `09:46:50.828Z`, about 39 seconds after issue closure. The observed working chain is PR closing reference → GitHub issue closure → issue reconciliation → Work card Done; no PR-card eligibility patch was needed. The successful current card is `a22fb994-8637-4939-8cd6-d46a55d90441`, not the initially observed imported card; intervening card replacement was not observed by the assistant. A separate triage decision for the earlier card remains failed with `run_terminal_event_missing`; therefore this verifies issue-backed completion, not a completely failure-free/uninterrupted original-card run. No application fix, manual Done transition, retry, or state edit was made by the assistant during this observation.

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

### US-08: Automatically accept approved generated tickets

Status: done — label-based auto-approval and the minimal `to-tickets` update are implemented and verified. Formatting, typecheck, and all 253 automated tests pass with 100% statements/branches/functions/lines coverage. The initial `./scripts/verify` build block was resolved in a user-authorized, backed-up stop/build/restart window; build passed and Factory is again bound to `127.0.0.1:4111`. Read-only checks confirm preserved configuration/key, credentials, model defaults, settings, and existing card state. The maintenance window triggered no live ticket. The user subsequently approved publication and automatic implementation of [test issue #4](https://github.com/TeroTS/factory-smoke-test/issues/4); its complete body was verified before `factory-approved` was applied last. The developer/admin subsequently confirmed that the live test worked; US-08 live end-to-end acceptance is recorded on that report, without separate assistant verification of the resulting PR or merge state. Separate from completed US-07.

Primary actor: Local developer/admin

Trigger: A complete, independent GitHub ticket is imported or its labels change in the selected repository.

Happy-path action: Explicitly authorize implementation when approving tickets in `.agents/skills/to-tickets`. The skill publishes complete independent tickets with `ready-for-agent` and applies `factory-approved` last. Factory evaluates these signals through existing polling/reconciliation without manual label application, per-ticket CLI confirmation, or board acceptance clicks.

Visible outcome: An eligible ticket moves Intake → Planning automatically, without a Triage run. Existing automation governs implementation and independent reviewed PR creation; merging stays manual.

Authoritative state transition: A deterministic system policy records the observed approval labels and commits Intake → Planning once through the normal transition service, without impersonating a human transition.

Slice boundary: Label-based auto-approval for complete, independent tickets in `TeroTS/factory-smoke-test`. Reuse upstream ingestion, polling, planning, implementation, independent review, storage, and LocalSandbox. Preserve ordinary manual acceptance, existing sessions/settings/credentials, loopback binding, and manual merging. Include the minimal `.agents/skills/to-tickets/SKILL.md` change to obtain implementation authorization and apply the exact approval labels after successful publication. No local authorization command, new HTTP API/UI, provider, repository access, dependency scheduler, or unrelated publishing improvement is included. This plan update does not authorize live publication or execution.

Acceptance criteria:

- Automatic acceptance requires an open issue in Intake in the allowed repository, both exact labels `ready-for-agent` and `factory-approved`, and nonempty What to build and Acceptance criteria sections. Issue authorship or publication alone never authorizes execution; `ready-for-agent` alone is insufficient.
- `.agents/skills/to-tickets/SKILL.md` explicitly asks whether to authorize Factory implementation and reviewed PR creation, excluding merge. After authorization it ensures exact repository labels `ready-for-agent` and `factory-approved` exist, publishes each complete independent ticket with `ready-for-agent`, verifies successful publication, then applies `factory-approved` last using the existing GitHub account. No manual label application is required. Publish-only, absent/declined implementation authorization, or failed/incomplete publication omits `factory-approved`; publishing or approving the breakdown alone is not implementation authorization.
- Applying `factory-approved` explicitly authorizes implementation and reviewed PR creation, not merging. For this single-user MVP, trust the current labels fetched from GitHub in the allowed repository; do not fetch label-event provenance or verify the label actor, publisher, or issue author. Anyone able to apply the approval label there can authorize agent execution on the local machine. Approval-actor verification is deferred.
- Conflicting `factory-approved` and `needs-triage` labels, incomplete bodies, or unavailable required GitHub evidence leave the ticket in Intake with a visible correction reason. Tickets outside the automatic-approval route retain the existing manual flow; no automatic Triage route is added in this MVP.
- Only independent tickets are supported. The developer/admin checks prerequisites before applying `factory-approved`; Factory does not verify native blockers or automatically release dependent work in this MVP. Do not treat this as a dependency scheduler.
- Approval applies to the published ticket; finish edits before applying `factory-approved`. Remove approval before further Intake edits and reapply after reviewing them. Historical edit reconstruction and automated approval invalidation are deferred; the MVP does not claim to detect all post-approval edits. Record the current title/body and approval evidence at acceptance. Post-acceptance changes retain existing governed handling.
- Record observed labels, repository/issue identity, current ticket content, policy decision, and actual system acceptance/transition. No approval actor or label-event history is required. Use the existing transition service, never human actor spoofing or direct SQL acceptance writes. Ordinary non-bug tickets retain their existing manual acceptance gate.
- Existing automation settings govern downstream runs; label approval must not silently enable settings, change defaults, bypass independent review, or authorize merging.
- Repeated/concurrent polls and restart cannot duplicate acceptance or Planning kickoff. A crash between acceptance and dispatch must not permanently lose normal kickoff; reuse existing durable mechanisms. Failures retain evidence and a visible reason without duplicate-work retry loops.
- Automated tests cover eligible routing, missing/partial/conflicting labels, the same eligibility regardless of label actor or issue author, wrong repository, incomplete bodies, unavailable GitHub data, audited system acceptance, unchanged manual gates, concurrent polling, and restart/recovery. Integration tests use real temporary SQLite and runnable Factory boundaries; only remote GitHub/model calls may be doubled.
- An explicit end-to-end test imports a complete fixture issue through the GitHub fixture, applies both labels without actor-provenance reads, and observes the real loopback Factory Server automatically exposing Planning plus approval/acceptance evidence without a CLI confirmation or board click. With auto-start enabled in the isolated fixture, verify exactly one normal Planning kickoff, including after repeated polls and restart. Remote model execution may be doubled; do not claim this replaces live Copilot acceptance.
- Run `./scripts/verify`; maintain at least 80% statements, branches, functions, and lines without decreasing existing coverage. Reports remain `coverage/index.html` and `coverage/lcov.info`. Live GitHub/Copilot acceptance requires separate authorization, backup of the database/key pair, and isolation from existing work.

Implementation plan:

1. Establish current label/body retrieval and the smallest audited system-acceptance extension. Do not add label-event history or actor-verification reads. The installed transition service rejects non-human acceptance; prefer a supported extension, otherwise define a narrowly scoped, version-checked compatibility change without weakening ordinary gates.
2. Define the minimal non-HTTP label-policy/evidence/acceptance contract in `docs/contracts.md` before runtime changes, including the single-user repository-label trust assumption, visible rejection reasons, duplicate suppression, and kickoff recovery. If changed HTTP surfaces prove necessary, stop for reviewed OpenAPI YAML and generated contracts/client first.
3. Update `.agents/skills/to-tickets/SKILL.md` for explicit implementation authorization, exact labels, and approval-last publication. Test authorized, publish-only, and incomplete/failed publication flows against the same intake contract; preserve unrelated tracker/local-file behavior without adding features.
4. Add failing policy and real-boundary tests, implement deterministic label-based reconciliation and audited system acceptance, then run `./scripts/verify`. The end-to-end fixture must exercise the publisher's authorized labeled output through Factory intake. Document labels, approval meaning, independent-ticket scope, and edit-before-approval/manual-merge limits.

Deferred follow-ups:

- Approval-label actor/provenance verification, native dependency scheduling, historical edit reconstruction and automated approval invalidation, and automatic Triage routing.
- Unrelated basic ticket-publication improvements; only the required `to-tickets` authorization/approval-label wiring is included.
- Semantic ambiguity detection, automatic merge, new tracker integrations, local-file intake, and broader repository access.

## Open Questions

- US-08: confirm current label/body retrieval and the smallest audited system-acceptance extension with durable duplicate suppression/kickoff recovery. Actor/provenance checks, native blocker verification, and historical edit reconstruction remain deferred; the single-user MVP explicitly trusts approval labels in the allowed repository. Any changed HTTP surface requires reviewed OpenAPI-first artifacts.
- None for US-07: the developer/admin explicitly accepted and closed the story; historical qualifications remain documented above.
