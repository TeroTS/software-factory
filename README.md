# software-factory

Local, self-hosted Mastra Factory project, scaffolded with `create-factory@0.3.0 --no-platform`.

## Current delivery

US-01 starts the Factory Server; US-02 opens usable Factory onboarding without signing in; US-03 keeps Factory data in project-local SQLite across restarts; US-04 verifies local command execution with the sandbox check script. Browser tests verify onboarding and a saved Factory name after restart. US-05 now exposes personal and Factory-wide GitHub Copilot sign-in through a tested, pinned SDK compatibility patch and fixed local administrator capability. Personal Copilot use and Factory-wide sign-in are user-verified. Both scopes now load their live Copilot catalogs; actual model execution after restart remains a manual check.

**Identity is assigned automatically, not verified.** The local identity provider treats every request as user `local-admin` (display name `Local developer/admin`), administrator of the existing organization `local`. Factory requires an identity and organization to load; no admin token, password, login session, or external identity service is used. Its `/auth/me` reports `authenticated: true`, but that is not proof of who called.

The server binds strictly to `127.0.0.1`. Never expose it through a proxy, tunnel, or LAN address. Anything able to reach it is treated as the local developer/admin and can access its capabilities, including command execution and organization-wide credential/configuration management; loopback is not complete isolation.

## Prerequisites

- Node.js 22.19.0 with npm for the reproducible baseline, pinned in `.nvmrc` and used by CI. The package supports newer Node versions.
- Git, available on `PATH`.
- OpenSSL for generating secrets.
- macOS or Linux for the startup test's process-group cleanup.
- Chromium for the browser test; `./scripts/setup` installs the version matched to the pinned Playwright library. On Linux, install its system libraries with `npm exec -- playwright-core install-deps chromium` (may require administrator privileges).
- Network access for dependency installation; no cloud account is needed to start.

LocalSandbox runs commands as your OS user without isolation. Only use trusted repositories.

## Install

```bash
./scripts/setup
cp .env.example .env
```

`./scripts/setup` runs non-interactive `npm ci` using the committed lockfile, then downloads Chromium for browser tests. npm's `postinstall` applies the Copilot compatibility patch; do not use `--ignore-scripts`. Existing installations can apply it with `npm run postinstall`, then restart Factory. If you use nvm, run `nvm use` first. Do not overwrite an existing `.env`; copying it is needed only before starting the Factory Server, not for verification. Upstream Stagehand/OpenAI dependencies currently produce a Zod peer-version warning; installation still succeeds.

## Environment configuration

Edit `.env` and fill the one required variable:

| Variable                            | Value                         |
| ----------------------------------- | ----------------------------- |
| `FACTORY_CREDENTIAL_ENCRYPTION_KEY` | A base64-encoded 32-byte key. |

Generate the credential encryption key:

```bash
openssl rand -base64 32
```

Never commit or share `.env`. Keep the encryption key stable: losing it makes encrypted credentials unreadable. `FACTORY_ADMIN_TOKEN` and `FACTORY_ADMIN_NAME` are not used; remove them from an existing `.env` if present.

`LIBSQL_URL=file:./data/factory.db` selects the local SQLite file. Relative filenames resolve against the Factory project root, not the shell or dev runner's working directory; an absolute local `file:` URL selects another location. Parent directories are created automatically. Remote URLs, in-memory storage, query parameters, and fragments are not supported. A location that cannot be created or written stops startup with a clear storage error.

Other optional defaults are commented in `.env.example`:

- `PORT=4111`
- `MASTRACODE_PUBLIC_URL=http://localhost:4111`

If changing the port, set the public URL to match. Restart after changing `.env`. A missing, blank, or malformed encryption key stops startup with a variable-specific error that does not print secrets.

## Start

```bash
npm run dev
```

The Factory Server logs its local URL. Open `http://localhost:4111`, or verify the response from another terminal:

```bash
curl --fail http://localhost:4111
```

Factory opens directly without a login step. Verify API access and the assigned identity without sending credentials:

```bash
curl --fail http://localhost:4111/api/agents
curl --fail http://localhost:4111/web/factory/projects
curl --fail http://localhost:4111/auth/me
```

Stop with Ctrl-C. No PostgreSQL, Redis, Docker, or Mastra platform provisioning is required.

## Persistence verification

The default database is `data/factory.db`; its directory is created on first startup. The database and SQLite journal/WAL files are ignored by Git. Keep the credential encryption key paired with this database when backing up or moving it.

Create a verification record once through the existing upstream API; no GitHub or model-provider connection is needed:

```bash
curl --fail http://localhost:4111/web/factory/projects \
  -H 'Content-Type: application/json' \
  --data '{"name":"Persistence check"}'
```

