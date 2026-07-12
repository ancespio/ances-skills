import { describe, expect, it } from "vitest";

import {
  CloudflareIndex,
  type AiSearchNamespaceIndexPort,
  type ItemStatePort,
} from "../src/cloudflare-index";

class FakeItemState implements ItemStatePort {
  readonly ids = new Map<string, string>();

  async getItemId(scope: string, path: string): Promise<string | null> {
    return this.ids.get(`${scope}:${path}`) ?? null;
  }

  async setItemId(scope: string, path: string, itemId: string): Promise<void> {
    this.ids.set(`${scope}:${path}`, itemId);
  }

  async deleteItemId(scope: string, path: string): Promise<void> {
    this.ids.delete(`${scope}:${path}`);
  }
}

describe("CloudflareIndex", () => {
  it("uploads to the scope-specific instance and stores the returned item ID", async () => {
    const uploads: unknown[] = [];
    const namespace: AiSearchNamespaceIndexPort = {
      get(instanceName) {
        expect(instanceName).toBe("kb-evidence");
        return {
          items: {
            async upload(name, content, options) {
              uploads.push({ name, content, options });
              return { id: "item-1", key: name };
            },
            async list() {
              return { result: [] };
            },
            async delete() {},
          },
        };
      },
    };
    const state = new FakeItemState();
    const index = new CloudflareIndex(namespace, state);

    await index.upload("evidence", "wiki/sources/a.md", "# A", {
      integrity_status: "verified",
    });

    expect(uploads).toEqual([
      {
        name: "wiki/sources/a.md",
        content: "# A",
        options: { metadata: { integrity_status: "verified" } },
      },
    ]);
    await expect(state.getItemId("evidence", "wiki/sources/a.md")).resolves.toBe("item-1");
  });

  it("deletes a known item without listing the instance", async () => {
    const deleted: string[] = [];
    let listCalled = false;
    const namespace: AiSearchNamespaceIndexPort = {
      get() {
        return {
          items: {
            async upload(name) {
              return { id: "unused", key: name };
            },
            async list() {
              listCalled = true;
              return { result: [] };
            },
            async delete(itemId) {
              deleted.push(itemId);
            },
          },
        };
      },
    };
    const state = new FakeItemState();
    await state.setItemId("knowledge", "wiki/concepts/a.md", "item-2");
    const index = new CloudflareIndex(namespace, state);

    await index.remove("knowledge", "wiki/concepts/a.md");

    expect(deleted).toEqual(["item-2"]);
    expect(listCalled).toBe(false);
    await expect(state.getItemId("knowledge", "wiki/concepts/a.md")).resolves.toBeNull();
  });

  it("finds an exact key when legacy state has no item ID", async () => {
    const deleted: string[] = [];
    const listCalls: unknown[] = [];
    const namespace: AiSearchNamespaceIndexPort = {
      get() {
        return {
          items: {
            async upload(name) {
              return { id: "unused", key: name };
            },
            async list(params) {
              listCalls.push(params);
              if (params?.page === 1) {
                return {
                  result: [{ id: "wrong", key: "wiki/sources/a.md.bak" }],
                  result_info: { page: 1, per_page: 10, total_count: 2 },
                };
              }
              if (params?.page === 2) {
                return {
                  result: [{ id: "exact", key: "wiki/sources/a.md" }],
                  result_info: { page: 2, per_page: 10, total_count: 2 },
                };
              }
              return {
                result: [],
              };
            },
            async delete(itemId) {
              deleted.push(itemId);
            },
          },
        };
      },
    };
    const state = new FakeItemState();
    const index = new CloudflareIndex(namespace, state);

    await index.remove("evidence", "wiki/sources/a.md");

    expect(deleted).toEqual(["exact"]);
    expect(listCalls).toEqual([
      { page: 1, per_page: 10 },
      { page: 2, per_page: 10 },
    ]);
  });

  it("lists unique indexed keys across pages of ten", async () => {
    const listCalls: unknown[] = [];
    const namespace: AiSearchNamespaceIndexPort = {
      get() {
        return {
          items: {
            async upload(name) {
              return { id: "unused", key: name };
            },
            async list(params) {
              listCalls.push(params);
              if (params?.page === 1) {
                return {
                  result: [
                    { id: "1", key: "wiki/concepts/a.md" },
                    { id: "2", key: "wiki/concepts/b.md" },
                  ],
                  result_info: { page: 1, per_page: 10, total_count: 3 },
                };
              }
              return {
                result: [
                  { id: "2-duplicate", key: "wiki/concepts/b.md" },
                  { id: "3", key: "wiki/concepts/c.md" },
                ],
                result_info: { page: 2, per_page: 10, total_count: 3 },
              };
            },
            async delete() {},
          },
        };
      },
    };
    const index = new CloudflareIndex(namespace, new FakeItemState());

    await expect(index.list("knowledge")).resolves.toEqual([
      "wiki/concepts/a.md",
      "wiki/concepts/b.md",
      "wiki/concepts/c.md",
    ]);
    expect(listCalls).toEqual([
      { page: 1, per_page: 10 },
      { page: 2, per_page: 10 },
    ]);
  });

  it("stops a repeated page scan without scheduling duplicate work", async () => {
    const listCalls: unknown[] = [];
    const namespace: AiSearchNamespaceIndexPort = {
      get() {
        return {
          items: {
            async upload(name) {
              return { id: "unused", key: name };
            },
            async list(params) {
              listCalls.push(params);
              if (listCalls.length > 2) throw new Error("pagination did not stop");
              return {
                result: [{ id: "1", key: "wiki/concepts/a.md" }],
                result_info: {
                  page: params?.page ?? 1,
                  per_page: 10,
                  total_count: 100,
                },
              };
            },
            async delete() {},
          },
        };
      },
    };
    const index = new CloudflareIndex(namespace, new FakeItemState());

    await expect(index.list("knowledge")).resolves.toEqual(["wiki/concepts/a.md"]);
    expect(listCalls).toEqual([
      { page: 1, per_page: 10 },
      { page: 2, per_page: 10 },
    ]);
  });
});
