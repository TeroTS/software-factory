import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  cpSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
let stop: (() => Promise<void>) | undefined;
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

it("local developer/admin opens the loopback-only Factory Server without an admin token or sign-in", async () => {
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
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MASTRA_DB_PATH: join(directory, "factory.db"),
    MASTRA_TELEMETRY_DISABLED: "1",
  };
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
  await startServer();
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
  } finally {
    await browser.close();
  }

  await stop?.();
  await startServer();
  const reopened = await fetch(`${url}/auth/me`);
  expect(reopened.status).toBe(200);
  expect(await reopened.json()).toEqual(identityStatus);
  expect(reopened.headers.get("set-cookie")).toBeNull();
}, 300_000);
