import { describe, expect, it } from "vitest";
import {
  APPROVAL_REPOSITORY,
  approvalReason,
  type ApprovalIssue,
} from "../../../src/mastra/github/approved-ticket";

const issue = (input: Partial<ApprovalIssue> = {}): ApprovalIssue => ({
  title: "Fixture",
  url: `https://github.com/${APPROVAL_REPOSITORY}/issues/12`,
  state: "open",
  labels: ["ready-for-agent", "factory-approved"],
  body: "## What to build\nAdd x.\n\n## Acceptance criteria\n- [ ] x\n",
  ...input,
});

describe("deterministic label approval", () => {
  it("accepts substantive sections including single-letter content", () => {
    expect(approvalReason(APPROVAL_REPOSITORY, issue())).toBeNull();
  });
  it.each([
    { state: "closed" as const },
    { labels: undefined },
    { labels: ["ready-for-agent"] },
    { labels: ["factory-approved"] },
    { labels: ["READY-FOR-AGENT", "factory-approved"] },
    { labels: ["ready-for-agent", "factory-approved", "needs-triage"] },
    { body: undefined },
    { body: null },
    { body: "## What to build\n\n## Acceptance criteria\n- [ ]\n" },
    {
      body: "## What to build\n<!-- nothing -->\n## Acceptance criteria\n- [ ]\n",
    },
    {
      body: "```md\n## What to build\nExample\n## Acceptance criteria\nExample\n```\n",
    },
    { body: "## What to build\nBuild it.\n" },
    { body: "## What to build\n\n## Acceptance criteria\nVerified.\n" },
    {
      body: "```md\n## What to build\nExample\n## Acceptance criteria\nExample\n",
    },
  ])("retains Intake for invalid input %j", (input) => {
    expect(approvalReason(APPROVAL_REPOSITORY, issue(input))).toBeTypeOf(
      "string",
    );
  });
  it("rejects a different repository", () => {
    expect(approvalReason("elsewhere/repo", issue())).toContain("Repository");
  });
  it("fails closed when the current issue cannot be read", () => {
    expect(approvalReason(APPROVAL_REPOSITORY, undefined)).toContain(
      "unavailable",
    );
  });
  it("accepts CRLF and heading case without accepting empty checkbox padding", () => {
    expect(
      approvalReason(
        APPROVAL_REPOSITORY,
        issue({
          body: "## WHAT TO BUILD\r\nBuild.\r\n## ACCEPTANCE CRITERIA\r\n- [ ] Verified.\r\n",
        }),
      ),
    ).toBeNull();
  });
});
