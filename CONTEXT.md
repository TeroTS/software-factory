# Domain Vocabulary

## Canonical Terms

### Factory project

This repository: the self-hosted Mastra Factory codebase, scaffolded with `create-factory --no-platform`. Repositories that agents change live elsewhere.

### Factory Server

The running Factory process started with `npm run dev`. It serves Factory at `http://localhost:4111` by default.

### Local developer/admin

The single human actor who runs and opens the Factory Server locally, without signing in. The local identity provider assigns requests this actor's fixed identity without verifying the caller. The server remains bound strictly to `127.0.0.1`; no admin token is used.

### Local identity provider

The Factory auth adapter that assigns every request the same non-secret `local-admin` identity, displayed as `Local developer/admin`, with the fixed organization ID `local` required by Factory, without credential verification or session storage. It satisfies Factory's identity and organizations-provider contracts, granting administration only to `local-admin` in existing organization `local`, without provisioning or credential migration. It supplies no access protection: anything able to reach the server is treated as the local developer/admin, including for organization-wide administration.

### Credential encryption key

The `FACTORY_CREDENTIAL_ENCRYPTION_KEY` value that encrypts stored provider and integration credentials. It must stay paired with the database in `data/`.

### Coding agent session

A Factory agent run that executes commands in `LocalSandbox` on the local machine.

### Sandbox root

The base directory for LocalSandbox session directories: `MASTRACODE_LOCAL_SANDBOX_ROOT`, or `~/.mastracode/web/sandboxes` when unset.

### Session directory

The directory `<sandbox root>/<sessionId>` where one coding agent session runs commands and checks out the repository.

_Avoid:_ per-session directory, session working directory

### Sandbox check script

The standalone npm script that runs a command through the same `LocalSandbox` configuration Factory uses.

### Work item

A unit of work on a Factory board, such as an issue that a coding agent session acts on.

### Model pack

A named set of Build, Plan, and Fast model choices in Factory. The selected default for this project is `github-copilot`.
