import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
import { GithubRepositoryClient } from "../src/github";
import { classify, frontmatter, KnowledgeReader, references, type Snapshot } from "../src/mcp-knowledge";
import { serveKnowledgeMcp } from "../src/mcp";
import { githubIdentity, type McpEnv } from "../src/mcp-auth";
import worker, { buildMcpReader } from "../src/mcp-index";

const commit = "a".repeat(40);
function setup() {
  const data = new Map<string, string>();
  const store = { get: async <T>(key: string) => JSON.parse(data.get(key) ?? "null") as T, put: async (key: string, value: string) => { data.set(key, value); } };
  const github = new GithubRepositoryClient({ owner: "example-owner", repository: "example-kb", token: "test" });
  return { data, store, github, reader: new KnowledgeReader(github, store as Pick<KVNamespace, "get" | "put">) };
}
const snapshot: Snapshot = { commit, updatedAt: "2026-09-30", documents: [
  { path: "literature/project/README.md", blobSha: "1", content: "# 注意力论文笔记\n[原文](../../raw/articles/paper.md)\n[译文](../../wiki/derived/pdfs/paper/transcript.md)\n[[paper]]" },
  { path: "wiki/sources/paper.md", blobSha: "2", content: "---\ntitle: 注意力\nraw_file: raw/articles/paper.md\nraw_sha256: '" + "0".repeat(64) + "'\nconfidence: low\nmetadata:\n  title: nested title\n---\n来源摘要" },
  { path: "context/persona/user.md", blobSha: "3", content: "---\nremote_access: always\n---\n注意力偏好" },
  { path: "context/diary/2026-09-30.md", blobSha: "4", content: "---\nremote_access: on-demand\n---\n注意力日记" },
] };

