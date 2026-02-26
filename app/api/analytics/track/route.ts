import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { trackPageView } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function parseHostFromUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function isSameOriginRequest(request: Request): boolean {
  const expectedHost =
    request.headers.get("x-forwarded-host")?.toLowerCase() ??
    request.headers.get("host")?.toLowerCase() ??
    "";
  if (!expectedHost) {
    return false;
  }

  const originHost = parseHostFromUrl(request.headers.get("origin"));
  if (originHost) {
    return originHost === expectedHost;
  }

  const refererHost = parseHostFromUrl(request.headers.get("referer"));
  if (refererHost) {
    return refererHost === expectedHost;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 4096) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    const body = (await request.json()) as { path?: string; referrer?: string };
    const path = String(body.path ?? "").trim();

    if (!path || !path.startsWith("/") || path.startsWith("//") || path.length > 300) {
      return NextResponse.json({ ok: false, error: "Missing path." }, { status: 400 });
    }

    const headerStore = await headers();
    const userAgent = headerStore.get("user-agent") ?? undefined;

    await trackPageView({
      path,
      referrer: body.referrer,
      userAgent,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
