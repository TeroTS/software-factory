# Local Self-Hosted Mastra Factory Decisions

Status: Accepted v3 — US-06 smoke test plus one user-approved US-07 automated pipeline test.

## Problem Summary

Extend the existing local Factory project to demonstrate a real repository checkout and Copilot command execution through LocalSandbox. `SPEC.md` remains the behavior backlog; this document records the agreed scope and constraints, not delivery progress.

## US-07 Scope Revision

The user explicitly approved proceeding with one isolated automated pipeline test after the manual smoke test. This revision supersedes the US-06-only exclusions below only for US-07; it does not retroactively expand the earlier smoke test.

- Use only `TeroTS/factory-smoke-test`, one new work item, one branch, and one unmerged pull request adding `PIPELINE_TEST.md` with exactly `Factory pipeline test passed.` and a final newline.
- Reuse existing upstream auto-start, auto-approve plans, and independent self-review. No new orchestration engine, API, UI, or credential scope is authorized.
- Preserve upstream's human acceptance gate for non-bug work. A human may need to move this documentation task into Planning once; after acceptance, the test must progress without manual session starts or chat follow-ups. Do not claim fully unattended issue intake from this narrower test.
- The human approves Contents and Pull requests read/write permissions on the existing App installation, keeping repository selection restricted to the disposable repository. Existing Issues write permission is sufficient for issue interaction. No Checks write permission is requested; leave publishing review test checks off. The installed workspace supports an installation-token fallback for GitHub CLI operations, so do not introduce a PAT preemptively.
- Inspect and isolate the affected Factory before changing its factory-wide automation settings; preserve existing work and saved model defaults. Back up local storage first, record original settings, and restore changed automation settings afterward or on failure.
- A test issue and agent-authored branch/commit/push/PR are allowed only for this task. No merge, auto-merge, default-branch change, destructive cleanup, extra repository access, or automatic App/repository provisioning is authorized.
- Prove the exact diff, validation commands, independent review verdict, linked PR, unchanged default branch, and lack of duplicate dispatch during subsequent polling. Failures must remain visible, not be repaired by manually performing the pipeline steps.
- A separate failing-validation scenario is deferred until the first run succeeds. Live provider calls are acceptance checks, never automated tests using developer credentials.

## Goals and Success Criteria

- Connect one disposable private GitHub repository owned by the local developer/admin's personal account.
- Manually start one work item in Factory.
- Factory checks out that repository into its LocalSandbox session directory.
- Copilot runs `git status` there, and the command output is visible in the coding agent session.
- The smoke-test run makes no code changes, commits, pushes, or pull requests.
- Existing local identity, SQLite persistence, encryption, Copilot connections, and automated verification remain intact.

## Primary Roles / Actors

- **Local developer/admin:** creates the GitHub App, supplies credentials locally, installs it on the test repository, and manually starts/observes the smoke test.
- **Coding agent session:** uses GitHub Copilot to run the requested harmless command in the checked-out repository through LocalSandbox.
- **Coding assistant:** implements Factory integration wiring, configuration validation, and automated tests; prepares setup instructions without receiving secrets through chat.

## Non-Goals

- Webhook delivery, smee.io relays, tunnels, LAN access, or production deployment.
- Changes to repository code, agent-authored commits, pushes, or pull requests.
- Existing project repositories, organization-owned GitHub resources, or broad installation access.
- Other integrations/providers, multiple local users, Factory login, new organization-management UI, or named model-pack UI.
- Automatically creating GitHub resources or entering credentials on the user's behalf.

## Locked Decisions

### Product / Scope

- US-06 is a checkout-and-command smoke test, not an issue-to-PR delivery workflow.
- Use a new private, disposable repository and a dedicated GitHub App under the user's personal GitHub account.
- Selected repository: `https://github.com/TeroTS/factory-smoke-test`; selected App slug: `factory-example`. Install the App only on that repository.
- Manual start and upstream polling replace webhook delivery for this scope.

### UX / Workflow

