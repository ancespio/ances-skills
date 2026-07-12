import { describe, expect, it } from "vitest";

import { createApp, type AppDependencies, type ExecutionPort } from "../src/app";

const encoder = new TextEncoder();

async function githubSignature(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `sha256=${Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function dependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  return {
    actionToken: "action-secret",
    adminToken: "admin-secret",
    webhookSecret: "webhook-secret",
    async query(input) {
      return {
        knowledge: [],
        evidence: [],
        context: [],
        warnings: [],
        syncedCommit: input.syncedCommit,
      };
    },
    async getSyncedCommit() {
      return "abc123";
    },
    async syncChanges() {
      return { uploaded: 0, removed: 0, issues: [] };
    },
    async startFullSync(commit) {
      return { commit, processed: 0, nextCursor: null, complete: true, issues: [] };
    },
    async continueFullSync() {
      return null;
    },
    async getSource() {
      return null;
    },
    ...overrides,
  };
}

function execution(): ExecutionPort & { pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil(promise) {
      pending.push(promise);
    },
  };
}

describe("query endpoint", () => {
  it("rejects requests without the private Action bearer token", async () => {
    const app = createApp(dependencies());
    const response = await app.fetch(
      new Request("https://gateway.example/v1/query", { method: "POST", body: "{}" }),
      execution(),
    );
    expect(response.status).toBe(401);
  });

  it("returns structured knowledge results to an authorized Action", async () => {
    const inputs: unknown[] = [];
    const app = createApp(
      dependencies({
        async query(input) {
          inputs.push(input);
          return {
            knowledge: [],
            evidence: [],
            context: [],
            warnings: ["当前知识库没有找到经过完整性验证的来源证据。"],
            syncedCommit: input.syncedCommit,
          };
        },
      }),
    );
    const response = await app.fetch(
      new Request("https://gateway.example/v1/query", {
        method: "POST",
        headers: {
          authorization: "Bearer action-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: "什么是 LLM Wiki？", include_context: true }),
      }),
      execution(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ syncedCommit: "abc123", warnings: expect.any(Array) }),
    );
    expect(inputs).toEqual([
      { query: "什么是 LLM Wiki？", includeContext: true, syncedCommit: "abc123" },
    ]);
  });
});

describe("Action schema endpoint", () => {
  it("publishes a host-specific OpenAPI schema without exposing admin routes", async () => {
    const app = createApp(dependencies());
    const response = await app.fetch(
      new Request("https://gateway.example/openapi.json"),
      execution(),
    );
    const document = (await response.json()) as {
      servers: { url: string }[];
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(document.servers).toEqual([{ url: "https://gateway.example" }]);
    expect(Object.keys(document.paths)).toEqual(["/v1/query", "/v1/sources/{slug}"]);
  });
});

describe("GitHub webhook endpoint", () => {
  it("verifies the signature and schedules a main-branch incremental sync", async () => {
    const changes: unknown[] = [];
    const deps = dependencies({
      async syncChanges(changeSet) {
        changes.push(changeSet);
        return { uploaded: 0, removed: 0, issues: [] };
      },
    });
    const app = createApp(deps);
    const body = JSON.stringify({
      ref: "refs/heads/main",
      after: "a".repeat(40),
      size: 2,
      forced: false,
      commits: [
        {
          added: ["wiki/sources/a.md"],
          modified: ["context/persona/User_Persona.md"],
          removed: [],
        },
        {
          added: [],
          modified: ["wiki/sources/a.md"],
          removed: ["wiki/concepts/old.md"],
        },
      ],
    });
    const ctx = execution();
    const response = await app.fetch(
      new Request("https://gateway.example/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "push",
          "x-hub-signature-256": await githubSignature(body, "webhook-secret"),
        },
        body,
      }),
      ctx,
    );

    expect(response.status).toBe(202);
    await Promise.all(ctx.pending);
    expect(changes).toEqual([
      {
        commit: "a".repeat(40),
        upsert: ["wiki/sources/a.md", "context/persona/User_Persona.md"],
        remove: ["wiki/concepts/old.md"],
      },
    ]);
  });

  it("rejects an invalid signature before parsing the payload", async () => {
    const app = createApp(dependencies());
    const response = await app.fetch(
      new Request("https://gateway.example/github/webhook", {
        method: "POST",
        headers: { "x-github-event": "push", "x-hub-signature-256": "sha256=bad" },
        body: "not-json",
      }),
      execution(),
    );
    expect(response.status).toBe(401);
  });

  it("ignores pushes to branches other than main", async () => {
    let called = false;
    const app = createApp(
      dependencies({
        async syncChanges() {
          called = true;
          return { uploaded: 0, removed: 0, issues: [] };
        },
      }),
    );
    const body = JSON.stringify({ ref: "refs/heads/dev", after: "a".repeat(40), commits: [] });
    const response = await app.fetch(
      new Request("https://gateway.example/github/webhook", {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": await githubSignature(body, "webhook-secret"),
        },
        body,
      }),
      execution(),
    );
    expect(response.status).toBe(202);
    expect(called).toBe(false);
  });

  it("starts a full sync for forced or truncated pushes", async () => {
    const commits: string[] = [];
    const app = createApp(
      dependencies({
        async startFullSync(commit) {
          commits.push(commit);
          return { commit, processed: 0, nextCursor: null, complete: true, issues: [] };
        },
      }),
    );
    const body = JSON.stringify({
      ref: "refs/heads/main",
      after: "b".repeat(40),
      size: 3,
      forced: false,
      commits: [{ added: [], modified: [], removed: [] }],
    });
    const ctx = execution();
    await app.fetch(
      new Request("https://gateway.example/github/webhook", {
        method: "POST",
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": await githubSignature(body, "webhook-secret"),
        },
        body,
      }),
      ctx,
    );
    await Promise.all(ctx.pending);
    expect(commits).toEqual(["b".repeat(40)]);
  });
});

describe("admin sync endpoints", () => {
  it("starts and continues a bounded reconciliation with the admin token", async () => {
    const calls: string[] = [];
    const app = createApp(
      dependencies({
        async startFullSync(commit) {
          calls.push(`start:${commit}`);
          return { commit, processed: 20, nextCursor: 20, complete: false, issues: [] };
        },
        async continueFullSync() {
          calls.push("continue");
          return {
            commit: "c".repeat(40),
            processed: 4,
            nextCursor: null,
            complete: true,
            issues: [],
          };
        },
      }),
    );
    const headers = {
      authorization: "Bearer admin-secret",
      "content-type": "application/json",
    };

    const started = await app.fetch(
      new Request("https://gateway.example/admin/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ commit: "c".repeat(40) }),
      }),
      execution(),
    );
    const continued = await app.fetch(
      new Request("https://gateway.example/admin/sync/continue", {
        method: "POST",
        headers,
      }),
      execution(),
    );

    expect(started.status).toBe(200);
    expect(continued.status).toBe(200);
    expect(calls).toEqual([`start:${"c".repeat(40)}`, "continue"]);
  });

  it("does not accept the Action token for admin operations", async () => {
    const app = createApp(dependencies());
    const response = await app.fetch(
      new Request("https://gateway.example/admin/sync/continue", {
        method: "POST",
        headers: { authorization: "Bearer action-secret" },
      }),
      execution(),
    );
    expect(response.status).toBe(401);
  });
});

describe("source endpoint", () => {
  it("returns a verified full source to the private Action", async () => {
    const app = createApp(
      dependencies({
        async getSource(slug, commit) {
          expect(slug).toBe("example-source");
          expect(commit).toBe("abc123");
          return {
            slug,
            path: "wiki/sources/example-source.md",
            title: "示例来源",
            content: "# 示例来源",
            rawFile: "raw/articles/example.md",
            rawSha256: "a".repeat(64),
            lastVerified: "2026-07-10",
            commit,
          };
        },
      }),
    );
    const response = await app.fetch(
      new Request("https://gateway.example/v1/sources/example-source", {
        headers: { authorization: "Bearer action-secret" },
      }),
      execution(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ slug: "example-source", commit: "abc123" }),
    );
  });

  it("returns 404 when no synced commit or verified source exists", async () => {
    const app = createApp(dependencies({ async getSyncedCommit() { return null; } }));
    const response = await app.fetch(
      new Request("https://gateway.example/v1/sources/example-source", {
        headers: { authorization: "Bearer action-secret" },
      }),
      execution(),
    );
    expect(response.status).toBe(404);
  });
});
