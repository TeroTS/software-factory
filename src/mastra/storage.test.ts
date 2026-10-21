import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDatabasePath, vector } from "./storage";

const root = resolve("/factory-project");

describe("Factory database path", () => {
  it("resolves relative paths against the project root", () => {
    expect(resolveDatabasePath("file:./data/factory.db", root)).toBe(
      resolve(root, "data/factory.db"),
    );
  });

  it("falls back to the repository root independently of relative database paths", () => {
    expect(resolveDatabasePath("file:./data/factory.db")).toBe(
      resolve(import.meta.dirname, "../../data/factory.db"),
    );
  });

  it("preserves absolute local paths", () => {
    const filename = resolve("/another-project/state.db");
    expect(resolveDatabasePath(`file:${filename}`, root)).toBe(filename);
  });

  it("supports encoded file URLs and encoded relative filenames", () => {
    const filename = resolve("/another project/state #1.db");
    expect(resolveDatabasePath(pathToFileURL(filename).href, root)).toBe(
      filename,
    );
    expect(resolveDatabasePath("file:./data/state%20%231.db", root)).toBe(
      resolve(root, "data/state #1.db"),
    );
  });

  it.each([
    "",
    "file:",
    "data/factory.db",
    ":memory:",
    "file::memory:",
    "libsql://example.test/factory",
    "file://remote-host/factory.db",
    "file:./factory.db?mode=memory",
    "file:./factory.db#fragment",
    "file:./bad%escape.db",
  ])("rejects unsupported storage URL %j", (url) => {
    expect(() => resolveDatabasePath(url, root)).toThrow(
      "LIBSQL_URL must be a local file: URL",
    );
  });

  it("does not configure a vector store", () => {
    expect(vector).toBeUndefined();
  });
});
