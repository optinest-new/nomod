#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_STORAGE_BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || "nomod").trim();
const modeArg = process.argv.find((arg) => arg.startsWith("--only=")) || "";
const onlyMode = modeArg ? modeArg.split("=", 2)[1] : "";
const skipMedia = process.argv.includes("--skip-media");
const runOnlyMedia = onlyMode === "media";
const runOnlyContent = onlyMode === "content";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const rootDirectory = process.cwd();
const metaDirectory = path.join(rootDirectory, "content", "meta");
const postsDirectory = path.join(rootDirectory, "content", "posts");
const publicImagesDirectory = path.join(rootDirectory, "public", "images");

const allowedMediaExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

function mimeTypeFromExtension(extension) {
  const normalized = String(extension || "").toLowerCase();
  const mimeMap = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
  };

  return mimeMap[normalized] || "application/octet-stream";
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

function toSupabaseMediaUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("/images/")) {
    return buildPublicUrl(trimmed.slice(1));
  }

  return trimmed;
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

  let body = undefined;
  if (options.body !== undefined) {
    const rawBody =
      typeof options.body === "string" ||
      options.body instanceof Uint8Array ||
      options.body instanceof ArrayBuffer;

    if (rawBody) {
      body = options.body;
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body,
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

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function listFilesRecursively(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursively(absolutePath)));
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }

    return files;
  } catch {
    return [];
  }
}

function normalizePostDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeDateTime(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function inferMediaKind(objectPath) {
  const segments = objectPath.split("/");
  const folder = (segments[1] || "").toLowerCase();

  if (folder === "posts" || folder === "authors" || folder === "about") {
    return folder;
  }

  return "other";
}

async function upsertInChunks(table, rows, onConflict, chunkSize = 200) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await supabaseRequest(`/rest/v1/${table}`, {
      method: "POST",
      query: {
        on_conflict: onConflict,
      },
      prefer: "resolution=merge-duplicates,return=minimal",
      body: chunk,
    });
  }
}

