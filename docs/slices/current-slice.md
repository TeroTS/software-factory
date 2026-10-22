# Current Slice

Status: active

## Slice Goal

- One accepted work item automatically produces an independently reviewed, single-file, unmerged PR in the disposable repository.

## Slice Boundary

- US-07: the local developer/admin admits one work item into the upstream workflow; Factory then plans, builds, validates, self-reviews, and opens the PR without manual session starts or chat follow-ups.
- The task adds only `PIPELINE_TEST.md` containing exactly `Factory pipeline test passed.` followed by a newline. No merge, auto-merge, default-branch edits, or other repository changes.
- Preserve upstream's required human acceptance for non-bug work. If triage requires a person to move the documentation task into Planning, record that one acceptance action; this does not prove fully unattended intake.
- Reuse installed upstream functionality. The user approved fixing the discovered Responses streaming compatibility bug and retrying this same card; no orchestration or approval-policy bypass is authorized.

## Stories In Scope

- `US-07 Run one automated file-to-PR pipeline test`

## Stories Completed In This Slice

## Stories Remaining In This Slice

- `US-07 Run one automated file-to-PR pipeline test`

## Contract Inputs

- Installed upstream Factory project settings: `autoRunEnabled`, `autoApprovePlans`, `selfReviewEnabled`, and `reviewTestChecksEnabled`.
- Existing work/review boards, rules dispatcher, source-control integration, work-item/run/session contracts, GitHub polling, and shared LocalSandbox callback. No authored HTTP API or schema change.
- `work-transition-policy`: non-bug work requires human acceptance into Planning/Building; auto-approve plans does not remove that acceptance gate. An open PR is not Done.
- `workspace`: GitHub CLI credentials fall back to the selected repository's installation token when no PAT is configured. Do not add a PAT preemptively.

## Decision Inputs

- `DECISIONS.md`: user-approved US-07 Scope Revision; earlier US-06-only exclusions remain historical and do not prevent this narrowly authorized test.
- US-06 completion and verification evidence is recorded under its story in `SPEC.md`. The user subsequently confirmed live Sol execution works.

## Shared State Required Now

- Existing SQLite/encryption-key pair, fixed `local-admin` / `local` identity, scoped Copilot connection, and retained manual smoke-test sessions; preserve them unchanged.
- Only repository: `TeroTS/factory-smoke-test`; App slug: `factory-example`; installation account: `TeroTS`.
- Live preflight after installation approval verified Contents write, Pull requests write, Issues write, Metadata read, installation selection `selected`, and exactly one accessible repository: `TeroTS/factory-smoke-test`.
- Baseline `main`: `d460b83b2282bac0fa6eb32a9337956b70733dde`; no open or closed PRs were returned. Recheck before triggering the pipeline.
- Existing `Local Factory` (`b2bc9036-4406-43a1-b3c9-a29f8ba8d676`) contains only the retained, resting `Test flow` card/chat session, with no running/parked sessions or pending decisions. Original automation settings are all false. This provides a safe single-repository test boundary without moving/deleting existing work. Saved default remains `github-copilot/gpt-6.1-sol`, with `hybrid` scope (Factory credentials for runs).
- Server remains on `127.0.0.1:4111`. App credentials are read only in memory; no secret values were displayed or changed.

## Operations / Endpoints / Surfaces In This Slice

