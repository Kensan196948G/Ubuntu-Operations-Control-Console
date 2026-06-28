import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  authConfigured,
  cookieSecure,
  createSessionCookie,
  sanitizeNextPath,
  verifyPassword
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const nextPath = sanitizeNextPath(form.get("next"));

  if (!authConfigured()) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const password = String(form.get("password") ?? "");
  if (!(await verifyPassword(password))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, await createSessionCookie(), {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: cookieSecure()
  });
  return response;
}
