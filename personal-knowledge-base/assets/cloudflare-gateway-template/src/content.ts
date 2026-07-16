export type ContentScope = "evidence" | "knowledge" | "context";
export type RemoteAccess = "always" | "on-demand" | "local-only";

export type SourceFrontmatter = {
  title: string;
  rawFile: string;
  rawSha256: string;
  confidence?: string;
  sourceCount?: number;
  lastVerified?: string;
  derivedManifest?: string;
  derivedTranscript?: string;
  derivedAbstractTranslation?: string;
  derivedFullTranslation?: string;
  derivedStatus?: string;
};

export type IntegrityResult = {
  status: "verified" | "modified";
  actualSha256: string;
};

const KNOWLEDGE_PREFIXES = [
  "wiki/concepts/",
  "wiki/entities/",
  "wiki/synthesis/",
] as const;

export function classifyRepositoryPath(path: string): ContentScope | null {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized.endsWith(".md")) return null;
  if (normalized.startsWith("wiki/sources/")) return "evidence";
  if (KNOWLEDGE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "knowledge";
  }
  if (normalized.startsWith("context/")) return "context";
  return null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFlatFrontmatter(markdown: string): Map<string, string> {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") throw new Error("invalid source frontmatter");
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error("invalid source frontmatter");

  const values = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    values.set(line.slice(0, colon).trim(), unquote(line.slice(colon + 1)));
  }
  return values;
}

export function parseRemoteAccess(markdown: string): RemoteAccess {
  try {
    const value = parseFlatFrontmatter(markdown).get("remote_access");
    return value === "always" || value === "local-only" ? value : "on-demand";
  } catch {
    return "on-demand";
  }
}

export function parseSourceFrontmatter(markdown: string): SourceFrontmatter {
  const values = parseFlatFrontmatter(markdown);
  const title = values.get("title") ?? "";
  const rawFile = values.get("raw_file") ?? "";
  const rawSha256 = (values.get("raw_sha256") ?? "").toLowerCase();
  if (!title || !rawFile || !/^[a-f0-9]{64}$/.test(rawSha256)) {
    throw new Error("invalid source frontmatter");
  }

  const sourceCountText = values.get("source_count");
  const sourceCount = sourceCountText ? Number.parseInt(sourceCountText, 10) : undefined;
  if (sourceCountText && !Number.isSafeInteger(sourceCount)) {
    throw new Error("invalid source frontmatter");
  }

  return {
    title,
    rawFile,
    rawSha256,
    ...(values.get("confidence") ? { confidence: values.get("confidence") } : {}),
    ...(sourceCount !== undefined ? { sourceCount } : {}),
    ...(values.get("last_verified")
      ? { lastVerified: values.get("last_verified") }
      : {}),
    ...(values.get("derived_manifest")
      ? { derivedManifest: values.get("derived_manifest") }
      : {}),
    ...(values.get("derived_transcript")
      ? { derivedTranscript: values.get("derived_transcript") }
      : {}),
    ...(values.get("derived_abstract_translation")
      ? { derivedAbstractTranslation: values.get("derived_abstract_translation") }
      : {}),
    ...(values.get("derived_full_translation")
      ? { derivedFullTranslation: values.get("derived_full_translation") }
      : {}),
    ...(values.get("derived_status") ? { derivedStatus: values.get("derived_status") } : {}),
  };
}

export async function sha256Hex(bytes: ArrayBuffer | ArrayBufferView): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifySourceIntegrity(
  source: SourceFrontmatter,
  rawBytes: ArrayBuffer | ArrayBufferView,
): Promise<IntegrityResult> {
  const actualSha256 = await sha256Hex(rawBytes);
  return {
    status: actualSha256 === source.rawSha256 ? "verified" : "modified",
    actualSha256,
  };
}
