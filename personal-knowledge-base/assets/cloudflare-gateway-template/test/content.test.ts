import { describe, expect, it } from "vitest";

import {
  classifyRepositoryPath,
  parseSourceFrontmatter,
  sha256Hex,
  verifySourceIntegrity,
} from "../src/content";

describe("classifyRepositoryPath", () => {
  it.each([
    ["wiki/sources/example.md", "evidence"],
    ["wiki/concepts/example.md", "knowledge"],
    ["wiki/entities/example.md", "knowledge"],
    ["wiki/synthesis/example.md", "knowledge"],
    ["context/persona/User_Persona.md", "context"],
  ] as const)("maps %s to %s", (path, expected) => {
    expect(classifyRepositoryPath(path)).toBe(expected);
  });

  it.each([
    "raw/pdfs/example.pdf",
    "wiki/outputs/query.md",
    "wiki/templates/source-template.md",
    "wiki/index.md",
    "wiki/log.md",
    "wiki/overview.md",
    "wiki/QUESTIONS.md",
    "AGENTS.md",
  ])("excludes %s", (path) => {
    expect(classifyRepositoryPath(path)).toBeNull();
  });
});

describe("parseSourceFrontmatter", () => {
  it("extracts the raw path, hash, confidence and review date", () => {
    const markdown = `---
title: 示例来源
raw_file: raw/articles/example.md
raw_sha256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
confidence: medium
source_count: 3
last_verified: 2026-07-10
---

# 示例来源
`;

    expect(parseSourceFrontmatter(markdown)).toEqual({
      title: "示例来源",
      rawFile: "raw/articles/example.md",
      rawSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      confidence: "medium",
      sourceCount: 3,
      lastVerified: "2026-07-10",
    });
  });

  it("rejects a source without a raw path or valid SHA-256", () => {
    expect(() =>
      parseSourceFrontmatter(`---\ntitle: Broken\nraw_sha256: nope\n---\n`),
    ).toThrow("invalid source frontmatter");
  });
});

describe("source integrity", () => {
  it("computes SHA-256 from the exact raw bytes", async () => {
    expect(await sha256Hex(new TextEncoder().encode("test"))).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("marks matching raw bytes as verified", async () => {
    const result = await verifySourceIntegrity(
      {
        title: "示例来源",
        rawFile: "raw/articles/example.md",
        rawSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        confidence: "medium",
        sourceCount: 3,
        lastVerified: "2026-07-10",
      },
      new TextEncoder().encode("test"),
    );

    expect(result).toEqual({ status: "verified", actualSha256: result.actualSha256 });
    expect(result.actualSha256).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("marks changed raw bytes as modified", async () => {
    const result = await verifySourceIntegrity(
      {
        title: "示例来源",
        rawFile: "raw/articles/example.md",
        rawSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        confidence: "medium",
        sourceCount: 3,
        lastVerified: "2026-07-10",
      },
      new TextEncoder().encode("changed"),
    );

    expect(result.status).toBe("modified");
  });
});
