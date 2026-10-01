import { createHash } from "node:crypto";

import type { RepositoryPort } from "./sync";

type GithubConfig = {
  owner: string;
  repository: string;
  token: string;
};

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const API_VERSION = "2022-11-28";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_HASH_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TREE_BYTES = 5 * 1024 * 1024;

function encodePath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function readBounded(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel("response exceeds configured limit");
      throw new Error("GitHub response exceeds configured size limit");
    }
    chunks.push(new Uint8Array(value));
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function sha256Bounded(response: Response, limit: number): Promise<string> {
  const hash = createHash("sha256");
  if (!response.body) return hash.digest("hex");
  const reader = response.body.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel("response exceeds configured hash limit");
      throw new Error("GitHub response exceeds configured hash size limit");
    }
    hash.update(value);
  }
  return hash.digest("hex");
}

function isTreeResponse(value: unknown): value is {
  truncated: boolean;
  tree: Array<{ path: string; type: string }>;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.truncated !== "boolean" || !Array.isArray(candidate.tree)) return false;
  return candidate.tree.every(
    (entry) =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).path === "string" &&
      typeof (entry as Record<string, unknown>).type === "string",
  );
}

export class GithubRepositoryClient implements RepositoryPort {
  get repositoryName(): string {
    return `${this.config.owner}/${this.config.repository}`;
  }
  constructor(
    private readonly config: GithubConfig,
    private readonly fetcher: FetchPort = (input, init) => fetch(input, init),
  ) {}

  private async request(path: string, accept = "application/vnd.github+json"): Promise<Response> {
    // Workers 不支持 redirect=error；manual 加非成功状态检查同样拒绝重定向。
    const response = await this.fetcher(`https://api.github.com${path}`, {
      redirect: "manual",
      headers: {
        accept,
        authorization: `Bearer ${this.config.token}`,
        "user-agent": "knowledgebase-gateway",
        "x-github-api-version": API_VERSION,
      },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`GitHub request failed with status ${response.status}`);
    }
    return response;
  }

  async readFile(path: string, commit: string): Promise<Uint8Array<ArrayBuffer> | null> {
    validateFileRequest(path, commit);
    const endpoint = `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(
      this.config.repository,
    )}/contents/${encodePath(path)}?ref=${encodeURIComponent(commit)}`;
    const response = await this.request(endpoint, "application/vnd.github.raw+json");
    if (response.status === 404) return null;
    return readBounded(response, MAX_FILE_BYTES);
  }

  async sha256File(path: string, commit: string): Promise<string | null> {
    validateFileRequest(path, commit);
    const endpoint = `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(
      this.config.repository,
    )}/contents/${encodePath(path)}?ref=${encodeURIComponent(commit)}`;
    const response = await this.request(endpoint, "application/vnd.github.raw+json");
    if (response.status === 404) return null;
    return sha256Bounded(response, MAX_HASH_FILE_BYTES);
  }

  async listFiles(commit: string): Promise<string[]> {
    const endpoint = `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(
      this.config.repository,
    )}/git/trees/${encodeURIComponent(commit)}?recursive=1`;
    const response = await this.request(endpoint);
    if (response.status === 404) throw new Error("Git tree was not found");
    const bytes = await readBounded(response, MAX_TREE_BYTES);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isTreeResponse(parsed)) throw new Error("Git tree response is invalid");
    if (parsed.truncated) throw new Error("Git tree response was truncated");
    return parsed.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
  }

  async resolveMain(): Promise<string> {
    const response = await this.request(`/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repository)}/git/ref/heads/main`);
    const value = await response.json() as { object?: { sha?: string } };
    if (!value.object?.sha || !/^[a-f0-9]{40}$/i.test(value.object.sha)) throw new Error("Invalid main commit");
    return value.object.sha;
  }

  async listBlobs(commit: string): Promise<Array<{ path: string; sha: string }>> {
    const response = await this.request(`/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repository)}/git/trees/${encodeURIComponent(commit)}?recursive=1`);
    const bytes = await readBounded(response, MAX_TREE_BYTES);
    const value = JSON.parse(new TextDecoder().decode(bytes)) as { truncated?: boolean; tree?: Array<{ path: string; type: string; mode: string; sha: string }> };
    if (value.truncated || !Array.isArray(value.tree)) throw new Error("Incomplete Git tree");
    return value.tree.filter(x => x.type === "blob" && x.mode !== "120000").map(x => ({ path: x.path, sha: x.sha }));
  }
}

function validateFileRequest(path: string, commit: string): void {
  if (!path || path.startsWith("/") || /[\\\u0000-\u001f]/.test(path) || path.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Invalid repository path");
  }
  if (!commit || /[?&#/\\]/.test(commit)) throw new Error("Invalid commit");
}
