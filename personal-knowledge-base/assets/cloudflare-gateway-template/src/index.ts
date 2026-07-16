import { createApp } from "./app";
import { CloudflareIndex } from "./cloudflare-index";
import { createCloudflareSearchClient } from "./cloudflare-search";
import { FullSyncCoordinator } from "./full-sync";
import { GithubRepositoryClient } from "./github";
import { ensureSearchInstances } from "./instances";
import { KvSyncState } from "./kv-state";
import { queryKnowledgeBase } from "./query";
import { getVerifiedSource, getVerifiedSourceText } from "./source";
import { syncChangedPaths } from "./sync";
import { runTrackedSync } from "./sync-status";

function buildRuntime(env: Env) {
  const state = new KvSyncState(env.SYNC_STATE);
  const repository = new GithubRepositoryClient({
    owner: env.GITHUB_OWNER,
    repository: env.GITHUB_REPOSITORY,
    token: env.GITHUB_TOKEN,
  });
  const index = new CloudflareIndex(env.AI_SEARCH, state);
  const search = createCloudflareSearchClient(env.AI_SEARCH);
  const fullSync = new FullSyncCoordinator({ repository, index, state }, 5);
  const ensureInstances = () => ensureSearchInstances(env.AI_SEARCH);
  const app = createApp({
    actionToken: env.GPT_ACTION_TOKEN,
    adminToken: env.ADMIN_TOKEN,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    query: (input) => queryKnowledgeBase(search, input),
    getSyncedCommit: () => state.getSyncedCommit(),
    getPendingFullSync: () => state.getPendingFullSync(),
    getLastSyncAttempt: () => state.getLastSyncAttempt(),
    setLastSyncAttempt: (attempt) => state.setLastSyncAttempt(attempt),
    syncChanges: async (changes) => {
      await ensureInstances();
      return syncChangedPaths({ repository, index, state }, changes);
    },
    startFullSync: async (commit) => {
      await ensureInstances();
      return fullSync.start(commit);
    },
    continueFullSync: async () => {
      await ensureInstances();
      return fullSync.continue();
    },
    getSource: (slug, commit) => getVerifiedSource(repository, slug, commit),
    getSourceText: (slug, commit, request) =>
      getVerifiedSourceText(repository, slug, commit, request),
  });
  return { app, fullSync, repository, state, ensureInstances };
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { app } = buildRuntime(env);
    return app.fetch(request, ctx);
  },

  async scheduled(controller, env, ctx): Promise<void> {
    const runtime = buildRuntime(env);
    ctx.waitUntil(
      (async () => {
        await runtime.ensureInstances();
        if (controller.cron === "30 2 * * *") {
          const commit = await runtime.repository.getBranchHead("main");
          await runTrackedSync(runtime.state, "full-sync", commit, () =>
            runtime.fullSync.start(commit),
          );
          return;
        }
        const pending = await runtime.state.getPendingFullSync();
        if (pending) {
          await runTrackedSync(runtime.state, "full-sync", pending.commit, () =>
            runtime.fullSync.continue(),
          );
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
