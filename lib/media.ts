import path from "node:path";

import {
  encodeStorageObjectPath,
  getSupabaseStorageBucket,
  getSupabaseStoragePublicUrl,
  getStorageObjectPathFromSupabasePublicUrl,
  normalizeLegacyMediaPath,
  readSupabaseJson,
  supabaseRequest,
} from "@/lib/supabase";

export type MediaAssetKind = "posts" | "authors" | "about" | "other";

export type MediaAsset = {
  path: string;
  fileName: string;
  extension: string;
  directory: string;
  kind: MediaAssetKind;
  sizeBytes: number;
  modifiedAt: string;
};

type MediaAssetRow = {
  object_path: string;
  public_url: string;
  file_name: string;
  extension: string;
  directory: string;
  kind: MediaAssetKind;
  size_bytes: number;
  modified_at: string;
};

export function inferMediaKind(objectPath: string): MediaAssetKind {
  const normalized = objectPath.replace(/^\/+/, "");
  const segments = normalized.split("/");
  const folder = (segments[1] ?? "").toLowerCase();

  if (folder === "posts" || folder === "authors" || folder === "about") {
    return folder;
  }

  return "other";
}

function objectPathToDirectory(objectPath: string): string {
  const normalized = objectPath.replace(/^\/+/, "");
  const fileDirectory = path.posix.dirname(normalized);
  return `/${fileDirectory}`;
}

function sanitizeMediaAsset(row: MediaAssetRow): MediaAsset {
  const normalizedObjectPath = row.object_path.replace(/^\/+/, "");
  let canonicalPath = row.public_url;

  try {
    canonicalPath = normalizedObjectPath
      ? getSupabaseStoragePublicUrl(normalizedObjectPath)
      : normalizeLegacyMediaPath(row.public_url);
  } catch {
    canonicalPath = normalizeLegacyMediaPath(row.public_url);
  }

  return {
    path: canonicalPath || row.public_url,
    fileName: row.file_name,
    extension: row.extension,
    directory: row.directory,
    kind: row.kind,
    sizeBytes: Number(row.size_bytes) || 0,
    modifiedAt: row.modified_at,
  };
}

export async function getMediaAssets(): Promise<MediaAsset[]> {
  try {
    const response = await supabaseRequest("/rest/v1/media_assets", {
      query: {
        select: "object_path,public_url,file_name,extension,directory,kind,size_bytes,modified_at",
        order: "modified_at.desc",
      },
    });

    const rows = await readSupabaseJson<MediaAssetRow[]>(response);
    return rows.map((row) => sanitizeMediaAsset(row));
  } catch {
    return [];
  }
}

export async function getPostMediaAssets(): Promise<MediaAsset[]> {
  return (await getMediaAssets()).filter((asset) => asset.kind === "posts");
}

export function toMediaAssetRecord(input: {
  objectPath: string;
  sizeBytes: number;
  modifiedAt?: string;
}): MediaAssetRow {
  const normalizedObjectPath = input.objectPath.replace(/^\/+/, "");
  const fileName = path.posix.basename(normalizedObjectPath);
  const extension = path.posix.extname(fileName).toLowerCase();
  const directory = objectPathToDirectory(normalizedObjectPath);

  return {
    object_path: normalizedObjectPath,
    public_url: getSupabaseStoragePublicUrl(normalizedObjectPath),
    file_name: fileName,
    extension,
    directory,
    kind: inferMediaKind(normalizedObjectPath),
    size_bytes: input.sizeBytes,
    modified_at: input.modifiedAt ?? new Date().toISOString(),
  };
}

export async function upsertMediaAssetRecord(input: {
  objectPath: string;
  sizeBytes: number;
  modifiedAt?: string;
}): Promise<MediaAsset> {
  const record = toMediaAssetRecord(input);

  const response = await supabaseRequest("/rest/v1/media_assets", {
    method: "POST",
    query: {
      on_conflict: "object_path",
      select: "object_path,public_url,file_name,extension,directory,kind,size_bytes,modified_at",
    },
    prefer: "resolution=merge-duplicates,return=representation",
    body: [
      {
        ...record,
        updated_at: new Date().toISOString(),
      },
    ],
  });

  const rows = await readSupabaseJson<MediaAssetRow[]>(response);
  const row = rows[0] ?? record;
  return sanitizeMediaAsset(row);
}

