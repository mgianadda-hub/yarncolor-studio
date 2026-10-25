import { NextResponse, type NextRequest } from "next/server";
import { cognitoSettings, isAuthEnabled } from "@/lib/auth/config";
import { completeLogin } from "@/lib/auth/oidc";
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  cookieOptions,
  createSessionToken,
  readLoginToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";

/** Ritorno da Cognito: scambio del codice, verifica del token e del gruppo, creazione della sessione. */
export async function GET(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.redirect(new URL("/", request.url));

  const fail = (error: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url), 303);
    response.cookies.delete(LOGIN_COOKIE);
    return response;
  };

  const settings = cognitoSettings();
  if (!settings || !process.env.AUTH_SECRET) return fail("config");
  // Errore restituito da Cognito/Google (es. accesso annullato).
  if (request.nextUrl.searchParams.has("error")) return fail("login");

  const transaction = await readLoginToken(request.cookies.get(LOGIN_COOKIE)?.value);
  if (!transaction) return fail("expired");

  let user;
  try {
    user = await completeLogin(settings, request.nextUrl, transaction);
  } catch (error) {
    console.error("Login Cognito non riuscito:", error);
    return fail("login");
  }

  if (!user.groups.includes(settings.allowedGroup)) return fail("unauthorized");

  const response = NextResponse.redirect(new URL(transaction.returnTo, request.url), 303);
  response.cookies.delete(LOGIN_COOKIE);
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken({ email: user.email, name: user.name, groups: user.groups }),
    cookieOptions(SESSION_MAX_AGE_SECONDS),
  );
  return response;
}
