# Domain Vocabulary

## Canonical Terms

### Factory project

This repository: the self-hosted Mastra Factory codebase, scaffolded with `create-factory --no-platform`. Repositories that agents change live elsewhere.

### Factory Server

The running Factory process started with `npm run dev`. It serves Factory at `http://localhost:4111` by default.

### Local developer/admin

The single human actor who runs and opens the Factory Server locally, without signing in. The server is unauthenticated and bound strictly to `127.0.0.1`; no admin token is used.

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
