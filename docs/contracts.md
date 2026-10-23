# Non-HTTP Contracts

## US-08: GitHub label approval

### Publisher

- `to-tickets` asks explicitly whether the developer/admin authorizes Factory implementation and reviewed PR creation; merging remains manual. Breakdown approval and publish-only are not implementation authorization.
- For authorized independent tickets in `TeroTS/factory-smoke-test`, ensure exact repository labels `ready-for-agent` and `factory-approved` exist. Publish complete bodies with nonempty `## What to build` and `## Acceptance criteria` sections and `ready-for-agent`; verify publication before applying `factory-approved` last.
- Publish-only, declined/absent implementation authorization, incomplete bodies, and failed publication omit approval. Preserve other tracker/local-file behavior without Factory approval. Do not approve dependent tickets: this MVP has no dependency scheduler.

### Consumer

- Extend the existing GitHub issue reconciliation sweep, not a new worker, endpoint, or local command. Fetch current issue state, title, body, URL, and labels using the existing installation client.
- Only repository `TeroTS/factory-smoke-test` is eligible. Confirm each card's existing GitHub issue source belongs to that repository and issue number; only the Work board's single Intake phase is eligible for a new acceptance.
- An open issue must have both exact labels `ready-for-agent` and `factory-approved`, no `needs-triage`, and nonempty What to build and Acceptance criteria sections. Headings inside fenced code and empty checkboxes do not count as substantive sections.
- Single-user trust: current GitHub labels authorize execution without label-event or actor-provenance reads. Existing upstream authorship/trust synchronization may still run but cannot veto this explicit approval route. Anyone with permission to apply the label in the selected repository can authorize execution on the local machine.
- Missing approval labels retain ordinary handling. Conflicting labels, invalid content, and unavailable current GitHub data retain Intake and record a correction/failure reason in existing work-item metadata. Existing manual acceptance remains available.
- The developer/admin checks prerequisite readiness and finishes edits before approval. Remove and reapply approval around Intake edits. Native blockers, edit-history reconstruction, and automatic approval invalidation are deferred; no guarantee about unobserved historical changes is made.

### Evidence and transition

- Persist a namespaced `factoryApproval` metadata snapshot containing policy version, repository/issue identity, observed labels, current title/body, decision/reason, and a deterministic digest. Do not stamp a human approval actor or write acceptance directly to SQL.
- Reconciliation requests Intake → Planning from the shared `FactoryTransitionService` with system actor `factory-label-approval`, rule ingress, and cause `github.label_approval`.
- A narrowly version-checked compatibility change permits acceptance only for that system request and matching eligible source/snapshot. All ordinary board/transition validation, revision checks, stage rules, and atomic acceptance/deferred-decision storage remain in force. Do not arm autonomy or preapprove plans: existing project settings continue to govern runs.
- Acceptance, stage change, and the normal Planning entry decision commit together through the upstream service. Audit records identify the system policy and snapshot digest, not a fabricated human. Full ticket content remains in work-item metadata, not logs/audit payloads.
- Persisted system acceptance permits this route to pass the upstream external-author dispatch restriction without rewriting author trust or affecting ordinary tickets. Auto-run, plan approval, independent self-review, and manual merge controls retain their meanings.
- Use deterministic ingress identity per work item and evidence digest. Concurrent races must not produce a second acceptance or Planning decision. Pending decisions survive a crash/restart and use normal dispatcher recovery. Unchanged rejected evidence is not a reason to enqueue new work repeatedly; stale revision races may be reevaluated on the next sweep.
- Existing metadata and audit/decision surfaces expose waiting, validation, and transition failures. No HTTP schemas, new endpoints, generated HTTP clients, database schema changes, credential changes, or live settings changes are included.

### Verification

- Unit tests cover exact labels, repository/state restrictions, content validation, conflicts, and the narrowly scoped system-acceptance predicate.
- Integration tests exercise the installed patch, real temporary SQLite, shared transition service, persisted evidence/audit, ordinary manual gates, concurrent sweeps, failed remote reads, and restart/dispatch recovery.
- An explicit end-to-end test runs the real loopback Factory Server with a remote GitHub/model fixture, ingests authorized publisher-shaped output, observes automatic Planning and evidence, and verifies one normal Planning kickoff across repeated polls/restart. Only remote calls may be doubled.
- Patch installation is idempotent and rejects dependency version/source drift before writing patched sources. `./scripts/verify` runs formatting, typecheck, V8 coverage, and build. Live GitHub/Copilot acceptance is separately authorized and is not replaced by fixture tests.
