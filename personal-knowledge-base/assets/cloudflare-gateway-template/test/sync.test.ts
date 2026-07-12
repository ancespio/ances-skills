import { describe, expect, it } from "vitest";

import {
  syncChangedPaths,
  type IndexPort,
  type RepositoryPort,
  type SyncStatePort,
} from "../src/sync";

const encoder = new TextEncoder();
const RAW_HASH = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

class FakeRepository implements RepositoryPort {
  readonly reads: Array<{ path: string; commit: string }> = [];

  constructor(private readonly files: Record<string, string>) {}

  async readFile(path: string, commit: string): Promise<Uint8Array<ArrayBuffer> | null> {
    this.reads.push({ path, commit });
    const content = this.files[path];
    return content === undefined ? null : encoder.encode(content);
  }
}

class FakeIndex implements IndexPort {
  readonly uploads: Array<{
    scope: string;
    path: string;
    content: string;
    metadata: Record<string, string>;
  }> = [];
  readonly removals: Array<{ scope: string; path: string }> = [];

  async upload(
    scope: "evidence" | "knowledge" | "context",
    path: string,
    content: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    this.uploads.push({ scope, path, content, metadata });
  }

  async remove(
    scope: "evidence" | "knowledge" | "context",
    path: string,
  ): Promise<void> {
    this.removals.push({ scope, path });
  }
}

class FakeState implements SyncStatePort {
  readonly sourceToRaw = new Map<string, string>();
  syncedCommit: string | null = null;

  async getRawForSource(sourcePath: string): Promise<string | null> {
    return this.sourceToRaw.get(sourcePath) ?? null;
  }

  async getSourcesForRaw(rawPath: string): Promise<string[]> {
    return [...this.sourceToRaw.entries()]
      .filter(([, value]) => value === rawPath)
      .map(([source]) => source);
  }

  async setSourceRaw(sourcePath: string, rawPath: string): Promise<void> {
    this.sourceToRaw.set(sourcePath, rawPath);
  }

  async deleteSourceRaw(sourcePath: string): Promise<void> {
    this.sourceToRaw.delete(sourcePath);
  }

  async setSyncedCommit(commit: string): Promise<void> {
    this.syncedCommit = commit;
  }
}

function sourceMarkdown(hash = RAW_HASH): string {
  return `---
type: source
title: "示例来源"
raw_file: "raw/articles/example.md"
raw_sha256: "${hash}"
last_verified: 2026-07-10
---

# 示例来源

Raw 不可变。
`;
}

describe("syncChangedPaths", () => {
  it("uploads knowledge, context and verified evidence from the same commit", async () => {
    const repository = new FakeRepository({
      "wiki/concepts/example.md": "---\ntitle: 示例概念\ntype: concept\n---\n# 示例概念",
      "context/persona/User_Persona.md": "# 用户画像\n\n偏好 execution-first。",
      "wiki/sources/example.md": sourceMarkdown(),
      "raw/articles/example.md": "test",
    });
    const index = new FakeIndex();
    const state = new FakeState();

    const result = await syncChangedPaths(
      { repository, index, state },
      {
        commit: "abc123",
        upsert: [
          "wiki/concepts/example.md",
          "context/persona/User_Persona.md",
          "wiki/sources/example.md",
        ],
        remove: [],
      },
    );

    expect(index.uploads.map(({ scope, path }) => ({ scope, path }))).toEqual([
      { scope: "knowledge", path: "wiki/concepts/example.md" },
      { scope: "context", path: "context/persona/User_Persona.md" },
      { scope: "evidence", path: "wiki/sources/example.md" },
    ]);
    expect(index.uploads.at(-1)?.metadata).toEqual({
      title: "示例来源",
      integrity_status: "verified",
      raw_file: "raw/articles/example.md",
      raw_sha256: RAW_HASH,
      last_verified: "2026-07-10",
    });
    expect(state.sourceToRaw.get("wiki/sources/example.md")).toBe("raw/articles/example.md");
    expect(state.syncedCommit).toBe("abc123");
    expect(result.issues).toEqual([]);
    expect(repository.reads.every((read) => read.commit === "abc123")).toBe(true);
  });

  it("removes modified or missing evidence instead of indexing it", async () => {
    const repository = new FakeRepository({
      "wiki/sources/example.md": sourceMarkdown(),
      "raw/articles/example.md": "changed",
    });
    const index = new FakeIndex();
    const state = new FakeState();

    const result = await syncChangedPaths(
      { repository, index, state },
      { commit: "abc123", upsert: ["wiki/sources/example.md"], remove: [] },
    );

    expect(index.uploads).toEqual([]);
    expect(index.removals).toEqual([
      { scope: "evidence", path: "wiki/sources/example.md" },
    ]);
    expect(result.issues).toEqual([
      {
        path: "wiki/sources/example.md",
        code: "source_modified",
        detail: "raw/articles/example.md",
      },
    ]);
  });

  it("revalidates mapped sources when their raw file changes", async () => {
    const repository = new FakeRepository({
      "wiki/sources/example.md": sourceMarkdown(),
      "raw/articles/example.md": "test",
    });
    const index = new FakeIndex();
    const state = new FakeState();
    state.sourceToRaw.set("wiki/sources/example.md", "raw/articles/example.md");

    await syncChangedPaths(
      { repository, index, state },
      { commit: "def456", upsert: ["raw/articles/example.md"], remove: [] },
    );

    expect(index.uploads.map((upload) => upload.path)).toEqual(["wiki/sources/example.md"]);
  });

  it("removes deleted indexed files and their source mapping", async () => {
    const repository = new FakeRepository({});
    const index = new FakeIndex();
    const state = new FakeState();
    state.sourceToRaw.set("wiki/sources/example.md", "raw/articles/example.md");

    await syncChangedPaths(
      { repository, index, state },
      {
        commit: "def456",
        upsert: [],
        remove: ["wiki/sources/example.md", "wiki/concepts/example.md"],
      },
    );

    expect(index.removals).toEqual([
      { scope: "evidence", path: "wiki/sources/example.md" },
      { scope: "knowledge", path: "wiki/concepts/example.md" },
    ]);
    expect(state.sourceToRaw.size).toBe(0);
  });
});
