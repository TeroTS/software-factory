# Current Slice

Status: done

## Slice Goal

- The local developer/admin connects GitHub Copilot and retains a usable connection after a Factory Server restart.

## Slice Boundary

- The local developer/admin completes browser/device sign-in, observes the connected provider, and selects individual Copilot models as personal and Factory defaults, with credentials encrypted in SQLite.
- User approved the discovery/catalog compatibility patches and organization-admin capability for fixed `local-admin` in existing organization `local` only. Keep upstream HTTP schemas, bundled UI, identity IDs, encryption, and loopback binding unchanged; no provisioning or credential migration.
- User confirms the integration works and accepts US-05 as complete. The installed UI's individual-model selection satisfies the original model-pack requirement; no named-pack UI is required. `SPEC.md` and `CONTEXT.md` now reflect that accepted distinction.

## Stories In Scope

- `US-05 Connect GitHub Copilot as the model provider`

## Stories Completed In This Slice

- `US-05 Connect GitHub Copilot as the model provider`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- Installed upstream Copilot device sign-in, encrypted credential storage, and default-model surfaces; existing HTTP schemas and operations remain unchanged. No authored HTTP contracts.

## Decision Inputs

- None.

## Shared State Required Now

- Existing SQLite database and unchanged `FACTORY_CREDENTIAL_ENCRYPTION_KEY`, with personal credentials scoped to fixed user `local-admin` and organization credentials to `local`.
- Existing Factory record, personal and organization Copilot connections, and the local developer/admin's active subscription. No credentials are copied between scopes or to global storage.

## Operations / Endpoints / Surfaces In This Slice

- **Your models** (`/factories/<factoryId>/settings/personal-models`) and **Factory models** (`/factories/<factoryId>/settings/models`) support separate sign-in and scoped live models. Existing saved defaults are never changed automatically.
- `src/mastra/auth.ts` implements the upstream organizations-provider contract only for the fixed local user/organization pair. This enables other upstream organization-admin actions too; loopback-only exposure remains mandatory.
- `src/mastra/copilot-compatibility.ts` and `scripts/apply-copilot-compatibility.ts` apply idempotent, version/source-checked install-time patches: SDK 1.15.0 exposes discovery before authentication; Factory 0.24.0 uses a generated copy of `src/mastra/copilot-catalog.ts` in its picker and session model-switch catalog. The existing pinned TypeScript compiler performs generation; no new dependencies or manual generated UI edits.
- The catalog helper resolves the permitted credential scope/session owner through upstream TenantCredentialStore, retaining token refresh, hidden/policy-disabled filtering, and failure fallback without cross-scope catalog caching or global token copying.
- README documents navigation, the existing-Factory prerequisite, separate credential scopes, install-time patches, encryption-key pairing, and repeatable verification.

## Tests Required

- Passed: regression checks reproduced the missing sign-in provider and GPT-4.1-only catalog before the respective fixes.
- Passed: patch idempotence and version/source drift checks, including rejection before partial source changes.
- Passed: real AuthStorage checks for discovery, no false authentication/auth-file creation, and rejection of unauthenticated requests.
- Passed: real encrypted SQLite checks for selected-scope discovery, personal precedence only when allowed, foreign/missing-scope isolation, expired-token refresh, and safe refresh-failure fallback.
- Passed: real server/browser checks for both sign-in surfaces, scoped catalogs/dropdowns, filtering, outage fallback, restart persistence, organization credential mutation, and personal credential preservation. Existing identity, loopback, storage, and sandbox checks also pass.
- Automated catalog tests replace only remote HTTP/refresh behavior; the real-server test uses an isolated HTTPS fixture and a temporary trusted certificate without disabling TLS. Automated tests never use developer credentials or contact GitHub.
- Latest full `./scripts/verify` passed on Node 22.22.3: 79 tests, 100% statements/branches/functions/lines coverage, formatting, typecheck, and build. Clean `./scripts/setup` also passed.
- Live API/browser inspection after restart showed 12 Copilot models in each scope without another sign-in and no catalog-failure or missing-encryption/plaintext warning.
- Manual acceptance: the user confirms the Copilot integration is working and declares US-05 done. The agent did not independently run paid provider inference; hosted CI was not checked. This completion update changes documentation only and does not claim a new test run.

## Not Now

- US-06 full Factory session, repository checkout, GitHub App setup, and webhook delivery remain deferred.
- No new provider adapters, credential migration, identity ID changes, environment variables, organization/membership UI, named-pack UI, or automated GitHub account sign-in.
- Review/remove the compatibility patches when upstream fixes discovery and before dependency upgrades.

## Done When

- Working Copilot integration is accepted by the local developer/admin, including separate personal/Factory connections and available default-model selection.
- Credentials remain encrypted and scoped; existing restart/browser checks and coverage pass.
- Documentation reflects the accepted individual-model UI rather than requiring an unavailable named-pack selector.

## Completion Summary

- GitHub Copilot connects in both personal and Factory settings, with encrypted SQLite credentials and scoped live model discovery rather than only the GPT-4.1 discovery fallback.
- Restarted-server API and browser checks confirm both connections/catalogs remain available. Fixed local administration enables Factory-wide connection without changing identities, copying credentials, or exposing the server beyond loopback.
- The user confirms the integration works and accepts US-05 as complete. Individual model selection is accepted in place of the original model-pack wording.

## Next Slice Recommendation

- `US-06 Run a full Factory session in LocalSandbox` is the only remaining explicit story and is explicitly deferred. Do not start it without user approval and its self-managed GitHub App prerequisite; no currently actionable story remains in `SPEC.md`.