async function migrateMediaAssets() {
  const files = await listFilesRecursively(publicImagesDirectory);
  const mediaFiles = files.filter((filePath) =>
    allowedMediaExtensions.has(path.extname(filePath).toLowerCase()),
  );

  const mediaRows = [];

  for (const absolutePath of mediaFiles) {
    const relativeFromPublic = path.relative(path.join(rootDirectory, "public"), absolutePath).replace(/\\/g, "/");
    const objectPath = relativeFromPublic.replace(/^\/+/, "");
    const encodedPath = encodeStorageObjectPath(objectPath);
    const buffer = await fs.readFile(absolutePath);

    await supabaseRequest(`/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeTypeFromExtension(path.extname(absolutePath)),
        "x-upsert": "true",
      },
      body: buffer,
    });

    const stats = await fs.stat(absolutePath);
    const fileName = path.posix.basename(objectPath);

    mediaRows.push({
      object_path: objectPath,
      public_url: buildPublicUrl(objectPath),
      file_name: fileName,
      extension: path.posix.extname(fileName).toLowerCase(),
      directory: `/${path.posix.dirname(objectPath)}`,
      kind: inferMediaKind(objectPath),
      size_bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await upsertInChunks("media_assets", mediaRows, "object_path");
  console.log(`Migrated ${mediaRows.length} media assets.`);
}

async function migrateCms() {
  const cms = await readJsonFile(path.join(metaDirectory, "cms.json"), null);
  if (!cms) {
    console.log("No CMS override file found; skipping cms_content migration.");
    return;
  }

  await supabaseRequest("/rest/v1/cms_content", {
    method: "POST",
    query: {
      on_conflict: "id",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [
      {
        id: 1,
        content: cms,
        updated_at: new Date().toISOString(),
      },
    ],
  });

  console.log("Migrated CMS content.");
}

async function migrateCategories() {
  const categories = await readJsonFile(path.join(metaDirectory, "categories.json"), []);
  const rows = Array.isArray(categories)
    ? Array.from(new Set(categories.map((item) => String(item || "").trim()).filter(Boolean))).map(
        (name) => ({ name }),
      )
    : [];

  await upsertInChunks("categories", rows, "name");
  console.log(`Migrated ${rows.length} categories.`);
}

async function migrateAuthors() {
  const authors = await readJsonFile(path.join(metaDirectory, "authors.json"), []);
  const rows = Array.isArray(authors)
    ? authors
        .map((author) => ({
          id: String(author?.id || "").trim(),
          name: String(author?.name || "").trim(),
          role: String(author?.role || "").trim(),
          short_bio: String(author?.shortBio || "").trim(),
          bio: String(author?.bio || "").trim(),
          avatar: toSupabaseMediaUrl(String(author?.avatar || "")),
          x_url: String(author?.xUrl || "").trim() || null,
          admin_user_id: String(author?.adminUserId || "").trim() || null,
          updated_at: new Date().toISOString(),
        }))
        .filter((author) =>
          author.id && author.name && author.role && author.short_bio && author.bio && author.avatar,
        )
    : [];

  await upsertInChunks("authors", rows, "id");
  console.log(`Migrated ${rows.length} authors.`);
}

async function migratePosts() {
  const fileNames = await fs
    .readdir(postsDirectory)
    .then((entries) => entries.filter((name) => name.endsWith(".md")))
    .catch(() => []);

  const rows = [];

  for (const fileName of fileNames) {
    const absolutePath = path.join(postsDirectory, fileName);
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = matter(raw);
    const data = parsed.data || {};

    const slug = String(data.slug || "").trim();
    const title = String(data.title || "").trim();
    const excerpt = String(data.excerpt || "").trim();
    const date = normalizePostDate(data.date);
    const authorId = String(data.authorId || "").trim();

    if (!slug || !title || !excerpt || !date || !authorId) {
      console.warn(`Skipping invalid post frontmatter: ${fileName}`);
      continue;
    }

    const status = ["published", "draft", "scheduled"].includes(String(data.status || ""))
      ? String(data.status)
      : "published";

    rows.push({
      slug,
      title,
      excerpt,
      date,
      category: String(data.category || "General").trim() || "General",
      author_id: authorId,
      cover_image: toSupabaseMediaUrl(String(data.coverImage || "")),
      cover_alt: String(data.coverAlt || title).trim() || title,
      status,
      publish_at: normalizeDateTime(data.publishAt),
      seo_title: String(data.seoTitle || "").trim() || null,
      seo_description: String(data.seoDescription || "").trim() || null,
      focus_keyword: String(data.focusKeyword || "").trim() || null,
      featured: Boolean(data.featured),
      recommended: Boolean(data.recommended),
      content: String(parsed.content || "").trim(),
      updated_at: new Date().toISOString(),
    });
  }

  await upsertInChunks("posts", rows, "slug", 100);
  console.log(`Migrated ${rows.length} posts.`);
}

async function migrateNewsletterSubscribers() {
  const subscribers = await readJsonFile(path.join(metaDirectory, "newsletter-subscribers.json"), []);
  const rows = Array.isArray(subscribers)
    ? subscribers
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          email: String(entry?.email || "").trim().toLowerCase(),
          source_path: String(entry?.sourcePath || "").trim() || null,
          submitted_at: normalizeDateTime(entry?.submittedAt) || new Date().toISOString(),
        }))
        .filter((entry) => entry.id && entry.email)
    : [];

  await upsertInChunks("newsletter_subscribers", rows, "email");
  console.log(`Migrated ${rows.length} newsletter subscribers.`);
}

async function migrateAnalyticsEvents() {
  const events = await readJsonFile(path.join(metaDirectory, "analytics-events.json"), []);
  const rows = Array.isArray(events)
    ? events
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          type: "pageview",
          path: String(entry?.path || "/").trim() || "/",
          referrer: String(entry?.referrer || "").trim() || null,
          user_agent: String(entry?.userAgent || "").trim() || null,
          created_at: normalizeDateTime(entry?.createdAt) || new Date().toISOString(),
        }))
        .filter((entry) => entry.id && entry.path)
    : [];

  await upsertInChunks("analytics_events", rows, "id", 500);
  console.log(`Migrated ${rows.length} analytics events.`);
}

async function migrateAdminUsers() {
  const users = await readJsonFile(path.join(metaDirectory, "admin-users.json"), []);
  const sourceRows = Array.isArray(users)
    ? users
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          email: String(entry?.email || "").trim().toLowerCase(),
          name: String(entry?.name || "").trim(),
          role: entry?.role === "admin" ? "admin" : "editor",
          password_hash: String(entry?.passwordHash || "").trim(),
          password_salt: String(entry?.passwordSalt || "").trim(),
          is_active: entry?.isActive !== false,
          created_at: normalizeDateTime(entry?.createdAt) || new Date().toISOString(),
          updated_at: normalizeDateTime(entry?.updatedAt) || new Date().toISOString(),
          last_login_at: normalizeDateTime(entry?.lastLoginAt),
        }))
        .filter((entry) => entry.id && entry.email && entry.name && entry.password_hash && entry.password_salt)
    : [];

  const existing = await supabaseRequest("/rest/v1/admin_users", {
    query: {
      select: "id,email",
    },
  });

  const existingByEmail = new Map(
    (Array.isArray(existing) ? existing : [])
      .map((item) => ({
        id: String(item?.id || "").trim(),
        email: String(item?.email || "").trim().toLowerCase(),
      }))
      .filter((item) => item.id && item.email)
      .map((item) => [item.email, item.id]),
  );

  const userIdMap = new Map();
  let migrated = 0;

  for (const row of sourceRows) {
    const existingId = existingByEmail.get(row.email);

    if (existingId) {
      await supabaseRequest("/rest/v1/admin_users", {
        method: "PATCH",
        query: {
          id: `eq.${existingId}`,
        },
        body: {
          name: row.name,
          role: row.role,
          password_hash: row.password_hash,
          password_salt: row.password_salt,
          is_active: row.is_active,
          updated_at: row.updated_at,
          last_login_at: row.last_login_at,
        },
      });

      userIdMap.set(row.id, existingId);
      migrated += 1;
      continue;
    }

    await supabaseRequest("/rest/v1/admin_users", {
      method: "POST",
      prefer: "return=minimal",
      body: [row],
    });

    userIdMap.set(row.id, row.id);
    existingByEmail.set(row.email, row.id);
    migrated += 1;
  }

  console.log(`Migrated ${migrated} admin users.`);
  return userIdMap;
}

async function migrateAdminSessions(userIdMap = new Map()) {
  const sessions = await readJsonFile(path.join(metaDirectory, "admin-sessions.json"), []);
  const rows = Array.isArray(sessions)
    ? sessions
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          token_hash: String(entry?.tokenHash || "").trim(),
          user_id: userIdMap.get(String(entry?.userId || "").trim()) || String(entry?.userId || "").trim(),
          role: entry?.role === "admin" ? "admin" : "editor",
          created_at: normalizeDateTime(entry?.createdAt) || new Date().toISOString(),
          expires_at: normalizeDateTime(entry?.expiresAt) || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          last_seen_at: normalizeDateTime(entry?.lastSeenAt) || new Date().toISOString(),
          user_agent: String(entry?.userAgent || "").trim() || null,
        }))
        .filter((entry) => entry.id && entry.token_hash && entry.user_id)
    : [];

  await upsertInChunks("admin_sessions", rows, "id");
  console.log(`Migrated ${rows.length} admin sessions.`);
}

async function migrateLoginRateLimits() {
  const records = await readJsonFile(path.join(metaDirectory, "security-login-rate-limit.json"), []);
  const rows = Array.isArray(records)
    ? records
        .map((entry) => ({
          key: String(entry?.key || "").trim(),
          count: Number(entry?.count || 0) || 0,
          first_attempt_at: normalizeDateTime(entry?.firstAttemptAt) || new Date().toISOString(),
          blocked_until: normalizeDateTime(entry?.blockedUntil),
          updated_at: new Date().toISOString(),
        }))
        .filter((entry) => entry.key && entry.count > 0)
    : [];

  await upsertInChunks("login_rate_limits", rows, "key");
  console.log(`Migrated ${rows.length} login rate-limit records.`);
}

async function main() {
  console.log("Starting migration to Supabase...");
  const shouldRunMedia = !skipMedia && !runOnlyContent;
  const shouldRunContent = !runOnlyMedia;

  if (shouldRunMedia) {
    await migrateMediaAssets();
  }

  if (shouldRunContent) {
    await migrateCms();
    await migrateCategories();
    await migrateAuthors();
    await migratePosts();
    await migrateNewsletterSubscribers();
    await migrateAnalyticsEvents();
    const userIdMap = await migrateAdminUsers();
    await migrateAdminSessions(userIdMap);
    await migrateLoginRateLimits();
  }

  console.log("Migration completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
