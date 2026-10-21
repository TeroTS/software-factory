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
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
let stop: (() => Promise<void>) | undefined;
const token = randomBytes(24).toString("hex");
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

for (const missing of [
  "FACTORY_ADMIN_TOKEN",
  "FACTORY_CREDENTIAL_ENCRYPTION_KEY",
]) {
  it(`npm run dev fails fast without ${missing}`, () => {
    const env = {
      ...process.env,
      FACTORY_ADMIN_TOKEN: token,
      FACTORY_CREDENTIAL_ENCRYPTION_KEY: key,
    };
    delete env[missing as keyof typeof env];
    const result = spawnSync("npm", ["run", "dev"], {
      cwd: directory,
      env,
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain(`${missing} is required`);
    expect(output).not.toContain(token);
    expect(output).not.toContain(key);
  });
}

it("local developer/admin starts the real Factory Server from .env and observes its local URL", async () => {
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
    `FACTORY_ADMIN_TOKEN=${token}\nFACTORY_CREDENTIAL_ENCRYPTION_KEY=${key}\nPORT=${port}\n`,
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MASTRA_DB_PATH: join(directory, "factory.db"),
    MASTRA_TELEMETRY_DISABLED: "1",
  };
  delete env.FACTORY_ADMIN_TOKEN;
  delete env.FACTORY_CREDENTIAL_ENCRYPTION_KEY;
  delete env.PORT;
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
  const url = `http://localhost:${port}`;
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
  expect(output).not.toContain(token);
  expect(output).not.toContain(key);
  expect(output).not.toContain("FACTORY_CREDENTIAL_ENCRYPTION_KEY is not set");
}, 150_000);
