import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { applyApprovedTicketCompatibility } from "../../src/mastra/compatibility/approved-ticket";

const files = [
  "dist/rules/transition-service.js",
  "dist/rules/dispatcher.js",
  "dist/routes/surface.js",
  "dist/factory.js",
  "dist/integrations/github/rules.js",
  "dist/integrations/github/integration.js",
  "dist/integrations/github/issue-reconciler.js",
];
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factory-label-patch-"));
  const installed = resolve("node_modules/@mastra/factory");
  for (const file of ["package.json", ...files]) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    cpSync(join(installed, file), join(directory, file));
  }
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("reapplies idempotently and installs the authored policy module", () => {
  applyApprovedTicketCompatibility(directory, "export const fixture = true;");
  const patched = files.map((file) =>
    readFileSync(join(directory, file), "utf8"),
  );
  applyApprovedTicketCompatibility(directory, "export const fixture = true;");
  expect(
    files.map((file) => readFileSync(join(directory, file), "utf8")),
  ).toEqual(patched);
  expect(
    readFileSync(
      join(directory, "dist/integrations/github/approved-ticket.js"),
      "utf8",
    ),
  ).toBe("export const fixture = true;");
});
it("rejects a version change before writing", () => {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ version: "0.24.1" }),
  );
  expect(() => applyApprovedTicketCompatibility(directory, "fixture")).toThrow(
    "requires @mastra/factory@0.24.0",
  );
  expect(
    existsSync(join(directory, "dist/integrations/github/approved-ticket.js")),
  ).toBe(false);
});
it.each(files)(
  "rejects drift in %s without partially writing other sources",
  (file) => {
    writeFileSync(join(directory, file), "upstream drift");
    const before = files.map((path) =>
      readFileSync(join(directory, path), "utf8"),
    );
    expect(() =>
      applyApprovedTicketCompatibility(directory, "fixture"),
    ).toThrow("Unexpected label approval source");
    expect(
      files.map((path) => readFileSync(join(directory, path), "utf8")),
    ).toEqual(before);
    expect(
      existsSync(
        join(directory, "dist/integrations/github/approved-ticket.js"),
      ),
    ).toBe(false);
  },
);
