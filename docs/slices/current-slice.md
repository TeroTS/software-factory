# Current Slice

Status: done

## Slice Goal

- The local developer/admin opens the local Factory Server without signing in or configuring an admin token.

## Slice Boundary

- After starting the Factory Server, the local developer/admin opens its loopback URL without credentials and receives Factory content and API responses; the request completes without an authentication step.
- User-approved scope change: replace US-02 admin-token sign-in with single-user, loopback-only access without authentication. No login screen or adapter is needed.

## Stories In Scope

- `US-02 Open Factory locally without signing in`

## Stories Completed In This Slice

- `US-02 Open Factory locally without signing in`

## Stories Remaining In This Slice

- None.

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

## Tests Required

- Unit tests accept configuration without an admin token while rejecting missing, blank, and malformed credential encryption keys without logging secrets.
- Real end-to-end startup test omits the admin token, observes Factory HTML and an API response without credentials, confirms auth-disabled status, and verifies the loopback listener.
- Formatting, typecheck, coverage (no decrease), and build pass.

## Not Now

- Login UI, token adapter, RBAC, multiple users, proxy/tunnel/LAN exposure.
- US-03 project-local persistence, US-04 sandbox verification, US-05 Copilot connection, and US-06 full Factory session.

## Done When

- Factory starts and responds without an admin token, authentication stays disabled, and the listener remains bound to `127.0.0.1`.
- The encryption key remains required; documentation consistently describes local-only unauthenticated access and its risks.
- Automated checks pass.

## Completion Summary

- Factory starts without an admin token; the local developer/admin receives Factory HTML and API responses without credentials. Authentication remains explicitly disabled and the server remains bound to `127.0.0.1`.
- The credential encryption key remains required and validated without logging secrets. Existing `.env` files do not need a new key; unused admin-token/name entries may be removed.
- The real startup test verifies auth-disabled status and rejects connections through available non-loopback IPv4 interfaces, using a temporary database and `.env` rather than developer state.
- Specification, decisions, vocabulary, setup instructions, and agent guidance now consistently describe the user-approved single-user local-access scope and its exposure risks. No login adapter, authored endpoint, generated contract, or dependency was added.
- `./scripts/verify` passes on Node 22.22.3: formatting, typecheck, all nine tests, coverage, and build. Runtime-module coverage remains 100% for statements, branches, functions, and lines. All nine tests also pass on Node 25.4.0.
- No browser-driven UI interaction or hosted CI run was performed; the end-to-end check uses the real server's HTML and HTTP API.

## Next Slice Recommendation

- `US-03 Factory data persists across restarts` is the next explicit story.
- Keep US-04 shared LocalSandbox configuration and US-05 Copilot credential persistence in view; neither is part of this slice.
