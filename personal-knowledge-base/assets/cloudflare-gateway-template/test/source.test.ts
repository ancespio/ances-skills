import { describe, expect, it } from "vitest";

import { getVerifiedSource } from "../src/source";

const HASH = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("getVerifiedSource", () => {
  it("returns a full source only when its raw bytes match at the same commit", async () => {
    const files: Record<string, string> = {
      "wiki/sources/example-source.md": `---
title: 示例来源
raw_file: raw/articles/example.md
raw_sha256: ${HASH}
last_verified: 2026-07-10
---
# 示例来源
`,
      "raw/articles/example.md": "test",
    };
    const repository = {
      async readFile(path: string, commit: string) {
        expect(commit).toBe("abc123");
        const content = files[path];
        return content === undefined ? null : new TextEncoder().encode(content);
      },
    };

    await expect(getVerifiedSource(repository, "example-source", "abc123")).resolves.toEqual({
      slug: "example-source",
      path: "wiki/sources/example-source.md",
      title: "示例来源",
      content: files["wiki/sources/example-source.md"],
      rawFile: "raw/articles/example.md",
      rawSha256: HASH,
      lastVerified: "2026-07-10",
      commit: "abc123",
    });
  });

  it("returns null for invalid slugs, missing files or modified raw content", async () => {
    const repository = {
      async readFile(path: string) {
        if (path.startsWith("wiki/sources/")) {
          return new TextEncoder().encode(`---
title: 示例来源
raw_file: raw/articles/example.md
raw_sha256: ${HASH}
---
# 示例来源
`);
        }
        return new TextEncoder().encode("changed");
      },
    };

    await expect(getVerifiedSource(repository, "../secret", "abc123")).resolves.toBeNull();
    await expect(getVerifiedSource(repository, "example-source", "abc123")).resolves.toBeNull();
  });
});
