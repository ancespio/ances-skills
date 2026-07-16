import { authorizeBearer, verifyGithubWebhook } from "./auth";
import type { FullSyncProgress } from "./full-sync";
import { openApiDocument } from "./openapi";
import type { QueryInput, QueryResult } from "./query";
import type {
  SourceTextRequest,
  VerifiedSource,
  VerifiedSourceText,
} from "./source";
import type { SyncResult } from "./sync";
import { runTrackedSync, type SyncAttempt, type SyncMode } from "./sync-status";

type ChangeSet = {
  commit: string;
  upsert: string[];
  remove: string[];
};

export interface AppDependencies {
  actionToken: string;
  adminToken: string;
  webhookSecret: string;
  query(input: QueryInput): Promise<QueryResult>;
  getSyncedCommit(): Promise<string | null>;
  getPendingFullSync(): Promise<{ commit: string; cursor: number } | null>;
  getLastSyncAttempt(): Promise<SyncAttempt | null>;
  setLastSyncAttempt(attempt: SyncAttempt): Promise<void>;
  syncChanges(changes: ChangeSet): Promise<SyncResult>;
  startFullSync(commit: string): Promise<FullSyncProgress>;
  continueFullSync(): Promise<FullSyncProgress | null>;
  getSource(slug: string, commit: string): Promise<VerifiedSource | null>;
  getSourceText(
    slug: string,
    commit: string,
    request: SourceTextRequest,
  ): Promise<VerifiedSourceText | null>;
}

export interface ExecutionPort {
  waitUntil(promise: Promise<unknown>): void;
}

type App = {
  fetch(request: Request, execution: ExecutionPort): Promise<Response>;
};

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

const INCREMENTAL_PATH_LIMIT = 5;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: JSON_HEADERS });
}

async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel("request body too large");
      throw new Error("request body too large");
    }
    chunks.push(new Uint8Array(value));
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseQueryBody(value: unknown): { query: string; includeContext: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.query !== "string") return null;
  if (candidate.include_context !== undefined && typeof candidate.include_context !== "boolean") {
    return null;
  }
  return { query: candidate.query, includeContext: candidate.include_context === true };
}

type PushCommit = { added: string[]; modified: string[]; removed: string[] };
type PushPayload = {
  ref: string;
  after: string;
  forced: boolean;
  size: number;
  commits: PushCommit[];
};

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parsePushPayload(value: unknown): PushPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.ref !== "string" ||
    typeof candidate.after !== "string" ||
    !/^[a-f0-9]{40,64}$/i.test(candidate.after) ||
    !Array.isArray(candidate.commits)
  ) {
    return null;
  }
  const commits: PushCommit[] = [];
  for (const item of candidate.commits) {
    if (!item || typeof item !== "object") return null;
    const commit = item as Record<string, unknown>;
    if (!stringArray(commit.added) || !stringArray(commit.modified) || !stringArray(commit.removed)) {
      return null;
    }
    commits.push({ added: commit.added, modified: commit.modified, removed: commit.removed });
  }
  return {
    ref: candidate.ref,
    after: candidate.after,
    forced: candidate.forced === true,
    size: typeof candidate.size === "number" ? candidate.size : commits.length,
    commits,
  };
}

function changesFromPush(payload: PushPayload): ChangeSet {
  const upsert = new Set<string>();
  const remove = new Set<string>();
  for (const commit of payload.commits) {
    for (const path of [...commit.added, ...commit.modified]) {
      remove.delete(path);
      upsert.add(path);
    }
    for (const path of commit.removed) {
      upsert.delete(path);
      remove.add(path);
    }
  }
  return { commit: payload.after, upsert: [...upsert], remove: [...remove] };
}

function scheduleSync(
  execution: ExecutionPort,
  dependencies: AppDependencies,
  mode: SyncMode,
  commit: string,
  task: () => Promise<unknown>,
): void {
  execution.waitUntil(runTrackedSync(dependencies, mode, commit, task));
}

async function handleQuery(request: Request, dependencies: AppDependencies): Promise<Response> {
  if (!(await authorizeBearer(request, dependencies.actionToken))) {
    return json({ error: "unauthorized" }, 401);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 16 * 1024)));
  } catch {
    return json({ error: "invalid request body" }, 400);
  }
  const input = parseQueryBody(parsed);
  if (!input) return json({ error: "invalid request body" }, 400);
  try {
    const syncedCommit = await dependencies.getSyncedCommit();
    return json(await dependencies.query({ ...input, syncedCommit }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "query failed";
    return json({ error: message }, 400);
  }
}

async function handleWebhook(
  request: Request,
  dependencies: AppDependencies,
  execution: ExecutionPort,
): Promise<Response> {
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = await readBoundedBody(request, 2 * 1024 * 1024);
  } catch {
    return json({ error: "payload too large" }, 413);
  }
  const valid = await verifyGithubWebhook(
    body,
    request.headers.get("x-hub-signature-256") ?? undefined,
    dependencies.webhookSecret,
  );
  if (!valid) return json({ error: "unauthorized" }, 401);
  if (request.headers.get("x-github-event") !== "push") {
    return json({ accepted: true, ignored: "event" }, 202);
  }

  let payload: PushPayload | null;
  try {
    payload = parsePushPayload(JSON.parse(new TextDecoder().decode(body)));
  } catch {
    payload = null;
  }
  if (!payload) return json({ error: "invalid push payload" }, 400);
  if (payload.ref !== "refs/heads/main") {
    return json({ accepted: true, ignored: "branch" }, 202);
  }

  const changes = changesFromPush(payload);
  const changedPathCount = changes.upsert.length + changes.remove.length;
  const pendingFullSync = await dependencies.getPendingFullSync();
  if (
    pendingFullSync !== null ||
    payload.forced ||
    payload.size > payload.commits.length ||
    changedPathCount > INCREMENTAL_PATH_LIMIT
  ) {
    scheduleSync(execution, dependencies, "full-sync", payload.after, () =>
      dependencies.startFullSync(payload.after),
    );
    return json({ accepted: true, mode: "full-sync", targetCommit: payload.after }, 202);
  } else {
    scheduleSync(execution, dependencies, "incremental", payload.after, () =>
      dependencies.syncChanges(changes),
    );
    return json({ accepted: true, mode: "incremental", targetCommit: payload.after }, 202);
  }
}

