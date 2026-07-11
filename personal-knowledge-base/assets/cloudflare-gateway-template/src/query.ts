export type SearchChunk = {
  path: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
};

export interface SearchClient {
  search(instance: string, query: string, maxResults: number): Promise<SearchChunk[]>;
}

export type QueryInput = {
  query: string;
  includeContext: boolean;
  syncedCommit: string | null;
};

type BaseResult = {
  path: string;
  title: string;
  excerpt: string;
  score: number;
  kind: string;
  commit: string | null;
};

export type EvidenceResult = BaseResult & {
  integrityStatus: "verified";
  rawFile: string;
  rawSha256: string;
  lastVerified: string | null;
  confidence: string;
  sourceCount: number | null;
};

export type QueryResult = {
  knowledge: BaseResult[];
  evidence: EvidenceResult[];
  context: BaseResult[];
  warnings: string[];
  syncedCommit: string | null;
};

const INSTANCES = {
  knowledge: "kb-knowledge",
  evidence: "kb-evidence",
  context: "kb-context",
} as const;

function textMetadata(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value ? value : null;
}

function numberMetadata(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function baseResult(chunk: SearchChunk): BaseResult {
  return {
    path: chunk.path,
    title: textMetadata(chunk.metadata, "title") ?? chunk.path.split("/").at(-1) ?? chunk.path,
    excerpt: chunk.text,
    score: chunk.score,
    kind: textMetadata(chunk.metadata, "kind") ?? "unknown",
    commit: textMetadata(chunk.metadata, "commit"),
  };
}

function evidenceResult(chunk: SearchChunk): EvidenceResult | null {
  if (textMetadata(chunk.metadata, "integrity_status") !== "verified") return null;
  const rawFile = textMetadata(chunk.metadata, "raw_file");
  const rawSha256 = textMetadata(chunk.metadata, "raw_sha256");
  if (!rawFile || !rawSha256) return null;
  return {
    ...baseResult(chunk),
    integrityStatus: "verified",
    rawFile,
    rawSha256,
    lastVerified: textMetadata(chunk.metadata, "last_verified"),
    confidence: textMetadata(chunk.metadata, "confidence") ?? "unscored",
    sourceCount: numberMetadata(chunk.metadata, "source_count"),
  };
}

function validateQuery(query: string): string {
  const normalized = query.trim();
  if (normalized.length < 1 || normalized.length > 1000) {
    throw new Error("query must contain 1 to 1000 characters");
  }
  return normalized;
}

export async function queryKnowledgeBase(
  client: SearchClient,
  input: QueryInput,
): Promise<QueryResult> {
  const query = validateQuery(input.query);
  const knowledgePromise = client.search(INSTANCES.knowledge, query, 5);
  const evidencePromise = client.search(INSTANCES.evidence, query, 5);
  const contextPromise = input.includeContext
    ? client.search(INSTANCES.context, query, 5)
    : Promise.resolve([]);
  const [knowledgeChunks, evidenceChunks, contextChunks] = await Promise.all([
    knowledgePromise,
    evidencePromise,
    contextPromise,
  ]);
  const evidence = evidenceChunks
    .map(evidenceResult)
    .filter((result): result is EvidenceResult => result !== null);

  return {
    knowledge: knowledgeChunks.map(baseResult),
    evidence,
    context: contextChunks.map(baseResult),
    warnings:
      evidence.length === 0 ? ["当前知识库没有找到经过完整性验证的来源证据。"] : [],
    syncedCommit: input.syncedCommit,
  };
}
