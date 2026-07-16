import { classifyRepositoryPath, type ContentScope } from "./content";
import {
  syncChangedPaths,
  type IndexPort,
  type RepositoryPort,
  type SyncIssue,
  type SyncStatePort,
} from "./sync";

export interface FullSyncRepositoryPort extends RepositoryPort {
  listFiles(commit: string): Promise<string[]>;
}

export interface FullSyncIndexPort extends IndexPort {
  list(scope: ContentScope): Promise<string[]>;
}

export interface FullSyncStatePort extends SyncStatePort {
  getPendingFullSync(): Promise<{ commit: string; cursor: number } | null>;
  setPendingFullSync(commit: string, cursor: number): Promise<void>;
  clearPendingFullSync(): Promise<void>;
}

type FullSyncDependencies = {
  repository: FullSyncRepositoryPort;
  index: FullSyncIndexPort;
  state: FullSyncStatePort;
};

export type FullSyncProgress = {
  commit: string;
  processed: number;
  nextCursor: number | null;
  complete: boolean;
  issues: SyncIssue[];
};

const SCOPES: ContentScope[] = ["knowledge", "evidence", "context"];

export class FullSyncCoordinator {
  constructor(
    private readonly dependencies: FullSyncDependencies,
    private readonly batchSize = 1,
  ) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 20) {
      throw new Error("full sync batch size must be between 1 and 20");
    }
  }

  async start(commit: string): Promise<FullSyncProgress> {
    const pending = await this.dependencies.state.getPendingFullSync();
    if (pending?.commit === commit) {
      return this.runBatch(commit, pending.cursor);
    }
    await this.dependencies.state.setPendingFullSync(commit, 0);
    const progress = await this.runBatch(commit, 0);
    if (!progress) throw new Error("full sync did not start");
    return progress;
  }

  async continue(): Promise<FullSyncProgress | null> {
    const pending = await this.dependencies.state.getPendingFullSync();
    if (!pending) return null;
    return this.runBatch(pending.commit, pending.cursor);
  }

  private stateWithoutCommit(): SyncStatePort {
    const state = this.dependencies.state;
    return {
      getRawForSource: (path) => state.getRawForSource(path),
      getSourcesForRaw: (path) => state.getSourcesForRaw(path),
      setSourceRaw: (source, raw) => state.setSourceRaw(source, raw),
      deleteSourceRaw: (source) => state.deleteSourceRaw(source),
      setSyncedCommit: async () => {},
    };
  }

  private async cleanupStale(paths: string[]): Promise<void> {
    const desired = new Map<ContentScope, Set<string>>(
      SCOPES.map((scope) => [scope, new Set<string>()]),
    );
    for (const path of paths) {
      const scope = classifyRepositoryPath(path);
      if (scope) desired.get(scope)?.add(path);
    }
    for (const scope of SCOPES) {
      for (const indexedPath of await this.dependencies.index.list(scope)) {
        if (!desired.get(scope)?.has(indexedPath)) {
          await this.dependencies.index.remove(scope, indexedPath);
        }
      }
    }
  }

  private async runBatch(commit: string, cursor: number): Promise<FullSyncProgress> {
    const repositoryPaths = (await this.dependencies.repository.listFiles(commit)).sort();
    const indexablePaths = repositoryPaths.filter(
      (path) => classifyRepositoryPath(path) !== null,
    );
    const batch = indexablePaths.slice(cursor, cursor + this.batchSize);
    const result = await syncChangedPaths(
      {
        repository: this.dependencies.repository,
        index: this.dependencies.index,
        state: this.stateWithoutCommit(),
      },
      { commit, upsert: batch, remove: [] },
    );
    const next = cursor + batch.length;
    if (next < indexablePaths.length) {
      await this.dependencies.state.setPendingFullSync(commit, next);
      return {
        commit,
        processed: batch.length,
        nextCursor: next,
        complete: false,
        issues: result.issues,
      };
    }

    await this.cleanupStale(repositoryPaths);
    await this.dependencies.state.setSyncedCommit(commit);
    await this.dependencies.state.clearPendingFullSync();
    return {
      commit,
      processed: batch.length,
      nextCursor: null,
      complete: true,
      issues: result.issues,
    };
  }
}
