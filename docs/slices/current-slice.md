# Current Slice

Status: active

## Slice Goal

- The local developer/admin connects GitHub Copilot and retains a usable connection after a Factory Server restart.

## Slice Boundary

- With Factory open and an active Copilot subscription, the local developer/admin completes the browser/device sign-in, observes the connected provider and selects its default model, with the credential encrypted in SQLite.
- User approved revising US-05's no-code boundary for a reproducible SDK compatibility fix. Keep the upstream HTTP schemas, bundled UI, fixed identity IDs, encryption, and loopback-only binding unchanged. The user subsequently approved implementing the upstream organization capability for fixed `local-admin` in existing organization `local` only; all other user/organization IDs must be rejected, without provisioning or migration.
- The specification still asks for the `github-copilot` model pack; the installed Factory UI selects individual default models instead. That mismatch needs explicit reconciliation before declaring US-05 complete; no new pack UI is in scope.

## Stories In Scope

- `US-05 Connect GitHub Copilot as the model provider`

## Stories Completed In This Slice

## Stories Remaining In This Slice

- `US-05 Connect GitHub Copilot as the model provider`

## Contract Inputs

- Installed upstream Copilot device sign-in, credential storage, and default-model surfaces; existing HTTP schemas and operations remain unchanged. No authored HTTP contracts.
- `SPEC.md` still requires a selectable named model pack; do not silently replace that acceptance outcome with individual-model selection.

## Decision Inputs

- None.

## Shared State Required Now

- Existing SQLite database and unchanged `FACTORY_CREDENTIAL_ENCRYPTION_KEY`, with personal credentials scoped to fixed user `local-admin` and organization `local`.
- An existing Factory to expose Settings. With explicit user approval, created an empty `Local Factory` through the existing projects API; no repository was connected. The user subsequently connected personal Copilot successfully.
- The local developer/admin's active Copilot subscription. The human completes GitHub authorization without sharing passwords or tokens.

## Operations / Endpoints / Surfaces In This Slice

- Root cause: Factory discovers providers from available models, but the SDK returns no Copilot models before sign-in, hiding its own sign-in option. npm registry checks found no newer stable release than the installed Factory 0.24.0, SDK 1.15.0, and CLI 1.35.0.
- `src/mastra/copilot-compatibility.ts` and `scripts/apply-copilot-compatibility.ts` apply version/source-checked, idempotent patches during npm `postinstall`: SDK 1.15.0 seeds unauthenticated provider discovery; Factory 0.24.0 wires a generated copy of `src/mastra/copilot-catalog.ts` into the existing picker and session model-switch catalog. Generation uses the existing pinned TypeScript compiler. No dependency additions or manual generated UI edits.
- The user reports Copilot sign-in succeeds in both scopes. Their GPT-4.1-only list was caused by using the global discovery catalog rather than selected tenant credentials. The new helper resolves exactly the permitted scope/session owner through upstream TenantCredentialStore and gets the live catalog, including upstream token refresh, filtering, and failure fallback. Other providers are preserved; tokens are not copied globally, and no cross-scope model cache is added. Actual model execution after restart remains unverified.
- `src/mastra/auth.ts` now implements upstream `IOrganizationsProvider`: `ensureOrganization` returns only existing organization `local` for fixed user `local-admin`, and `isOrganizationAdmin` rejects every other user/organization pair. No provisioning, migration, identity changes, or personal-to-organization credential copying.
- Both **Your models** (`settings/personal-models`) and **Factory models** (`settings/models`) now offer enabled Copilot sign-in. Organization administration enables other upstream admin actions too, so loopback-only exposure remains essential.
- README documents the actual navigation, empty-Factory prerequisite, install-time patch, encryption-key pairing, and remaining manual checks.
- Clean `./scripts/setup` and latest full `./scripts/verify` pass on Node 22.22.3: formatting, typecheck, 79 tests, 100% statements/branches/functions/lines coverage, and build. Hosted CI was not run.
- Restarted the local Factory Server with its existing `.env` and database after verification. Live API requests return 12 Copilot models for each scope, and agent-browser confirms those models in both dropdowns. Existing defaults were left unchanged; Factory UI retains its previously selected GPT-4.1 alongside the live list. No credentials were printed, manually copied, or migrated, and no catalog-failure or missing-encryption/plaintext warning appears in the new log.

## Tests Required

- Passed: regression tests first reproduced both empty unauthenticated catalogs, then passed after the compatibility patch.
- Passed: real temporary SDK files verify exact/idempotent transformation and fail-fast version/source drift without partial writes.
- Passed: real temporary AuthStorage verifies modern and legacy credential-store catalog discovery, no auth-file creation, no false authenticated state, and unchanged rejection of unauthenticated model requests.
- Passed: real server/browser test verifies admin provider metadata and enabled Copilot sign-in on both settings pages before and after restart, while Copilot models remain credential-gated. Existing identity, persistence, loopback, and sandbox checks also pass.
- User-reported personal Copilot use and Factory-wide sign-in succeeded. Actual connection usability after restart remains a manual check.
- Passed: the real-server regression first failed with GPT-4.1 instead of the fixture's scoped model. It now verifies isolated personal/org live catalogs, hidden/policy-disabled filtering, actual dropdown visibility, persistence across restart, outage fallback, and an empty personal catalog after its credential is removed while the org remains connected. A test-only HTTPS fixture replaces remote GitHub, using a temporary trusted certificate without disabling TLS.
- Passed: real encrypted SQLite unit checks verify personal precedence only when both scopes are allowed, missing/foreign-scope isolation, expired organization-token refresh without changing the personal token, and safe fallback when refresh fails. Remote HTTP/token-refresh calls alone are doubled because GitHub has no local emulator.
- Passed: new unit tests initially failed for the missing organization capability, then passed. They reject unknown/empty user and organization IDs and verify idempotent recognition of the existing organization.
- Passed: real server tests store inert personal and organization API-key fixtures, confirm both persist across restart, then remove the organization fixture while retaining the personal fixture. The test also removes the personal fixture and makes no model-provider requests. Actual developer credentials are never used in automated tests.
- Pending: reconcile the named-model-pack criterion with the installed UI's individual-model selection. Do not claim pack verification from a model picker.

## Not Now

- US-06 full Factory session, repository checkout, GitHub App setup, and webhook delivery remain deferred.
- No new provider adapters, dependencies, credential migration, identity ID changes, environment variables, new organizations/membership UI, named-pack UI, or automated GitHub account sign-in.
- No generated UI changes, credential copying to global storage, cross-scope catalog sharing, or speculative model configuration. The user approved credential-aware live Copilot model discovery for both existing settings scopes. Remove compatibility patches when upstream fixes discovery; review them before upgrades.

## Done When

- README accurately documents prerequisites, personal connection, default selection, restart verification, and encryption-key/database pairing.
- Real sign-in, connected status, default selection, connection usability after restart, and absence of missing-encryption warnings are verified.
- The named-model-pack/default-model mismatch is explicitly resolved with the user/specification.
- Automated checks stay green without decreasing coverage. Do not mark this slice done based only on discovery tests.

## Completion Summary

## Next Slice Recommendation
