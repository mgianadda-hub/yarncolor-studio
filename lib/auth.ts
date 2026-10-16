/**
 * Sessione firmata con HMAC-SHA256 usando APP_PASSWORD come chiave.
 * Cambiare la password invalida tutte le sessioni esistenti.
 * Usa solo Web Crypto, così funziona sia nel proxy sia nelle route.
 */

export const SESSION_COOKIE = "yc_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

function sessionPayload(expiresAt: number): Uint8Array<ArrayBuffer> {
  return encoder.encode(`yarncolor-session:${expiresAt}`);
}

export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, sessionPayload(expiresAt));
  return `${expiresAt}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const [expiresRaw, signatureRaw] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return false;
  const signature = signatureRaw ? fromBase64Url(signatureRaw) : null;
  if (!signature) return false;
  const key = await hmacKey(secret, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, sessionPayload(expiresAt));
}

/** Confronto della password a tempo costante (confronta gli HMAC, non le stringhe). */
export async function passwordMatches(candidate: string, secret: string): Promise<boolean> {
  const key = await hmacKey(secret, ["sign", "verify"]);
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(secret));
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(candidate));
}
