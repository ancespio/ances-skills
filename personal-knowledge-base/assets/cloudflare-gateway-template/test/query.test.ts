import { describe, expect, it } from "vitest";

import {
  queryKnowledgeBase,
  type SearchClient,
  type SearchChunk,
  type SearchFilters,
} from "../src/query";

class FakeSearchClient implements SearchClient {
  readonly calls: Array<{
    instance: string;
    query: string;
    maxResults: number;
    filters?: SearchFilters;
  }> = [];

  constructor(private readonly results: Record<string, SearchChunk[]>) {}

  async search(
    instance: string,
    query: string,
    maxResults: number,
    filters?: SearchFilters,
  ): Promise<SearchChunk[]> {
    this.calls.push({ instance, query, maxResults, ...(filters ? { filters } : {}) });
    const chunks = this.results[instance] ?? [];
    const kinds = filters?.kind;
    if (!kinds || typeof kinds === "string") return chunks;
    return chunks.filter((chunk) => kinds.$in.includes(String(chunk.metadata.kind ?? "")));
  }
}

const knowledgeChunk: SearchChunk = {
  path: "wiki/concepts/llm-wiki.md",
  text: "LLM Wiki 是持续维护的结构化知识库。",
  score: 0.91,
  metadata: { title: "LLM Wiki", kind: "concept", commit: "abc123" },
};

const evidenceChunk: SearchChunk = {
  path: "wiki/sources/llm-wiki-setup-tutorial.md",
  text: "教程强调 Raw 不可变、Wiki 由 LLM 维护。",
  score: 0.88,
  metadata: {
    title: "LLM Wiki 搭建教程",
    kind: "source",
    integrity_status: "verified",
    raw_file: "raw/articles/LLM Wiki 搭建教程.md",
    raw_sha256: "a".repeat(64),
    last_verified: "2026-07-10",
    confidence: "unscored",
    commit: "abc123",
  },
};

const contextChunk: SearchChunk = {
  path: "context/persona/User_Persona.md",
  text: "用户偏好 execution-first。",
  score: 0.8,
  metadata: { title: "用户画像", kind: "context-persona", commit: "abc123" },
};

const diaryChunk: SearchChunk = {
  path: "context/diary/2026-08-20_Diary.md",
  text: "用户确认了 Context 网页端读取分层。",
  score: 0.79,
  metadata: { title: "2026-08-20 日记", kind: "context-diary", commit: "abc123" },
};

describe("queryKnowledgeBase", () => {
  it("always searches persona but not diary by default", async () => {
    const client = new FakeSearchClient({
      "kb-knowledge": [knowledgeChunk],
      "kb-evidence": [evidenceChunk],
      "kb-context": [contextChunk, diaryChunk],
    });

    const result = await queryKnowledgeBase(client, {
      query: "  什么是 LLM Wiki？  ",
      includeContext: false,
      syncedCommit: "abc123",
    });

    expect(client.calls).toEqual([
      { instance: "kb-knowledge", query: "什么是 LLM Wiki？", maxResults: 5 },
      { instance: "kb-evidence", query: "什么是 LLM Wiki？", maxResults: 5 },
      {
        instance: "kb-context",
        query: "什么是 LLM Wiki？",
        maxResults: 5,
        filters: {
          kind: {
            $in: ["context-persona", "context-project", "context-guide", "persona"],
          },
        },
      },
    ]);
    expect(result.knowledge).toHaveLength(1);
    expect(result.evidence).toEqual([
      expect.objectContaining({
        path: "wiki/sources/llm-wiki-setup-tutorial.md",
        title: "LLM Wiki 搭建教程",
        integrityStatus: "verified",
        rawFile: "raw/articles/LLM Wiki 搭建教程.md",
      }),
    ]);
    expect(result.context).toEqual([
      expect.objectContaining({ path: "context/persona/User_Persona.md" }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.syncedCommit).toBe("abc123");
  });

  it("adds diary context only when requested", async () => {
    const client = new FakeSearchClient({
      "kb-knowledge": [knowledgeChunk],
      "kb-evidence": [evidenceChunk],
      "kb-context": [contextChunk, diaryChunk],
    });

    const result = await queryKnowledgeBase(client, {
      query: "我偏好什么工作方式？",
      includeContext: true,
      syncedCommit: "abc123",
    });

    expect(client.calls.map((call) => call.instance)).toEqual([
      "kb-knowledge",
      "kb-evidence",
      "kb-context",
      "kb-context",
    ]);
    expect(result.context).toEqual([
      expect.objectContaining({ path: "context/persona/User_Persona.md" }),
      expect.objectContaining({ path: "context/diary/2026-08-20_Diary.md" }),
    ]);
  });

  it("drops unverified evidence and reports that evidence is insufficient", async () => {
    const client = new FakeSearchClient({
      "kb-knowledge": [knowledgeChunk],
      "kb-evidence": [
        {
          ...evidenceChunk,
          metadata: { ...evidenceChunk.metadata, integrity_status: "modified" },
        },
      ],
    });

    const result = await queryKnowledgeBase(client, {
      query: "什么是 LLM Wiki？",
      includeContext: false,
      syncedCommit: "abc123",
    });

    expect(result.evidence).toEqual([]);
    expect(result.warnings).toContain("当前知识库没有找到经过完整性验证的来源证据。");
  });

  it.each(["", "   ", "x".repeat(1001)])("rejects an invalid query", async (query) => {
    const client = new FakeSearchClient({});
    await expect(
      queryKnowledgeBase(client, { query, includeContext: false, syncedCommit: null }),
    ).rejects.toThrow("query must contain 1 to 1000 characters");
    expect(client.calls).toEqual([]);
  });
});
