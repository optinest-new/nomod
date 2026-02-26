import crypto from "node:crypto";

import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

export type NewsletterSubscriber = {
  id: string;
  email: string;
  submittedAt: string;
  sourcePath?: string;
};

type SubscriberRow = {
  id: string;
  email: string;
  submitted_at: string;
  source_path?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSubscriber(value: unknown): NewsletterSubscriber | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<SubscriberRow>;
  const id = sanitizeText(record.id);
  const email = sanitizeText(record.email).toLowerCase();
  const submittedAt = sanitizeText(record.submitted_at);
  const sourcePath = sanitizeText(record.source_path);

  if (!id || !email || !submittedAt) {
    return null;
  }

  const parsedDate = Date.parse(submittedAt);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return {
    id,
    email,
    submittedAt: new Date(parsedDate).toISOString(),
    sourcePath: sourcePath.startsWith("/") ? sourcePath.slice(0, 200) : undefined,
  };
}

function sanitizeSubscribers(value: unknown): NewsletterSubscriber[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => sanitizeSubscriber(entry))
    .filter((entry): entry is NewsletterSubscriber => Boolean(entry))
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  try {
    const response = await supabaseRequest("/rest/v1/newsletter_subscribers", {
      query: {
        select: "id,email,submitted_at,source_path",
        order: "submitted_at.desc",
      },
    });

    const rows = await readSupabaseJson<SubscriberRow[]>(response);
    return sanitizeSubscribers(rows);
  } catch {
    return [];
  }
}

export async function saveNewsletterSubscribers(
  subscribers: NewsletterSubscriber[],
): Promise<void> {
  const normalized = sanitizeSubscribers(subscribers);

  const response = await supabaseRequest("/rest/v1/newsletter_subscribers", {
    method: "POST",
    query: {
      on_conflict: "email",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: normalized.map((entry) => ({
      id: entry.id || crypto.randomUUID(),
      email: entry.email,
      submitted_at: entry.submittedAt,
      source_path: entry.sourcePath ?? null,
    })),
  });

  await readSupabaseJson(response);
}

export async function addNewsletterSubscriber(input: {
  email: string;
  sourcePath?: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const sourcePathInput = sanitizeText(input.sourcePath);
  const sourcePath =
    sourcePathInput.startsWith("/") && !sourcePathInput.startsWith("//")
      ? sourcePathInput.slice(0, 200)
      : undefined;

  if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error("Invalid email address.");
  }

  const response = await supabaseRequest("/rest/v1/newsletter_subscribers", {
    method: "POST",
    query: {
      on_conflict: "email",
    },
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: [
      {
        email,
        source_path: sourcePath ?? null,
        submitted_at: new Date().toISOString(),
      },
    ],
  });

  await readSupabaseJson(response);
}

export async function deleteNewsletterSubscriberById(subscriberId: string): Promise<boolean> {
  const id = subscriberId.trim();
  if (!id) {
    return false;
  }

  const response = await supabaseRequest("/rest/v1/newsletter_subscribers", {
    method: "DELETE",
    query: {
      id: `eq.${id}`,
      select: "id",
    },
  });

  const deletedRows = await readSupabaseJson<Array<{ id: string }>>(response);
  return deletedRows.length > 0;
}
