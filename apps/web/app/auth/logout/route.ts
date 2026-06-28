import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieSecure } from "@/lib/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: cookieSecure()
  });
  return response;
}
