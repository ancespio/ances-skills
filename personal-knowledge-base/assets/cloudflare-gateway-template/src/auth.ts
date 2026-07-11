const encoder = new TextEncoder();
const BEARER_CHALLENGE = encoder.encode("knowledgebase-gateway-bearer-v1");

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return token ? token : null;
}

async function importHmacKey(value: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function authorizeBearer(
  request: Request,
  expectedToken: string,
): Promise<boolean> {
  const receivedToken = bearerToken(request);
  if (!receivedToken || !expectedToken) return false;
  const [receivedKey, expectedKey] = await Promise.all([
    importHmacKey(receivedToken, "sign"),
    importHmacKey(expectedToken, "verify"),
  ]);
  const signature = await crypto.subtle.sign("HMAC", receivedKey, BEARER_CHALLENGE);
  return crypto.subtle.verify("HMAC", expectedKey, signature, BEARER_CHALLENGE);
}

function hexBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyGithubWebhook(
  body: ArrayBuffer | ArrayBufferView,
  signatureHeader: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const signature = hexBytes(signatureHeader.slice("sha256=".length));
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signature, body as BufferSource);
}
