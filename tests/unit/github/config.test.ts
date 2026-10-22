import { generateKeyPairSync, randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { validateEnvironment } from "../../../src/mastra/env";
import { readGitHubConfiguration } from "../../../src/mastra/github/config";

const privateKey = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
}).privateKey;
const app = {
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: privateKey,
  GITHUB_APP_CLIENT_ID: "Iv1.fixture-client",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret",
  GITHUB_APP_SLUG: "fixture-app",
  FACTORY_STATE_SECRET: randomBytes(32).toString("base64"),
};
const base = {
  FACTORY_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};

it("returns the complete normalized upstream configuration without enabling webhooks", () => {
  const config = readGitHubConfiguration({
    ...app,
    GITHUB_APP_ID: ` ${app.GITHUB_APP_ID} `,
    GITHUB_APP_CLIENT_ID: ` ${app.GITHUB_APP_CLIENT_ID} `,
    GITHUB_APP_SLUG: ` ${app.GITHUB_APP_SLUG} `,
    FACTORY_STATE_SECRET: ` ${app.FACTORY_STATE_SECRET} `,
  });
  expect(config).toMatchObject({
    integration: {
      appId: app.GITHUB_APP_ID,
      clientId: app.GITHUB_APP_CLIENT_ID,
      clientSecret: app.GITHUB_APP_CLIENT_SECRET,
      slug: app.GITHUB_APP_SLUG,
    },
    stateSecret: app.FACTORY_STATE_SECRET,
  });
  expect(config?.integration.privateKey).toContain("BEGIN PRIVATE KEY");
  expect(config?.integration.webhookSecret).toBeUndefined();
  expect(readGitHubConfiguration({})).toBeUndefined();
});

it("keeps GitHub optional when all App settings are absent or blank", () => {
  expect(() => validateEnvironment(base)).not.toThrow();
  expect(() =>
    validateEnvironment({
      ...base,
      ...Object.fromEntries(Object.keys(app).map((name) => [name, "  "])),
    }),
  ).not.toThrow();
});

it.each(Object.keys(app))(
  "rejects missing %s in a partial App configuration without exposing secrets",
  (name) => {
    const env: NodeJS.ProcessEnv = { ...base, ...app, [name]: " " };
    expect(() => validateEnvironment(env)).toThrow(`${name} is required`);
    try {
      validateEnvironment(env);
    } catch (error) {
      expect(String(error)).not.toContain(app.GITHUB_APP_CLIENT_SECRET);
      expect(String(error)).not.toContain(privateKey);
      expect(String(error)).not.toContain(app.FACTORY_STATE_SECRET);
    }
  },
);

it("rejects a lone App setting instead of silently disabling GitHub", () => {
  expect(() =>
    validateEnvironment({ ...base, GITHUB_APP_SLUG: "fixture-app" }),
  ).toThrow("GITHUB_APP_ID is required");
});

it.each(["0", "-1", "not-an-id"])("rejects invalid App ID %s", (id) => {
  expect(() =>
    validateEnvironment({ ...base, ...app, GITHUB_APP_ID: id }),
  ).toThrow("GITHUB_APP_ID");
});

it.each([
  "not-a-private-key",
  "-----BEGIN RSA PRIVATE KEY-----   -----END RSA PRIVATE KEY-----",
  generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey,
])(
  "rejects malformed or non-RSA private keys without exposing them",
  (invalidKey) => {
    const check = () =>
      validateEnvironment({
        ...base,
        ...app,
        GITHUB_APP_PRIVATE_KEY: invalidKey,
      });
    expect(check).toThrow(
      "GITHUB_APP_PRIVATE_KEY must be a valid unencrypted RSA private key",
    );
    try {
      check();
    } catch (error) {
      expect(String(error)).not.toContain(invalidKey);
    }
  },
);

it.each([
  "fixture-not-base64",
  randomBytes(16).toString("base64"),
  `${app.FACTORY_STATE_SECRET}!`,
])("rejects malformed state secrets without exposing them", (secret) => {
  const check = () =>
    validateEnvironment({ ...base, ...app, FACTORY_STATE_SECRET: secret });
  expect(check).toThrow(
    "FACTORY_STATE_SECRET must be a base64-encoded 32-byte key",
  );
  try {
    check();
  } catch (error) {
    expect(String(error)).not.toContain(secret);
  }
});

it.each([
  privateKey,
  privateKey.replaceAll("\n", "\\n"),
  privateKey.replaceAll("\n", ""),
])(
  "accepts complete configuration with upstream-supported PEM formatting",
  (key) => {
    expect(() =>
      validateEnvironment({ ...base, ...app, GITHUB_APP_PRIVATE_KEY: key }),
    ).not.toThrow();
  },
);
