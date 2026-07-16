import {
  classifyRepositoryPath,
  parseSourceFrontmatter,
  parseRemoteAccess,
  verifySourceIntegrity,
  type ContentScope,
} from "./content";

export interface RepositoryPort {
  readFile(path: string, commit: string): Promise<Uint8Array<ArrayBuffer> | null>;
  sha256File?(path: string, commit: string): Promise<string | null>;
}

export interface IndexPort {
  upload(
    scope: ContentScope,
    path: string,
    content: string,
    metadata: Record<string, string>,
  ): Promise<void>;
  remove(scope: ContentScope, path: string): Promise<void>;
}

export interface SyncStatePort {
  getRawForSource(sourcePath: string): Promise<string | null>;
  getSourcesForRaw(rawPath: string): Promise<string[]>;
  setSourceRaw(sourcePath: string, rawPath: string): Promise<void>;
  deleteSourceRaw(sourcePath: string): Promise<void>;
  setSyncedCommit(commit: string): Promise<void>;
}

export type SyncIssue = {
  path: string;
  code: "file_missing" | "invalid_source" | "raw_missing" | "source_modified";
  detail: string;
};

export type SyncResult = {
  uploaded: number;
  removed: number;
  issues: SyncIssue[];
};

type SyncDependencies = {
  repository: RepositoryPort;
  index: IndexPort;
  state: SyncStatePort;
};

type ChangeSet = {
  commit: string;
  upsert: string[];
  remove: string[];
};

const decoder = new TextDecoder();

function firstFrontmatterValue(markdown: string, key: string): string | null {
  const normalized = markdown.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return null;
  const prefix = `${key}:`;
  const line = normalized
    .slice(4, end)
    .split("\n")
    .find((candidate) => candidate.startsWith(prefix));
  if (!line) return null;
  const value = line.slice(prefix.length).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value || null;
}

function headingTitle(markdown: string): string | null {
  const heading = markdown
    .replaceAll("\r\n", "\n")
    .split("\n")
    .find((line) => line.startsWith("# "));
  return heading?.slice(2).trim() || null;
}

function fallbackTitle(path: string): string {
  return path.split("/").at(-1)?.replace(/\.md$/i, "") ?? path;
}

function ordinaryMetadata(path: string, content: string, scope: ContentScope) {
  return {
    title: firstFrontmatterValue(content, "title") ?? headingTitle(content) ?? fallbackTitle(path),
    kind:
      firstFrontmatterValue(content, "type") ??
      (scope === "context" ? path.split("/")[1] ?? "context" : path.split("/")[1] ?? scope),
    ...(scope === "context" ? { remote_access: parseRemoteAccess(content) } : {}),
  };
}

async function removePath(
  dependencies: SyncDependencies,
  path: string,
): Promise<boolean> {
  const scope = classifyRepositoryPath(path);
  if (!scope) return false;
  await dependencies.index.remove(scope, path);
  if (scope === "evidence") await dependencies.state.deleteSourceRaw(path);
  return true;
}

async function syncEvidence(
  dependencies: SyncDependencies,
  path: string,
  commit: string,
  content: string,
  issues: SyncIssue[],
): Promise<boolean> {
  let source;
  try {
    source = parseSourceFrontmatter(content);
  } catch {
    await dependencies.index.remove("evidence", path);
    await dependencies.state.deleteSourceRaw(path);
    issues.push({ path, code: "invalid_source", detail: "raw_file or raw_sha256 is invalid" });
    return false;
  }

  await dependencies.state.setSourceRaw(path, source.rawFile);
  let actualSha256: string | null;
  if (dependencies.repository.sha256File) {
    actualSha256 = await dependencies.repository.sha256File(source.rawFile, commit);
  } else {
    const rawBytes = await dependencies.repository.readFile(source.rawFile, commit);
    actualSha256 = rawBytes ? (await verifySourceIntegrity(source, rawBytes)).actualSha256 : null;
  }
  if (!actualSha256) {
    await dependencies.index.remove("evidence", path);
    issues.push({ path, code: "raw_missing", detail: source.rawFile });
    return false;
  }
  if (actualSha256 !== source.rawSha256) {
    await dependencies.index.remove("evidence", path);
    issues.push({ path, code: "source_modified", detail: source.rawFile });
    return false;
  }

  await dependencies.index.upload("evidence", path, content, {
    title: source.title,
    integrity_status: "verified",
    raw_file: source.rawFile,
    raw_sha256: source.rawSha256,
    last_verified: source.lastVerified ?? "",
  });
  return true;
}

export async function syncChangedPaths(
  dependencies: SyncDependencies,
  changes: ChangeSet,
): Promise<SyncResult> {
  const issues: SyncIssue[] = [];
  let uploaded = 0;
  let removed = 0;

  const expandedUpserts = new Set(changes.upsert);
  for (const path of [...changes.upsert, ...changes.remove]) {
    if (!path.replaceAll("\\", "/").startsWith("raw/")) continue;
    for (const sourcePath of await dependencies.state.getSourcesForRaw(path)) {
      expandedUpserts.add(sourcePath);
    }
  }

  for (const path of changes.remove) {
    if (await removePath(dependencies, path)) removed += 1;
  }

  for (const path of expandedUpserts) {
    const scope = classifyRepositoryPath(path);
    if (!scope) continue;
    const bytes = await dependencies.repository.readFile(path, changes.commit);
    if (!bytes) {
      if (await removePath(dependencies, path)) removed += 1;
      issues.push({ path, code: "file_missing", detail: changes.commit });
      continue;
    }
    const content = decoder.decode(bytes);
    if (scope === "evidence") {
      if (await syncEvidence(dependencies, path, changes.commit, content, issues)) {
        uploaded += 1;
      } else {
        removed += 1;
      }
      continue;
    }
    const metadata = ordinaryMetadata(path, content, scope);
    if (scope === "context" && metadata.remote_access === "local-only") {
      await dependencies.index.remove("context", path);
      removed += 1;
      continue;
    }
    await dependencies.index.upload(scope, path, content, metadata);
    uploaded += 1;
  }

  await dependencies.state.setSyncedCommit(changes.commit);
  return { uploaded, removed, issues };
}
