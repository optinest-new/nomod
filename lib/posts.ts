import readingTime from "reading-time";

import { getAuthorById } from "@/lib/authors";
import { normalizeLegacyMediaPath, readSupabaseJson, supabaseRequest } from "@/lib/supabase";
import { Post } from "@/lib/types";

type PostQueryOptions = {
  includeUnpublished?: boolean;
  now?: Date;
};

type PostRow = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  author_id: string;
  cover_image: string;
  cover_alt: string;
  status: string;
  publish_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  featured: boolean;
  recommended: boolean;
  content: string;
};

export type PostRecordInput = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  authorId: string;
  coverImage: string;
  coverAlt: string;
  status: "published" | "draft" | "scheduled";
  publishAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  featured: boolean;
  recommended: boolean;
  content: string;
};

function toText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return fallback;
  }

  return String(value);
}

function normalizeDateValue(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return "";
}

function normalizeDateTimeValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return undefined;
}

function parsePostStatus(value: unknown): "published" | "draft" | "scheduled" {
  const normalized = toText(value).trim().toLowerCase();

  if (normalized === "draft" || normalized === "scheduled" || normalized === "published") {
    return normalized;
  }

  return "published";
}

function isPostPublished(post: Pick<Post, "status" | "publishAt">, nowMs: number): boolean {
  if (post.status === "draft") {
    return false;
  }

  if (post.status === "scheduled") {
    if (!post.publishAt) {
      return false;
    }

    return new Date(post.publishAt).getTime() <= nowMs;
  }

  return true;
}

function getPostSortTimestamp(post: Pick<Post, "date" | "publishAt" | "status">): number {
  const dateCandidate =
    post.status === "scheduled" && post.publishAt ? post.publishAt : post.date;
  const parsed = new Date(dateCandidate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sanitizePostRow(row: unknown): Post | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const postData = row as Partial<PostRow>;
  const slug = toText(postData.slug).trim();
  const title = toText(postData.title).trim();
  const authorId = toText(postData.author_id).trim();
  const date = normalizeDateValue(postData.date);
  const status = parsePostStatus(postData.status);
  const publishAt = normalizeDateTimeValue(postData.publish_at);

  if (!slug || !title || !authorId || !date) {
    return null;
  }

  const content = toText(postData.content);
  const stats = readingTime(content);

  return {
    slug,
    title,
    excerpt: toText(postData.excerpt),
    date,
    category: toText(postData.category, "General"),
    authorId,
    coverImage: normalizeLegacyMediaPath(toText(postData.cover_image)),
    coverAlt: toText(postData.cover_alt, title),
    status,
    publishAt,
    seoTitle: toText(postData.seo_title).trim() || undefined,
    seoDescription: toText(postData.seo_description).trim() || undefined,
    focusKeyword: toText(postData.focus_keyword).trim() || undefined,
    featured: Boolean(postData.featured),
    recommended: Boolean(postData.recommended),
    content,
    readingTimeText: stats.text,
    readingTimeMinutes: Math.ceil(stats.minutes),
    isPublished: false,
  } satisfies Post;
}

export async function getAllPosts(options: PostQueryOptions = {}): Promise<Post[]> {
  const nowMs = (options.now ?? new Date()).getTime();
  const includeUnpublished = options.includeUnpublished === true;

  let rows: PostRow[] = [];

  try {
    const response = await supabaseRequest("/rest/v1/posts", {
      query: {
        select:
          "slug,title,excerpt,date,category,author_id,cover_image,cover_alt,status,publish_at,seo_title,seo_description,focus_keyword,featured,recommended,content",
      },
    });
    rows = await readSupabaseJson<PostRow[]>(response);
  } catch {
    rows = [];
  }

  const posts = rows
    .map((row) => sanitizePostRow(row))
    .filter((post): post is Post => Boolean(post));

  const withPublishState = posts.map((post) => ({
    ...post,
    isPublished: isPostPublished(post, nowMs),
  }));

  const visiblePosts = includeUnpublished
    ? withPublishState
    : withPublishState.filter((post) => post.isPublished);

  return visiblePosts.sort(
    (a, b) => getPostSortTimestamp(b) - getPostSortTimestamp(a),
  );
}

export async function getPostBySlug(
  slug: string,
  options: PostQueryOptions = {},
): Promise<Post | undefined> {
  return (await getAllPosts(options)).find((post) => post.slug === slug);
}

export async function getFeaturedPosts(limit = 4, options: PostQueryOptions = {}): Promise<Post[]> {
  return (await getAllPosts(options))
    .filter((post) => post.featured)
    .slice(0, limit);
}

export async function getRecommendedPosts(
  limit = 4,
  options: PostQueryOptions = {},
): Promise<Post[]> {
  return (await getAllPosts(options))
    .filter((post) => post.recommended)
    .slice(0, limit);
}

export async function getLatestPosts(limit?: number, options: PostQueryOptions = {}): Promise<Post[]> {
  const posts = await getAllPosts(options);
  return typeof limit === "number" ? posts.slice(0, limit) : posts;
}

export async function getPostsByAuthor(
  authorId: string,
  options: PostQueryOptions = {},
): Promise<Post[]> {
  return (await getAllPosts(options)).filter((post) => post.authorId === authorId);
}

export async function getAuthorDetailsForPost(post: Post) {
  return getAuthorById(post.authorId);
}

function toPostRow(post: PostRecordInput): PostRow {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    category: post.category,
    author_id: post.authorId,
    cover_image: post.coverImage,
    cover_alt: post.coverAlt,
    status: post.status,
    publish_at: post.publishAt ?? null,
    seo_title: post.seoTitle ?? null,
    seo_description: post.seoDescription ?? null,
    focus_keyword: post.focusKeyword ?? null,
    featured: post.featured,
    recommended: post.recommended,
    content: post.content,
  };
}

