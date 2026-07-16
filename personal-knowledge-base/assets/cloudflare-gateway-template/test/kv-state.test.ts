import { describe, expect, it } from "vitest";

import { KvSyncState, type KvPort } from "../src/kv-state";

class FakeKv implements KvPort {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("KvSyncState", () => {
  it("maintains source-to-raw and raw-to-sources mappings", async () => {
    const kv = new FakeKv();
    const state = new KvSyncState(kv);

    await state.setSourceRaw("wiki/sources/a.md", "raw/a.md");
    await state.setSourceRaw("wiki/sources/b.md", "raw/a.md");

    await expect(state.getRawForSource("wiki/sources/a.md")).resolves.toBe("raw/a.md");
    await expect(state.getSourcesForRaw("raw/a.md")).resolves.toEqual([
      "wiki/sources/a.md",
      "wiki/sources/b.md",
    ]);
  });

  it("moves a source when raw_file changes", async () => {
    const kv = new FakeKv();
    const state = new KvSyncState(kv);
    await state.setSourceRaw("wiki/sources/a.md", "raw/old.md");

    await state.setSourceRaw("wiki/sources/a.md", "raw/new.md");

    await expect(state.getSourcesForRaw("raw/old.md")).resolves.toEqual([]);
    await expect(state.getSourcesForRaw("raw/new.md")).resolves.toEqual([
      "wiki/sources/a.md",
    ]);
  });

  it("removes both sides of a deleted source mapping", async () => {
    const kv = new FakeKv();
    const state = new KvSyncState(kv);
    await state.setSourceRaw("wiki/sources/a.md", "raw/a.md");

    await state.deleteSourceRaw("wiki/sources/a.md");

    await expect(state.getRawForSource("wiki/sources/a.md")).resolves.toBeNull();
    await expect(state.getSourcesForRaw("raw/a.md")).resolves.toEqual([]);
  });

  it("stores sync commit and item IDs independently", async () => {
    const kv = new FakeKv();
    const state = new KvSyncState(kv);

    await state.setSyncedCommit("abc123");
    await state.setItemId("evidence", "wiki/sources/a.md", "item-1");

    await expect(state.getSyncedCommit()).resolves.toBe("abc123");
    await expect(state.getItemId("evidence", "wiki/sources/a.md")).resolves.toBe("item-1");
    await state.deleteItemId("evidence", "wiki/sources/a.md");
    await expect(state.getItemId("evidence", "wiki/sources/a.md")).resolves.toBeNull();
  });

  it("stores and clears resumable full-sync progress", async () => {
    const state = new KvSyncState(new FakeKv());

    await state.setPendingFullSync("abc123", 20);
    await expect(state.getPendingFullSync()).resolves.toEqual({ commit: "abc123", cursor: 20 });
    await state.clearPendingFullSync();
    await expect(state.getPendingFullSync()).resolves.toBeNull();
  });

  it("stores the latest sync attempt", async () => {
    const state = new KvSyncState(new FakeKv());
    const attempt = {
      commit: "abc123",
      mode: "incremental" as const,
      status: "failed" as const,
      updatedAt: "2026-07-15T00:00:00.000Z",
      error: "upload failed",
    };

    await state.setLastSyncAttempt(attempt);
    await expect(state.getLastSyncAttempt()).resolves.toEqual(attempt);
  });
});
