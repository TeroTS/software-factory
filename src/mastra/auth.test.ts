import type { IMastraAuthProvider } from "@mastra/core/server";
import { describe, expect, it } from "vitest";
import { createLocalIdentityProvider } from "./auth";

const identity = {
  id: "local-admin",
  name: "Local developer/admin",
  organizationId: "local",
};
const request = new Request("http://localhost:4111/auth/me");

describe("local identity provider", () => {
  it.each([
    { token: "", headers: new Headers() },
    {
      token: "arbitrary-token",
      headers: new Headers({
        Authorization: "Bearer another-user",
        "X-Playground-Access": "another-user",
        Cookie: "mastra-token=another-user; userId=another-user",
        "X-Mastra-Organization-Id": "another-organization",
      }),
    },
  ])(
    "assigns the fixed identity regardless of credentials: $token",
    async ({ token, headers }) => {
      const provider: IMastraAuthProvider<typeof identity> =
        createLocalIdentityProvider();
      const supplied = new Request(
        "http://localhost:4111/auth/me?userId=another-user",
        { headers },
      );
      expect(await provider.authenticateToken(token, supplied)).toEqual(
        identity,
      );
    },
  );

  it("authorizes only the fixed user and organization", async () => {
    const provider: IMastraAuthProvider<typeof identity> =
      createLocalIdentityProvider();
    expect(await provider.authorizeUser(identity, request)).toBe(true);
    expect(
      await provider.authorizeUser(
        { ...identity, id: "another-user" },
        request,
      ),
    ).toBe(false);
    expect(
      await provider.authorizeUser(
        { ...identity, organizationId: "another-organization" },
        request,
      ),
    ).toBe(false);
  });

  it("keeps identity and resource scoping stable across provider instances", async () => {
    const first: IMastraAuthProvider<typeof identity> =
      createLocalIdentityProvider();
    const second: IMastraAuthProvider<typeof identity> =
      createLocalIdentityProvider();
    expect(await first.authenticateToken("", request)).toEqual(identity);
    expect(await second.authenticateToken("", request)).toEqual(identity);
    expect(first.mapUserToResourceId?.(identity)).toBe(identity.id);
    expect(second.mapUserToResourceId?.(identity)).toBe(identity.id);
  });
});