Open Factory and confirm the selected Factory is named `Persistence check`. Stop the server with Ctrl-C, run `npm run dev` again with the same database and encryption key, and confirm the same name is still shown. You can also inspect the saved records:

```bash
curl --fail http://localhost:4111/web/factory/projects
```

**Before upgrading an existing installation:** the default has changed from the upstream Mastra Code database to `data/factory.db`. No old database is moved, copied, or deleted. To keep an existing database, back it up and explicitly set `LIBSQL_URL` to its absolute local `file:` URL before starting; preserve its encryption key. `MASTRA_DB_PATH` no longer selects the Factory database.

**Before reusing existing data:** organization scope remains `local`, but per-user settings/credentials previously stored under user `local` are separate from `local-admin` and will not be transferred automatically. Do not rename the fixed identity, delete data, or change scopes to work around missing settings. Back up the database and agree on any required transition first; no legacy-data migration is included.

## Sandbox verification

```bash
npm run check:sandbox
```

The standalone sandbox check script uses the same explicit `LocalSandbox` callback as Factory. It needs Git on `PATH`, but no running server, encryption key, database, or provider sign-in. It reads `.env` when present and prints `git --version` output and `Session directory: <sandbox root>/check-<unique ID>`, exiting 0 on success and nonzero with an error on failure.

The sandbox root is `MASTRACODE_LOCAL_SANDBOX_ROOT`, defaulting to `~/.mastracode/web/sandboxes` when unset or blank. Set an absolute path in `.env` to avoid differences between shell and dev-runner working directories. Missing roots are created when Factory configures its sandbox or the script runs; blocked or unwritable roots fail clearly. Each session directory is created when its LocalSandbox starts. Existing sessions are not deleted. The check leaves its empty session directory for inspection; remove only that printed directory when no longer needed.

LocalSandbox executes commands directly as your OS user, without isolation or a remote provider. Commands receive `PATH` and `HOME`, not the server's credential environment. This is not a security boundary: commands can still access your files. Use only trusted repositories, and keep Factory loopback-only.

## Connect GitHub Copilot (manual verification)

Settings requires an existing Factory. If onboarding hides Settings and blocks on repository integration, create an empty Factory using the existing API command in **Persistence verification**, then reload; repository integration is not required to connect a personal model provider. In an existing Factory, open the lower-left **Local developer/admin** user menu → **Settings** → **Your models**, or visit `/factories/<factoryId>/settings/personal-models`. **Factory models** (`/factories/<factoryId>/settings/models`) manages organization-wide credentials and the Factory default model. The local identity provider grants administration only to fixed user `local-admin` in existing organization `local`, enabling its sign-in controls without provisioning organizations or changing identity IDs. Personal and organization credentials are separate: connecting **Your models** does not connect **Factory models**, and credentials are never copied between scopes automatically. The current Hybrid model scope uses personal credentials for interactive sessions and organization credentials for work-item runs.

The pinned SDK originally returned no Copilot models before authentication, so Factory never offered its sign-in button. `scripts/apply-copilot-compatibility.ts` reproducibly changes only those two unauthenticated returns in `@mastra/code-sdk@1.15.0` to its existing conservative fallback catalog (`gpt-4.1`). The same install hook version-checks `@mastra/factory@0.24.0` and wires `src/mastra/copilot-catalog.ts` into its existing model picker and session model-switch catalog. It uses the already selected personal/organization credential scope through upstream `TenantCredentialStore` to fetch the live catalog, refresh expired OAuth tokens, and filter hidden/policy-disabled models. It replaces the global Copilot fallback with that scope's returned list without changing other providers or copying tokens to global storage. Upstream's GPT-4.1 fallback remains for catalog/refresh failures, not as a guarantee of account entitlement.

Both patches are idempotent, run on installation, and reject version/source drift before writing. The existing pinned TypeScript compiler generates the small catalog helper inside installed Factory; do not edit that generated copy. No new dependency, HTTP schema, or bundled UI change is involved. Review/remove these compatibility patches when upstream fixes discovery and before upgrading.

Prerequisites: an active GitHub Copilot subscription, network access to GitHub/Copilot, and the Factory Server running with its existing SQLite database and credential encryption key. No additional environment variables or GitHub App are needed for this connection.

