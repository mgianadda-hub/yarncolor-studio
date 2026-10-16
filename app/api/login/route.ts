import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  passwordMatches,
} from "@/lib/auth";

export async function POST(request: Request) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return NextResponse.json({ error: "APP_PASSWORD non è configurata." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!(await passwordMatches(password, secret))) {
    // Rallenta i tentativi ripetuti.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: "Password errata." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
