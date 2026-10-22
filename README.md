# software-factory

Local Mastra Factory Server with SQLite persistence, LocalSandbox execution, and GitHub Copilot.

**Local use only.** There is no login or caller verification: anything reaching the server receives administrator capabilities, including command execution. Keep it bound to `127.0.0.1`; never expose it through a proxy, tunnel, or LAN. LocalSandbox runs as your OS user without isolation—use trusted repositories only.

## Quick start

Requires macOS/Linux, Node.js 22.19.0 (`.nvmrc`) with npm, Git, OpenSSL, and network access for installation.

```bash
./scripts/setup
test -f .env || cp .env.example .env
```

For a **new installation**, generate a key and set `FACTORY_CREDENTIAL_ENCRYPTION_KEY` in `.env`:

```bash
openssl rand -base64 32
```

Never overwrite an existing key or commit `.env`. No admin token is needed.

```bash
npm run dev
```

Open [localhost:4111](http://localhost:4111). Stop with Ctrl-C.

## Configuration and data

See [`.env.example`](.env.example) for optional port, public URL, database, and sandbox-root settings. Keep the public URL consistent with the port.

- SQLite defaults to `data/factory.db`; `LIBSQL_URL` accepts another local `file:` URL. Relative paths resolve against this repository, and missing parent directories are created.
- Keep the encryption key paired with the database when backing up or moving it. Lost/replaced keys make stored credentials unreadable. Existing databases and legacy identity scopes are not migrated automatically.
- To verify persistence, restart Factory with the same database/key and confirm your Factory and provider connections remain available.
- Optional GitHub repository access: [GitHub setup](docs/github-setup.md).

## Verify

```bash
./scripts/verify          # formatting, typecheck, tests + coverage, build
npm run check:sandbox     # prints Git version and retained session directory
```

Setup installs Chromium. On Linux, also install its system libraries:

```bash
npm exec -- playwright-core install-deps chromium
```

Tests need no `.env`, provider sign-in, or database service. Coverage: `coverage/index.html`. For coverage alone, run `npm run test:coverage`.

Development commands, compatibility patches, and upgrade constraints: [`AGENTS.md`](AGENTS.md). Do not skip npm install scripts; they apply required Copilot and session-handoff compatibility patches.
