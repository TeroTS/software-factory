# Current Slice

Status: done

## Slice Goal

- The local developer/admin can start the Factory Server with validated local configuration.

## Slice Boundary

- After installing dependencies and configuring `.env`, the local developer/admin runs `npm run dev`, sees the local URL, and receives an HTTP response; Factory Server transitions from stopped to running.

## Stories In Scope

- `US-01 Start the local Factory Server`

## Stories Completed In This Slice

- `US-01 Start the local Factory Server`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- None.

## Decision Inputs

- None.

## Shared State Required Now

- Validated `FACTORY_ADMIN_TOKEN` and `FACTORY_CREDENTIAL_ENCRYPTION_KEY` environment variables.
- Upstream scaffold configuration required to start the Factory Server locally.

## Operations / Endpoints / Surfaces In This Slice

- Root npm project generated with `create-factory --no-platform`.
- Environment validation, `.env.example`, `.gitignore`, test and coverage tooling, and startup documentation.
- Existing upstream Factory HTTP surface; no new HTTP endpoints or contracts.

## Tests Required

- Unit tests reject missing or blank required variables without exposing secrets.
- Typecheck and Vitest coverage pass with at least 80% coverage of hand-written runtime modules.
- Explicit end-to-end test starts the real Factory Server using valid environment configuration and observes an HTTP response and the local URL.
- Startup with either required variable absent fails clearly without logging secrets.

## Not Now

- US-02 auth configuration and sign-in verification.
- US-03 persistence configuration and restart verification.
- US-04 shared LocalSandbox callback and check script.
- US-05 Copilot connection; US-06 full Factory session.
- Deployment pipeline. A minimal CI coverage check is included only because the repository-wide testing instructions require coverage execution in CI, despite SPEC.md's CI non-goal.

## Done When

- `npm install`, typecheck, coverage, and the real startup test pass.
- Both required variables fail fast when absent; secrets are never logged.
- README documents prerequisites, installation, environment setup, and startup.
- `.git`, `instructions.txt`, and existing project documentation are preserved.

## Completion Summary

- The local developer/admin can install dependencies, configure `.env`, and start the real Factory Server; its logged loopback URL and HTML response are verified automatically.
- Missing or blank required values and malformed encryption keys fail before the server starts, without exposing secrets.
- All 13 tests pass on Node 25.4.0 and Node 22.19.0; environment validation has 100% statement, branch, function, and line coverage. Typecheck and Prettier checks pass.
- Authentication is deliberately not enabled until US-02; the server binds to `127.0.0.1`. Do not proxy or tunnel this intermediate server.
- The latest generator rejects a non-empty root, so its temporary-directory scaffold was copied while preserving `.git`, `instructions.txt`, and existing documentation. Unused cloud/integration configuration was omitted.
- Upstream uses `LocalFactorySandbox` rather than the older callback-oriented template. US-04 must reconcile that installed API with its stated boundary before implementation.
- `npm install` succeeds with an upstream Stagehand/OpenAI Zod peer-version warning. The hosted GitHub Actions job has not been executed here.

## Next Slice Recommendation

- `US-02 Sign in with the admin token` is the next explicit story; verify SimpleAuth compatibility with Factory's authenticated UI as well as protected API calls.
- Keep US-03 project-local SQLite persistence and US-04 shared LocalSandbox configuration in view; neither is part of this completed slice.