describe("GitHub-only MCP", () => {
  it("keeps deployment entrypoints, resources and commands separate", () => {
    const legacy = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
    const mcp = JSON.parse(readFileSync("wrangler.mcp.jsonc", "utf8"));
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(legacy.main).toBe("src/index.ts");
    expect(mcp.main).toBe("src/mcp-index.ts");
    expect(legacy.name).not.toBe(mcp.name);
    expect(mcp).not.toHaveProperty("ai_search_namespaces");
    expect(legacy.ai_search_namespaces[0].binding).toBe("AI_SEARCH");
    expect(mcp.kv_namespaces.map((binding: { binding: string }) => binding.binding)).toEqual(["SYNC_STATE", "OAUTH_KV"]);
    expect(pkg.scripts["deploy:mcp"]).toContain("-c wrangler.mcp.jsonc");
    expect(pkg.scripts.deploy).not.toContain("mcp");
    expect(readFileSync("src/index.ts", "utf8")).not.toContain("mcp");
    expect(pkg.scripts["cf:types:mcp"]).toContain("isolate-mcp-types.mjs");
    expect(readFileSync("mcp-configuration.d.ts", "utf8")).toContain("export type { McpBindings };");
  });
  it("uses the deployer's repository instead of a copied private owner", async () => {
    const { store, data } = setup();
    data.set("mcp:kb:latest", JSON.stringify(snapshot));
    const reader = buildMcpReader({ GITHUB_OWNER: "another-owner", GITHUB_REPOSITORY: "another-kb", GITHUB_MCP_TOKEN: "test", SYNC_STATE: store } as unknown as McpEnv);
    expect((await reader.query({ query: "注意力" })).repository).toBe("another-owner/another-kb");
  });
  it("classifies literature and excludes templates, system pages and derived", () => {
    expect(classify("literature/project/README.md")).toBe("literature");
    for (const path of ["literature/README.md", "literature/templates/reading.md", "wiki/derived/pdfs/paper/transcript.md", "wiki/index.md", "raw/articles/paper.md"]) expect(classify(path)).toBeNull();
    for (const path of ["/context/a.md", "context/../raw/a.md", "context\\a.md", "context//a.md"]) expect(() => classify(path)).toThrow();
  });
  it("parses nested YAML without replacing top-level identity", () => {
    expect(frontmatter(snapshot.documents[1]!.content)).toMatchObject({ title: "注意力", metadata: { title: "nested title" } });
    expect(() => frontmatter("---\ntitle: a\ntitle: b\n---\n")).toThrow();
  });
  it("searches literature and stable context, and only opens diary on demand", async () => {
    const { data, reader } = setup(); data.set("mcp:kb:latest", JSON.stringify(snapshot));
    const result = await reader.query({ query: "注意力" });
    expect(result.literature).toHaveLength(1); expect(result.context).toHaveLength(1);
    expect((await reader.query({ query: "注意力", include_diary: true })).context).toHaveLength(2);
    expect(result.mode).toBe("keyword"); expect(result.commit).toBe(commit);
    expect((await reader.query({ query: "不存在的检索词" })).evidence).toEqual([]);
  });
  it("resolves raw and derived references without reading unchecked originals", () => {
    expect(references(snapshot.documents[0]!, snapshot)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceSlug: "paper", status: "source-needs-verification" }),
      expect.objectContaining({ sourceSlug: "paper", status: "text-needs-verification" }),
    ]));
  });
  it("paginates allowed documents and requires source verification", async () => {
    const { data, reader } = setup(); data.set("mcp:kb:latest", JSON.stringify(snapshot));
    const result = await reader.document("literature/project/README.md", 1, 1, commit);
    expect(result.nextLine).toBe(2); expect(result.complete).toBe(false);
    await expect(reader.document("wiki/sources/paper.md")).rejects.toThrow();
    await expect(reader.document("raw/articles/paper.md")).rejects.toThrow();
    await expect(reader.document("context/persona/user.md", 1, 201)).rejects.toThrow();
    await expect(reader.snapshot("main")).rejects.toThrow();
  });
  it("fails closed on changed raw and always verifies the pinned commit", async () => {
    const { data, reader, github } = setup(); data.set("mcp:kb:latest", JSON.stringify(snapshot));
    const read = vi.spyOn(github, "readFile").mockResolvedValue(new TextEncoder().encode(snapshot.documents[1]!.content));
    const hash = vi.spyOn(github, "sha256File").mockResolvedValue("f".repeat(64));
    await expect(reader.source("paper", commit)).rejects.toThrow("校验失败");
    expect(read).toHaveBeenCalledWith("wiki/sources/paper.md", commit);
    expect(hash).toHaveBeenCalledWith("raw/articles/paper.md", commit);
  });
  it("publishes only completed snapshots and reuses unchanged blobs", async () => {
    const { reader, github, data } = setup();
    vi.spyOn(github, "resolveMain").mockResolvedValue(commit);
    vi.spyOn(github, "listBlobs").mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ path: `wiki/concepts/page-${i}.md`, sha: String(i) })));
    const read = vi.spyOn(github, "readFile").mockResolvedValue(new TextEncoder().encode("# 论文"));
    expect((await reader.warm()).complete).toBe(false); expect(data.has("mcp:kb:latest")).toBe(false);
    expect((await reader.warm()).complete).toBe(true); expect(read).toHaveBeenCalledTimes(21);
    expect((await reader.warm()).complete).toBe(true); expect(read).toHaveBeenCalledTimes(21);
  });
  it("exposes exactly four read-only tools through real MCP JSON-RPC", async () => {
    const { reader } = setup();
    const response = await serveKnowledgeMcp(new Request("https://example.com/mcp", {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }), reader);
    const result = await response.json() as { result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean }; inputSchema: { properties: Record<string, unknown> } }> } };
    expect(result.result.tools.map(t => t.name)).toEqual(["queryKnowledgeBase", "getKnowledgeDocument", "getVerifiedSource", "getVerifiedSourceText"]);
    for (const tool of result.result.tools) { expect(tool.annotations.readOnlyHint).toBe(true); expect(tool.inputSchema.properties).not.toHaveProperty("repository"); }
  });
  it("rejects path traversal before any outbound GitHub call", async () => {
    const fetcher = vi.fn(); const client = new GithubRepositoryClient({ owner: "example-owner", repository: "example-kb", token: "test" }, fetcher);
    await expect(client.readFile("raw/../../secret", commit)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires owner identity and no GitHub repository OAuth scopes", async () => {
    const env = { MCP_ALLOWED_LOGIN: "example-owner", MCP_ORIGIN: "https://example.com", GITHUB_OAUTH_CLIENT_ID: "id", GITHUB_OAUTH_CLIENT_SECRET: "secret" } as McpEnv;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "temporary", scope: "" })).mockResolvedValueOnce(Response.json({ login: "someone-else", id: 2 }));
    await expect(githubIdentity(env, "code", "verifier", fetcher)).rejects.toThrow();
    const broad = vi.fn().mockResolvedValue(Response.json({ access_token: "temporary", scope: "repo" }));
    await expect(githubIdentity(env, "code", "verifier", broad)).rejects.toThrow(); expect(broad).toHaveBeenCalledTimes(1);
    const valid = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "temporary", scope: "" })).mockResolvedValueOnce(Response.json({ login: "example-owner", id: 1 }));
    await expect(githubIdentity(env, "code", "verifier", valid)).resolves.toEqual({ login: "example-owner", userId: "1" });
  });
  it("protects anonymous MCP and publishes discovery without touching AI Search", async () => {
    const { store } = setup();
    const env = { OAUTH_KV: store, SYNC_STATE: store, MCP_ORIGIN: "https://example.com" } as unknown as McpEnv;
    Object.defineProperty(env, "AI_SEARCH", { get() { throw new Error("AI Search must not be used"); } });
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    const protectedResponse = await worker.fetch(new Request("https://example.com/mcp") as Parameters<typeof worker.fetch>[0], env, ctx);
    expect(protectedResponse.status).toBe(401); expect(await protectedResponse.text()).not.toContain("注意力");
    const discovery = await worker.fetch(new Request("https://example.com/.well-known/oauth-authorization-server") as Parameters<typeof worker.fetch>[0], env, ctx);
    expect(discovery.status).toBe(200);
    expect(await discovery.json()).toMatchObject({ registration_endpoint: "https://example.com/oauth/register", authorization_endpoint: "https://example.com/authorize" });
    const resource = await worker.fetch(new Request("https://example.com/.well-known/oauth-protected-resource/mcp") as Parameters<typeof worker.fetch>[0], env, ctx);
    expect(resource.status).toBe(200);
    expect(await resource.json()).toMatchObject({ resource: "https://example.com/mcp", authorization_servers: ["https://example.com"] });
  });
  it("keeps the MCP deployment independent from legacy AI Search endpoints", async () => {
    const env = {} as unknown as McpEnv;
    Object.defineProperty(env, "AI_SEARCH", { get() { throw new Error("AI Search must not be used"); } });
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
    for (const path of ["/v1/query", "/github/webhook", "/admin/full-sync"]) {
      const response = await worker.fetch(new Request(`https://example.com${path}`) as Parameters<typeof worker.fetch>[0], env, ctx);
      expect(response.status).toBe(404);
    }
    await worker.scheduled({} as ScheduledController, env, ctx);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });
});
