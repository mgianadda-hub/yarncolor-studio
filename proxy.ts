import { NextResponse, type NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

// Login, ritorno da Cognito e logout devono funzionare anche senza sessione.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/callback", "/api/logout"];

export async function proxy(request: NextRequest) {
  // Anteprime Vercel: protette da Vercel Deployment Protection, autenticazione dell'app disattivata.
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const allowedGroup = process.env.COGNITO_ALLOWED_GROUP?.trim();
  if (session && allowedGroup && session.groups.includes(allowedGroup)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accesso non autorizzato." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
