# Current Slice

Status: done

## Slice Goal

- The local developer/admin runs the sandbox check script and sees Git output and its session directory under the sandbox root.

## Slice Boundary

- The local developer/admin invokes one npm script; the shared LocalSandbox callback creates a session directory and runs `git --version` on the local machine, printing its output and directory.
- Implement only US-04. Preserve storage, local identity, loopback binding, and credential encryption configuration.

## Stories In Scope

- `US-04 Run a command in LocalSandbox`

## Stories Completed In This Slice

- `US-04 Run a command in LocalSandbox`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- Installed upstream `MastraFactory` sandbox callback contract (`FactorySandboxContext` to `LocalSandbox`); no authored HTTP contracts.
- The installed Factory accepts both `LocalFactorySandbox` and a callback. Use the callback specified by US-04, retaining session identity, 30-second command timeout, and HOME-only environment additions (upstream supplies PATH). Factory labels bare callbacks `custom`; returned sandboxes remain provider `local`.

## Decision Inputs

- None.

## Shared State Required Now

- Sandbox root from `MASTRACODE_LOCAL_SANDBOX_ROOT`, falling back to `~/.mastracode/web/sandboxes`; create it when missing and check writability.
- Session directory `<sandbox root>/<sessionId>`; do not delete existing sessions or allow session IDs to escape the root.

## Operations / Endpoints / Surfaces In This Slice

- `src/mastra/sandbox.ts`: shared explicit LocalSandbox callback, used by Factory and the sandbox check script.
- `scripts/check-sandbox.ts` and `npm run check:sandbox`: standalone Git command verification without server startup, provider credentials, or SQLite.
- README sandbox verification, optional root configuration, and repository guidance.

## Tests Required

- Unit tests for default, blank, relative, and absolute root resolution.
- Real filesystem tests for root creation, blocked/unwritable paths, session path validation, and preservation of existing files.
- Real LocalSandbox start/execute/stop test proving Git output, execution cwd, and limited environment inheritance.
- Explicit end-to-end test invoking the npm script with an isolated temporary root and observing Git output and an existing session directory.
- Script failure checks for blocked/unwritable roots and unsuccessful command execution.
- Full `./scripts/verify`, including existing browser/restart checks, coverage without regression, and build.

## Not Now

- US-05 GitHub Copilot sign-in and credential persistence verification.
- US-06 repository checkout/full Factory session, GitHub App setup, remote sandbox providers, native OS isolation, and authored HTTP endpoints.
- No dependency additions, existing session deletion, or developer sandbox use in tests.

## Done When

- The sandbox check script exits 0 with `git --version` output and the session directory under the configured root.
- Factory and the script share the same explicit LocalSandbox callback; missing roots are created, invalid/unwritable roots fail clearly, and existing sessions are preserved.
- Automated real execution and end-to-end checks pass; documentation explains configuration, local execution risks, and verification.
- Full verification passes without lowering runtime coverage.

## Completion Summary

- `npm run check:sandbox` runs real `git --version` through the same explicit LocalSandbox callback used by Factory and prints its unique session directory. It works without starting Factory or configuring credentials/storage; optional `.env` supplies the sandbox root.
- Missing roots are created and checked for write/traversal permission. Blocked/unwritable paths fail clearly, unsafe session IDs are rejected, and existing session contents are preserved. LocalSandbox retains the upstream session ID, 30-second timeout, and HOME/PATH environment behavior without inheriting credential variables.
- Real integration tests exercise command output, actual execution cwd, environment inheritance, session reuse, root failures, and the npm script end to end. Script failures return nonzero for an unusable root or unavailable Git. The real server/browser restart test now uses an isolated temporary sandbox root and confirms its creation at startup.
- README and `.env.example` explain root configuration, standalone verification, retained check directories, and unisolated local execution. No dependency, HTTP contract, storage, identity, or provider credential changes were made.
- `./scripts/verify` passes on Node 22.22.3: formatting, typecheck, 54 tests including real browser/restart checks, coverage, and build. Runtime statements, branches, functions, and lines remain at 100%. Hosted CI, Copilot sign-in, and a full Factory agent session were not run.

## Next Slice Recommendation

- `US-05 Connect GitHub Copilot as the model provider`: document the connection steps and manually verify sign-in and usability after restart with the local developer/admin's active subscription. Do not claim completion without that manual verification.
- Keep US-06 full Factory session explicitly deferred; its GitHub App prerequisite remains a non-goal for this delivery.
