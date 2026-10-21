import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createFactorySecretEncryption } from "@mastra/factory";
import { ModelCredentialsStorage } from "@mastra/factory/storage/domains/credentials/base";
import { chromium } from "playwright-core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { z } from "zod";
import { createFactoryStorage } from "../src/mastra/storage";
import { createCopilotFixture } from "./copilot-fixture";

let directory: string;
let stop: (() => Promise<void>) | undefined;
let copilotFixture:
  | Awaited<ReturnType<typeof createCopilotFixture>>
  | undefined;
const key = randomBytes(32).toString("base64");

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-startup-"));
  for (const path of ["src", "scripts", "package.json", "tsconfig.json"]) {
    cpSync(path, join(directory, path), { recursive: true });
  }
  symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "dir");
});

afterEach(async () => {
  await stop?.();
  stop = undefined;
  await copilotFixture?.close();
  copilotFixture = undefined;
  rmSync(directory, { recursive: true, force: true });
});

it("npm run dev fails fast without the credential encryption key", () => {
  const env = { ...process.env };
  delete env.FACTORY_CREDENTIAL_ENCRYPTION_KEY;
  const result = spawnSync("npm", ["run", "dev"], {
    cwd: directory,
    env,
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  const output = result.stdout + result.stderr;
  expect(output).toContain("FACTORY_CREDENTIAL_ENCRYPTION_KEY is required");
  expect(output).not.toContain(key);
});

it.each(["predev", "dev"])(
  "%s fails fast when storage cannot be created",
  (script) => {
    const blocker = join(directory, "blocked");
    writeFileSync(blocker, "keep existing data");
    const result = spawnSync("npm", ["run", script], {
      cwd: directory,
      env: {
        ...process.env,
        FACTORY_CREDENTIAL_ENCRYPTION_KEY: key,
        LIBSQL_URL: `file:${blocker}/factory.db`,
      },
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain("Cannot initialize Factory storage");
    expect(output).not.toContain(key);
  },
);

it("local developer/admin discovers scoped Copilot models and saved Factory data after restarting the loopback-only server", async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  writeFileSync(
    join(directory, ".env"),
    `FACTORY_CREDENTIAL_ENCRYPTION_KEY=${key}\nPORT=${port}\n`,
  );
  copilotFixture = await createCopilotFixture(directory);
  const fixture = copilotFixture;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_EXTRA_CA_CERTS: fixture.caFile,
    MASTRA_TELEMETRY_DISABLED: "1",
    MASTRACODE_LOCAL_SANDBOX_ROOT: join(directory, "sandboxes"),
  };
  delete env.LIBSQL_URL;
  delete env.MASTRA_DB_PATH;
  delete env.FACTORY_ADMIN_TOKEN;
  delete env.FACTORY_CREDENTIAL_ENCRYPTION_KEY;
  delete env.PORT;
  const url = `http://localhost:${port}`;
  async function startServer(): Promise<void> {
    const child = spawn("npm", ["run", "dev"], {
      cwd: directory,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
    });
    stop = async () => {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      process.kill(-child.pid!, "SIGTERM");
      const force = setTimeout(() => {
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {}
      }, 5000);
      await exited;
      clearTimeout(force);
    };
    await expect
      .poll(
        async () => {
          if (child.exitCode !== null)
            throw new Error(`Factory exited: ${output}`);
          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(2000),
            });
            const body = await response.text();
            return response.ok && body.includes("<html");
          } catch {
            return false;
          }
        },
        { timeout: 120_000, interval: 1000 },
      )
      .toBe(true);
    expect(output).toContain(`http://127.0.0.1:${port}`);
    expect(output).not.toContain(key);
    expect(output).not.toContain(
      "FACTORY_CREDENTIAL_ENCRYPTION_KEY is not set",
    );
  }
  expect(existsSync(join(directory, "data"))).toBe(false);
  await startServer();
  expect(existsSync(join(directory, "sandboxes"))).toBe(true);
  expect(existsSync(join(directory, "data", "factory.db"))).toBe(true);
  const agents = await fetch(`${url}/api/agents`);
  expect(agents.status).toBe(200);
  expect(await agents.json()).toBeTypeOf("object");
  const auth = await fetch(`${url}/auth/me`);
  expect(auth.status).toBe(200);
  const identityStatus = await auth.json();
  expect(identityStatus).toMatchObject({
    authenticated: true,
    provider: "local-identity",
    user: {
      userId: "local-admin",
      name: "Local developer/admin",
      organizationId: "local",
    },
  });
  expect(auth.headers.get("set-cookie")).toBeNull();
  const suppliedCredentials = await fetch(
    `${url}/auth/me?userId=another-user`,
    {
      headers: {
        Authorization: "Bearer another-user",
        Cookie: "mastra-token=another-user",
      },
    },
  );
  expect(suppliedCredentials.status).toBe(200);
  expect(await suppliedCredentials.json()).toEqual(identityStatus);
  expect(suppliedCredentials.headers.get("set-cookie")).toBeNull();
  const projects = await fetch(`${url}/web/factory/projects`);
  expect(projects.status).toBe(200);
  expect(await projects.json()).toEqual({ projects: [] });
  for (const address of Object.values(networkInterfaces()).flat()) {
    if (address?.family === "IPv4" && !address.internal) {
      await expect(
        fetch(`http://${address.address}:${port}`, {
          signal: AbortSignal.timeout(2000),
        }),
      ).rejects.toThrow();
    }
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await expect
      .poll(() => page.getByRole("heading", { level: 1 }).allTextContents(), {
        timeout: 15_000,
      })
      .toEqual(["Set up your factory."]);
    const start = page.getByRole("button", {
      name: "Create my first factory",
      exact: true,
    });
    expect(await start.isVisible()).toBe(true);
    expect(await start.isEnabled()).toBe(true);
    expect(new URL(page.url()).pathname).not.toBe("/signin");
    expect(await page.locator('input[type="password"]').count()).toBe(0);
    expect(await context.cookies()).toEqual([]);

    const name = "Persistence check";
    const created = await fetch(`${url}/web/factory/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({ project: { name } });
    const projectId = z
      .object({ project: z.object({ id: z.string() }) })
      .parse(createdBody).project.id;
    async function expectCopilotSignIn(): Promise<void> {
      const providers = await fetch(`${url}/web/config/providers`);
      expect(providers.status).toBe(200);
      expect(await providers.json()).toMatchObject({
        orgKeyAdmin: true,
        providers: expect.arrayContaining([
          expect.objectContaining({
            provider: "github-copilot",
            source: "none",
            oauth: { supported: true, modes: ["device-code"] },
          }),
        ]),
      });
      const models = await fetch(`${url}/web/config/models`);
      expect(models.status).toBe(200);
      const catalog = z
        .object({ models: z.array(z.object({ provider: z.string() })) })
        .parse(await models.json());
      expect(
        catalog.models.filter((model) => model.provider === "github-copilot"),
      ).toEqual([]);
      for (const section of ["personal-models", "models"]) {
        await page.goto(`${url}/factories/${projectId}/settings/${section}`);
        const signIn = page.getByRole("button", {
          name: "Sign in to GitHub Copilot",
          exact: true,
        });
        await expect.poll(() => signIn.isVisible()).toBe(true);
        expect(await signIn.isEnabled()).toBe(true);
      }
    }
    await expectCopilotSignIn();
    // Inert fixtures exercise storage permissions, not provider authentication or inference.
    for (const [scope, credential] of [
      ["user", "test-only-personal-credential"],
      ["org", "test-only-organization-credential"],
    ]) {
      const stored = await fetch(`${url}/web/config/providers/anthropic/key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, key: credential }),
      });
      expect(stored.status).toBe(200);
      expect(await stored.json()).toMatchObject({ ok: true });
    }
    await page.goto(url);
    await expect
      .poll(
        () =>
          page
            .getByRole("button", { name: "Select factory", exact: true })
            .allTextContents(),
        {
          timeout: 15_000,
        },
      )
      .toEqual([name]);
    await stop?.();
    await startServer();
    const reopened = await fetch(`${url}/auth/me`);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toEqual(identityStatus);
    expect(reopened.headers.get("set-cookie")).toBeNull();
    const saved = await fetch(`${url}/web/factory/projects`);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ projects: [{ name }] });
    await expectCopilotSignIn();
    const credentialStatus = await fetch(`${url}/web/config/providers`);
    expect(await credentialStatus.json()).toMatchObject({
      providers: expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          source: "stored-user",
          userCredential: "api_key",
          orgCredential: "api_key",
          orgKey: true,
        }),
      ]),
    });
    const removedOrg = await fetch(
      `${url}/web/config/providers/anthropic/key?scope=org`,
      {
        method: "DELETE",
      },
    );
    expect(removedOrg.status).toBe(200);
    expect(await removedOrg.json()).toMatchObject({
      ok: true,
      provider: {
        provider: "anthropic",
        source: "stored-user",
        userCredential: "api_key",
        orgKey: false,
      },
    });
    const removedPersonal = await fetch(
      `${url}/web/config/providers/anthropic/key?scope=user`,
      {
        method: "DELETE",
      },
    );
    expect(removedPersonal.status).toBe(200);
    expect(await removedPersonal.json()).toMatchObject({
      ok: true,
      provider: { provider: "anthropic", source: "none", orgKey: false },
    });
    const credentialDatabase = createFactoryStorage({}, directory);
    const credentialStore = credentialDatabase.registerDomain(
      new ModelCredentialsStorage(
        createFactorySecretEncryption({
          primary: { id: "v1", key: Buffer.from(key, "base64") },
        }),
      ),
    );
    await credentialDatabase.init();
    try {
      await credentialStore.ensureReady();
      for (const scope of ["user", "org"] as const) {
        await credentialStore.setCredential(
          {
            orgId: "local",
            ...(scope === "user" ? { userId: "local-admin" } : {}),
          },
          "github-copilot",
          {
            type: "oauth",
            access: fixture.tokens[scope],
            refresh: "fixture-only",
            expires: Date.now() + 3_600_000,
          },
        );
      }
      async function scopedModels(scope: "user" | "org"): Promise<string[]> {
        const response = await fetch(`${url}/web/config/models?scope=${scope}`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(JSON.stringify(body)).not.toContain("fixture-only");
        const catalog = z
          .object({ models: z.array(z.object({ id: z.string() })) })
          .parse(body);
        return catalog.models.map((model) => model.id);
      }
      for (const scope of ["user", "org"] as const) {
        expect(await scopedModels(scope)).toEqual([
          `github-copilot/${scope}-model`,
        ]);
        await page.goto(
          `${url}/factories/${projectId}/settings/${scope === "user" ? "personal-models" : "models"}`,
        );
        await page
          .getByRole("combobox", {
            name: scope === "user" ? "Default model" : "Factory default model",
            exact: true,
          })
          .click();
        await expect
          .poll(() => page.getByRole("option").allTextContents())
          .toEqual(
            expect.arrayContaining([
              expect.stringContaining(`github-copilot/${scope}-model`),
            ]),
          );
        await page.keyboard.press("Escape");
      }
      await stop?.();
      await startServer();
      expect(await scopedModels("user")).toEqual(["github-copilot/user-model"]);
      expect(await scopedModels("org")).toEqual(["github-copilot/org-model"]);
      fixture.state.unavailable = true;
      expect(await scopedModels("user")).toEqual(["github-copilot/gpt-4.1"]);
      fixture.state.unavailable = false;
      await credentialStore.removeCredential(
        { orgId: "local", userId: "local-admin" },
        "github-copilot",
      );
      expect(await scopedModels("user")).toEqual([]);
      expect(await scopedModels("org")).toEqual(["github-copilot/org-model"]);
      expect(fixture.requests).toEqual(expect.arrayContaining(["user", "org"]));
    } finally {
      await credentialDatabase.close();
    }
    await context.close();
    const freshContext = await browser.newContext();
    const reopenedPage = await freshContext.newPage();
    await reopenedPage.goto(url);
    const selected = reopenedPage.getByRole("button", {
      name: "Select factory",
      exact: true,
    });
    await expect
      .poll(() => selected.allTextContents(), { timeout: 15_000 })
      .toEqual([name]);
    expect(await selected.isVisible()).toBe(true);
    expect(await freshContext.cookies()).toEqual([]);
  } finally {
    await browser.close();
  }
}, 300_000);