export async function getMediaAssetByPublicUrl(publicUrl: string): Promise<MediaAsset | undefined> {
  const normalizedPublicUrl = normalizeLegacyMediaPath(publicUrl);
  const response = await supabaseRequest("/rest/v1/media_assets", {
    query: {
      select: "object_path,public_url,file_name,extension,directory,kind,size_bytes,modified_at",
      public_url: `eq.${normalizedPublicUrl}`,
      limit: "1",
    },
  });

  let rows = await readSupabaseJson<MediaAssetRow[]>(response);
  let row = rows[0];

  if (!row) {
    const objectPath = getStorageObjectPathFromSupabasePublicUrl(normalizedPublicUrl);
    if (!objectPath) {
      return undefined;
    }

    const fallbackResponse = await supabaseRequest("/rest/v1/media_assets", {
      query: {
        select: "object_path,public_url,file_name,extension,directory,kind,size_bytes,modified_at",
        object_path: `eq.${objectPath}`,
        limit: "1",
      },
    });
    rows = await readSupabaseJson<MediaAssetRow[]>(fallbackResponse);
    row = rows[0];
  }

  return row ? sanitizeMediaAsset(row) : undefined;
}

export async function deleteMediaAssetByPublicUrl(publicUrl: string): Promise<string | null> {
  const normalizedPublicUrl = normalizeLegacyMediaPath(publicUrl);
  const response = await supabaseRequest("/rest/v1/media_assets", {
    method: "DELETE",
    query: {
      public_url: `eq.${normalizedPublicUrl}`,
      select: "object_path",
    },
  });

  const deletedByUrl = await readSupabaseJson<Array<{ object_path: string }>>(response);
  if (deletedByUrl[0]?.object_path) {
    return deletedByUrl[0].object_path;
  }

  const objectPath = getStorageObjectPathFromSupabasePublicUrl(normalizedPublicUrl);
  if (!objectPath) {
    return null;
  }

  const fallbackResponse = await supabaseRequest("/rest/v1/media_assets", {
    method: "DELETE",
    query: {
      object_path: `eq.${objectPath}`,
      select: "object_path",
    },
  });

  const deletedByObjectPath = await readSupabaseJson<Array<{ object_path: string }>>(fallbackResponse);
  return deletedByObjectPath[0]?.object_path ?? null;
}

export function getStorageObjectPathFromPublicUrl(publicUrl: string): string {
  const trimmed = publicUrl.trim();
  if (!trimmed) {
    throw new Error("Missing media URL.");
  }

  if (trimmed.startsWith("/images/")) {
    return trimmed.slice(1);
  }

  const objectPath = getStorageObjectPathFromSupabasePublicUrl(trimmed);
  if (objectPath) {
    return objectPath;
  }

  throw new Error("Invalid media URL.");
}

export async function deleteStorageObject(objectPath: string): Promise<void> {
  const normalized = objectPath.replace(/^\/+/, "");
  const bucket = getSupabaseStorageBucket();
  const encoded = encodeStorageObjectPath(normalized);

  const response = await supabaseRequest(`/storage/v1/object/${bucket}/${encoded}`, {
    method: "DELETE",
  });

  await readSupabaseJson(response);
}

export function shouldUnoptimizeImage(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  return withoutQuery.endsWith(".svg");
}

export function getRenderableImageSrc(src: string): string {
  if (!shouldUnoptimizeImage(src)) {
    return src;
  }

  try {
    const parsed = new URL(src);
    const marker = "/storage/v1/object/public/";

    if (!parsed.pathname.startsWith(marker)) {
      return src;
    }

    const remainder = parsed.pathname.slice(marker.length);
    const [, ...objectPathParts] = remainder.split("/");
    const objectPath = objectPathParts.join("/");

    if (!objectPath) {
      return src;
    }

    return `/api/media/${objectPath}`;
  } catch {
    return src;
  }
}
