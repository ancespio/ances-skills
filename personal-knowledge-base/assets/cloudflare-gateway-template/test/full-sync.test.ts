import { describe, expect, it } from "vitest";

import {
  FullSyncCoordinator,
  type FullSyncIndexPort,
  type FullSyncRepositoryPort,
  type FullSyncStatePort,
} from "../src/full-sync";

class Repository implements FullSyncRepositoryPort {
  constructor(private readonly files: Record<string, string>) {}

  async listFiles(): Promise<string[]> {
    return Object.keys(this.files);
  }

  async readFile(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const content = this.files[path];
    return content === undefined ? null : new TextEncoder().encode(content);
  }
}

class Index implements FullSyncIndexPort {
  readonly paths = new Map<string, Set<string>>([
    ["knowledge", new Set(["wiki/concepts/stale.md"])],
    ["evidence", new Set()],
    ["context", new Set()],
  ]);
  readonly uploaded: string[] = [];
  readonly removed: string[] = [];

  async upload(scope: string, path: string): Promise<void> {
    this.uploaded.push(path);
    this.paths.get(scope)?.add(path);
  }

  async remove(scope: string, path: string): Promise<void> {
    this.removed.push(path);
    this.paths.get(scope)?.delete(path);
  }

  async list(scope: string): Promise<string[]> {
    return [...(this.paths.get(scope) ?? [])];
  }
}

class State implements FullSyncStatePort {
  syncedCommit: string | null = null;
  pending: { commit: string; cursor: number } | null = null;

  async getRawForSource(): Promise<string | null> {
    return null;
  }

  async getSourcesForRaw(): Promise<string[]> {
    return [];
  }

  async setSourceRaw(): Promise<void> {}
  async deleteSourceRaw(): Promise<void> {}

  async setSyncedCommit(commit: string): Promise<void> {
    this.syncedCommit = commit;
  }

  async getPendingFullSync(): Promise<{ commit: string; cursor: number } | null> {
    return this.pending;
  }

  async setPendingFullSync(commit: string, cursor: number): Promise<void> {
    this.pending = { commit, cursor };
  }

  async clearPendingFullSync(): Promise<void> {
    this.pending = null;
  }
}

describe("FullSyncCoordinator", () => {
  it("processes bounded batches and publishes the commit only after stale cleanup", async () => {
    const repository = new Repository({
      "wiki/concepts/a.md": "# A",
      "wiki/entities/b.md": "# B",
      "context/persona/user.md": "# User",
      "raw/ignored.md": "ignored",
    });
    const index = new Index();
    const state = new State();
    const coordinator = new FullSyncCoordinator({ repository, index, state }, 2);

    await expect(coordinator.start("abc123")).resolves.toEqual({
      commit: "abc123",
      processed: 2,
      nextCursor: 2,
      complete: false,
      issues: [],
    });
    expect(state.syncedCommit).toBeNull();
    expect(state.pending).toEqual({ commit: "abc123", cursor: 2 });
    expect(index.removed).toEqual([]);

    await expect(coordinator.continue()).resolves.toEqual({
      commit: "abc123",
      processed: 1,
      nextCursor: null,
      complete: true,
      issues: [],
    });
    expect(state.syncedCommit).toBe("abc123");
    expect(state.pending).toBeNull();
    expect(index.uploaded.sort()).toEqual([
      "context/persona/user.md",
      "wiki/concepts/a.md",
      "wiki/entities/b.md",
    ]);
    expect(index.removed).toEqual(["wiki/concepts/stale.md"]);
  });

  it("returns idle when no reconciliation is pending", async () => {
    const coordinator = new FullSyncCoordinator(
      { repository: new Repository({}), index: new Index(), state: new State() },
      20,
    );
    await expect(coordinator.continue()).resolves.toBeNull();
  });
});
