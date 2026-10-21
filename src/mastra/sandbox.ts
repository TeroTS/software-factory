import { accessSync, constants, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { LocalSandbox } from "@mastra/core/workspace";
import type { FactorySandboxContext } from "@mastra/core/workspace";

export function resolveSandboxRoot(env: NodeJS.ProcessEnv): string {
  return resolve(
    env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() ||
      join(homedir(), ".mastracode", "web", "sandboxes"),
  );
}

export function createSandbox(
  env: NodeJS.ProcessEnv,
): (context: FactorySandboxContext) => LocalSandbox {
  const root = resolveSandboxRoot(env);
  try {
    mkdirSync(root, { recursive: true });
    accessSync(root, constants.W_OK | constants.X_OK);
  } catch (cause) {
    throw new Error(
      `Cannot initialize sandbox root at ${root}: check directory and permissions`,
      { cause },
    );
  }

  return ({ sessionId }) => {
    if (
      !sessionId ||
      sessionId === "." ||
      sessionId === ".." ||
      /[/\\\0]/.test(sessionId)
    ) {
      throw new Error("Invalid sandbox session ID");
    }
    return new LocalSandbox({
      id: sessionId,
      workingDirectory: join(root, sessionId),
      timeout: 30_000,
      env: { HOME: homedir() },
    });
  };
}
