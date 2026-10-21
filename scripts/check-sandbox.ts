import { randomUUID } from "node:crypto";
import { createSandbox } from "../src/mastra/sandbox.ts";

try {
  const sandbox = createSandbox(process.env)({
    sessionId: `check-${randomUUID()}`,
    getRepositoryAccess: undefined,
  });
  try {
    await sandbox.start();
    const result = await sandbox.executeCommand!("git", ["--version"]);
    if (result.exitCode !== 0) {
      throw new Error(
        `git --version failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    console.log(result.stdout.trim());
    console.log(`Session directory: ${sandbox.workingDirectory}`);
  } finally {
    await sandbox.stop();
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Sandbox check failed",
  );
  process.exitCode = 1;
}
