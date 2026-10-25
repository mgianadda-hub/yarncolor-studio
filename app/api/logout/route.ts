import { NextResponse } from "next/server";
import { cognitoLogoutUrl, cognitoSettings, isAuthEnabled } from "@/lib/auth/config";
import { LOGIN_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

/** Chiude la sessione dell'app e quella di Cognito, poi torna alla pagina di login. */
export async function POST(request: Request) {
  const settings = cognitoSettings();
  const target =
    isAuthEnabled() && settings ? cognitoLogoutUrl(settings) : new URL("/login", request.url).toString();
  const response = NextResponse.redirect(target, 303);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(LOGIN_COOKIE);
  return response;
}
