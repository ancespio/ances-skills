import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getVerifiedSource, getVerifiedSourceText } from "../src/source";

const HASH = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function textRepository(overrides: Record<string, string> = {}) {
  const transcript = "---\ngraph-excluded: true\n---\nline 1\nline 2\nline 3\nline 4\n";
  const transcriptBytes = new TextEncoder().encode(transcript).byteLength;
  const files: Record<string, string> = {
    "wiki/sources/example-source.md": `---
title: 示例来源
raw_file: raw/pdfs/example.pdf
raw_sha256: ${HASH}
last_verified: 2026-07-10
derived_manifest: wiki/derived/pdfs/example-source/manifest.json
derived_transcript: wiki/derived/pdfs/example-source/transcript.md
derived_status: pass
---
# 示例来源
`,
    "raw/pdfs/example.pdf": "test",
    "wiki/derived/pdfs/example-source/transcript.md": transcript,
    "wiki/derived/pdfs/example-source/manifest.json": JSON.stringify({
      source_slug: "example-source",
      raw_file: "raw/pdfs/example.pdf",
      raw_sha256: HASH,
      generated_at: "2026-07-16T00:00:00Z",
      quality_status: "pass",
      warnings: ["auxiliary text"],
      artifacts: [
        {
          path: "transcript.md",
          bytes: transcriptBytes,
          sha256: sha256(transcript),
        },
      ],
    }),
    ...overrides,
  };
  return {
    files,
    repository: {
      async readFile(path: string, commit: string) {
        expect(commit).toBe("abc123");
        const content = files[path];
        return content === undefined ? null : new TextEncoder().encode(content);
      },
    },
  };
}

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
      availableTextVariants: [],
      commit: "abc123",
    });
  });

  it("lists only derived variants that pass manifest and artifact verification", async () => {
    const { repository } = textRepository();
    await expect(getVerifiedSource(repository, "example-source", "abc123")).resolves.toEqual(
      expect.objectContaining({ availableTextVariants: ["original"] }),
    );
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

  it("uses the streaming repository hash for large raw files", async () => {
    const repository = {
      async readFile(path: string) {
        if (path.startsWith("wiki/sources/")) {
          return new TextEncoder().encode(`---
title: 示例来源
raw_file: raw/pdfs/example.pdf
raw_sha256: ${HASH}
---
# 示例来源
`);
        }
        throw new Error("raw file should not be buffered");
      },
      async sha256File() {
        return HASH;
      },
    };

    await expect(getVerifiedSource(repository, "example-source", "abc123")).resolves.toEqual(
      expect.objectContaining({ rawFile: "raw/pdfs/example.pdf", rawSha256: HASH }),
    );
  });
});

describe("getVerifiedSourceText", () => {
  it("returns a verified line range with continuation metadata", async () => {
    const { repository } = textRepository();
    await expect(
      getVerifiedSourceText(repository, "example-source", "abc123", {
        variant: "original",
        fromLine: 5,
        maxLines: 2,
      }),
    ).resolves.toEqual({
      sourceSlug: "example-source",
      variant: "original",
      content: "line 2\nline 3",
      fromLine: 5,
      nextLine: 7,
      complete: false,
      rawFile: "raw/pdfs/example.pdf",
      rawSha256: HASH,
      derivedFile: "wiki/derived/pdfs/example-source/transcript.md",
      derivedSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      generatedAt: "2026-07-16T00:00:00Z",
      syncedCommit: "abc123",
      warnings: ["auxiliary text"],
    });
  });

  it("rejects a missing full translation", async () => {
    const { repository } = textRepository();
    await expect(
      getVerifiedSourceText(repository, "example-source", "abc123", {
        variant: "zh-full",
        fromLine: 1,
        maxLines: 200,
      }),
    ).resolves.toBeNull();
  });

  it("rejects a modified raw file", async () => {
    const { repository } = textRepository({ "raw/pdfs/example.pdf": "modified" });
    await expect(
      getVerifiedSourceText(repository, "example-source", "abc123", {
        variant: "original",
        fromLine: 1,
        maxLines: 200,
      }),
    ).resolves.toBeNull();
  });

  it("rejects a manifest whose raw identity was changed", async () => {
    const fixture = textRepository();
    const manifest = JSON.parse(
      fixture.files["wiki/derived/pdfs/example-source/manifest.json"]!,
    ) as Record<string, unknown>;
    manifest.raw_sha256 = "a".repeat(64);
    fixture.files["wiki/derived/pdfs/example-source/manifest.json"] = JSON.stringify(manifest);
    await expect(
      getVerifiedSourceText(fixture.repository, "example-source", "abc123", {
        variant: "original",
        fromLine: 1,
        maxLines: 200,
      }),
    ).resolves.toBeNull();
  });

  it("rejects a derived file whose bytes no longer match the manifest", async () => {
    const fixture = textRepository();
    fixture.files["wiki/derived/pdfs/example-source/transcript.md"] += "tampered\n";
    await expect(
      getVerifiedSourceText(fixture.repository, "example-source", "abc123", {
        variant: "original",
        fromLine: 1,
        maxLines: 200,
      }),
    ).resolves.toBeNull();
  });
});
