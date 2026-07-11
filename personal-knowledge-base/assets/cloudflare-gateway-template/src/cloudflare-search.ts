import type { SearchClient, SearchChunk } from "./query";

type CloudflareSearchRequest = {
  query: string;
  ai_search_options: {
    retrieval: {
      retrieval_type: "hybrid";
      max_num_results: number;
      return_on_failure: false;
    };
    query_rewrite: { enabled: false };
    reranking: { enabled: false };
  };
};

type CloudflareSearchResponse = {
  search_query: string;
  chunks: Array<{
    id: string;
    type: string;
    score: number;
    text: string;
    item: {
      key: string;
      timestamp?: number;
      metadata?: Record<string, unknown>;
    };
  }>;
};

export interface AiSearchNamespacePort {
  get(instanceName: string): {
    search(request: CloudflareSearchRequest): Promise<CloudflareSearchResponse>;
  };
}

export function createCloudflareSearchClient(namespace: AiSearchNamespacePort): SearchClient {
  return {
    async search(instance: string, query: string, maxResults: number): Promise<SearchChunk[]> {
      const result = await namespace.get(instance).search({
        query,
        ai_search_options: {
          retrieval: {
            retrieval_type: "hybrid",
            max_num_results: maxResults,
            return_on_failure: false,
          },
          query_rewrite: { enabled: false },
          reranking: { enabled: false },
        },
      });
      return result.chunks.map((chunk) => ({
        path: chunk.item.key,
        text: chunk.text,
        score: chunk.score,
        metadata: {
          ...(chunk.item.metadata ?? {}),
          ...(chunk.item.timestamp === undefined ? {} : { timestamp: chunk.item.timestamp }),
        },
      }));
    },
  };
}
