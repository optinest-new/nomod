import { NextResponse } from "next/server";

import { getNewsletterSubscribers } from "@/lib/newsletter";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ exists: false });
  }

  const subscribers = await getNewsletterSubscribers();
  const exists = subscribers.some((entry) => entry.email === email);

  return NextResponse.json({ exists });
}
