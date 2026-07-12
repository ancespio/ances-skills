import { describe, expect, it } from "vitest";

import { ensureSearchInstances, type InstanceNamespacePort } from "../src/instances";

describe("ensureSearchInstances", () => {
  it("creates only missing instances with bounded metadata schemas", async () => {
    const created: unknown[] = [];
    const namespace: InstanceNamespacePort = {
      async list() {
        return { result: [{ id: "kb-knowledge" }] };
      },
      async create(config) {
        created.push(config);
      },
    };

    await ensureSearchInstances(namespace);

    expect(created).toEqual([
      {
        id: "kb-evidence",
        index_method: { vector: true, keyword: true },
        fusion_method: "rrf",
        rewrite_query: false,
        reranking: false,
        custom_metadata: [
          { field_name: "title", data_type: "text" },
          { field_name: "integrity_status", data_type: "text" },
          { field_name: "raw_file", data_type: "text" },
          { field_name: "raw_sha256", data_type: "text" },
          { field_name: "last_verified", data_type: "text" },
        ],
      },
      {
        id: "kb-context",
        index_method: { vector: true, keyword: true },
        fusion_method: "rrf",
        rewrite_query: false,
        reranking: false,
        custom_metadata: [
          { field_name: "title", data_type: "text" },
          { field_name: "kind", data_type: "text" },
        ],
      },
    ]);
  });
});
