import type { ContentScope } from "./content";
import type { IndexPort } from "./sync";

type ItemInfo = { id: string; key: string };

interface AiSearchItemsPort {
  upload(
    name: string,
    content: string,
    options?: { metadata?: Record<string, string> },
  ): Promise<ItemInfo>;
  list(params?: { search?: string; page?: number; per_page?: number }): Promise<{
    result: ItemInfo[];
    result_info?: { page: number; per_page: number; total_count: number };
  }>;
  delete(itemId: string): Promise<void>;
}

export interface AiSearchNamespaceIndexPort {
  get(instanceName: string): { items: AiSearchItemsPort };
}

export interface ItemStatePort {
  getItemId(scope: ContentScope, path: string): Promise<string | null>;
  setItemId(scope: ContentScope, path: string, itemId: string): Promise<void>;
  deleteItemId(scope: ContentScope, path: string): Promise<void>;
}

const INSTANCE_BY_SCOPE: Record<ContentScope, string> = {
  evidence: "kb-evidence",
  knowledge: "kb-knowledge",
  context: "kb-context",
};

const ITEMS_PAGE_SIZE = 10;

async function scanItems(items: AiSearchItemsPort): Promise<ItemInfo[]> {
  const itemsByKey = new Map<string, ItemInfo>();
  let page = 1;
  while (true) {
    const response = await items.list({ page, per_page: ITEMS_PAGE_SIZE });
    const previousCount = itemsByKey.size;
    for (const item of response.result) {
      if (!itemsByKey.has(item.key)) itemsByKey.set(item.key, item);
    }
    const totalCount = response.result_info?.total_count;
    if (
      response.result.length === 0 ||
      totalCount === undefined ||
      itemsByKey.size >= totalCount ||
      itemsByKey.size === previousCount
    ) {
      return [...itemsByKey.values()];
    }
    page += 1;
  }
}

export class CloudflareIndex implements IndexPort {
  constructor(
    private readonly namespace: AiSearchNamespaceIndexPort,
    private readonly state: ItemStatePort,
  ) {}

  async upload(
    scope: ContentScope,
    path: string,
    content: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    const item = await this.namespace
      .get(INSTANCE_BY_SCOPE[scope])
      .items.upload(path, content, { metadata });
    await this.state.setItemId(scope, path, item.id);
  }

  async remove(scope: ContentScope, path: string): Promise<void> {
    const items = this.namespace.get(INSTANCE_BY_SCOPE[scope]).items;
    let itemId = await this.state.getItemId(scope, path);
    if (!itemId) {
      itemId = (await scanItems(items)).find((item) => item.key === path)?.id ?? null;
    }
    if (itemId) await items.delete(itemId);
    await this.state.deleteItemId(scope, path);
  }

  async list(scope: ContentScope): Promise<string[]> {
    const items = this.namespace.get(INSTANCE_BY_SCOPE[scope]).items;
    return (await scanItems(items)).map((item) => item.key);
  }
}
