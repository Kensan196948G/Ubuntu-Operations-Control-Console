import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authConfigured, sanitizeNextPath, verifySessionCookie } from "@/lib/session";

const PUBLIC_PREFIXES = ["/_next", "/auth/login", "/auth/logout", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  if (!authConfigured() || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authenticated = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (authenticated) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/ops-api")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", sanitizeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return pathname === "/login" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/ops-api/:path*"]
};
