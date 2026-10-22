import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FactoryProjectsStorage } from "@mastra/factory";
import type { FactoryProject } from "@mastra/factory";
import type { LibSQLFactoryStorage } from "@mastra/libsql";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createFactoryStorage } from "../../src/mastra/storage";

let directory: string;
const stores: LibSQLFactoryStorage[] = [];

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-storage-"));
});

afterEach(async () => {
  await Promise.all(stores.splice(0).map((storage) => storage.close()));
  rmSync(directory, { recursive: true, force: true });
});

it("creates the default database under the project root, not the process working directory", async () => {
  expect(existsSync(join(directory, "data"))).toBe(false);
  const storage = createFactoryStorage(
    { MASTRA_PROJECT_ROOT: join(directory, ".mastra") },
    directory,
  );
  stores.push(storage);
  await storage.init();
  expect(existsSync(join(directory, "data", "factory.db"))).toBe(true);
});

it("persists an upstream Factory record through a real write/close/reopen/read round trip", async () => {
  const env = {
    LIBSQL_URL: "file:./nested%20data/state.db",
  };
  const first = createFactoryStorage(env, directory);
  const projects = first.registerDomain(new FactoryProjectsStorage());
  let created: FactoryProject;
  try {
    await first.init();
    await projects.ensureReady();
    created = await projects.create({
      orgId: "local",
      userId: "local-admin",
      input: {
        name: "Saved Factory",
        description: "Survives reopening SQLite",
      },
    });
  } finally {
    await first.close();
  }

  const reopened = createFactoryStorage(env, directory);
  stores.push(reopened);
  const saved = reopened.registerDomain(new FactoryProjectsStorage());
  await reopened.init();
  await saved.ensureReady();
  expect(await saved.get({ orgId: "local", id: created.id })).toEqual(created);
  expect(await saved.list({ orgId: "another-organization" })).toEqual([]);
  expect(existsSync(join(directory, "nested data", "state.db"))).toBe(true);
});

it("fails clearly when a parent path is a file, without changing that file", () => {
  const blocker = join(directory, "blocked");
  writeFileSync(blocker, "keep existing data");
  expect(() =>
    createFactoryStorage({ LIBSQL_URL: `file:${blocker}/factory.db` }),
  ).toThrow("Cannot initialize Factory storage");
  expect(readFileSync(blocker, "utf8")).toBe("keep existing data");
});

it("fails clearly when the database path is a directory", () => {
  expect(() =>
    createFactoryStorage({ LIBSQL_URL: `file:${directory}` }),
  ).toThrow("Cannot initialize Factory storage");
});

it("fails clearly when the parent directory cannot be written", () => {
  chmodSync(directory, 0o500);
  try {
    expect(() =>
      createFactoryStorage({ LIBSQL_URL: "file:./factory.db" }, directory),
    ).toThrow("Cannot initialize Factory storage");
  } finally {
    chmodSync(directory, 0o700);
  }
});

it("fails clearly when an existing database file cannot be written", () => {
  const filename = join(directory, "readonly.db");
  writeFileSync(filename, "");
  chmodSync(filename, 0o400);
  try {
    expect(() =>
      createFactoryStorage({ LIBSQL_URL: `file:${filename}` }),
    ).toThrow("Cannot initialize Factory storage");
  } finally {
    chmodSync(filename, 0o600);
  }
});

it("keeps SQLite databases and journal files ignored by Git", () => {
  const paths = [
    "data/factory.db",
    "data/factory.db-wal",
    "data/factory.db-shm",
    "data/factory.db-journal",
    "custom/state.db",
    "custom/state.db-wal",
    "custom/state.db-shm",
    "custom/state.db-journal",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", ...paths], {
    encoding: "utf8",
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split("\n")).toEqual(paths);
});
