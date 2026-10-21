import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env";

const valid = {
  FACTORY_ADMIN_TOKEN: "test-only-token",
  FACTORY_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};

describe("Factory environment", () => {
  it("accepts valid configuration", () => {
    expect(() => validateEnvironment(valid)).not.toThrow();
  });

  for (const name of Object.keys(valid)) {
    for (const value of [undefined, "", " \t "]) {
      it(`rejects ${name} when ${JSON.stringify(value)}`, () => {
        expect(() => validateEnvironment({ ...valid, [name]: value })).toThrow(
          `${name} is required`,
        );
      });
    }
  }

  for (const key of [
    "invalid-secret",
    randomBytes(16).toString("base64"),
    "!".repeat(44),
  ]) {
    it("rejects malformed encryption keys without exposing them", () => {
      const check = () =>
        validateEnvironment({
          ...valid,
          FACTORY_CREDENTIAL_ENCRYPTION_KEY: key,
        });
      expect(check).toThrow(
        "FACTORY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
      try {
        check();
      } catch (error) {
        expect(String(error)).not.toContain(key);
        expect(String(error)).not.toContain(valid.FACTORY_ADMIN_TOKEN);
      }
    });
  }
});
