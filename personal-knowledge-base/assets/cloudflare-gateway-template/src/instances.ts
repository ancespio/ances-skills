type MetadataField = {
  field_name: string;
  data_type: "text" | "number" | "boolean" | "datetime";
};

type InstanceConfig = {
  id: string;
  index_method: { vector: true; keyword: true };
  fusion_method: "rrf";
  rewrite_query: false;
  reranking: false;
  custom_metadata: MetadataField[];
};

export interface InstanceNamespacePort {
  list(): Promise<{ result: Array<{ id: string }> }>;
  create(config: InstanceConfig): Promise<unknown>;
}

const BASE_CONFIG = {
  index_method: { vector: true, keyword: true },
  fusion_method: "rrf",
  rewrite_query: false,
  reranking: false,
} as const;

const INSTANCE_CONFIGS: InstanceConfig[] = [
  {
    id: "kb-knowledge",
    ...BASE_CONFIG,
    custom_metadata: [
      { field_name: "title", data_type: "text" },
      { field_name: "kind", data_type: "text" },
    ],
  },
  {
    id: "kb-evidence",
    ...BASE_CONFIG,
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
    ...BASE_CONFIG,
    custom_metadata: [
      { field_name: "title", data_type: "text" },
      { field_name: "kind", data_type: "text" },
    ],
  },
];

export async function ensureSearchInstances(namespace: InstanceNamespacePort): Promise<void> {
  const existing = new Set((await namespace.list()).result.map((instance) => instance.id));
  for (const config of INSTANCE_CONFIGS) {
    if (!existing.has(config.id)) await namespace.create(config);
  }
}
