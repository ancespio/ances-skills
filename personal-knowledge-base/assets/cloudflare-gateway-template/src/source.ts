import {
  parseSourceFrontmatter,
  sha256Hex,
  verifySourceIntegrity,
  type SourceFrontmatter,
} from "./content";
import type { RepositoryPort } from "./sync";

export type SourceTextVariant = "original" | "zh-abstract" | "zh-full";

export type VerifiedSource = {
  slug: string;
  path: string;
  title: string;
  content: string;
  rawFile: string;
  rawSha256: string;
  lastVerified: string | null;
  availableTextVariants: SourceTextVariant[];
  commit: string;
};

export type SourceTextRequest = {
  variant: SourceTextVariant;
  fromLine: number;
  maxLines: number;
};

export type VerifiedSourceText = {
  sourceSlug: string;
  variant: SourceTextVariant;
  content: string;
  fromLine: number;
  nextLine: number | null;
  complete: boolean;
  rawFile: string;
  rawSha256: string;
  derivedFile: string;
  derivedSha256: string;
  generatedAt: string;
  syncedCommit: string;
  warnings: string[];
};

type DerivedArtifact = {
  path: string;
  bytes: number;
  sha256: string;
};

type DerivedManifest = {
  sourceSlug: string;
  rawFile: string;
  rawSha256: string;
  generatedAt: string;
  qualityStatus: string;
  artifacts: DerivedArtifact[];
  warnings: string[];
};

type VerifiedSourceBase = {
  content: string;
  source: SourceFrontmatter;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function verifyRaw(
  repository: RepositoryPort,
  source: SourceFrontmatter,
  commit: string,
): Promise<boolean> {
  if (!source.rawFile.startsWith("raw/")) return false;
  let actualSha256: string | null;
  if (repository.sha256File) {
    actualSha256 = await repository.sha256File(source.rawFile, commit);
  } else {
    const rawBytes = await repository.readFile(source.rawFile, commit);
    actualSha256 = rawBytes ? (await verifySourceIntegrity(source, rawBytes)).actualSha256 : null;
  }
  return actualSha256 === source.rawSha256;
}

async function loadVerifiedSourceBase(
  repository: RepositoryPort,
  slug: string,
  commit: string,
): Promise<VerifiedSourceBase | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const sourceBytes = await repository.readFile(`wiki/sources/${slug}.md`, commit);
  if (!sourceBytes) return null;
  const content = new TextDecoder().decode(sourceBytes);
  let source: SourceFrontmatter;
  try {
    source = parseSourceFrontmatter(content);
  } catch {
    return null;
  }
  if (!(await verifyRaw(repository, source, commit))) return null;
  return { content, source };
}

function parseDerivedManifest(value: unknown): DerivedManifest | null {
  if (!isRecord(value) || !Array.isArray(value.artifacts)) return null;
  const artifacts: DerivedArtifact[] = [];
  for (const artifact of value.artifacts) {
    if (
      !isRecord(artifact) ||
      typeof artifact.path !== "string" ||
      typeof artifact.bytes !== "number" ||
      typeof artifact.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(artifact.sha256)
    ) {
      return null;
    }
    artifacts.push({
      path: artifact.path,
      bytes: artifact.bytes,
      sha256: artifact.sha256.toLowerCase(),
    });
  }
  if (
    typeof value.source_slug !== "string" ||
    typeof value.raw_file !== "string" ||
    typeof value.raw_sha256 !== "string" ||
    typeof value.generated_at !== "string" ||
    typeof value.quality_status !== "string"
  ) {
    return null;
  }
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  return {
    sourceSlug: value.source_slug,
    rawFile: value.raw_file,
    rawSha256: value.raw_sha256.toLowerCase(),
    generatedAt: value.generated_at,
    qualityStatus: value.quality_status,
    artifacts,
    warnings,
  };
}

