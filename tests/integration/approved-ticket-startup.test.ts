import { createFactorySecretEncryption } from "@mastra/factory";
import { ModelCredentialsStorage } from "@mastra/factory/storage/domains/credentials/base";
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  cpSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createServer as reservePort } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  approvalBody,
  openApprovalDatabase,
  seedApprovalRepository,
} from "./fixtures/approval-database";

it("automatically accepts to-tickets-shaped labeled output and starts Planning once through the real loopback server", async () => {
  const directory = mkdtempSync(join(tmpdir(), "factory-approved-startup-"));
  let stop: (() => Promise<void>) | undefined;
  let output = "";
  let modelCalls = 0;
  let issueReads = 0;
  const requests: string[] = [];
  const issue = {
    number: 12,
    title: "Approved publisher fixture",
    body: approvalBody,
    state: "open",
    html_url: "https://github.com/TeroTS/factory-smoke-test/issues/12",
    labels: [{ name: "ready-for-agent" }],
    user: { login: "outsider" },
    assignees: [],
    created_at: "",
    updated_at: new Date().toISOString(),
  };
  const remote = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture");
    requests.push(`${request.method} ${url.pathname}`);
    const json = (body: unknown) =>
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(body));
    if (url.pathname === "/github/app/installations/7/access_tokens")
      return json({
        token: "fixture-installation",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    if (url.pathname.endsWith("/collaborators/outsider/permission"))
      return json({ permission: "read", user: { login: "outsider" } });
    if (
      url.pathname === "/github/repos/TeroTS/factory-smoke-test/issues/12" &&
      request.method === "GET"
    ) {
      issueReads++;
      return json(issue);
    }
    if (
      url.pathname === "/github/repos/TeroTS/factory-smoke-test/issues" &&
      request.method === "GET"
    )
      return json([issue]);
    if (url.pathname === "/github/app")
      return json({ id: 123, slug: "fixture-app", owner: { login: "TeroTS" } });
    if (url.pathname === "/copilot/models")
      return json({
        data: [
          {
            id: "gpt-4.1",
            name: "Fixture model",
            model_picker_enabled: true,
            supported_endpoints: ["/chat/completions"],
          },
        ],
      });
    if (url.pathname === "/copilot/chat/completions") {
      modelCalls++;
      for await (const _chunk of request) {
        /* consume remote model request */
      }
      const chunk = {
        id: "fixture",
        object: "chat.completion.chunk",
        created: 1,
        model: "gpt-4.1",
      };
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(
        `data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: { role: "assistant", content: "Fixture Planning kickoff received." }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
      return;
    }
    if (
      request.method === "DELETE" &&
      url.pathname.includes("/issues/12/labels/")
    ) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(404, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Fixture endpoint not configured" }));
  });
  try {
    remote.listen(0, "127.0.0.1");
    await once(remote, "listening");
    const remoteAddress = remote.address();
    if (!remoteAddress || typeof remoteAddress === "string")
      throw new Error("No fixture port");
    const reservation = reservePort();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const address = reservation.address();
    if (!address || typeof address === "string")
      throw new Error("No server port");
    const port = address.port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    for (const path of ["src", "scripts", "package.json", "tsconfig.json"])
      cpSync(path, join(directory, path), { recursive: true });
    symlinkSync(
      resolve("node_modules"),
      join(directory, "node_modules"),
      "dir",
    );
    const preload = join(directory, "remote-fixture.mjs");
    writeFileSync(
      preload,
      `const original = globalThis.fetch;\nglobalThis.fetch = (input, init) => {\nconst url = new URL(input instanceof Request ? input.url : input);\nconst prefix = url.hostname === "api.github.com" ? "/github" : /githubcopilot\\.com$/.test(url.hostname) ? "/copilot" : null;\nif (prefix) { const target = "http://127.0.0.1:${remoteAddress.port}" + prefix + url.pathname + url.search; return original(input instanceof Request ? new Request(target, input) : target, init); }\nif (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("External network blocked by approval fixture: " + url.hostname);\nreturn original(input, init);\n};\n`,
    );
    const key = randomBytes(32);
    const seed = await openApprovalDatabase(directory);
    const { project } = await seedApprovalRepository(seed);
    await seed.projects.update({
      orgId: "local",
      id: project.id,
      input: {
        autoRunEnabled: true,
        defaultModelId: "github-copilot/gpt-4.1",
        modelScope: "factory",
      },
    });
    const credentials = seed.database.registerDomain(
      new ModelCredentialsStorage(
        createFactorySecretEncryption({ primary: { id: "v1", key } }),
      ),
    );
    await credentials.ensureReady();
    await credentials.setCredential({ orgId: "local" }, "github-copilot", {
      type: "oauth",
      access: "fixture-access",
      refresh: "fixture-refresh",
      expires: Date.now() + 3600000,
    });
    await seed.database.close();
    // Discovery only imports tickets published after the repository was linked.
    issue.created_at = new Date().toISOString();
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: directory,
      NODE_OPTIONS: `--import=${preload}`,
      NODE_ENV: "test",
      MASTRA_TELEMETRY_DISABLED: "1",
      FACTORY_CREDENTIAL_ENCRYPTION_KEY: key.toString("base64"),
      FACTORY_STATE_SECRET: randomBytes(32).toString("base64"),
      PORT: String(port),
      MASTRACODE_PUBLIC_URL: `http://127.0.0.1:${port}`,
      MASTRACODE_LOCAL_SANDBOX_ROOT: join(directory, "sandboxes"),
      MASTRACODE_GITHUB_PR_RECONCILE_ENABLED: "false",
      MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS: "500",
      GITHUB_APP_ID: "123",
      GITHUB_APP_PRIVATE_KEY: privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
      GITHUB_APP_CLIENT_ID: "fixture",
      GITHUB_APP_CLIENT_SECRET: "fixture",
      GITHUB_APP_SLUG: "fixture-app",
    };
    const base = `http://127.0.0.1:${port}`;
    async function start() {
      const child = spawn("npm", ["run", "dev"], {
        cwd: directory,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      stop = async () => {
        if (child.exitCode !== null) return;
        const exited = once(child, "exit");
        process.kill(-child.pid!, "SIGTERM");
        const force = setTimeout(() => {
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {}
        }, 5000);
        await exited;
        clearTimeout(force);
      };
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null)
              throw new Error(`Fixture server exited: ${output}`);
            try {
              return (
                await fetch(`${base}/auth/me`, {
                  signal: AbortSignal.timeout(1000),
                })
              ).ok;
            } catch {
              return false;
            }
          },
          { timeout: 60000, interval: 500 },
        )
        .toBe(true);
    }
    const items = async () => {
      const response = await fetch(
        `${base}/web/factory/projects/${project.id}/work-items`,
      );
      expect(response.status, output).toBe(200);
      return z
        .object({
          workItems: z.array(
            z.object({
              id: z.string(),
              stages: z.array(z.string()),
              acceptedAt: z.string().nullable(),
              metadata: z.record(z.string(), z.unknown()).nullable(),
            }),
          ),
        })
        .parse(await response.json()).workItems;
    };
    await start();
    await expect
      .poll(async () => (await items()).length, {
        timeout: 15000,
        interval: 500,
      })
      .toBe(1);
    expect((await items())[0]).toMatchObject({
      stages: ["intake"],
      acceptedAt: null,
    });
    // Authorized, complete publisher output: approval is applied only after publication.
    issue.labels.push({ name: "factory-approved" });
    await expect
      .poll(async () => (await items())[0]?.stages, {
        timeout: 15000,
        interval: 500,
      })
      .toEqual(["planning"]);
    expect((await items())[0]?.metadata).toMatchObject({
      factoryApproval: { decision: "eligible", body: approvalBody },
    });
    await expect
      .poll(() => modelCalls, { timeout: 20000, interval: 500 })
      .toBeGreaterThan(0);
    const auditResponse = await fetch(
      `${base}/web/factory/projects/${project.id}/audit`,
    );
    expect(await auditResponse.json()).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          actorType: "system",
          actorId: "factory-label-approval",
          action: "factory.work_item.stage_moved",
        }),
      ]),
    });
    const beforeRestart = issueReads;
    await expect
      .poll(() => issueReads, { timeout: 5000 })
      .toBeGreaterThan(beforeRestart + 1);
    await stop?.();
    await start();
    await expect
      .poll(() => issueReads, { timeout: 10000 })
      .toBeGreaterThan(beforeRestart + 3);
    await stop?.();
    const reopened = await openApprovalDatabase(directory);
    try {
      const allItems = await reopened.storage.list({
        orgId: "local",
        factoryProjectId: project.id,
      });
      expect(allItems).toHaveLength(1);
      expect(allItems[0]?.stages).toEqual(["planning"]);
      const planning = (
        await reopened.storage.listDeferredDecisions("local", project.id)
      ).filter(
        (entry) =>
          entry.decision.type === "invokeSkill" &&
          entry.decision.role === "plan",
      );
      expect(planning, output).toHaveLength(1);
      expect(planning[0], output).toMatchObject({ status: "succeeded" });
      expect(
        (
          await reopened.storage.listRunBindings(
            "local",
            project.id,
            allItems[0]!.id,
          )
        ).filter((binding) => binding.role === "plan"),
      ).toHaveLength(1);
    } finally {
      await reopened.database.close();
    }
    expect(
      requests.some((request) => /\/events|\/timeline|blocking/.test(request)),
    ).toBe(false);
  } finally {
    await stop?.();
    remote.closeAllConnections();
    await new Promise<void>((resolve) => remote.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
}, 180000);
