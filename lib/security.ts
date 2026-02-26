import crypto from "node:crypto";

import { headers } from "next/headers";

import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

type LoginRateLimitRecord = {
  key: string;
  count: number;
  first_attempt_at: string;
  blocked_until?: string | null;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getHostHeader(headerStore: Headers): string {
  return (
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    ""
  )
    .trim()
    .toLowerCase();
}

function normalizePort(host: string): string {
  if (host === "localhost") {
    return "localhost:80";
  }

  return host;
}

function parseSourceHost(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.host.trim().toLowerCase();
  } catch {
    return null;
  }
}

export async function assertSameOriginRequest(): Promise<void> {
  const headerStore = await headers();
  const expectedHost = getHostHeader(headerStore);

  if (!expectedHost) {
    throw new Error("Missing host header.");
  }

  const origin = headerStore.get("origin");
  if (origin) {
    const sourceHost = parseSourceHost(origin);
    if (!sourceHost || normalizePort(sourceHost) !== normalizePort(expectedHost)) {
      throw new Error("Invalid request origin.");
    }

    return;
  }

  const referer = headerStore.get("referer");
  if (referer) {
    const sourceHost = parseSourceHost(referer);
    if (!sourceHost || normalizePort(sourceHost) !== normalizePort(expectedHost)) {
      throw new Error("Invalid request referrer.");
    }

    return;
  }

  throw new Error("Missing origin/referrer headers.");
}

async function readRateLimitRecord(key: string): Promise<LoginRateLimitRecord | null> {
  try {
    const response = await supabaseRequest("/rest/v1/login_rate_limits", {
      query: {
        select: "key,count,first_attempt_at,blocked_until",
        key: `eq.${key}`,
        limit: "1",
      },
    });

    const rows = await readSupabaseJson<LoginRateLimitRecord[]>(response);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function writeRateLimitRecord(record: LoginRateLimitRecord): Promise<void> {
  const response = await supabaseRequest("/rest/v1/login_rate_limits", {
    method: "POST",
    query: {
      on_conflict: "key",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [
      {
        ...record,
        updated_at: new Date().toISOString(),
      },
    ],
  });

  await readSupabaseJson(response);
}

async function deleteRateLimitRecord(key: string): Promise<void> {
  const response = await supabaseRequest("/rest/v1/login_rate_limits", {
    method: "DELETE",
    query: {
      key: `eq.${key}`,
    },
  });

  await readSupabaseJson(response);
}

function getIpAddress(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headerStore.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export async function getRequestClientFingerprint(): Promise<string> {
  const headerStore = await headers();
  const ip = getIpAddress(headerStore);
  const ua = (headerStore.get("user-agent") ?? "").slice(0, 180);
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

export async function getLoginRateLimitState(key: string): Promise<{
  limited: boolean;
  retryAfterSeconds: number;
}> {
  const now = Date.now();
  const record = await readRateLimitRecord(key);

  if (!record) {
    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  }

  const firstMs = new Date(record.first_attempt_at).getTime();
  const stale = !Number.isFinite(firstMs) || now - firstMs > WINDOW_MS * 4;
  if (stale) {
    await deleteRateLimitRecord(key);
    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  }

  const blockedUntilMs = record.blocked_until ? new Date(record.blocked_until).getTime() : 0;
  if (blockedUntilMs > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - now) / 1000)),
    };
  }

  if (record.blocked_until) {
    await writeRateLimitRecord({
      ...record,
      blocked_until: null,
    });
  }

  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

export async function recordLoginFailure(key: string): Promise<{
  limited: boolean;
  retryAfterSeconds: number;
}> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const current = await readRateLimitRecord(key);

  if (!current) {
    await writeRateLimitRecord({
      key,
      count: 1,
      first_attempt_at: nowIso,
      blocked_until: null,
    });

    return { limited: false, retryAfterSeconds: 0 };
  }

  const firstMs = new Date(current.first_attempt_at).getTime();
  const resetWindow = !Number.isFinite(firstMs) || now - firstMs > WINDOW_MS;

  const nextCount = resetWindow ? 1 : current.count + 1;
  const nextFirstAttempt = resetWindow ? nowIso : current.first_attempt_at;

  if (nextCount >= MAX_ATTEMPTS) {
    const blockedUntilMs = now + LOCKOUT_MS;
    const blockedUntil = new Date(blockedUntilMs).toISOString();

    await writeRateLimitRecord({
      key,
      count: nextCount,
      first_attempt_at: nextFirstAttempt,
      blocked_until: blockedUntil,
    });

    return {
      limited: true,
      retryAfterSeconds: Math.ceil((blockedUntilMs - now) / 1000),
    };
  }

  await writeRateLimitRecord({
    key,
    count: nextCount,
    first_attempt_at: nextFirstAttempt,
    blocked_until: null,
  });

  return { limited: false, retryAfterSeconds: 0 };
}

export async function clearLoginRateLimit(key: string): Promise<void> {
  await deleteRateLimitRecord(key);
}
