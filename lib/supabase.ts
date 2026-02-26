import "server-only";

const DEFAULT_STORAGE_BUCKET = "nomod";
const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/";

type SupabaseRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
  headers?: HeadersInit;
  prefer?: string;
};

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const decoded = Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function assertServerKeyLooksPrivileged(key: string): void {
  // Legacy Supabase keys are JWTs; enforce service_role claim when detectable.
  if (key.startsWith("eyJ")) {
    const payload = decodeJwtPayload(key);
    const role = typeof payload?.role === "string" ? payload.role : "";

    if (role && role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY must be a service role key. Detected JWT role "${role}".`,
      );
    }
  }
}

function getSupabaseConfig(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).",
    );
  }

  assertServerKeyLooksPrivileged(serviceRoleKey);

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const url = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY");
  return Boolean(url && serviceRoleKey);
}

export function getSupabaseStorageBucket(): string {
  return getEnv("SUPABASE_STORAGE_BUCKET") || DEFAULT_STORAGE_BUCKET;
}

export function encodeStorageObjectPath(pathValue: string): string {
  return pathValue
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getSupabaseStoragePublicUrl(objectPath: string): string {
  const { url } = getSupabaseConfig();
  const bucket = getSupabaseStorageBucket();
  const normalized = objectPath.trim().replace(/^\/+/, "");

  return `${url}/storage/v1/object/public/${bucket}/${encodeStorageObjectPath(normalized)}`;
}

function decodeStorageObjectPath(rawPath: string): string {
  return rawPath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function getStorageObjectPathFromSupabasePublicUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (!parsed.pathname.startsWith(STORAGE_PUBLIC_MARKER)) {
      return null;
    }

    const remainder = parsed.pathname.slice(STORAGE_PUBLIC_MARKER.length);
    const [, ...objectPathParts] = remainder.split("/");
    const objectPath = decodeStorageObjectPath(objectPathParts.join("/").replace(/^\/+/, ""));

    return objectPath || null;
  } catch {
    return null;
  }
}

export function normalizeLegacyMediaPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (!trimmed.startsWith("/images/")) {
    const objectPath = getStorageObjectPathFromSupabasePublicUrl(trimmed);

    if (!objectPath || !isSupabaseConfigured()) {
      return trimmed;
    }

    try {
      return getSupabaseStoragePublicUrl(objectPath);
    } catch {
      return trimmed;
    }
  }

  if (!isSupabaseConfigured()) {
    return trimmed;
  }

  try {
    return getSupabaseStoragePublicUrl(trimmed.slice(1));
  } catch {
    return trimmed;
  }
}

export async function supabaseRequest(
  path: string,
  options: SupabaseRequestOptions = {},
): Promise<Response> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const requestUrl = new URL(path.startsWith("/") ? `${url}${path}` : `${url}/${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) {
        continue;
      }
      requestUrl.searchParams.set(key, value);
    }
  }

  const headers = new Headers(options.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);

  if (options.prefer) {
    headers.set("Prefer", options.prefer);
  }

  const hasBody = options.body !== undefined;
  const rawBody =
    typeof options.body === "string" ||
    options.body instanceof Blob ||
    options.body instanceof FormData ||
    options.body instanceof URLSearchParams ||
    options.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(options.body);
  const body = hasBody
    ? rawBody
      ? (options.body as BodyInit)
      : JSON.stringify(options.body)
    : undefined;

  if (hasBody && !rawBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(requestUrl.toString(), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  return response;
}

export async function readSupabaseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    const lowerBody = body.toLowerCase();
    const looksLikeRlsError =
      lowerBody.includes("row-level security policy") ||
      lowerBody.includes("\"code\":\"42501\"");

    if ((response.status === 401 || response.status === 403) && looksLikeRlsError) {
      throw new Error(
        `Supabase request failed (${response.status}) due to RLS. Use SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) for server-side calls, not anon/publishable keys.`,
      );
    }

    throw new Error(`Supabase request failed (${response.status}): ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