- The human approved installation `174237987`'s updated write permissions. Read-only remote baseline recheck found exactly the selected repository, unchanged `main`, zero PRs, zero open issues, and only `README.md` on `main`.
- Backed up the live SQLite database, paired `.env`, and original automation/model settings privately at `~/.factory-pipeline-backup.E0KU9C/` before changing Factory state. No credentials or saved model defaults were changed.
- Use one local Intake card, not an App-authored GitHub issue. This tests accepted-card-to-PR automation, not GitHub issue ingestion, and avoids incorrectly treating a bot-authored issue as a trusted human request. The developer/admin will admit the new card into Planning once; do not manually start a session or send kickoff chat.
- The upstream background reconciliation interval defaults to one hour. Restarting for this acceptance run with process-only `MASTRACODE_GITHUB_PR_RECONCILE_INTERVAL_MS=30000` and `MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=30000` allows two observed polling cycles and clears old cached installation tokens. `.env` is unchanged; restart without these temporary overrides during cleanup. The first restart found the old CLI still shutting down; after verifying its processes exited, a fresh launch was started.
- Enabled Auto-start runs, Auto-approve plans, and Self-review before pull requests through the existing UI for the attempt. After the planning failure, restored all three to false; Publish review test checks stayed false throughout. Saved default/model scope remain unchanged. Restarted the server without the temporary polling overrides; `.env` is unchanged.
- Created exactly one local work item in Intake: `7757002c-2237-4760-883d-3507342737b3`, title beginning `US-07 pipeline test`. Its title contains the exact file/content/diff/review/PR requirements and no-merge constraints. At creation it had no session or decisions; the old `Test flow` card/session was unchanged.
- The developer/admin moved the card into Planning. Factory automatically invoked `factory-plan` in session/thread `ec052b1d-b577-468c-bc10-d82f8a9c2d50`; no manual Start session or chat kickoff was used. The prior `Test flow` card/session remained unchanged.
- Initial failure: the planning stream repeatedly threw `TypeError: Cannot read properties of undefined (reading 'summaryParts')` in `@ai-sdk/openai` while using Sol. A separate live read-only tool-follow-up diagnostic recorded event types/identity comparisons only (no model text, credentials, or encrypted payloads): Copilot changed a reasoning item's ID between its start and completion events. The adapter indexed active reasoning only by the starting ID, so completion dereferenced missing state. The UI retains the original errors and repeated kickoff messages.
- Decision `a23f203a-78da-4296-997a-06fa776e495e` terminated as `failed`, `failureCode: run_failed`, after five attempts. The card remains in Planning with no running or parked sessions; no Abort action was needed once the terminal failure was observed. No manual retry, stage advance, model switch, or pipeline step was performed to manufacture success.
- Retained checkout: `~/.mastracode/web/sandboxes/83229453-5db0-4dcf-8ac4-b47936869704/factory-smoke-test`. Post-failure inspection found a clean working tree on `factory/item-7757002c-2237-4760-883d-3507342737b3` at initial commit `d460b83`. A live GitHub check confirmed unchanged `main`, only remote branch `main`, and zero PRs: no file edit, new commit, pushed branch, or PR resulted.
- User-approved fix: the existing install-time compatibility script now version-checks `@ai-sdk/openai@3.0.131` and patches its ESM/CJS reasoning correlation by output index. Reasoning-end keeps the starting stream ID and final completion metadata/encrypted content; unmatched output indices fail explicitly rather than pairing unrelated items. Source drift in either module fails before writing either file; installation remains idempotent. No installed artifact was edited manually, dependencies upgraded, defaults changed, or policy bypassed.
- Before the retry, backed up the failed-run database/key pair privately at `~/.factory-pipeline-retry-backup.rD66zZ/`. The regression reproduced the exact crash before the fix. Afterward, formatting, typecheck, 143 tests with 100% statements/branches/functions/lines coverage, and build passed. `npm run postinstall` applied the authored patch.
- Retried exactly the same failed decision through the installed decision-retry operation after verifying the UI click had not dispatched it. The same Planning session was reused; no new card, manual chat kickoff, or manual stage advancement was introduced. With the three test settings enabled, this attempt ran once without the streaming exception and the decision reached `succeeded`, but the card did not leave Planning.
- New blocker: the planner wrote `.artifacts/plans/issue-US-07.md`, then ran a Python check asserting `len(b'Factory pipeline test passed.\\n') == 29`. The actual required size is 30 bytes. The traceback points to that assertion; independent read-only checks confirmed all six preceding heading assertions pass. The agent's final claim of a heading-validation failure is inaccurate. Per the task's stop-on-error instruction, it stopped without submitting/advancing the plan or performing implementation.
- Retained the untracked planning artifact as evidence; no `PIPELINE_TEST.md`, new local commit, remote branch, or PR was created. A fresh live GitHub check again found only `main` at the baseline SHA and zero PRs. Restored all three automation switches to false and restarted without temporary polling overrides. Saved model/defaults and the old smoke-test session remain unchanged.
- Next: decide how to correct/retry the planner-generated byte-count assertion through the agent's workflow, not by editing its artifact, faking a successful tool result, or manually advancing the pipeline. US-07 remains unaccepted. No GitHub issue was created; issue ingestion and fully unattended intake are not covered.

## Tests Required

- First live attempt: automatic Planning kickoff and real checkout succeeded, then the stream failed on `summaryParts`. After the tested compatibility fix, one retry completed its stream and wrote a plan, then stopped on the incorrect 29-byte assertion. This demonstrates visible validation-stop behavior, not a successful pipeline. Building, validation of the requested target file, independent self-review, commit/push, PR creation, and post-success duplicate-dispatch checks were not reached. US-07 is not accepted.
- Human-assisted live acceptance using the real loopback Factory Server, GitHub installation, scoped Copilot, SQLite, and LocalSandbox. Never use developer credentials in automated tests.
- Record the event/run bindings and actual tool outputs for checkout, exact file bytes, single-file diff, validation, commit, push, and PR creation.
- Verify the independent self-review verdict covers the actual pushed head before the PR opens, and inspect its validation report rather than accepting an agent summary.
- Verify exactly one linked PR changes only the requested file; PR remains open, unmerged, and without auto-merge. Recheck `main` against the baseline SHA.
- Observe at least two subsequent polling cycles for duplicate cards, unexpected runs/commits, or PRs; record normal role-specific sessions separately from duplicate dispatch.
- Any permission/model/clone/validation/review failure remains visible and is not success. Restore changed automation settings without deleting evidence.
- No authored runtime code changed during initial preflight. The later approved adapter fix has automated coverage for stable/renamed reasoning IDs, empty/nonempty summaries, stream pairing, final metadata/encrypted content, missing-start rejection, ESM/CJS idempotency, and version/source drift. All earlier routing/scoping/refresh/startup checks remain green. Automated tests use only synthetic credentials and temporary encrypted SQLite; live diagnostics/retries remain separate acceptance work.

## Not Now

- A second failing-validation/retry card, fully unattended non-bug acceptance, merges, default-branch changes, deployment, additional integrations/providers, broad repository access, webhooks, relays, tunnels, and production readiness.
- App/repository provisioning, secret entry in chat, credential migration, PAT introduction, default-model changes, destructive cleanup, or edits to installed/generated artifacts.

## Done When

- One admitted work item advances through the installed automation, with no manual session starts or chat follow-ups after any required human acceptance.
- Actual records prove validation, independent self-review, commit, push, and exactly the authorized single-file PR; no merge/default-branch change or duplicate dispatch occurs.
- Changed automation settings are restored and evidence retained. Any human gate or limitation is recorded honestly; configuration alone is not acceptance.

## Completion Summary

## Next Slice Recommendation
