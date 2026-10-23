# Current Slice

Status: done

## Slice Goal

- Complete, independently ready GitHub tickets with explicit approval labels automatically enter Planning without a CLI confirmation, board acceptance click, or Triage run.

## Slice Boundary

- Actor: Local developer/admin.
- Trigger: A complete, independent GitHub ticket is imported or its labels change in the selected repository.
- Action: Explicitly authorize implementation when approving tickets in `to-tickets`; the skill publishes complete independent tickets with `ready-for-agent` and applies `factory-approved` last. Factory evaluates the labels through existing polling/reconciliation without manual label application.
- Visible outcome: Eligible tickets automatically move Intake → Planning; existing automation governs implementation and independent reviewed PR creation. Merging stays manual.
- Authoritative transition: A deterministic system policy records the observed approval labels and commits Intake → Planning once through the normal transition service, without impersonating a human.
- The local-command proposal is withdrawn. Keep the reduced MVP focused on label-based auto-approval, including the required `to-tickets` authorization/approval-label wiring, not dependency scheduling or unrelated publishing improvements. US-07 remains accepted and closed; its completed slice history is in git at `9e1e795`.

## Stories In Scope

- `US-08 Automatically accept approved generated tickets`

## Stories Completed In This Slice

- `US-08 Automatically accept approved generated tickets`

## Stories Remaining In This Slice

- None.

## Contract Inputs

- `docs/contracts.md`: US-08 GitHub label approval defines the publisher/consumer evidence and system-acceptance contract. No HTTP changes are planned; any changed HTTP surface requires reviewed OpenAPI YAML and generated contracts/client first.
- Installed upstream GitHub ingestion/reconciliation, board transition/acceptance service, storage, audit, and durable dispatch constrain integration. Existing `autoRunEnabled`, `autoApprovePlans`, and `selfReviewEnabled` retain their meanings.
- `.agents/skills/to-tickets/SKILL.md` must share the same exact label/authorization contract with Factory intake; its minimal update is in scope.

## Decision Inputs

- `DECISIONS.md`: US-08 Deterministic Label-Based Auto-Approval; the local-command detour is withdrawn.

## Shared State Required Now

- Existing repository selection: `TeroTS/factory-smoke-test`; preserve fixed `local-admin` / `local`, scoped credentials, SQLite/key pairing, sessions, defaults, and loopback binding.
- Imported issue identity, current open/Intake state, exact labels, current title/body, observed approval labels, and actual acceptance/transition evidence.
- Require both `ready-for-agent` and `factory-approved`, and nonempty What to build and Acceptance criteria sections. `ready-for-agent`, issue authorship, or publication alone never authorizes execution.
- `factory-approved` authorizes implementation and reviewed PR creation, not merging. This single-user MVP trusts current labels fetched from GitHub in the allowed repository without approval-actor, publisher, issue-author, or label-event verification. Anyone able to apply approval there can authorize local agent execution. Missing required labels or unavailable current GitHub evidence still fails closed with a visible reason.
- Conflicting `factory-approved` / `needs-triage` labels or incomplete bodies stay in Intake for correction. Other tickets retain existing manual handling; no automatic Triage route is added.
- Only independent tickets are supported. The developer/admin checks prerequisites before applying approval; native blocker verification/scheduling is deferred.
- Finish edits before approval; remove/reapply approval around further Intake edits. Automated historical edit reconstruction and approval invalidation are deferred, not guaranteed. Capture current title/body at acceptance; retain existing post-acceptance governance.
- Preserve durable duplicate suppression and normal Planning kickoff recovery across repeated/concurrent polls, crashes, and restart; reuse existing mechanisms rather than inventing a queue.

## Operations / Endpoints / Surfaces In This Slice