- Keep the existing Factory UI and manually start the test; no unattended start/approval workflow is added.
- Use the existing Factory-scoped Copilot connection for the work-item run and select an available model through the existing UI.
- The observable result is the checkout plus `git status` output, not an agent's unsupported claim that the command ran.
- Retain the session directory for inspection; do not delete existing sandboxes.

### Data / State / Ownership

- Keep existing SQLite state and `FACTORY_CREDENTIAL_ENCRYPTION_KEY` unchanged.
- Keep fixed identity `local-admin` and organization `local`; personal GitHub ownership does not change Factory's local identity scope.
- The user enters App credentials directly into local `.env`. Never request private keys, client secrets, or access tokens in chat.
- Preserve separation of personal and Factory model credentials; no migration or global copying.

### Interfaces / Contracts

- Reuse installed upstream `GithubIntegration`, repository connection, work-item, and sandbox contracts; no custom HTTP endpoint or UI is planned.
- Wire optional GitHub App configuration through the existing Factory composition. Unconfigured GitHub must not prevent existing non-GitHub functionality from starting; partial configuration must fail clearly without printing secrets.
- The installed integration requires App ID, private key, OAuth client ID/secret, and slug. Factory also requires a stable OAuth state-signing secret for this integration.
- Use App installation credentials for repository access. A separate classic PAT is not required for this command-only scope; upstream can use the installation token when no PAT is configured.

### Operations / Deployment

- Factory remains strictly on `127.0.0.1`, normally port 4111, without caller verification. Never expose it publicly, even temporarily for setup.
- GitHub browser authorization can return to a loopback callback; no webhook ingress is planned.
- Keep npm setup, checked Copilot compatibility patches, and existing verification entrypoints.

## Core Business Rules

- Limit the test to the selected disposable repository; do not silently grant access to other repositories.
- No smoke-test code edits, commits, pushes, or pull requests. Resource provisioning may initialize the repository with its initial README commit before the session starts.
- Do not broaden the inherited host environment. Let upstream inject repository credentials where required; never persist tokens in clone URLs or log them.
- Missing/invalid App credentials, denied repository access, clone failure, or Copilot failure must not be reported as a successful smoke test.

## UX / Workflow Rules

- The human owns GitHub App creation and credential entry; the assistant owns wiring and tests.
- Connecting GitHub repositories remains distinct from connecting Copilot.
- No Factory login, public tunnel, or webhook is introduced to work around integration problems.

## Data / State / Ownership Decisions

- SQLite remains authoritative for Factory state; GitHub owns the test repository/App; the local filesystem owns the checkout.
- Preserve the database/key pair and existing sessions on failures or retries. Do not automatically delete GitHub resources afterward.

## Interface / Contract Expectations

- Upstream HTTP schemas remain unchanged. If a new/changed authored API proves necessary, stop for reviewed OpenAPI-first contracts rather than adding an undocumented endpoint.
- Keep the literal `new Mastra(...)` composition entry and existing LocalSandbox callback.

## Operational / Deployment Constraints

- Use Node from `.nvmrc`, npm, Git, OpenSSL, real local SQLite, and the existing macOS/Linux test path.
- Automated tests isolate files, ports, and credentials from developer state. Test runnable local boundaries for real; remote GitHub behavior may require explicit test fixtures because no local GitHub App emulator is available.
- A real GitHub/Copilot run is a human-assisted acceptance check, not a CI dependency.

## Assumptions

- The disposable repository has an initial README/default branch so checkout can succeed.
- The existing Factory-scoped Copilot connection remains usable; model choice stays in the UI rather than adding configuration.
- Exact App permissions, callback settings, polling controls, and stable state-secret configuration will be derived from the installed upstream implementation before the user creates the App. Request only permissions needed by the selected workflow; do not promise read-only permissions without checking upstream requirements.

## Open Questions

- None requiring another product/scope decision. Repository/App names and credential values are setup inputs; exact upstream configuration and permission requirements still need technical verification.

## Ready for Spec Generation

- Status: yes
- Reason: The user agreed the outcome, resource ownership, repository isolation, ingress policy, and setup responsibilities. US-06 can now be updated from deferred documentation-only scope to the agreed smoke test without inventing product policy. This decision record does not start implementation or replace the completed slice note.
