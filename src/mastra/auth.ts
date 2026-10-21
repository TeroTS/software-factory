import type { IMastraAuthProvider } from "@mastra/core/server";

const identity = Object.freeze({
  id: "local-admin",
  name: "Local developer/admin",
  organizationId: "local",
});

// Identity assignment only, not credential verification. Keep the server loopback-only.
export function createLocalIdentityProvider(): IMastraAuthProvider<
  typeof identity
> {
  return {
    name: "local-identity",
    async authenticateToken() {
      return identity;
    },
    authorizeUser(user) {
      return (
        user.id === identity.id &&
        user.organizationId === identity.organizationId
      );
    },
    mapUserToResourceId() {
      return identity.id;
    },
  };
}
