# Current Slice

Status: done

## Slice Goal

- The local developer/admin opens usable Factory content locally without signing in or configuring an admin token.

## Slice Boundary

- With the Factory Server running, the local developer/admin opens its loopback URL without credentials, receives the fixed local identity, and sees Factory onboarding rather than a sign-in or auth-configuration screen. No persisted login session is created.
- User-approved plan: replace `auth: null` with a minimal local identity provider. It assigns identity without verifying the caller and provides no access protection; keep the listener strictly on `127.0.0.1`.
- This corrects the existing US-02 slice rather than adding another story or plan file. The user-approved fixed-user/fixed-organization approach is implemented and browser-verified.

## Stories In Scope

- `US-02 Open Factory locally without signing in`

## Stories Completed In This Slice

- `US-02 Open Factory locally without signing in`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- Installed `@mastra/core/server` auth-provider contract accepted by `MastraFactory`.
- Existing upstream `/auth/me`, Factory API, and browser auth checks; no authored routes or HTTP schema changes are planned.
- If an authored HTTP route or schema change becomes necessary, stop for contract-first review rather than adding it implicitly.

## Decision Inputs

- `DECISIONS.md` scope amendment: local identity provider, no credential verification, loopback-only access.
- `DECISIONS.md` → `Interfaces / Contracts`: fixed identity and organization `local`, no sessions or organization management, and compatibility/data-scoping checks before wiring.

## Shared State Required Now

- One stable non-secret identity: ID `local-admin`, display name `Local developer/admin`, organization ID `local`; no token, password, cookie, session store, or external identity service.
- Existing required credential encryption key, unchanged database configuration, and explicit server host `127.0.0.1`.
- Identity-based upstream storage scope must be understood before wiring; no automatic rekeying, migration, deletion, or hiding of existing developer data.

## Operations / Endpoints / Surfaces In This Slice

1. Confirm the installed provider contract, Factory gate, `/auth/me`, UI checks, and capability/licensing requirements support automatic local identity without provider impersonation or license bypass. Inspect identity-based storage scoping. If compatibility requires broader changes or an existing-data transition, stop and ask before implementation.
   - Preflight: upstream `/web/factory/projects` requires an organization ID. The user approved fixed organization `local`; no organization-management surface is added. This keeps the existing local organization scope. Per-user settings previously stored for user `local` are a separate compatibility concern; never migrate developer data implicitly. The provider requires no SSO, credentials, RBAC, FGA, or enterprise capability markers.
2. Write failing unit tests for fixed identity and authorization through the upstream provider contract. Update the real-server auth-status assertions to expect the fixed identity; retain the already-failing positive browser assertions.
3. Add the smallest provider in `src/mastra/auth.ts` and wire it into `src/mastra/index.ts` instead of `auth: null`. Keep loopback binding, encryption validation, dependency versions, and upstream UI untouched.
4. Run the real browser test against the real server with isolated SQLite state. Require visible usable onboarding, not merely successful HTML/API responses. Do not weaken, skip, or invert the regression assertion to make the test pass.
5. Update `README.md`, `.env.example` comments, and `AGENTS.md` to explain automatic identity versus verified authentication, remove stale `auth: null` guidance, and retain exposure warnings. Mark this slice done only after verification succeeds.
6. Run `./scripts/verify`: formatting, typecheck, tests with coverage, and build. Keep this slice active if the UI or any upstream capability remains incompatible.

## Tests Required

- Unit tests exercise the upstream provider contract: no credentials and arbitrary tokens/headers/cookies all resolve to the same fixed identity; none can select a different user. Authorization permits that identity, and the identity is stable across provider instances.
- Existing environment tests continue rejecting missing, blank, and malformed credential encryption keys without logging their values. No admin token becomes required.
- Real startup test uses a temporary `.env`, SQLite file, and dynamic port, supplies no admin token, and verifies HTML/API access, `/auth/me` with `authenticated: true` and the expected user ID/name, and no session cookie from identity resolution.
- Start the real server again against the same temporary database and confirm the same identity is reported; this checks identity stability, not US-03 Factory-data persistence.
- A fresh Chromium context renders the onboarding heading and visible, enabled "Create my first factory" button, without a sign-in redirect, password field, or auth-configuration error. Browser/server cleanup must still run on failure.
- Retain the loopback URL and non-loopback connection-refusal checks; identity assignment must not widen network exposure.
- `./scripts/verify` passes with no decrease from existing runtime-module coverage; new provider logic is covered. No browser mocks or intercepted auth responses may substitute for the real end-to-end path.

## Not Now

- Real credential verification, login UI, admin tokens, login endpoints, session management, RBAC, multiple users, organization provisioning/membership management, remote exposure, and external identity services.
- Bundled-UI patches, provider upgrades, new dependencies, license bypasses, and speculative auth abstractions.
- Data migration or a change to the current database location without an explicit decision.
- US-03 project-local persistence, US-04 sandbox verification, US-05 Copilot connection, and US-06 full Factory session. Their persisted state motivates a stable identity now, not broader implementation.

## Done When

- The real browser test passes: the local developer/admin opens usable Factory onboarding without signing in or configuring an admin token.
- Upstream identity status reports the stable local identity; arbitrary supplied credentials cannot choose another identity, and no login session is stored.
- The encryption key remains required, the listener remains strictly on `127.0.0.1`, and no existing developer data is silently changed or hidden.
- Documentation clearly states this is automatic identity assignment, not access protection; anything able to reach the server is treated as the local developer/admin.
- Full verification passes. The observed auth-disabled error is resolved without weakening the test or editing the bundled UI.

## Completion Summary

- The local developer/admin opens real Factory onboarding without credentials, a login form, or a persisted session. The existing Chromium regression now passes unchanged: onboarding heading and enabled start button are visible.
- `src/mastra/auth.ts` assigns fixed user `local-admin`, display name `Local developer/admin`, and the user-approved organization ID `local` through the upstream provider contract. Arbitrary credentials cannot choose another identity. No hosted-provider impersonation, enterprise capability markers, organization provisioning, or bundled-UI changes were used.
- Real HTTP checks cover `/auth/me`, agent listing, and Factory project listing. Restarting the real server against the same temporary SQLite file retains the identity; fresh browser cookies and identity-response session headers remain empty. Loopback URL and available non-loopback connection-refusal checks still pass.
- Environment validation and the encryption key requirement are unchanged. Tests use isolated state; no developer database was opened, migrated, or deleted. README and agent guidance explicitly warn that legacy settings/credentials under user `local` are separate from `local-admin` and require a decision before reusing old data; organization scope stays `local`.
- `./scripts/verify` passes on Node 22.22.3: formatting, typecheck, 13 tests, coverage, and build. Statements, branches, functions, and lines remain at 100% for hand-written runtime modules, including the provider. Hosted CI and a full Factory/Copilot session were not run.

## Next Slice Recommendation

- `US-03 Factory data persists across restarts` is the next explicit story. Resolve any existing-data transition before reusing a developer database.
- Keep US-04 shared LocalSandbox configuration and US-05 Copilot credential persistence in view; neither is implemented by this slice.
