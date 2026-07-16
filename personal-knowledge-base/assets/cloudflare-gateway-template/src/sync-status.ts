export type SyncMode = "incremental" | "full-sync";
export type SyncAttemptStatus = "running" | "succeeded" | "failed";

export type SyncAttempt = {
  commit: string;
  mode: SyncMode;
  status: SyncAttemptStatus;
  updatedAt: string;
  error?: string;
};

export interface SyncAttemptPort {
  setLastSyncAttempt(attempt: SyncAttempt): Promise<void>;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "sync failed";
}

export async function runTrackedSync<T>(
  state: SyncAttemptPort,
  mode: SyncMode,
  commit: string,
  task: () => Promise<T>,
): Promise<T> {
  await state.setLastSyncAttempt({
    commit,
    mode,
    status: "running",
    updatedAt: new Date().toISOString(),
  });
  try {
    const result = await task();
    await state.setLastSyncAttempt({
      commit,
      mode,
      status: "succeeded",
      updatedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const message = messageFrom(error);
    await state.setLastSyncAttempt({
      commit,
      mode,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: message,
    });
    console.error(JSON.stringify({ event: "knowledgebase_sync_failed", mode, commit, error: message }));
    throw error;
  }
}
