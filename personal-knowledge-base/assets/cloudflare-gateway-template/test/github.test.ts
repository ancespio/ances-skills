import { afterEach, describe, expect, it, vi } from "vitest";

import { GithubRepositoryClient } from "../src/github";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GithubRepositoryClient", () => {
  it("does not rebind the Workers runtime fetch function to the repository client", async () => {
    vi.stubGlobal(
      "fetch",
      function runtimeFetch(this: unknown) {
        if (this !== undefined) throw new TypeError("Illegal invocation");
        return Promise.resolve(Response.json({ truncated: false, tree: [] }));
      },
    );
    const client = new GithubRepositoryClient({
      owner: "example-owner",
      repository: "example-knowledgebase",
      token: "github-token",
    });

    await expect(client.listFiles("abc123")).resolves.toEqual([]);
  });

  it("reads a private file at an exact commit", async () => {
    const requests: Request[] = [];
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return new Response("知识库", { status: 200 });
      },
    );

    const content = await client.readFile("raw/articles/带 空格.md", "abc123");

    expect(new TextDecoder().decode(content ?? undefined)).toBe("知识库");
    expect(requests[0]?.url).toBe(
      "https://api.github.com/repos/example-owner/example-knowledgebase/contents/raw/articles/%E5%B8%A6%20%E7%A9%BA%E6%A0%BC.md?ref=abc123",
    );
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer github-token");
    expect(requests[0]?.headers.get("accept")).toBe("application/vnd.github.raw+json");
  });

  it("returns null for a missing file", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () => new Response("not found", { status: 404 }),
    );
    await expect(client.readFile("raw/missing.md", "abc123")).resolves.toBeNull();
  });

  it("hashes a raw file as a stream without buffering it through readFile", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () => new Response("test", { status: 200 }),
    );

    await expect(client.sha256File("raw/pdfs/example.pdf", "abc123")).resolves.toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("lists only blobs from a recursive Git tree", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () =>
        Response.json({
          truncated: false,
          tree: [
            { path: "wiki/sources/a.md", type: "blob" },
            { path: "context", type: "tree" },
            { path: "context/persona/user.md", type: "blob" },
          ],
        }),
    );

    await expect(client.listFiles("abc123")).resolves.toEqual([
      "wiki/sources/a.md",
      "context/persona/user.md",
    ]);
  });

  it("rejects a truncated Git tree instead of silently missing files", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () => Response.json({ truncated: true, tree: [] }),
    );
    await expect(client.listFiles("abc123")).rejects.toThrow("Git tree response was truncated");
  });

  it("reads the current main branch commit for scheduled reconciliation", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () => Response.json({ object: { sha: "d".repeat(40) } }),
    );
    await expect(client.getBranchHead("main")).resolves.toBe("d".repeat(40));
  });

  it("throws a bounded GitHub error without including response content", async () => {
    const client = new GithubRepositoryClient(
      { owner: "example-owner", repository: "example-knowledgebase", token: "github-token" },
      async () => new Response("private response body", { status: 403 }),
    );
    await expect(client.readFile("wiki/sources/a.md", "abc123")).rejects.toThrow(
      "GitHub request failed with status 403",
    );
  });
});
