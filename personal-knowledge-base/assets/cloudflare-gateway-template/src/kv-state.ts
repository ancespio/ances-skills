import type { ContentScope } from "./content";
import type { SyncStatePort } from "./sync";
import type { SyncAttempt } from "./sync-status";

export interface KvPort {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function key(prefix: string, value: string): string {
  return `${prefix}:${encodeURIComponent(value)}`;
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("KV mapping is invalid");
  }
  return parsed;
}

function parseSyncAttempt(value: string | null): SyncAttempt | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("sync attempt state is invalid");
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.commit !== "string" ||
    (candidate.mode !== "incremental" && candidate.mode !== "full-sync") ||
    (candidate.status !== "running" &&
      candidate.status !== "succeeded" &&
      candidate.status !== "failed") ||
    typeof candidate.updatedAt !== "string" ||
    (candidate.error !== undefined && typeof candidate.error !== "string")
  ) {
    throw new Error("sync attempt state is invalid");
  }
  return {
    commit: candidate.commit,
    mode: candidate.mode,
    status: candidate.status,
    updatedAt: candidate.updatedAt,
    ...(candidate.error ? { error: candidate.error } : {}),
  };
}

export class KvSyncState implements SyncStatePort {
  constructor(private readonly kv: KvPort) {}

  async getRawForSource(sourcePath: string): Promise<string | null> {
    return this.kv.get(key("source", sourcePath));
  }

  async getSourcesForRaw(rawPath: string): Promise<string[]> {
    return parseStringArray(await this.kv.get(key("raw", rawPath)));
  }

  private async writeRawSources(rawPath: string, sources: string[]): Promise<void> {
    const mappingKey = key("raw", rawPath);
    if (sources.length === 0) {
      await this.kv.delete(mappingKey);
      return;
    }
    await this.kv.put(mappingKey, JSON.stringify([...new Set(sources)].sort()));
  }

  async setSourceRaw(sourcePath: string, rawPath: string): Promise<void> {
    const sourceKey = key("source", sourcePath);
    const oldRawPath = await this.kv.get(sourceKey);
    if (oldRawPath && oldRawPath !== rawPath) {
      const oldSources = await this.getSourcesForRaw(oldRawPath);
      await this.writeRawSources(
        oldRawPath,
        oldSources.filter((source) => source !== sourcePath),
      );
    }
    await this.kv.put(sourceKey, rawPath);
    const newSources = await this.getSourcesForRaw(rawPath);
    await this.writeRawSources(rawPath, [...newSources, sourcePath]);
  }

  async deleteSourceRaw(sourcePath: string): Promise<void> {
    const sourceKey = key("source", sourcePath);
    const rawPath = await this.kv.get(sourceKey);
    await this.kv.delete(sourceKey);
    if (!rawPath) return;
    const sources = await this.getSourcesForRaw(rawPath);
    await this.writeRawSources(
      rawPath,
      sources.filter((source) => source !== sourcePath),
    );
  }

  async setSyncedCommit(commit: string): Promise<void> {
    await this.kv.put("sync:commit", commit);
  }

  async getSyncedCommit(): Promise<string | null> {
    return this.kv.get("sync:commit");
  }

  async setLastSyncAttempt(attempt: SyncAttempt): Promise<void> {
    await this.kv.put("sync:last-attempt", JSON.stringify(attempt));
  }

  async getLastSyncAttempt(): Promise<SyncAttempt | null> {
    return parseSyncAttempt(await this.kv.get("sync:last-attempt"));
  }

  async setItemId(scope: ContentScope, path: string, itemId: string): Promise<void> {
    await this.kv.put(key(`item:${scope}`, path), itemId);
  }

  async getItemId(scope: ContentScope, path: string): Promise<string | null> {
    return this.kv.get(key(`item:${scope}`, path));
  }

  async deleteItemId(scope: ContentScope, path: string): Promise<void> {
    await this.kv.delete(key(`item:${scope}`, path));
  }

  async getPendingFullSync(): Promise<{ commit: string; cursor: number } | null> {
    const value = await this.kv.get("sync:pending");
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") throw new Error("pending sync state is invalid");
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.commit !== "string" ||
      typeof candidate.cursor !== "number" ||
      !Number.isSafeInteger(candidate.cursor) ||
      candidate.cursor < 0
    ) {
      throw new Error("pending sync state is invalid");
    }
    return { commit: candidate.commit, cursor: candidate.cursor };
  }

  async setPendingFullSync(commit: string, cursor: number): Promise<void> {
    await this.kv.put("sync:pending", JSON.stringify({ commit, cursor }));
  }

  async clearPendingFullSync(): Promise<void> {
    await this.kv.delete("sync:pending");
  }
}
