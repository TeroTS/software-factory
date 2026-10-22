import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LocalSandbox } from "@mastra/core/workspace";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSandbox } from "../../src/mastra/sandbox";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-sandbox-"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

it("creates a missing root and runs real commands in its LocalSandbox session directory", async () => {
  vi.stubEnv("FACTORY_CREDENTIAL_ENCRYPTION_KEY", "host-only-test-sentinel");
  const root = join(directory, "new", "sandboxes");
  const callback = createSandbox({ MASTRACODE_LOCAL_SANDBOX_ROOT: root });
  expect(existsSync(root)).toBe(true);
  const sandbox = callback({
    sessionId: "check-session",
    getRepositoryAccess: undefined,
  });
  expect(sandbox).toBeInstanceOf(LocalSandbox);
  expect(sandbox.provider).toBe("local");
  expect(sandbox.id).toBe("check-session");
  expect(sandbox.workingDirectory).toBe(join(root, "check-session"));
  await sandbox.start();
  try {
    const git = await sandbox.executeCommand!("git", ["--version"]);
    expect(git.exitCode).toBe(0);
    expect(git.stdout).toMatch(/^git version /);
    const cwd = await sandbox.executeCommand!(process.execPath, [
      "-e",
      "console.log(require('node:fs').realpathSync(process.cwd()))",
    ]);
    expect(cwd.exitCode).toBe(0);
    expect(cwd.stdout.trim()).toBe(realpathSync(join(root, "check-session")));
    const env = await sandbox.executeCommand!(process.execPath, [
      "-e",
      "console.log(JSON.stringify({home: process.env.HOME, secret: process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY}))",
    ]);
    expect(env.exitCode).toBe(0);
    expect(JSON.parse(env.stdout)).toEqual({ home: process.env.HOME });
  } finally {
    await sandbox.stop();
  }
  expect(existsSync(sandbox.workingDirectory)).toBe(true);
});

it("preserves existing files and session directories", async () => {
  const callback = createSandbox({ MASTRACODE_LOCAL_SANDBOX_ROOT: directory });
  const sandbox = callback({
    sessionId: "existing",
    getRepositoryAccess: undefined,
  });
  await sandbox.start();
  try {
    const filename = join(sandbox.workingDirectory, "keep.txt");
    writeFileSync(filename, "existing data");
    await sandbox.stop();
    await sandbox.start();
    expect(readFileSync(filename, "utf8")).toBe("existing data");
  } finally {
    await sandbox.stop();
  }
});

it.each([
  "",
  ".",
  "..",
  "../escape",
  "/absolute",
  "nested/session",
  "nested\\session",
  "bad\0id",
])("rejects session ID %j instead of leaving the sandbox root", (sessionId) => {
  const callback = createSandbox({ MASTRACODE_LOCAL_SANDBOX_ROOT: directory });
  expect(() => callback({ sessionId, getRepositoryAccess: undefined })).toThrow(
    "Invalid sandbox session ID",
  );
});

it("fails clearly when a root parent is a file without changing it", () => {
  const blocker = join(directory, "blocked");
  writeFileSync(blocker, "keep");
  expect(() =>
    createSandbox({ MASTRACODE_LOCAL_SANDBOX_ROOT: join(blocker, "root") }),
  ).toThrow("Cannot initialize sandbox root");
  expect(readFileSync(blocker, "utf8")).toBe("keep");
});

it("fails clearly when the sandbox root is not writable", () => {
  chmodSync(directory, 0o500);
  try {
    expect(() =>
      createSandbox({ MASTRACODE_LOCAL_SANDBOX_ROOT: directory }),
    ).toThrow("Cannot initialize sandbox root");
  } finally {
    chmodSync(directory, 0o700);
  }
});

it("runs the standalone npm script end to end and prints Git output and its session directory", () => {
  cpSync("package.json", join(directory, "package.json"));
  for (const path of ["scripts", "src"]) {
    symlinkSync(resolve(path), join(directory, path), "dir");
  }
  const root = join(directory, "script root");
  const result = spawnSync("npm", ["run", "check:sandbox"], {
    cwd: directory,
    env: { ...process.env, MASTRACODE_LOCAL_SANDBOX_ROOT: root },
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toMatch(/git version /);
  const sessions = readdirSync(root);
  expect(sessions).toHaveLength(1);
  expect(result.stdout).toContain(
    `Session directory: ${join(root, sessions[0]!)}`,
  );
  expect(existsSync(join(root, sessions[0]!))).toBe(true);
}, 35_000);

it("the script fails clearly for an unusable root", () => {
  const blocker = join(directory, "blocked");
  writeFileSync(blocker, "keep");
  const result = spawnSync(process.execPath, ["scripts/check-sandbox.ts"], {
    env: { ...process.env, MASTRACODE_LOCAL_SANDBOX_ROOT: blocker },
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Cannot initialize sandbox root");
  expect(readFileSync(blocker, "utf8")).toBe("keep");
}, 35_000);

it("the script exits nonzero when Git cannot be executed", () => {
  const result = spawnSync(process.execPath, ["scripts/check-sandbox.ts"], {
    env: {
      ...process.env,
      PATH: directory,
      MASTRACODE_LOCAL_SANDBOX_ROOT: directory,
    },
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("git --version failed");
}, 35_000);
