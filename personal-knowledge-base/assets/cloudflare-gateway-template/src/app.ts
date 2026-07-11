import { authorizeBearer, verifyGithubWebhook } from "./auth";
import type { FullSyncProgress } from "./full-sync";
import { openApiDocument } from "./openapi";
import type { QueryInput, QueryResult } from "./query";
import type { VerifiedSource } from "./source";
import type { SyncResult } from "./sync";

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
  syncChanges(changes: ChangeSet): Promise<SyncResult>;
  startFullSync(commit: string): Promise<FullSyncProgress>;
  continueFullSync(): Promise<FullSyncProgress | null>;
  getSource(slug: string, commit: string): Promise<VerifiedSource | null>;
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

  if (payload.forced || payload.size > payload.commits.length) {
    execution.waitUntil(dependencies.startFullSync(payload.after));
  } else {
    execution.waitUntil(dependencies.syncChanges(changesFromPush(payload)));
  }
  return json({ accepted: true }, 202);
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

export function createApp(dependencies: AppDependencies): App {
  return {
    async fetch(request: Request, execution: ExecutionPort): Promise<Response> {
      const url = new URL(request.url);
      const { pathname } = url;
      if (request.method === "GET" && pathname === "/health") {
        return json({ ok: true, syncedCommit: await dependencies.getSyncedCommit() });
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
      if (request.method === "GET" && pathname.startsWith("/v1/sources/")) {
        const slug = decodeURIComponent(pathname.slice("/v1/sources/".length));
        return handleSource(request, dependencies, slug);
      }
      return json({ error: "not found" }, 404);
    },
  };
}