- Update `.agents/skills/to-tickets/SKILL.md` to explicitly request implementation authorization, ensure exact labels `ready-for-agent` and `factory-approved` exist, publish complete independent tickets with `ready-for-agent`, verify successful publication, then apply `factory-approved` last using the existing GitHub account. Publish-only, absent/declined implementation authorization, and failed/incomplete publication must omit approval. Approval includes reviewed PR creation, not merge; breakdown/publication approval alone is insufficient.
- Extend existing GitHub polling/reconciliation with deterministic label-based eligibility and audited system acceptance. No manual label application, local authorization command, or per-ticket confirmation is included.
- Use existing Factory evidence surfaces for approval, policy decisions, validation failures, and actual acceptance/transition.
- Implemented `src/mastra/github/approved-ticket.ts` and a narrow install-time `src/mastra/compatibility/approved-ticket.ts` patch for `@mastra/factory@0.24.0`. It adds issue-body retrieval, shares the existing transition service with issue reconciliation, records evidence, and permits only proven policy requests to record system acceptance. Ordinary manual gates remain intact; invalid requests using the reserved policy cause are explicitly rejected.
- Normal atomic transition storage persists acceptance and Planning entry decisions together. The dispatcher respects project settings while allowing explicitly accepted tickets regardless of issue-author trust. Previously accepted cards parked back in Intake are not automatically reaccepted.
- `to-tickets` now requests implementation authorization and applies approval last; unrelated publication behavior remains unchanged. `.gitignore` keeps other agent material ignored but allows this one skill file so the required publisher change can be versioned.
- No HTTP contract, database schema, identity, credential, default, or live settings change was made. Approval-actor verification remains deferred.
- Preserve literal `new Mastra(...)` and prepare → constructor → finalize ordering in `src/mastra/index.ts`. Do not change live settings, defaults, credentials, or unrelated work.

## Tests Required

