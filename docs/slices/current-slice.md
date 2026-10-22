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
- Next: the user fills all six values in their existing `.env`, including `GITHUB_APP_SLUG=factory-example`, without sharing secrets. Then start the loopback server and complete the real App install/connect and smoke test. No live App credentials were used and no development server was left running.

## Tests Required

- Passed: 21 unit checks for absent/blank optional configuration, complete configuration, missing fields, invalid App ID/private key/state secret, supported PEM formatting, and secret-free errors. Regression tests first failed for missing validation; the empty flattened PEM case also failed before normalization errors were handled safely.
- Passed: real predev rejects partial configuration before creating storage. Real temporary server/SQLite startup with synthetic valid credentials reports GitHub enabled, uses a loopback callback and verifiable signed state, rejects invalid state, and rejects webhook requests without calling GitHub.
- Passed: `./scripts/verify` on Node 22.22.3: formatting, typecheck, 101 tests, 100% statements/branches/functions/lines coverage, and build. Existing browser/restart, credential scope, storage, and sandbox checks remain green. Hosted CI was not run.
- Pending human-assisted end-to-end acceptance after credentials are supplied: install/connect only the selected repository, manually start the work item, observe the checkout and actual Copilot command output, and verify no code changes/commits/pushes/PRs. Do not mark done from configuration tests alone.

## Not Now

- Webhooks, relays, tunnels, production deployment, organization-owned GitHub resources, broad repository access, code changes, commits, pushes, PRs, and additional stories.
- No developer credentials in automated tests; no classic PAT, global credential copying, identity migration, new login, or GitHub resource deletion.

## Done When

- Configuration/startup checks and full verification pass without changing existing data or lowering coverage.
- The local developer/admin completes the real GitHub/Copilot flow and verifies the checkout and harmless command output in the coding agent session.
- Failures are actionable and secret-free; loopback-only access and repository scope remain intact.

## Completion Summary

## Next Slice Recommendation
