import { EncryptJWT, jwtDecrypt } from "jose";
import { appConfig } from "@/config/app.config";

/**
 * Cookie cifrati (JWE, A256GCM) con una chiave derivata da AUTH_SECRET. Solo Web Crypto e jose,
 * così funzionano sia nel proxy sia nelle route.
 */

export const SESSION_COOKIE = "yc_session";
export const LOGIN_COOKIE = "yc_login";
export const SESSION_MAX_AGE_SECONDS = appConfig.auth.sessionMaxAgeDays * 24 * 60 * 60;
export const LOGIN_MAX_AGE_SECONDS = 10 * 60;

export type Session = { email: string; name?: string; groups: string[] };

/** Dati temporanei del login in corso (PKCE, state, nonce, pagina di ritorno). */
export type LoginTransaction = { verifier: string; state: string; nonce: string; returnTo: string };

const encoder = new TextEncoder();

async function key(purpose: string): Promise<Uint8Array> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET non è configurata.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`yarncolor:${purpose}:${secret}`));
  return new Uint8Array(digest);
}

async function seal(payload: Record<string, unknown>, purpose: string, maxAgeSeconds: number) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(await key(purpose));
}

async function unseal(token: string | undefined, purpose: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await key(purpose));
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(session: Session) {
  return seal(session, "session", SESSION_MAX_AGE_SECONDS);
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  const payload = await unseal(token, "session");
  if (!payload || typeof payload.email !== "string" || !Array.isArray(payload.groups)) return null;
  return {
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    groups: payload.groups.filter((g): g is string => typeof g === "string"),
  };
}

export function createLoginToken(transaction: LoginTransaction) {
  return seal(transaction, "login", LOGIN_MAX_AGE_SECONDS);
}

export async function readLoginToken(token: string | undefined): Promise<LoginTransaction | null> {
  const p = await unseal(token, "login");
  if (!p) return null;
  const { verifier, state, nonce, returnTo } = p;
  if ([verifier, state, nonce, returnTo].some((v) => typeof v !== "string")) return null;
  return p as unknown as LoginTransaction;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