- Publisher contract checks: explicit implementation-authorization request, exact label creation, approval-last sequencing after successful publication, and no approval for publish-only, declined/absent authorization, or incomplete/failed publication. Exercise authorized publisher output through the intake fixture; preserve unrelated tracker/local-file behavior.
- Policy tests: eligible direct-to-Planning routing; missing/partial/conflicting labels; unchanged eligibility regardless of label actor or issue author; wrong repository; incomplete bodies; unavailable GitHub evidence; and unchanged manual handling outside this route.
- Real temporary SQLite/Factory integration tests: approval evidence, audited system acceptance, ordinary non-bug manual gate, repeated/concurrent polling, restart duplicate suppression, crash recovery between acceptance and kickoff, and visible remote/transition failures.
- Explicit story end-to-end test: import a complete fixture issue, apply both labels through the GitHub fixture without actor-provenance reads, and observe the real loopback Factory Server automatically expose Planning plus approval/acceptance evidence without a CLI confirmation or board click. Enable auto-start only in the isolated fixture and verify exactly one normal Planning kickoff, including after repeated polls and restart. Only remote GitHub/model calls may be doubled; isolate SQLite, ports, sandbox roots, and cleanup from developer state.
- Before declaring done, use `.nvmrc` Node and run `./scripts/verify` (formatting → typecheck → tests with V8 coverage → build). Targeted integration: `npm run test:integration`; coverage: `npm run test:coverage`. Maintain at least 80% statements, branches, functions, and lines without decreasing existing coverage; reports: `coverage/index.html` and `coverage/lcov.info`.
- Verification: Node `22.19.0`; TDD reproduced missing system acceptance before implementation, plus invalid reserved-policy requests and parked-card reacceptance before regression fixes. Policy, real SQLite/reconciliation, patch drift/idempotency, publisher-instruction contract, and real-server tests pass.
- End-to-end evidence: a complete fixture issue stays in Intake with `ready-for-agent`, then automatically enters Planning after publisher-shaped output adds `factory-approved`. The real loopback Factory Server exposes system audit evidence and runs one normal Planning kickoff against a remote model fixture. Subsequent polls and restart preserve one acceptance, decision, and Planning binding; no label-provenance reads occur.
- Full verification history: the first full run passed 252 cases but failed fixture discovery because its issue timestamp preceded completion of repository linking under concurrent load. Corrected the fixture to publish after linking, without increasing timeouts. The rerun passes formatting, typecheck, all 253 tests, and 100% statements/branches/functions/lines coverage. Explicit skill/AGENTS formatting and `git diff --check` also pass.
- `./scripts/verify` initially stopped at build because dev server PID `60189` owned the output directory. The user then explicitly authorized a backup → graceful stop → build → restart window. Private SQLite online and quiesced backups plus `.env`/original process environments are retained at `~/.factory-us08-backup.x6bcw6l0/` with restricted permissions; integrity and the running key/.env match were checked before stopping. Preflight found zero active coding sessions, pending dispatches, or open GitHub issues; no work was triggered.
- `npm run build` passed with Node `22.19.0` during that window, completing the remaining verification step without forcing a build. Restarted `npm run dev` with its original environment (parent PID `80487`, listener PID `80880`), bound only to `127.0.0.1:4111`. Read-only comparisons confirm unchanged `.env`/key, identity, project settings/model defaults, credential/default storage, and the existing card's revision/stage/metadata. Factory HTML and auth respond; this health check is not a claim of live browser or provider acceptance.
- Subsequent user-authorized live test: the developer/admin explicitly approved one independent `AUTO_APPROVAL_TEST.md` ticket and automatic implementation/reviewed PR creation, excluding merge. Fresh SQLite/key backup is retained at `~/.factory-auto-approval-test-backup.qexf9t4z/`. Preflight verified zero existing cards/active coding sessions/pending dispatches/open GitHub issues/open PRs, unchanged required automation settings, App installation selection limited to `TeroTS/factory-smoke-test`, absent target file, and baseline `main` `98023736be17a7b3564ffe6d15291ae5e8f94a4b`.
- Created exact labels `ready-for-agent` and `factory-approved`, then [issue #4](https://github.com/TeroTS/factory-smoke-test/issues/4) with `ready-for-agent`. Verified its published body against the approved complete ticket and independent readiness before applying `factory-approved` last. The developer/admin will observe the end-to-end run themselves. No manual stage advance, session start, implementation, verdict, PR, merge, or settings change was performed by the assistant; the developer/admin subsequently confirmed that the live test worked. Record US-08 live end-to-end acceptance on that user report; the assistant did not separately inspect the resulting PR, diff, or merge state.

## Not Now

- Local authorization CLI or any replacement for the requested label-based mechanism.
- Approval-label actor/provenance verification, native dependency scheduling, historical edit reconstruction and automated approval invalidation, and automatic Triage routing.
- Unrelated basic ticket-publication improvements; only required `to-tickets` implementation-authorization and approval-label wiring is in scope.
- Semantic ambiguity detection, local-file intake, other trackers, automatic merge, broader repository access, webhooks/tunnels, deployment, and production hardening.
- Changes to credentials, model defaults/scopes, existing live cards/settings, destructive cleanup, direct SQL acceptance writes, or human actor impersonation.
- Live ticket publication or execution without separate authorization. No additional explicit story remains after US-08 in `SPEC.md`; do not invent one from deferred work.

## Done When

- After explicit implementation authorization, `to-tickets` publishes a complete independent ticket and applies `ready-for-agent` plus `factory-approved` without manual label application; Factory automatically enters Planning with auditable system acceptance, without a CLI confirmation, board click, or Triage run.
- The skill does not apply approval for publish-only, declined/absent implementation authorization, or incomplete/failed publication.
- Missing required labels, wrong repository, conflicting labels, incomplete content, or unavailable required current GitHub evidence cannot silently authorize work; ordinary tickets retain manual acceptance. Approval-actor/event evidence is not required.
- Repeated/concurrent polls and restart do not duplicate acceptance or kickoff, and a crash after acceptance does not permanently lose normal kickoff.
- Existing automation and independent review remain intact; approval does not enable settings or permit merging.
- Real end-to-end/integration tests and required verification pass; label meaning, prerequisite-readiness responsibility, edit-before-approval limits, and manual merge are documented.

## Completion Summary

- `to-tickets` requests explicit implementation authorization and applies `factory-approved` last after complete independent-ticket publication; publish-only/incomplete/failed paths leave approval off.
- Eligible `ready-for-agent` + `factory-approved` issues in the selected repository automatically move Intake → Planning with persisted policy evidence and system acceptance, without a board click, CLI confirmation, or Triage run. Single-user repository-label trust is explicit; actor verification remains deferred.
- Existing automation/review/manual-merge controls and ordinary manual gates remain intact. Real-server fixture tests prove one normal Planning kickoff across polling/restart; all 253 tests pass with 100% coverage, and formatting/typecheck/build pass. The user-authorized backed-up restart preserves developer state and loopback binding.
- The maintenance window did not authorize or exercise live ticket execution. The developer/admin confirmed that the subsequent separately authorized issue #4 test worked. US-08 live end-to-end acceptance is recorded on that user report; no separate assistant verification of PR details or merge state was performed.

## Next Slice Recommendation

- No explicit next story remains in `SPEC.md`. Do not start deferred work without a new user request.
