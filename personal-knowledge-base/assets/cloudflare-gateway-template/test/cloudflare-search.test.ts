import { describe, expect, it } from "vitest";

import {
  createCloudflareSearchClient,
  type AiSearchNamespacePort,
} from "../src/cloudflare-search";

describe("createCloudflareSearchClient", () => {
  it("uses hybrid retrieval without query rewriting, reranking or generation", async () => {
    const calls: unknown[] = [];
    const namespace: AiSearchNamespacePort = {
      get(instanceName) {
        expect(instanceName).toBe("kb-evidence");
        return {
          async search(request) {
            calls.push(request);
            return {
              search_query: "LLM Wiki",
              chunks: [
                {
                  id: "chunk-1",
                  type: "text",
                  score: 0.9,
                  text: "Raw 不可变。",
                  item: {
                    key: "wiki/sources/llm-wiki.md",
                    timestamp: 1_752_105_600_000,
                    metadata: { title: "LLM Wiki", integrity_status: "verified" },
                  },
                },
              ],
            };
          },
        };
      },
    };

    const client = createCloudflareSearchClient(namespace);
    await expect(client.search("kb-evidence", "LLM Wiki", 5)).resolves.toEqual([
      {
        path: "wiki/sources/llm-wiki.md",
        text: "Raw 不可变。",
        score: 0.9,
        metadata: {
          title: "LLM Wiki",
          integrity_status: "verified",
          timestamp: 1_752_105_600_000,
        },
      },
    ]);
    expect(calls).toEqual([
      {
        query: "LLM Wiki",
        ai_search_options: {
          retrieval: {
            retrieval_type: "hybrid",
            max_num_results: 5,
            return_on_failure: false,
          },
          query_rewrite: { enabled: false },
          reranking: { enabled: false },
        },
      },
    ]);
  });
});
