import { NextResponse, type NextRequest } from "next/server";
import { appConfig } from "@/config/app.config";
import { cognitoSettings, isAuthEnabled, safeReturnPath } from "@/lib/auth/config";
import { buildLoginUrl } from "@/lib/auth/oidc";
import { LOGIN_COOKIE, LOGIN_MAX_AGE_SECONDS, cookieOptions, createLoginToken } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Avvia il login: PKCE, state e nonce in un cookie temporaneo, poi redirect alla Hosted UI (Google). */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("next"));
  if (!isAuthEnabled()) return NextResponse.redirect(new URL(returnTo, request.url));

  // Il login parte sempre dal dominio di produzione, lo stesso della callback registrata in Cognito,
  // altrimenti il cookie temporaneo non arriverebbe alla callback.
  const production = new URL(appConfig.auth.productionUrl);
  if (request.nextUrl.host !== production.host && process.env.VERCEL_ENV === "production") {
    const url = new URL("/api/auth/login", production);
    url.searchParams.set("next", returnTo);
    return NextResponse.redirect(url, 303);
  }

  const settings = cognitoSettings();
  if (!settings || !process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);
  }

  const { url, verifier, state, nonce } = await buildLoginUrl(settings);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(
    LOGIN_COOKIE,
    await createLoginToken({ verifier, state, nonce, returnTo }),
    cookieOptions(LOGIN_MAX_AGE_SECONDS),
  );
  return response;
}