export async function savePost(post: PostRecordInput): Promise<void> {
  const response = await supabaseRequest("/rest/v1/posts", {
    method: "POST",
    query: {
      on_conflict: "slug",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [
      {
        ...toPostRow(post),
        updated_at: new Date().toISOString(),
      },
    ],
  });

  await readSupabaseJson(response);
}

export async function deletePostBySlug(slug: string): Promise<void> {
  const response = await supabaseRequest("/rest/v1/posts", {
    method: "DELETE",
    query: {
      slug: `eq.${slug}`,
    },
  });

  await readSupabaseJson(response);
}

export async function renameCategoryInPosts(previousName: string, nextName: string): Promise<void> {
  const response = await supabaseRequest("/rest/v1/posts", {
    method: "PATCH",
    query: {
      category: `eq.${previousName}`,
    },
    body: {
      category: nextName,
      updated_at: new Date().toISOString(),
    },
  });

  await readSupabaseJson(response);
}

export async function renameAuthorInPosts(
  previousAuthorId: string,
  nextAuthorId: string,
): Promise<void> {
  const response = await supabaseRequest("/rest/v1/posts", {
    method: "PATCH",
    query: {
      author_id: `eq.${previousAuthorId}`,
    },
    body: {
      author_id: nextAuthorId,
      updated_at: new Date().toISOString(),
    },
  });

  await readSupabaseJson(response);
}

export async function isCoverImageUsed(coverImage: string): Promise<boolean> {
  const normalizedTarget = normalizeLegacyMediaPath(coverImage);
  const response = await supabaseRequest("/rest/v1/posts", {
    query: {
      select: "cover_image",
    },
  });

  const rows = await readSupabaseJson<Array<{ cover_image: string }>>(response);
  return rows.some((row) => {
    const value = toText(row.cover_image).trim();
    if (!value) {
      return false;
    }

    if (value === coverImage) {
      return true;
    }

    return normalizeLegacyMediaPath(value) === normalizedTarget;
  });
}
