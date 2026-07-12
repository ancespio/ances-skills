import { describe, expect, it } from "vitest";

import { authorizeBearer, verifyGithubWebhook } from "../src/auth";

const encoder = new TextEncoder();

describe("authorizeBearer", () => {
  it("accepts the exact bearer token", async () => {
    const request = new Request("https://gateway.example/v1/query", {
      headers: { authorization: "Bearer expected-secret" },
    });
    expect(await authorizeBearer(request, "expected-secret")).toBe(true);
  });

  it.each([
    undefined,
    "Basic expected-secret",
    "Bearer wrong-secret",
    "Bearer expected-secret-extra",
  ])("rejects an invalid authorization header: %s", async (authorization) => {
    const headers = authorization ? { authorization } : undefined;
    const request = new Request("https://gateway.example/v1/query", { headers });
    expect(await authorizeBearer(request, "expected-secret")).toBe(false);
  });
});

describe("verifyGithubWebhook", () => {
  async function sign(body: Uint8Array<ArrayBuffer>, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, body);
    return `sha256=${Array.from(new Uint8Array(signature), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  }

  it("accepts a valid GitHub sha256 signature", async () => {
    const body = encoder.encode('{"ref":"refs/heads/main"}');
    expect(await verifyGithubWebhook(body, await sign(body, "hook-secret"), "hook-secret")).toBe(
      true,
    );
  });

  it("rejects a modified payload", async () => {
    const original = encoder.encode('{"ref":"refs/heads/main"}');
    const modified = encoder.encode('{"ref":"refs/heads/other"}');
    expect(
      await verifyGithubWebhook(modified, await sign(original, "hook-secret"), "hook-secret"),
    ).toBe(false);
  });

  it.each([undefined, "", "sha1=abc", "sha256=not-hex"])(
    "rejects a malformed signature: %s",
    async (signature) => {
      expect(
        await verifyGithubWebhook(encoder.encode("{}"), signature, "hook-secret"),
      ).toBe(false);
    },
  );
});
