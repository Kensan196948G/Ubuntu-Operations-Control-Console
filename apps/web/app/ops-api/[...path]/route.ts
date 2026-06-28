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
    const headers: Record<string, string> = {
      accept: request.headers.get("accept") ?? "application/json",
      "content-type": request.headers.get("content-type") ?? "application/json"
    };
    const operatorToken = process.env.UOCC_OPERATOR_TOKEN;
    if (!operatorToken && request.method !== "GET" && request.method !== "HEAD") {
      return NextResponse.json({ error: "Operator token is not configured" }, { status: 503 });
    }
    if (operatorToken && request.method !== "GET" && request.method !== "HEAD") {
      headers["x-uocc-operator-token"] = operatorToken;
    }
    const origin = request.headers.get("origin");
    if (origin) {
      headers.origin = origin;
    }

    const response = await fetch(target, {
      method: request.method,
      headers,
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
