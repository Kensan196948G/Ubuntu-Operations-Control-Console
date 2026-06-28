import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const configuredBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const baseUrl = configuredBase.replace(/\/$/, "");
  const url = new URL(request.url);
  const target = new URL(`${baseUrl}/api/${path.join("/")}`);
  target.search = url.search;

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        accept: request.headers.get("accept") ?? "application/json",
        "content-type": request.headers.get("content-type") ?? "application/json"
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store"
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "API proxy failed",
        detail: error instanceof Error ? error.message : "Unknown proxy error"
      },
      { status: 502 }
    );
  }
}

export { handler as GET, handler as POST };