async function loadVerifiedManifest(
  repository: RepositoryPort,
  slug: string,
  source: SourceFrontmatter,
  commit: string,
): Promise<DerivedManifest | null> {
  const expectedPath = `wiki/derived/pdfs/${slug}/manifest.json`;
  if (source.derivedManifest !== expectedPath || source.derivedStatus !== "pass") return null;
  const bytes = await repository.readFile(expectedPath, commit);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  const manifest = parseDerivedManifest(parsed);
  if (
    !manifest ||
    manifest.sourceSlug !== slug ||
    manifest.rawFile !== source.rawFile ||
    manifest.rawSha256 !== source.rawSha256 ||
    manifest.qualityStatus !== "pass"
  ) {
    return null;
  }
  return manifest;
}

function derivedPath(source: SourceFrontmatter, variant: SourceTextVariant): string | undefined {
  if (variant === "original") return source.derivedTranscript;
  if (variant === "zh-abstract") return source.derivedAbstractTranslation;
  return source.derivedFullTranslation;
}

async function readVerifiedVariant(
  repository: RepositoryPort,
  slug: string,
  source: SourceFrontmatter,
  manifest: DerivedManifest,
  variant: SourceTextVariant,
  commit: string,
): Promise<{ path: string; sha256: string; content: string } | null> {
  const path = derivedPath(source, variant);
  const prefix = `wiki/derived/pdfs/${slug}/`;
  if (!path || !path.startsWith(prefix)) return null;
  const relative = path.slice(prefix.length);
  const artifact = manifest.artifacts.find((candidate) => candidate.path === relative);
  if (!artifact) return null;
  const bytes = await repository.readFile(path, commit);
  if (!bytes || bytes.byteLength !== artifact.bytes) return null;
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== artifact.sha256) return null;
  return { path, sha256: actualSha256, content: new TextDecoder().decode(bytes) };
}

async function availableVariants(
  repository: RepositoryPort,
  slug: string,
  source: SourceFrontmatter,
  commit: string,
): Promise<SourceTextVariant[]> {
  const manifest = await loadVerifiedManifest(repository, slug, source, commit);
  if (!manifest) return [];
  const variants: SourceTextVariant[] = [];
  for (const variant of ["original", "zh-abstract", "zh-full"] as const) {
    if (await readVerifiedVariant(repository, slug, source, manifest, variant, commit)) {
      variants.push(variant);
    }
  }
  return variants;
}

export async function getVerifiedSource(
  repository: RepositoryPort,
  slug: string,
  commit: string,
): Promise<VerifiedSource | null> {
  const verified = await loadVerifiedSourceBase(repository, slug, commit);
  if (!verified) return null;
  return {
    slug,
    path: `wiki/sources/${slug}.md`,
    title: verified.source.title,
    content: verified.content,
    rawFile: verified.source.rawFile,
    rawSha256: verified.source.rawSha256,
    lastVerified: verified.source.lastVerified ?? null,
    availableTextVariants: await availableVariants(repository, slug, verified.source, commit),
    commit,
  };
}

export async function getVerifiedSourceText(
  repository: RepositoryPort,
  slug: string,
  commit: string,
  request: SourceTextRequest,
): Promise<VerifiedSourceText | null> {
  const verified = await loadVerifiedSourceBase(repository, slug, commit);
  if (!verified) return null;
  const manifest = await loadVerifiedManifest(repository, slug, verified.source, commit);
  if (!manifest) return null;
  const derived = await readVerifiedVariant(
    repository,
    slug,
    verified.source,
    manifest,
    request.variant,
    commit,
  );
  if (!derived) return null;

  const lines = derived.content.replaceAll("\r\n", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (request.fromLine > Math.max(lines.length, 1)) return null;
  const start = request.fromLine - 1;
  const end = Math.min(start + request.maxLines, lines.length);
  const complete = end >= lines.length;
  return {
    sourceSlug: slug,
    variant: request.variant,
    content: lines.slice(start, end).join("\n"),
    fromLine: request.fromLine,
    nextLine: complete ? null : end + 1,
    complete,
    rawFile: verified.source.rawFile,
    rawSha256: verified.source.rawSha256,
    derivedFile: derived.path,
    derivedSha256: derived.sha256,
    generatedAt: manifest.generatedAt,
    syncedCommit: commit,
    warnings: manifest.warnings,
  };
}
