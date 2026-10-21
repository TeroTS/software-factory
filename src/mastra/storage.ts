import { accessSync, closeSync, constants, mkdirSync, openSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_RETENTION } from "@mastra/code-sdk/utils/storage-maintenance";
import { LibSQLFactoryStorage } from "@mastra/libsql";

export const vector = undefined;

// The dev runner's MASTRA_PROJECT_ROOT points into rebuilt .mastra; source and bundle are both two levels deep.
export function resolveDatabasePath(
  libsqlUrl: string,
  projectRoot = resolve(import.meta.dirname, "../.."),
): string {
  try {
    const url = new URL(libsqlUrl);
    if (!libsqlUrl.startsWith("file:") || url.search || url.hash) {
      throw new Error("Unsupported storage URL");
    }
    const filename = libsqlUrl.startsWith("file://")
      ? fileURLToPath(url)
      : decodeURIComponent(libsqlUrl.slice(5));
    if (!filename || basename(filename) === ":memory:") {
      throw new Error("A persistent filename is required");
    }
    return resolve(projectRoot, filename);
  } catch {
    throw new Error(
      "LIBSQL_URL must be a local file: URL without query parameters or fragments",
    );
  }
}

export function createFactoryStorage(
  env: NodeJS.ProcessEnv,
  projectRoot?: string,
): LibSQLFactoryStorage {
  const filename = resolveDatabasePath(
    env.LIBSQL_URL ?? "file:./data/factory.db",
    projectRoot,
  );
  try {
    mkdirSync(dirname(filename), { recursive: true });
    accessSync(dirname(filename), constants.W_OK);
    // Opening without writing checks an existing file and creates a missing one without truncation.
    closeSync(openSync(filename, "a"));
    return new LibSQLFactoryStorage({
      id: "mastra-code-storage",
      url: pathToFileURL(filename).href,
      retention: DEFAULT_RETENTION,
    });
  } catch (cause) {
    throw new Error(
      `Cannot initialize Factory storage at ${filename}: check directory and file permissions`,
      { cause },
    );
  }
}
