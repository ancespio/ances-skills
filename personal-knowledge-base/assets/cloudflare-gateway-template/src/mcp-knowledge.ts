import { posix } from "node:path";
import { parse } from "yaml";
import { GithubRepositoryClient } from "./github";
import { getVerifiedSource, getVerifiedSourceText, type SourceTextRequest } from "./source";

export type Scope = "knowledge" | "evidence" | "literature" | "context";
type Document = { path: string; blobSha: string; content: string; metadata?: Record<string, unknown> };
export type Snapshot = { commit: string; updatedAt: string; documents: Document[] };
type WarmState = Snapshot & { pending: Array<{ path: string; sha: string }>; cursor: number };
type Store = Pick<KVNamespace, "get" | "put">;
const PREFIX = "mcp:kb:";

export function safePath(path: string): string {
  if (!path || path.startsWith("/") || /[\\\u0000-\u001f]/.test(path) || path.split("/").some(p => !p || p === "." || p === "..")) throw new Error("路径超出允许范围");
  return path;
}

export function classify(path: string): Scope | null {
  safePath(path);
  if (!path.endsWith(".md")) return null;
  if (/^wiki\/(concepts|entities|synthesis)\//.test(path)) return "knowledge";
  if (/^wiki\/sources\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path)) return "evidence";
  if (path.startsWith("context/")) return "context";
  if (path.startsWith("literature/") && path !== "literature/README.md" && !path.startsWith("literature/templates/")) return "literature";
  return null;
}

export function frontmatter(content: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return {};
  const value: unknown = parse(match[1] ?? "", { maxAliasCount: 30, uniqueKeys: true });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Frontmatter 不是对象");
  return value as Record<string, unknown>;
}

function title(doc: Document, fm = doc.metadata ?? frontmatter(doc.content)): string {
  return typeof fm.title === "string" && fm.title ? fm.title : /^#\s+(.+)$/m.exec(doc.content)?.[1] ?? posix.basename(doc.path, ".md");
}

function page(content: string, fromLine: number, maxLines: number) {
  if (!Number.isInteger(fromLine) || fromLine < 1 || !Number.isInteger(maxLines) || maxLines < 1 || maxLines > 200) throw new Error("行范围无效");
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (fromLine > Math.max(1, lines.length)) throw new Error("行范围超出文档");
  const end = Math.min(lines.length, fromLine - 1 + maxLines);
  return { content: lines.slice(fromLine - 1, end).join("\n"), fromLine, nextLine: end < lines.length ? end + 1 : null, complete: end >= lines.length, totalLines: lines.length };
}

function linkTarget(base: string, target: string): string | null {
  const clean = target.trim().replace(/^<|>$/g, "").split("#")[0]?.split("?")[0] ?? "";
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("/")) return null;
  const resolved = posix.normalize(posix.join(posix.dirname(base), decodeURIComponent(clean)));
  return safePath(resolved);
}

export function references(doc: Document, snapshot: Snapshot) {
  const found: Array<{ target: string; path?: string; sourceSlug?: string; status: string }> = [];
  const paths = new Set(snapshot.documents.map(x => x.path));
  const add = (target: string, path: string | null) => {
    if (!path) { found.push({ target, status: "external-or-anchor" }); return; }
    const sourceSlug = /^wiki\/sources\/([a-z0-9-]+)\.md$/.exec(path)?.[1];
    if (paths.has(path)) found.push({ target, path, ...(sourceSlug ? { sourceSlug } : {}), status: sourceSlug ? "source-needs-verification" : "available" });
    else if (path.startsWith("raw/")) {
      const source = snapshot.documents.find(x => classify(x.path) === "evidence" && (x.metadata ?? frontmatter(x.content)).raw_file === path);
      found.push({ target, path, ...(source ? { sourceSlug: posix.basename(source.path, ".md") } : {}), status: source ? "source-needs-verification" : "raw-only-or-missing" });
    } else if (/^wiki\/derived\/pdfs\/([a-z0-9-]+)\//.test(path)) {
      found.push({ target, path, sourceSlug: path.split("/")[3], status: "text-needs-verification" });
    } else found.push({ target, path, status: "not-readable-or-missing" });
  };
  for (const match of doc.content.matchAll(/\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g)) {
    try { add(match[1] ?? "", linkTarget(doc.path, match[1] ?? "")); }
    catch { found.push({ target: match[1] ?? "", status: "rejected-path" }); }
  }
  for (const match of doc.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const target = match[1]?.split("#")[0] ?? "";
    const matches = snapshot.documents.filter(x => x.path === `${target}.md` || posix.basename(x.path, ".md") === target);
    if (matches.length === 1) add(target, matches[0]?.path ?? null);
    else found.push({ target, status: matches.length ? "ambiguous" : "missing" });
  }
  return found;
}

export class KnowledgeReader {
  constructor(readonly repository: GithubRepositoryClient, readonly store: Store) {}

