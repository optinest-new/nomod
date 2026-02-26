import crypto from "node:crypto";

import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

export type AnalyticsPageViewEvent = {
  id: string;
  type: "pageview";
  path: string;
  referrer?: string;
  userAgent?: string;
  createdAt: string;
};

export type AnalyticsSummary = {
  totalViews: number;
  uniquePaths: number;
  uniqueReferrers: number;
  topPaths: Array<{ path: string; views: number }>;
  topReferrers: Array<{ referrer: string; views: number }>;
  dailyViews: Array<{ date: string; views: number }>;
};

type AnalyticsEventRow = {
  id: string;
  type: "pageview";
  path: string;
  referrer?: string | null;
  user_agent?: string | null;
  created_at: string;
};

const MAX_EVENTS = 25_000;

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname + parsed.search;
    } catch {
      return "/";
    }
  }

  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`;
  }

  return trimmed;
}

function sanitizeReferrer(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.hostname;
  } catch {
    return undefined;
  }
}

function sanitizeEvents(rows: AnalyticsEventRow[]): AnalyticsPageViewEvent[] {
  return rows
    .map((row) => ({
      id: row.id,
      type: "pageview" as const,
      path: normalizePath(row.path),
      referrer: sanitizeReferrer(row.referrer ?? undefined),
      userAgent: row.user_agent ?? undefined,
      createdAt: row.created_at,
    }))
    .filter((event) => Boolean(event.id) && Boolean(event.path) && Boolean(event.createdAt));
}

export async function getAnalyticsEvents(): Promise<AnalyticsPageViewEvent[]> {
  try {
    const response = await supabaseRequest("/rest/v1/analytics_events", {
      query: {
        select: "id,type,path,referrer,user_agent,created_at",
        order: "created_at.desc",
        limit: String(MAX_EVENTS),
      },
    });

    const rows = await readSupabaseJson<AnalyticsEventRow[]>(response);
    return sanitizeEvents(rows).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}

export async function trackPageView(input: {
  path: string;
  referrer?: string;
  userAgent?: string;
}): Promise<void> {
  const normalizedPath = normalizePath(input.path);
  if (normalizedPath.startsWith("/admin")) {
    return;
  }

  const event = {
    id: crypto.randomUUID(),
    type: "pageview" as const,
    path: normalizedPath,
    referrer: sanitizeReferrer(input.referrer) ?? null,
    user_agent: input.userAgent?.slice(0, 220) ?? null,
    created_at: new Date().toISOString(),
  };

  const response = await supabaseRequest("/rest/v1/analytics_events", {
    method: "POST",
    prefer: "return=minimal",
    body: [event],
  });

  await readSupabaseJson(response);
}

function summarizeByCount<T extends string>(values: T[]): Array<{ value: T; count: number }> {
  const map = new Map<T, number>();

  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getAnalyticsSummary(days = 30): Promise<AnalyticsSummary> {
  const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let rows: AnalyticsEventRow[] = [];
  try {
    const response = await supabaseRequest("/rest/v1/analytics_events", {
      query: {
        select: "id,type,path,referrer,user_agent,created_at",
        created_at: `gte.${fromIso}`,
        order: "created_at.desc",
        limit: String(MAX_EVENTS),
      },
    });

    rows = await readSupabaseJson<AnalyticsEventRow[]>(response);
  } catch {
    rows = [];
  }

  const recent = sanitizeEvents(rows);
  const pathCounts = summarizeByCount(recent.map((event) => event.path));
  const referrerCounts = summarizeByCount(
    recent
      .map((event) => event.referrer)
      .filter((value): value is string => Boolean(value)),
  );

  const last14Days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return date.toISOString().slice(0, 10);
  });

  const viewsByDay = new Map<string, number>();
  for (const event of recent) {
    const key = event.createdAt.slice(0, 10);
    viewsByDay.set(key, (viewsByDay.get(key) ?? 0) + 1);
  }

  return {
    totalViews: recent.length,
    uniquePaths: new Set(recent.map((event) => event.path)).size,
    uniqueReferrers: new Set(
      recent
        .map((event) => event.referrer)
        .filter((value): value is string => Boolean(value)),
    ).size,
    topPaths: pathCounts.slice(0, 10).map((item) => ({ path: item.value, views: item.count })),
    topReferrers: referrerCounts
      .slice(0, 10)
      .map((item) => ({ referrer: item.value, views: item.count })),
    dailyViews: last14Days.map((date) => ({
      date,
      views: viewsByDay.get(date) ?? 0,
    })),
  };
}