1. Open **Your models** for personal credentials or **Factory models** for organization-wide credentials. Under **Sign in with a provider**, click **Sign in to GitHub Copilot**. Complete each connection separately if both scopes are needed.
2. Start its sign-in flow. Open the GitHub verification link shown by Factory, enter the displayed device code, and authorize using the account with your active Copilot subscription. Complete GitHub sign-in yourself; do not share passwords, device codes, or tokens.
3. Return to the selected settings scope and wait for GitHub Copilot to show as connected. If authorization is denied or the code expires, start a new sign-in attempt; do not change the encryption key or delete the database.
4. Select an available GitHub Copilot model as **Default model** in **Your models**, or **Factory default model** in **Factory models**, and save it. The picker now loads your selected scope's live models; availability depends on that account's subscription/policy. Existing saved defaults are not changed automatically, so replace an old default if it is absent from the live catalog. This installed UI selects individual default models, not named SDK model packs; the specification's `github-copilot` model-pack criterion still needs reconciliation before US-05 can be declared complete.
5. Stop the Factory Server with Ctrl-C and run `npm run dev` again using the same database and encryption key. Reopen Settings and confirm the provider remains connected and its models are still available without another sign-in. A full coding agent session is not required for this story.
6. Check the server logs before and after restart: there must be no missing-encryption warning. Do not paste credentials or unredacted authentication logs into issues.

**Keep `FACTORY_CREDENTIAL_ENCRYPTION_KEY` paired with `data/`** (or the database selected by `LIBSQL_URL`) when backing up, moving, or restarting Factory. Provider credentials are stored encrypted in SQLite. Replacing or losing the key makes existing credentials unreadable; never regenerate it just to restart. Keep backups private and preserve the fixed local identity.

These are manual acceptance steps, not a record of a successful connection. Automated real-browser checks confirm personal and Factory-wide Copilot sign-in buttons are enabled before and after restart, while models still require credentials. Real-server checks also verify organization credential write/delete permissions and personal credential preservation across restart using inert test fixtures, without contacting a model provider. Personal use and Factory-wide sign-in have been reported successful. Live API and browser inspection after restart show 12 Copilot models in each scope without another sign-in. Automated tests additionally verify isolated scope-specific catalogs over a local HTTPS fixture, filtering, outage fallback, and upstream credential refresh with real encrypted SQLite storage. They do not use developer credentials or contact GitHub. US-05 remains active until actual model execution after restart is verified and the model-pack/default-model specification mismatch is resolved.

US-06, a full Factory session with a repository checkout, remains deferred: it requires a self-managed GitHub App, which is outside this delivery. Connecting Copilot alone does not verify repository access or command execution by a coding agent session.

## Tests and coverage

```bash
./scripts/verify
```

This is the same verification CI runs: formatting → typecheck → tests with coverage → build. It stops at the first failure. No separate linter is configured. Verification needs no `.env`, external database service, or cloud authentication. Build copies the upstream Factory UI into ignored `src/mastra/public/` and creates ignored `.mastra/` output, including installed dependencies; this step may need network access.

Fast and individual checks:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
npm run typecheck
npm run format:check
npm run build
```

Single-file, module, and test-case targets:

```bash
npm test -- src/mastra/env.test.ts
npm run test:unit -- src/mastra
npm test -- src/mastra/env.test.ts -t "accepts valid configuration"
```

For the startup test alone:

```bash
npm test -- tests/startup.test.ts
```

The startup test runs the real `npm run dev` without an admin token, using a temporary `.env`, SQLite file, and dynamically selected port. It checks HTML, agent and project API responses without credentials, the fixed user/organization from `/auth/me`, absence of session cookies, the logged loopback URL, and refusal of non-loopback IPv4 connections when interfaces are available. A fresh Chromium context must show Factory onboarding and its enabled start button without a sign-in redirect or password field. The test creates a named Factory record through the real upstream API, verifies its name in the UI, restarts against the same temporary `data/factory.db`, and verifies both the saved name in a fresh browser context and identity stability. Browser and server processes are cleaned up even on failure. The test also checks fail-fast startup without the credential encryption key and with a blocked storage path. Separate integration tests exercise real filesystem write failures, a `LibSQLFactoryStorage` write/close/reopen/read round trip, and Git ignore rules. Sandbox tests use temporary roots, execute real Git and working-directory checks through LocalSandbox, verify existing-session preservation and limited environment inheritance, reject invalid session IDs, and invoke the npm script end to end, including command/root failures. It does not use your `.env`, SQLite database, or browser profile.

Coverage reports: `coverage/index.html` and `coverage/lcov.info`. Statements, branches, functions, and lines must each reach 80%. The upstream framework-composition entry is excluded; hand-written environment validation, the local identity provider, storage configuration, and sandbox configuration are included. New behavior modules must remain covered.

`.github/workflows/check.yml` uses `.nvmrc`, `./scripts/setup`, and `./scripts/verify`. No extra CI environment variables or services are required; no deployment pipeline is included. Agent workflow and layout guidance lives in `AGENTS.md`.

## Scaffold provenance

The generator refuses a non-empty target directory. The scaffold was generated in a temporary directory and copied into this repo without its generated `.git`, `.env`, or replacement documentation. Unused cloud/integration configuration, Docker setup, and duplicate bundled agent skills were omitted. Framework initialization retains the upstream `prepare()` → literal `new Mastra(...)` → `finalize()` sequence.
