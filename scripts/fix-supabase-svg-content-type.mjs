#!/usr/bin/env node

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
).trim();
const SUPABASE_STORAGE_BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || "nomod").trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).",
  );
  process.exit(1);
}

function encodeStorageObjectPath(pathValue) {
  return pathValue
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicUrl(objectPath) {
  const normalized = objectPath.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeStorageObjectPath(normalized)}`;
}

async function supabaseRequest(pathname, options = {}) {
  const url = new URL(pathname.startsWith("/") ? `${SUPABASE_URL}${pathname}` : `${SUPABASE_URL}/${pathname}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, value);
    }
  }

  const headers = new Headers(options.headers || {});
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);

  if (options.prefer) {
    headers.set("Prefer", options.prefer);
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}) ${pathname}: ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getSvgObjects() {
  const rows = await supabaseRequest("/rest/v1/media_assets", {
    query: {
      select: "object_path,public_url,extension",
      extension: "eq..svg",
      order: "object_path.asc",
    },
  });

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      objectPath: String(row?.object_path || "").trim(),
      publicUrl: String(row?.public_url || "").trim(),
      extension: String(row?.extension || "").trim().toLowerCase(),
    }))
    .filter((row) => row.objectPath && row.extension === ".svg");
}

async function reuploadSvg(objectPath, publicUrl) {
  const sourceUrl = publicUrl || buildPublicUrl(objectPath);
  const sourceResponse = await fetch(sourceUrl, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!sourceResponse.ok) {
    const text = await sourceResponse.text();
    throw new Error(`Failed to read SVG ${objectPath}: ${sourceResponse.status} ${text}`);
  }

  const bytes = await sourceResponse.arrayBuffer();
  const encodedPath = encodeStorageObjectPath(objectPath.replace(/^\/+/, ""));

  await supabaseRequest(`/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/svg+xml",
      "x-upsert": "true",
    },
    body: Buffer.from(bytes),
  });
}

async function main() {
  console.log(`Checking SVG objects in bucket "${SUPABASE_STORAGE_BUCKET}"...`);
  const svgObjects = await getSvgObjects();
  console.log(`Found ${svgObjects.length} SVG objects.`);

  let updated = 0;
  for (const item of svgObjects) {
    await reuploadSvg(item.objectPath, item.publicUrl);
    updated += 1;

    if (updated % 25 === 0) {
      console.log(`Updated ${updated}/${svgObjects.length} SVG files...`);
    }
  }

  console.log(`Updated ${updated} SVG files to image/svg+xml.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
