# Current Slice

Status: active

## Slice Goal

- The local developer/admin opens the local Factory Server without signing in or configuring an admin token.

## Slice Boundary

- After starting the Factory Server, the local developer/admin opens its loopback URL without credentials and receives Factory content and API responses; the request completes without an authentication step.
- User-approved scope change: replace US-02 admin-token sign-in with single-user, loopback-only access without authentication. No login screen or adapter is needed.

## Stories In Scope

- `US-02 Open Factory locally without signing in`

## Stories Completed In This Slice

## Stories Remaining In This Slice

- `US-02 Open Factory locally without signing in`

## Contract Inputs

- None. No authored HTTP endpoints or upstream API schemas change.

## Decision Inputs

- `DECISIONS.md`: single-user local access without authentication supersedes the original Simple Auth decision.

## Shared State Required Now

- Required credential encryption key; no admin token, identity, or session state.
- Explicit `auth: null` and server host `127.0.0.1`.

## Operations / Endpoints / Surfaces In This Slice

- Environment validation, `.env.example`, and existing Factory composition.
- Startup integration test, README, specification, decisions, vocabulary, and repository guidance.
- Browser-test follow-up: `playwright-core` is pinned directly, setup installs Chromium, and CI installs its Linux dependencies.
- Blocked: the real browser and new regression test show the upstream auth-disabled error screen instead of Factory onboarding. The bundled UI refuses `auth: null`, despite the successful HTML/API checks. US-02 is reopened; no authentication or bundled-UI change has been made. Resolving this incompatibility requires a user decision before implementation.

## Tests Required

- Unit tests accept configuration without an admin token while rejecting missing, blank, and malformed credential encryption keys without logging secrets.
- Real end-to-end startup test omits the admin token, observes Factory HTML and an API response without credentials, confirms auth-disabled status, and verifies the loopback listener.
- A fresh Chromium context must render the onboarding heading and an enabled "Create my first factory" button, without a sign-in redirect or password field.
- Formatting, typecheck, coverage (no decrease), and build pass.

## Not Now

- Login UI, token adapter, RBAC, multiple users, proxy/tunnel/LAN exposure.
- US-03 project-local persistence, US-04 sandbox verification, US-05 Copilot connection, and US-06 full Factory session.

## Done When

- Factory starts and responds without an admin token, authentication stays disabled, and the listener remains bound to `127.0.0.1`.
- The encryption key remains required; documentation consistently describes local-only unauthenticated access and its risks.
- Automated checks pass.

## Completion Summary

## Next Slice Recommendation
