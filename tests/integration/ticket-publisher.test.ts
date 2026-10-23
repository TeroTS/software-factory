import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("defines explicit implementation authorization and approval-last GitHub publication", () => {
  const skill = readFileSync(".agents/skills/to-tickets/SKILL.md", "utf8");
  expect(skill).toContain(
    "Approve these tickets and authorize Factory to implement them automatically?",
  );
  expect(skill).toContain(
    "implementation and reviewed PR creation, not merging",
  );
  expect(skill).toContain(
    "ensure the exact repository labels `ready-for-agent` and `factory-approved` exist",
  );
  expect(skill).toContain("apply `factory-approved` last");
  expect(skill).toContain(
    "Publish-only, declined/absent implementation authorization, and failed/incomplete publication omit `factory-approved`",
  );
  expect(skill).toContain("only independent tickets");
  expect(skill).toContain("TeroTS/factory-smoke-test");
  expect(skill).toContain("Local files");
  expect(skill).toContain("Do NOT close or modify any parent issue.");
});
