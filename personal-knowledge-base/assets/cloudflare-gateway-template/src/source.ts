import { parseSourceFrontmatter, verifySourceIntegrity } from "./content";
import type { RepositoryPort } from "./sync";

export type VerifiedSource = {
  slug: string;
  path: string;
  title: string;
  content: string;
  rawFile: string;
  rawSha256: string;
  lastVerified: string | null;
  commit: string;
};

export async function getVerifiedSource(
  repository: RepositoryPort,
  slug: string,
  commit: string,
): Promise<VerifiedSource | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const path = `wiki/sources/${slug}.md`;
  const sourceBytes = await repository.readFile(path, commit);
  if (!sourceBytes) return null;
  const content = new TextDecoder().decode(sourceBytes);
  let source;
  try {
    source = parseSourceFrontmatter(content);
  } catch {
    return null;
  }
  const rawBytes = await repository.readFile(source.rawFile, commit);
  if (!rawBytes) return null;
  const integrity = await verifySourceIntegrity(source, rawBytes);
  if (integrity.status !== "verified") return null;
  return {
    slug,
    path,
    title: source.title,
    content,
    rawFile: source.rawFile,
    rawSha256: source.rawSha256,
    lastVerified: source.lastVerified ?? null,
    commit,
  };
}
