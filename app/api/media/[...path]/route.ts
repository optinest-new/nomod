import path from "node:path";

import { NextResponse } from "next/server";

import { getSupabaseStoragePublicUrl } from "@/lib/supabase";

const SVG_MIME = "image/svg+xml";

function inferMimeTypeFromPath(objectPath: string, fallback: string | null): string {
  const extension = path.extname(objectPath).toLowerCase();

  if (extension === ".svg") {
    return SVG_MIME;
  }

  return fallback || "application/octet-stream";
}

function sanitizeObjectPath(segments: string[]): string | null {
  const joined = segments.join("/").trim().replace(/^\/+/, "");

  if (!joined || joined.includes("..") || joined.includes("\\")) {
    return null;
  }

  return joined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  const objectPath = sanitizeObjectPath(resolvedParams.path ?? []);

  if (!objectPath) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }

  const sourceUrl = getSupabaseStoragePublicUrl(objectPath);
  const sourceResponse = await fetch(sourceUrl, { cache: "force-cache" });

  if (!sourceResponse.ok) {
    return NextResponse.json({ error: "Media not found." }, { status: sourceResponse.status });
  }

  const body = await sourceResponse.arrayBuffer();
  const upstreamType = sourceResponse.headers.get("content-type");
  const contentType = inferMimeTypeFromPath(objectPath, upstreamType);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
    },
  });
}
