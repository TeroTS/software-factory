# Local GitHub setup

Factory works without these settings. To connect repositories, configure a personal GitHub App and install it only on your disposable test repository. Keep Factory loopback-only; no tunnel, webhook relay, or classic PAT is needed.

## App settings

- Callback URL and Setup URL: `http://localhost:4111/auth/github/callback`.
- Webhooks: inactive; no events.
- Installation availability: only your personal account.
- Initial repository permissions: Contents read-only, Issues read/write, Pull requests read-only, and Metadata read-only. These are derived from upstream's checkout/intake operations; verify the live flow before considering them sufficient. Do not broaden access silently.

## Local credentials

Add all six settings to your existing `.env`, using your own values:

```dotenv
GITHUB_APP_ID=<numeric App ID>
GITHUB_APP_PRIVATE_KEY="<complete PEM private key, not its filename>"
GITHUB_APP_CLIENT_ID=<OAuth Client ID>
GITHUB_APP_CLIENT_SECRET=<OAuth Client secret>
GITHUB_APP_SLUG=<App URL slug>
FACTORY_STATE_SECRET=<separate base64-encoded 32-byte key>
```

Quoted multiline PEM contents or literal `\n` escapes are supported. Keep private keys, client secrets, and tokens out of chat, Git, screenshots, and logs.

Generate the separate state key once:

```bash
openssl rand -base64 32
```

Keep it stable across restarts. **Do not replace `FACTORY_CREDENTIAL_ENCRYPTION_KEY`**: it protects existing database credentials.

```bash
npm run predev
npm run dev
```

Partial/invalid App configuration stops startup with the relevant variable name. No GitHub requests are needed for validation. If using another port, update `PORT`, `MASTRACODE_PUBLIC_URL`, and the App callback/setup URLs together.

## Connect and verify

1. With Factory running, open its GitHub connection flow and authorize the App. When installing, select only the disposable repository.
2. Connect that repository to a Factory and choose an available Copilot model under **Factory models**. Leave automatic execution disabled.
3. Manually start one work item with this instruction:
   > Run only `git status` in the checked-out repository and show its output. Do not edit files, commit, push, or create a pull request. Stop after displaying the command result.
4. Inspect the retained LocalSandbox session directory and actual session command output. An agent's summary alone is not evidence of command execution. Unexpected writes, denied access, clone errors, and model failures are not a successful check; do not delete existing data to retry.

The initial README commit made when creating the test repository is separate from this command-only run. Installation tokens handle repository access; a separate personal access token is unnecessary. Polling handles repository updates without webhook ingress.
