import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { resolveSandboxRoot } from "./sandbox";

it("defaults the sandbox root to the local developer/admin home", () => {
  expect(resolveSandboxRoot({})).toBe(
    join(homedir(), ".mastracode", "web", "sandboxes"),
  );
  expect(resolveSandboxRoot({ MASTRACODE_LOCAL_SANDBOX_ROOT: "  " })).toBe(
    resolveSandboxRoot({}),
  );
});

it("resolves configured relative and absolute sandbox roots", () => {
  expect(
    resolveSandboxRoot({ MASTRACODE_LOCAL_SANDBOX_ROOT: " ./sandboxes " }),
  ).toBe(resolve("sandboxes"));
  expect(
    resolveSandboxRoot({ MASTRACODE_LOCAL_SANDBOX_ROOT: "/tmp/sandbox root" }),
  ).toBe("/tmp/sandbox root");
});