  async warm(): Promise<{ commit: string; complete: boolean; loaded: number; remaining: number }> {
    let state = await this.store.get<WarmState>(`${PREFIX}warming`, "json");
    if (!state) {
      const commit = await this.repository.resolveMain();
      const previous = await this.store.get<Snapshot>(`${PREFIX}latest`, "json");
      if (previous?.commit === commit) return { commit, complete: true, loaded: previous.documents.length, remaining: 0 };
      const blobs = (await this.repository.listBlobs(commit)).filter(x => classify(x.path));
      const documents = blobs.flatMap(blob => {
        const old = previous?.documents.find(x => x.path === blob.path && x.blobSha === blob.sha);
        return old ? [old] : [];
      });
      state = { commit, updatedAt: new Date().toISOString(), documents, pending: blobs.filter(x => !documents.some(d => d.path === x.path)), cursor: 0 };
    }
    // 免费 Worker 单次外部子请求限额内分批；未完成快照不进入查询。
    const batch = state.pending.slice(state.cursor, state.cursor + 20);
    for (const blob of batch) {
      const bytes = await this.repository.readFile(blob.path, state.commit);
      if (!bytes) throw new Error("快照文件缺失");
      const content = new TextDecoder().decode(bytes);
      const metadata = frontmatter(content);
      state.documents.push({ path: blob.path, blobSha: blob.sha, content, metadata });
    }
    state.cursor += batch.length;
    const complete = state.cursor === state.pending.length;
    if (complete) {
      const snapshot: Snapshot = { commit: state.commit, updatedAt: new Date().toISOString(), documents: state.documents };
      await this.store.put(`${PREFIX}snapshot:${state.commit}`, JSON.stringify(snapshot), { expirationTtl: 604800 });
      await this.store.put(`${PREFIX}latest`, JSON.stringify(snapshot));
      // 不删除 KV：使用短期完成标记，下一次 warm 建立新版本。
      await this.store.put(`${PREFIX}warming`, "null", { expirationTtl: 60 });
    } else await this.store.put(`${PREFIX}warming`, JSON.stringify(state));
    return { commit: state.commit, complete, loaded: state.documents.length, remaining: state.pending.length - state.cursor };
  }

  async snapshot(commit?: string): Promise<Snapshot> {
    if (commit && !/^[a-f0-9]{40}$/i.test(commit)) throw new Error("必须使用完整 Git commit SHA");
    let snapshot = await this.store.get<Snapshot>(commit ? `${PREFIX}snapshot:${commit}` : `${PREFIX}latest`, "json");
    if (!snapshot && commit) {
      const latest = await this.store.get<Snapshot>(`${PREFIX}latest`, "json");
      if (latest?.commit === commit) snapshot = latest;
    }
    if (!snapshot) throw new Error("该快照尚未建立，请先完成 MCP 缓存同步");
    return snapshot;
  }

  async query(input: { query: string; include_diary?: boolean; scope?: Scope; limit?: number; commit?: string }) {
    const snapshot = await this.snapshot(input.commit);
    const tokens = [...new Set(input.query.toLowerCase().match(/[a-z0-9-]+|[\p{Script=Han}]{1,2}/gu) ?? [])];
    if (!tokens.length) throw new Error("查询为空或没有可检索词");
    const limit = input.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("limit 必须为 1 至 10");
    const groups: Record<Scope, unknown[]> = { knowledge: [], evidence: [], literature: [], context: [] };
    const ranked = snapshot.documents.flatMap(doc => {
      const scope = classify(doc.path);
      if (!scope || (input.scope && scope !== input.scope)) return [];
      const fm = doc.metadata ?? frontmatter(doc.content);
      if (scope === "context" && (doc.path.startsWith("context/diary/") || fm.remote_access !== "always") && !input.include_diary) return [];
      const name = title(doc, fm);
      const alias = JSON.stringify(fm.aliases ?? "");
      const body = doc.content.toLowerCase();
      const score = tokens.reduce((sum, term) => sum + (name.toLowerCase().includes(term) ? 5 : 0) + (alias.toLowerCase().includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0);
      if (!score) return [];
      const lines = doc.content.replaceAll("\r\n", "\n").split("\n");
      const start = Math.max(0, lines.findIndex(line => tokens.some(t => line.toLowerCase().includes(t))) - 1);
      return [{ scope, path: doc.path, title: name, score, snippet: lines.slice(start, start + 6).join("\n").slice(0, 1600), fromLine: start + 1, sourceSlug: scope === "evidence" ? posix.basename(doc.path, ".md") : null, confidence: fm.confidence ?? null, verification: scope === "evidence" ? "not-yet-verified" : "not-independent-evidence" }];
    }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    for (const result of ranked) if (groups[result.scope].length < limit) groups[result.scope].push(result);
    return { repository: this.repository.repositoryName, commit: snapshot.commit, indexedAt: snapshot.updatedAt, mode: "keyword", ...groups, warnings: ["按已完成快照读取；不代表最新 main 已同步。关键词检索不等同于向量召回。来源摘要须继续核验原件。"] };
  }

  async document(path: string, fromLine = 1, maxLines = 200, commit?: string) {
    const scope = classify(path);
    if (!scope || scope === "evidence") throw new Error("该路径必须使用来源校验接口，或不在允许读取范围");
    const snapshot = await this.snapshot(commit);
    const doc = snapshot.documents.find(x => x.path === path);
    if (!doc) throw new Error("快照中未找到文档");
    return { path, scope, title: title(doc), commit: snapshot.commit, ...page(doc.content, fromLine, maxLines), references: references(doc, snapshot) };
  }

  async source(slug: string, commit?: string) {
    const snapshot = await this.snapshot(commit);
    const source = await getVerifiedSource(this.repository, slug, snapshot.commit);
    if (!source) throw new Error("来源不存在或 raw 完整性校验失败");
    return { ...source, metadata: frontmatter(source.content), integrityStatus: "verified", warnings: ["原件哈希核验不代表题录字段全部核验通过；metadata_status 与 confidence 分开解释。"] };
  }

  async text(slug: string, request: SourceTextRequest, commit?: string) {
    if (!Number.isInteger(request.fromLine) || request.fromLine < 1 || !Number.isInteger(request.maxLines) || request.maxLines < 1 || request.maxLines > 200) throw new Error("行范围无效");
    const snapshot = await this.snapshot(commit);
    const result = await getVerifiedSourceText(this.repository, slug, snapshot.commit, request);
    if (!result) throw new Error("正文缺失、校验失败或行范围无效");
    return result;
  }
}
