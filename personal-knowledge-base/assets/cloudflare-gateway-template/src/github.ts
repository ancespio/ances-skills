import type { RepositoryPort } from "./sync";

type GithubConfig = {
  owner: string;
  repository: string;
  token: string;
};

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const API_VERSION = "2022-11-28";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
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

function isRefResponse(value: unknown): value is { object: { sha: string } } {
  if (!value || typeof value !== "object") return false;
  const object = (value as Record<string, unknown>).object;
  return (
    object !== null &&
    typeof object === "object" &&
    typeof (object as Record<string, unknown>).sha === "string" &&
    /^[a-f0-9]{40,64}$/i.test((object as Record<string, unknown>).sha as string)
  );
}

export class GithubRepositoryClient implements RepositoryPort {
  constructor(
    private readonly config: GithubConfig,
    private readonly fetcher: FetchPort = (input, init) => fetch(input, init),
  ) {}

  private async request(path: string, accept = "application/vnd.github+json"): Promise<Response> {
    const response = await this.fetcher(`https://api.github.com${path}`, {
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
    const endpoint = `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(
      this.config.repository,
    )}/contents/${encodePath(path)}?ref=${encodeURIComponent(commit)}`;
    const response = await this.request(endpoint, "application/vnd.github.raw+json");
    if (response.status === 404) return null;
    return readBounded(response, MAX_FILE_BYTES);
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

  async getBranchHead(branch: string): Promise<string> {
    const endpoint = `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(
      this.config.repository,
    )}/git/ref/heads/${encodeURIComponent(branch)}`;
    const response = await this.request(endpoint);
    if (response.status === 404) throw new Error("Git branch was not found");
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(await readBounded(response, 64 * 1024)),
    );
    if (!isRefResponse(parsed)) throw new Error("Git ref response is invalid");
    return parsed.object.sha;
  }
}
