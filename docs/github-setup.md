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

## Label-based automatic acceptance

Only `TeroTS/factory-smoke-test` is eligible for this single-user MVP. In `to-tickets`, explicitly authorize implementation when approving complete, independent tickets. The skill ensures `ready-for-agent` and `factory-approved` exist, publishes with `ready-for-agent`, verifies publication, and applies `factory-approved` last. Publish-only or incomplete/failed publication leaves approval off; no separate manual labeling step is needed.

Factory's existing issue polling checks open Work cards in Intake for both exact labels, nonempty **What to build** and **Acceptance criteria** sections, and no conflicting `needs-triage` label. Eligible tickets enter Planning automatically without Triage or a board click. Missing/invalid input stays in Intake; existing work-item metadata exposes `factoryApproval` evidence and correction reasons, and the normal audit/decision surfaces show the system transition and kickoff. Polling uses the existing GitHub issue interval (upstream default: one hour). For one-minute polling, set `MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000` in your local environment. This does not enable downstream automation.

Existing Auto-start, Auto-approve plans, and independent self-review settings still govern downstream execution; approval does not enable them. An accepted Planning card may wait for normal run approval if Auto-start is off. Merging remains manual. Previously accepted work parked back in Intake is not automatically reaccepted.

**Trust boundary:** there is no approval-actor check. Anyone able to apply `factory-approved` in this repository can authorize execution as your OS user. Review existing labeled tickets before starting an updated server; eligible existing Intake tickets can be accepted on its next sweep. Keep repository access restricted.

Only approve independently ready tickets. Blocker verification/scheduling and edit-history detection are not implemented. Finish ticket edits before approval; remove approval before further Intake edits and reapply after reviewing them. Native dependency links do not delay this MVP's acceptance. Post-acceptance changes retain upstream handling.

Installation scripts apply an idempotent, version/source-checked `@mastra/factory@0.24.0` compatibility patch for issue-body retrieval and narrowly scoped system acceptance through the existing transition service. It does not migrate storage or change identities, credentials, HTTP schemas, or live settings. Review the patch before upgrading Factory.