async function handleAdminSync(
  request: Request,
  dependencies: AppDependencies,
  shouldStart: boolean,
): Promise<Response> {
  if (!(await authorizeBearer(request, dependencies.adminToken))) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!shouldStart) return json(await dependencies.continueFullSync());

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 4 * 1024)));
  } catch {
    return json({ error: "invalid request body" }, 400);
  }
  if (!parsed || typeof parsed !== "object") return json({ error: "invalid request body" }, 400);
  const commit = (parsed as Record<string, unknown>).commit;
  if (typeof commit !== "string" || !/^[a-f0-9]{40,64}$/i.test(commit)) {
    return json({ error: "invalid commit" }, 400);
  }
  return json(await dependencies.startFullSync(commit));
}

async function handleSource(
  request: Request,
  dependencies: AppDependencies,
  slug: string,
): Promise<Response> {
  if (!(await authorizeBearer(request, dependencies.actionToken))) {
    return json({ error: "unauthorized" }, 401);
  }
  const commit = await dependencies.getSyncedCommit();
  if (!commit) return json({ error: "verified source not found" }, 404);
  const source = await dependencies.getSource(slug, commit);
  return source ? json(source) : json({ error: "verified source not found" }, 404);
}

function parsePositiveInteger(
  url: URL,
  name: string,
  defaultValue: number,
  maximum: number,
): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return defaultValue;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value <= maximum ? value : null;
}

function parseSourceTextRequest(url: URL): SourceTextRequest | null {
  const variant = url.searchParams.get("variant") ?? "original";
  if (variant !== "original" && variant !== "zh-abstract" && variant !== "zh-full") {
    return null;
  }
  const fromLine = parsePositiveInteger(url, "from_line", 1, 1_000_000);
  const maxLines = parsePositiveInteger(url, "max_lines", 200, 500);
  if (fromLine === null || maxLines === null) return null;
  return { variant, fromLine, maxLines };
}

async function handleSourceText(
  request: Request,
  dependencies: AppDependencies,
  slug: string,
  url: URL,
): Promise<Response> {
  if (!(await authorizeBearer(request, dependencies.actionToken))) {
    return json({ error: "unauthorized" }, 401);
  }
  const input = parseSourceTextRequest(url);
  if (!input) return json({ error: "invalid source text query" }, 400);
  const commit = await dependencies.getSyncedCommit();
  if (!commit) return json({ error: "verified source text not found" }, 404);
  const sourceText = await dependencies.getSourceText(slug, commit, input);
  return sourceText
    ? json(sourceText)
    : json({ error: "verified source text not found" }, 404);
}

export function createApp(dependencies: AppDependencies): App {
  return {
    async fetch(request: Request, execution: ExecutionPort): Promise<Response> {
      const url = new URL(request.url);
      const { pathname } = url;
      if (request.method === "GET" && pathname === "/health") {
        const [syncedCommit, pendingFullSync, lastAttempt] = await Promise.all([
          dependencies.getSyncedCommit(),
          dependencies.getPendingFullSync(),
          dependencies.getLastSyncAttempt(),
        ]);
        return json({
          ok: true,
          syncedCommit,
          pendingFullSync,
          lastAttempt: lastAttempt
            ? {
                commit: lastAttempt.commit,
                mode: lastAttempt.mode,
                status: lastAttempt.status,
                updatedAt: lastAttempt.updatedAt,
                hasError: lastAttempt.error !== undefined,
              }
            : null,
        });
      }
      if (request.method === "GET" && pathname === "/openapi.json") {
        return json(openApiDocument(url.origin));
      }
      if (request.method === "POST" && pathname === "/v1/query") {
        return handleQuery(request, dependencies);
      }
      if (request.method === "POST" && pathname === "/github/webhook") {
        return handleWebhook(request, dependencies, execution);
      }
      if (request.method === "POST" && pathname === "/admin/sync") {
        return handleAdminSync(request, dependencies, true);
      }
      if (request.method === "POST" && pathname === "/admin/sync/continue") {
        return handleAdminSync(request, dependencies, false);
      }
      const sourceTextMatch = pathname.match(/^\/v1\/sources\/([^/]+)\/text$/);
      if (request.method === "GET" && sourceTextMatch) {
        try {
          return handleSourceText(
            request,
            dependencies,
            decodeURIComponent(sourceTextMatch[1]!),
            url,
          );
        } catch {
          return json({ error: "invalid source slug" }, 400);
        }
      }
      const sourceMatch = pathname.match(/^\/v1\/sources\/([^/]+)$/);
      if (request.method === "GET" && sourceMatch) {
        try {
          return handleSource(request, dependencies, decodeURIComponent(sourceMatch[1]!));
        } catch {
          return json({ error: "invalid source slug" }, 400);
        }
      }
      return json({ error: "not found" }, 404);
    },
  };
}
