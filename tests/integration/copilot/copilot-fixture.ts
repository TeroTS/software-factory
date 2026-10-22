import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { join } from "node:path";

// GitHub provides no local Copilot emulator; this HTTPS fixture tests transport/scoping, not sign-in.
export async function createCopilotFixture(directory: string) {
  const caFile = join(directory, "copilot-fixture-cert.pem");
  const keyFile = join(directory, "copilot-fixture-key.pem");
  const certificate = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      keyFile,
      "-out",
      caFile,
    ],
    { stdio: "ignore", timeout: 15_000 },
  );
  if (certificate.status !== 0)
    throw new Error("Cannot generate Copilot HTTPS fixture certificate");
  const requests: string[] = [];
  const state = { unavailable: false };
  const tokens = { user: "", org: "" };
  const server = createServer(
    { key: readFileSync(keyFile), cert: readFileSync(caFile) },
    (request, response) => {
      const scope = (["user", "org"] as const).find(
        (scope) => request.headers.authorization === `Bearer ${tokens[scope]}`,
      );
      if (!scope || request.url !== "/models") {
        response.writeHead(401).end();
        return;
      }
      requests.push(scope);
      if (state.unavailable) {
        response.writeHead(503).end();
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          data: [
            {
              id: `${scope}-model`,
              name: `${scope} model`,
              model_picker_enabled: true,
            },
            {
              id: `${scope}-disabled`,
              model_picker_enabled: true,
              policy: { state: "disabled" },
            },
            { id: `${scope}-hidden`, model_picker_enabled: false },
          ],
        }),
      );
    },
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No Copilot fixture port");
  for (const scope of ["user", "org"] as const) {
    tokens[scope] =
      `fixture-only;proxy-ep=127.0.0.1:${address.port};scope=${scope};`;
  }
  return {
    caFile,
    tokens,
    requests,
    state,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
