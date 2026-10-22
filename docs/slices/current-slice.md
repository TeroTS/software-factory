# Current Slice

Status: active

## Slice Goal

- A coding agent session checks out the disposable GitHub repository in LocalSandbox and displays Copilot's actual `git status` output.

## Slice Boundary

- On a manually started work item, one coding agent session moves from no sandbox checkout to a started LocalSandbox containing the repository and actual command output; no code edits, commits, pushes, or pull requests.
- Implement only US-06 using the installed upstream GitHub integration and existing UI/contracts. Keep local identity, encrypted SQLite, separate model credentials, and loopback-only binding unchanged.

## Stories In Scope

- `US-06 Run a checkout-and-command smoke test in LocalSandbox`

## Stories Completed In This Slice

## Stories Remaining In This Slice

- `US-06 Run a checkout-and-command smoke test in LocalSandbox`

## Contract Inputs

- Upstream `GithubIntegrationConfig`, `MastraFactoryConfig.stateSecret`, GitHub connection/OAuth routes, work-item/session contracts, and shared LocalSandbox callback. No authored HTTP API or schema change.
- Upstream GitHub polling is enabled by default; webhook signing is absent and deliveries are rejected without a webhook secret.

## Decision Inputs

- `DECISIONS.md`: Product / Scope, Interfaces / Contracts, Operations / Deployment, and human-owned App creation/credential entry.

## Shared State Required Now

- Existing database/encryption key, fixed `local-admin` / `local` identity, and Factory-scoped Copilot connection.
- User-selected private repository `https://github.com/TeroTS/factory-smoke-test`, verified to have default branch `main`; GitHub App slug `factory-example`. The App's public metadata query returned 404, which may reflect private visibility; do not change visibility or assume credentials are invalid.
- Optional complete App configuration and a separate stable OAuth state secret. User enters all secret values directly into local `.env`; never print, overwrite, or request them in chat.

## Operations / Endpoints / Surfaces In This Slice

- Optional GitHub environment parsing/validation under `src/mastra/github/`, reused by predev and the runtime entry.
- Implemented optional upstream GithubIntegration and stable state-secret wiring in the runtime entry; startup without GitHub is preserved. Validation is reused by predev and runtime, including native Node's explicit `.ts` import requirement.
- Existing `/web/github/status`, `/auth/github/connect`, `/auth/github/callback`, connection UI, polling, and work-item/session surfaces; no new endpoints or UI.
- `.env.example` lists the six optional values; `docs/github-setup.md` covers credential entry, installation, and the command-only check. Existing `.env`, database, GitHub resources, and the user's untracked files were not changed.
- The user supplied credentials locally and completed GitHub authorization after setting the App callback URL to `http://localhost:4111/auth/github/callback`. The real server reported `connected: true`, and the UI listed the selected private repository on `main`. The existing database and `.env` were backed up privately before startup; no secrets were displayed. The development server was stopped for build verification.

## Tests Required

- Passed: 21 unit checks for absent/blank optional configuration, complete configuration, missing fields, invalid App ID/private key/state secret, supported PEM formatting, and secret-free errors. Regression tests first failed for missing validation; the empty flattened PEM case also failed before normalization errors were handled safely.
- Passed: real predev rejects partial configuration before creating storage. Real temporary server/SQLite startup with synthetic valid credentials reports GitHub enabled, uses a loopback callback and verifiable signed state, rejects invalid state, and rejects webhook requests without calling GitHub.
- Passed: `./scripts/verify` on Node 22.22.3: formatting, typecheck, 101 tests, 100% statements/branches/functions/lines coverage, and build. Existing browser/restart, credential scope, storage, and sandbox checks remain green. Hosted CI was not run.
- Passed: human-assisted manual smoke test on work item `Test flow` (`0682d782-7ac8-4783-8fc7-95667dd27ed3`). The session's expanded command record showed `$ git status` and the actual output below. Local checkout inspection confirmed a clean working tree, HEAD at initial commit `d460b83`, and zero commits beyond the locally recorded remote refs.
- Model limitation observed during the smoke test: `gpt-6.1-sol` failed because it is not accessible through `/chat/completions`. The successful turn used Factory-shared Copilot with Claude Sonnet 5.5. See the user-approved routing follow-up below; a live Sol turn remains unverified.
- Latest verification before commit `e2fde59`: formatting, typecheck, and 101 tests passed with 100% statements/branches/functions/lines coverage. Build was initially blocked by the running dev server; after stopping it, the build attempt timed out. No further tests were run after the user requested commit/push without tests. The earlier successful full verification remains historical, not evidence that this latest build completed.
- User-approved Copilot routing follow-up: the pinned SDK always chose Chat Completions despite retaining supported endpoints in its live catalog. The existing version/source-checked, idempotent install-time patch now uses the installed OpenAI Responses adapter only when the selected credential's catalog advertises `/responses` without `/chat/completions`. Other entries and catalog-failure fallback keep the existing Chat Completions route; no model IDs, defaults, or credential scopes are changed. Responses requests reuse upstream OAuth refresh, Copilot headers, per-token host resolution, cancellation, and unauthorized-response handling, set `store: false`, and classify tool-result follow-ups as agent requests.
- Routing verification: the regression first reproduced the endpoint error against a remote-HTTP double with real encrypted temporary SQLite and upstream scoped credentials. After the patch, formatting, typecheck, 120 tests with 100% statements/branches/functions/lines coverage, and build passed on Node 22.22.3. Tests cover generate/stream routing, tool conversion and follow-ups, personal/Factory separation, missing credentials, refresh, catalog failure, authentication errors, cancellation, source drift, and idempotency. `npm run postinstall` reapplied the authored patch; no installed artifact was edited manually. No live Sol request or hosted CI run was performed.
- Remaining acceptance checks: remote push/PR activity and exact installation repository scope were not independently checked. Keep the slice active pending these checks; the manual smoke test did not exercise an automated delivery pipeline.

## Not Now

- Webhooks, relays, tunnels, production deployment, organization-owned GitHub resources, broad repository access, code changes, commits, pushes, PRs, and additional stories.
- No developer credentials in automated tests; no classic PAT, global credential copying, identity migration, new login, or GitHub resource deletion.

## Done When

- Configuration/startup checks and full verification pass without changing existing data or lowering coverage.
- The local developer/admin completes the real GitHub/Copilot flow and verifies the checkout and harmless command output in the coding agent session.
- Failures are actionable and secret-free; loopback-only access and repository scope remain intact.

## Completion Summary

Manual checkout-and-command smoke test passed. The Activity entry alone did not start an agent turn; the user sent the instruction in the coding agent session. The retained checkout is at `~/.mastracode/web/sandboxes/0402259c-076a-46e4-8771-c555f495b5b0/factory-smoke-test`.

Observed command output:

```text
On branch factory/item-0682d782-7ac8-4783-8fc7-95667dd27ed3
nothing to commit, working tree clean
```

No tracked/untracked changes or new local commits were found. Remote push/PR activity was not checked. Planning, implementation, review, and automated pipeline progression were not exercised.

## Next Slice Recommendation
