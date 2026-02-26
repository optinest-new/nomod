"use server";

import path from "node:path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  authenticateAdminUser,
  createAdminUser,
  deleteAdminUser,
  clearAdminSession,
  type AdminRole,
  listAdminUsers,
  requireAdminSession,
  updateAdminUserPassword,
  updateAdminUserRole,
  setAdminSession,
} from "@/lib/admin";
import { getAuthorByAdminUserId, getAuthors, saveAuthors } from "@/lib/authors";
import { getCategories, saveCategories } from "@/lib/categories";
import {
  deleteCmsContent,
  getCmsContent,
  saveCmsContent,
  type CmsContent,
  type CmsLinkItem,
  type CmsSocialLinkItem,
} from "@/lib/cms";
import {
  deleteMediaAssetByPublicUrl,
  deleteStorageObject,
  getMediaAssetByPublicUrl,
  getStorageObjectPathFromPublicUrl,
  upsertMediaAssetRecord,
} from "@/lib/media";
import { deleteNewsletterSubscriberById } from "@/lib/newsletter";
import {
  deletePostBySlug,
  getPostBySlug,
  getPostsByAuthor,
  isCoverImageUsed,
  renameAuthorInPosts,
  renameCategoryInPosts,
  savePost,
} from "@/lib/posts";
import {
  assertSameOriginRequest,
  clearLoginRateLimit,
  getLoginRateLimitState,
  getRequestClientFingerprint,
  recordLoginFailure,
} from "@/lib/security";
import { getSupabaseStorageBucket, readSupabaseJson, supabaseRequest } from "@/lib/supabase";
import { Author } from "@/lib/types";
import { slugify } from "@/lib/utils";

type PostPayload = {
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  category: string;
  authorId: string;
  status: "published" | "draft" | "scheduled";
  publishAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  coverAlt: string;
  featured: boolean;
  recommended: boolean;
  content: string;
};

type AuthorPayload = {
  id: string;
  name: string;
  role: string;
  shortBio: string;
  bio: string;
  xUrl?: string;
  adminUserId?: string;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMediaFolders = new Set(["posts", "authors", "about", "general"]);

function parsePostStatus(value: string): "published" | "draft" | "scheduled" {
  const normalized = value.trim().toLowerCase();

  if (normalized === "published" || normalized === "draft" || normalized === "scheduled") {
    return normalized;
  }

  return "published";
}

function parseOptionalDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Scheduled publish time is invalid.");
  }

  return parsed.toISOString();
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

async function parsePostPayload(formData: FormData): Promise<PostPayload> {
  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || title);
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const authorId = String(formData.get("authorId") ?? "").trim();
  const status = parsePostStatus(String(formData.get("status") ?? "published"));
  const publishAt = parseOptionalDateTime(String(formData.get("publishAt") ?? ""));
  const seoTitle = normalizeOptionalText(formData.get("seoTitle"));
  const seoDescription = normalizeOptionalText(formData.get("seoDescription"));
  const focusKeyword = normalizeOptionalText(formData.get("focusKeyword"));
  const coverAlt = String(formData.get("coverAlt") ?? "").trim();
  const featured = formData.get("featured") === "on";
  const recommended = formData.get("recommended") === "on";
  const content = String(formData.get("content") ?? "").trim();

  if (!title || !slug || !excerpt || !date || !category || !authorId || !coverAlt || !content) {
    throw new Error("All post fields are required.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  if (status === "scheduled" && !publishAt) {
    throw new Error("Scheduled posts must include a publish date and time.");
  }

  if (status === "scheduled" && publishAt) {
    const publishTime = new Date(publishAt).getTime();
    if (publishTime <= Date.now()) {
      throw new Error("Scheduled publish time must be in the future.");
    }
  }

  const [categories, authors] = await Promise.all([getCategories(), getAuthors()]);

  if (!categories.includes(category)) {
    throw new Error("Category is invalid. Please select a category from the list.");
  }

  if (!authors.some((author) => author.id === authorId)) {
    throw new Error("Author is invalid. Please select an author from the list.");
  }

  return {
    title,
    slug,
    excerpt,
    date,
    category,
    authorId,
    status,
    publishAt,
    seoTitle,
    seoDescription,
    focusKeyword,
    coverAlt,
    featured,
    recommended,
    content,
  };
}

function inferFileExtension(file: File): string | null {
  const extension = path.extname(file.name).toLowerCase();
  const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);

  if (allowedExtensions.has(extension)) {
    return extension === ".jpeg" ? ".jpg" : extension;
  }

  const mimeMap: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };

  return mimeMap[file.type.toLowerCase()] ?? null;
}

function toMimeType(extension: string, fileType: string): string {
  if (fileType) {
    return fileType;
  }

  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };

  return mimeMap[extension] ?? "application/octet-stream";
}

async function assertSafeImageFile(file: File, extension: string, label: string): Promise<void> {
  if (extension !== ".svg") {
    return;
  }

  const raw = await file.text();
  const hasScriptTag = /<script[\s>]/i.test(raw);
  const hasForeignObject = /<foreignObject[\s>]/i.test(raw);
  const hasEventHandlerAttribute = /\son[a-z]+\s*=/i.test(raw);
  const hasJavascriptHref = /(href|xlink:href)\s*=\s*["']\s*javascript:/i.test(raw);

  if (hasScriptTag || hasForeignObject || hasEventHandlerAttribute || hasJavascriptHref) {
    throw new Error(`${label} SVG contains unsafe markup.`);
  }
}

async function uploadImageFile(input: {
  file: File;
  objectPath: string;
  label: string;
  extension: string;
}): Promise<string> {
  const bucket = getSupabaseStorageBucket();
  const normalizedPath = input.objectPath.replace(/^\/+/, "");
  const encodedPath = normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const uploadResponse = await supabaseRequest(`/storage/v1/object/${bucket}/${encodedPath}`, {
    method: "POST",
    headers: {
      "Content-Type": toMimeType(input.extension, input.file.type),
      "x-upsert": "true",
    },
    body: bytes,
  });
  await readSupabaseJson(uploadResponse);

  const mediaAsset = await upsertMediaAssetRecord({
    objectPath: normalizedPath,
    sizeBytes: input.file.size,
    modifiedAt: new Date().toISOString(),
  });

  return mediaAsset.path;
}

async function resolveCoverImage(
  formData: FormData,
  slug: string,
  fallbackCoverImage: string,
): Promise<string> {
  const uploaded = formData.get("coverImageFile");

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Featured image must be 5MB or smaller.");
    }

    const extension = inferFileExtension(uploaded);
    if (!extension) {
      throw new Error("Unsupported featured image format.");
    }
    await assertSafeImageFile(uploaded, extension, "Featured image");

    const fileName = `${slug}-${Date.now()}${extension}`;
    const objectPath = `images/posts/${fileName}`;

    return uploadImageFile({
      file: uploaded,
      objectPath,
      label: "Featured image",
      extension,
    });
  }

  const fallback = fallbackCoverImage.trim();
  if (!fallback) {
    throw new Error("Please upload a featured image.");
  }

  return fallback;
}

function invalidatePublicPages(slug: string, oldSlug?: string): void {
  revalidatePath("/");
  revalidatePath("/latest");
  revalidatePath("/authors");
  revalidatePath("/about");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/latest/${slug}`);

  if (oldSlug && oldSlug !== slug) {
    revalidatePath(`/latest/${oldSlug}`);
  }
}

function redirectWithError(basePath: string, message: string): never {
  redirect(`${basePath}?error=${encodeURIComponent(message)}`);
}

function resolveAuthorRedirectBasePath(formData: FormData): string {
  const rawRedirect = String(formData.get("redirectTo") ?? "").trim();
  if (rawRedirect.startsWith("/admin/authors")) {
    return "/admin/authors";
  }

  return "/admin/taxonomy";
}

async function requireTrustedAdminMutation(
  roles?: AdminRole[],
) {
  try {
    await assertSameOriginRequest();
  } catch {
    redirectWithError("/admin", "Request was blocked for security reasons.");
  }

  return requireAdminSession(roles);
}

export async function loginAction(formData: FormData): Promise<void> {
  try {
    await assertSameOriginRequest();
  } catch {
    redirectWithError("/admin/login", "Request was blocked for security reasons.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithError("/admin/login", "Email and password are required.");
  }

  const clientKey = await getRequestClientFingerprint();
  const rateLimitState = await getLoginRateLimitState(clientKey);
  if (rateLimitState.limited) {
    const minutes = Math.ceil(rateLimitState.retryAfterSeconds / 60);
    redirectWithError(
      "/admin/login",
      `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }

  const user = await authenticateAdminUser(email, password);
  if (!user) {
    const failedState = await recordLoginFailure(clientKey);
    if (failedState.limited) {
      const minutes = Math.ceil(failedState.retryAfterSeconds / 60);
      redirectWithError(
        "/admin/login",
        `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
    }

    redirectWithError("/admin/login", "Invalid credentials.");
  }

  await clearLoginRateLimit(clientKey);
  await setAdminSession(user);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  try {
    await assertSameOriginRequest();
  } catch {
    redirectWithError("/admin", "Request was blocked for security reasons.");
  }

  await clearAdminSession();
  redirect("/admin/login");
}

export async function createPostAction(formData: FormData): Promise<void> {
  const user = await requireTrustedAdminMutation();

  let payload: PostPayload;
  try {
    payload = await parsePostPayload(formData);
  } catch (error) {
    redirectWithError(
      "/admin/new",
      error instanceof Error ? error.message : "Invalid post data.",
    );
  }

  if (user.role === "editor") {
    const linkedAuthor = await getAuthorByAdminUserId(user.id);
    if (!linkedAuthor) {
      redirectWithError(
        "/admin/new",
        "Your account is not linked to an author profile. Ask an admin to link it in Author CMS.",
      );
    }

    payload.authorId = linkedAuthor.id;
  }

  if (await getPostBySlug(payload.slug, { includeUnpublished: true })) {
    redirectWithError("/admin/new", "A post with that slug already exists.");
  }

  let coverImage: string;
  try {
    coverImage = await resolveCoverImage(
      formData,
      payload.slug,
      String(formData.get("existingCoverImage") ?? ""),
    );
  } catch (error) {
    redirectWithError(
      "/admin/new",
      error instanceof Error ? error.message : "Invalid featured image.",
    );
  }

  await savePost({ ...payload, coverImage });
  invalidatePublicPages(payload.slug);
  redirect(`/admin/edit/${payload.slug}?saved=1`);
}

export async function updatePostAction(formData: FormData): Promise<void> {
  const user = await requireTrustedAdminMutation();

  const oldSlug = String(formData.get("oldSlug") ?? "").trim();

  let payload: PostPayload;
  try {
    payload = await parsePostPayload(formData);
  } catch (error) {
    redirectWithError(
      `/admin/edit/${oldSlug}`,
      error instanceof Error ? error.message : "Invalid post data.",
    );
  }

  if (!oldSlug) {
    redirectWithError("/admin", "Missing original post slug.");
  }

  const originalPost = await getPostBySlug(oldSlug, { includeUnpublished: true });
  if (!originalPost) {
    redirectWithError("/admin", "Original post was not found.");
  }

  if (user.role === "editor") {
    const linkedAuthor = await getAuthorByAdminUserId(user.id);
    if (!linkedAuthor) {
      redirectWithError(
        `/admin/edit/${oldSlug}`,
        "Your account is not linked to an author profile. Ask an admin to link it in Author CMS.",
      );
    }

    if (originalPost.authorId !== linkedAuthor.id) {
      redirectWithError("/admin", "Editors can only edit posts from their linked author profile.");
    }

    payload.authorId = linkedAuthor.id;
  }

  const existing = await getPostBySlug(payload.slug, { includeUnpublished: true });
  if (existing && payload.slug !== oldSlug) {
    redirectWithError(`/admin/edit/${oldSlug}`, "Slug is already used by another post.");
  }

  let coverImage: string;
  try {
    coverImage = await resolveCoverImage(
      formData,
      payload.slug,
      String(formData.get("existingCoverImage") ?? ""),
    );
  } catch (error) {
    redirectWithError(
      `/admin/edit/${oldSlug}`,
      error instanceof Error ? error.message : "Invalid featured image.",
    );
  }

  await savePost({ ...payload, coverImage });

  if (oldSlug !== payload.slug) {
    await deletePostBySlug(oldSlug);
  }

  invalidatePublicPages(payload.slug, oldSlug);
  redirect(`/admin/edit/${payload.slug}?saved=1`);
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const user = await requireTrustedAdminMutation();

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) {
    redirectWithError("/admin", "Missing slug for delete.");
  }

  const post = await getPostBySlug(slug, { includeUnpublished: true });
  if (!post) {
    redirectWithError("/admin", "Post was not found.");
  }

  if (user.role === "editor") {
    const linkedAuthor = await getAuthorByAdminUserId(user.id);
    if (!linkedAuthor) {
      redirectWithError(
        "/admin",
        "Your account is not linked to an author profile. Ask an admin to link it in Author CMS.",
      );
    }

    if (post.authorId !== linkedAuthor.id) {
      redirectWithError("/admin", "Editors can only delete posts from their linked author profile.");
    }
  }

  await deletePostBySlug(slug);
  invalidatePublicPages(slug);
  redirect("/admin?deleted=1");
}

export async function addCategoryAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirectWithError("/admin/taxonomy", "Category name is required.");
  }

  const categories = await getCategories();
  if (categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
    redirectWithError("/admin/taxonomy", "Category already exists.");
  }

  await saveCategories([...categories, name]);
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/taxonomy");
  redirect("/admin/taxonomy?saved=category-added");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const previousName = String(formData.get("previousName") ?? "").trim();
  const nextName = String(formData.get("nextName") ?? "").trim();

  if (!previousName || !nextName) {
    redirectWithError("/admin/taxonomy", "Both current and new category names are required.");
  }

  const categories = await getCategories();
  if (!categories.includes(previousName)) {
    redirectWithError("/admin/taxonomy", "Selected category does not exist.");
  }

  if (
    previousName !== nextName &&
    categories.some((category) => category.toLowerCase() === nextName.toLowerCase())
  ) {
    redirectWithError("/admin/taxonomy", "Another category already uses that name.");
  }

  const nextCategories = categories.map((category) =>
    category === previousName ? nextName : category,
  );

  await saveCategories(nextCategories);
  await renameCategoryInPosts(previousName, nextName);

  revalidatePath("/");
  revalidatePath("/latest");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/taxonomy");
  redirect("/admin/taxonomy?saved=category-updated");
}

function parseAuthorPayload(formData: FormData): AuthorPayload {
  const idInput = String(formData.get("authorId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const shortBio = String(formData.get("shortBio") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const xUrlValue = String(formData.get("xUrl") ?? "").trim();
  const adminUserIdValue = String(formData.get("adminUserId") ?? "").trim();
  const id = slugify(idInput || name);

  if (!id || !name || !role || !shortBio || !bio) {
    throw new Error("All author fields except social URL are required.");
  }

  return {
    id,
    name,
    role,
    shortBio,
    bio,
    xUrl: xUrlValue || undefined,
    adminUserId: adminUserIdValue || undefined,
  };
}

async function resolveAuthorAvatar(
  formData: FormData,
  authorId: string,
  fallbackAvatar: string,
): Promise<string> {
  const uploaded = formData.get("avatarFile");

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Avatar image must be 5MB or smaller.");
    }

    const extension = inferFileExtension(uploaded);
    if (!extension) {
      throw new Error("Unsupported avatar image format.");
    }
    await assertSafeImageFile(uploaded, extension, "Avatar");

    const fileName = `${authorId}-${Date.now()}${extension}`;
    const objectPath = `images/authors/${fileName}`;

    return uploadImageFile({
      file: uploaded,
      objectPath,
      label: "Avatar",
      extension,
    });
  }

  const fallback = fallbackAvatar.trim();
  if (!fallback) {
    throw new Error("Please upload an avatar image.");
  }

  return fallback;
}

export async function addAuthorAction(formData: FormData): Promise<void> {
  const actingUser = await requireTrustedAdminMutation();
  const redirectBasePath = resolveAuthorRedirectBasePath(formData);

  let payload: AuthorPayload;
  try {
    payload = parseAuthorPayload(formData);
  } catch (error) {
    redirectWithError(
      redirectBasePath,
      error instanceof Error ? error.message : "Invalid author data.",
    );
  }

  const [authors, adminUsers] = await Promise.all([getAuthors(), listAdminUsers()]);

  if (actingUser.role === "editor") {
    payload.adminUserId = actingUser.id;
  }

  if (!payload.adminUserId) {
    redirectWithError(redirectBasePath, "Choose the user account linked to this author.");
  }

  if (payload.adminUserId) {
    const targetAdminUser = adminUsers.find(
      (user) => user.id === payload.adminUserId && user.isActive,
    );

    if (!targetAdminUser) {
      redirectWithError(redirectBasePath, "Selected user account was not found or is inactive.");
    }

    if (actingUser.role === "editor" && payload.adminUserId !== actingUser.id) {
      redirectWithError(redirectBasePath, "Editors can only manage their own author profile.");
    }

    if (authors.some((item) => item.adminUserId === payload.adminUserId)) {
      redirectWithError(redirectBasePath, "That user is already linked to another author.");
    }
  }

  if (authors.some((item) => item.id === payload.id)) {
    redirectWithError(redirectBasePath, "Author ID already exists.");
  }

  let avatar: string;
  try {
    avatar = await resolveAuthorAvatar(
      formData,
      payload.id,
      String(formData.get("existingAvatar") ?? ""),
    );
  } catch (error) {
    redirectWithError(
      redirectBasePath,
      error instanceof Error ? error.message : "Invalid avatar image.",
    );
  }

  await saveAuthors([...authors, { ...payload, avatar }]);
  revalidatePath("/");
  revalidatePath("/authors");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/taxonomy");
  revalidatePath("/admin/authors");
  redirect(`${redirectBasePath}?saved=author-added`);
}

export async function updateAuthorAction(formData: FormData): Promise<void> {
  const actingUser = await requireTrustedAdminMutation();
  const redirectBasePath = resolveAuthorRedirectBasePath(formData);

  const previousAuthorId = String(formData.get("previousAuthorId") ?? "").trim();
  if (!previousAuthorId) {
    redirectWithError(redirectBasePath, "Current author selection is required.");
  }

  let payload: AuthorPayload;
  try {
    payload = parseAuthorPayload(formData);
  } catch (error) {
    redirectWithError(
      redirectBasePath,
      error instanceof Error ? error.message : "Invalid author data.",
    );
  }

  const [authors, adminUsers] = await Promise.all([getAuthors(), listAdminUsers()]);
  const previousAuthor = authors.find((author) => author.id === previousAuthorId);
  if (!previousAuthor) {
    redirectWithError(redirectBasePath, "Selected author does not exist.");
  }

  if (actingUser.role === "editor") {
    if (previousAuthor.adminUserId !== actingUser.id) {
      redirectWithError(redirectBasePath, "Editors can only update their own author profile.");
    }
    payload.adminUserId = actingUser.id;
  } else if (!payload.adminUserId) {
    payload.adminUserId = previousAuthor.adminUserId;
  }

  if (!payload.adminUserId) {
    redirectWithError(redirectBasePath, "Choose the user account linked to this author.");
  }

  if (payload.adminUserId) {
    const targetAdminUser = adminUsers.find(
      (user) => user.id === payload.adminUserId && user.isActive,
    );

    if (!targetAdminUser) {
      redirectWithError(redirectBasePath, "Selected user account was not found or is inactive.");
    }

    if (
      authors.some(
        (author) => author.id !== previousAuthorId && author.adminUserId === payload.adminUserId,
      )
    ) {
      redirectWithError(redirectBasePath, "That user is already linked to another author.");
    }
  }

  if (
    previousAuthorId !== payload.id &&
    authors.some((author) => author.id === payload.id)
  ) {
    redirectWithError(redirectBasePath, "Another author already uses that ID.");
  }

  let avatar: string;
  try {
    avatar = await resolveAuthorAvatar(
      formData,
      payload.id,
      String(formData.get("existingAvatar") ?? previousAuthor.avatar),
    );
  } catch (error) {
    redirectWithError(
      redirectBasePath,
      error instanceof Error ? error.message : "Invalid avatar image.",
    );
  }

  const nextAuthor: Author = {
    ...payload,
    avatar,
  };

  const nextAuthors = authors.map((author) =>
    author.id === previousAuthorId ? nextAuthor : author,
  );
  if (previousAuthorId !== nextAuthor.id) {
    await saveAuthors(nextAuthors, { allowReferencedAuthorDelete: true });
    await renameAuthorInPosts(previousAuthorId, nextAuthor.id);
    await saveAuthors(nextAuthors);
  } else {
    await saveAuthors(nextAuthors);
  }

  revalidatePath("/");
  revalidatePath("/authors");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/taxonomy");
  revalidatePath("/admin/authors");
  redirect(`${redirectBasePath}?saved=author-updated`);
}

export async function deleteAuthorAction(formData: FormData): Promise<void> {
  const actingUser = await requireTrustedAdminMutation();
  const redirectBasePath = resolveAuthorRedirectBasePath(formData);

  if (actingUser.role !== "admin") {
    redirectWithError(redirectBasePath, "Only admins can delete author profiles.");
  }

  const authorId = String(formData.get("authorId") ?? "").trim();
  const reassignToAuthorId = String(formData.get("reassignToAuthorId") ?? "").trim();

  if (!authorId) {
    redirectWithError(redirectBasePath, "Missing author id.");
  }

  const authors = await getAuthors();
  const authorToDelete = authors.find((author) => author.id === authorId);

  if (!authorToDelete) {
    redirectWithError(redirectBasePath, "Selected author does not exist.");
  }

  if (authors.length <= 1) {
    redirectWithError(
      redirectBasePath,
      "Cannot delete the last author profile. Create another author first.",
    );
  }

  const authoredPosts = await getPostsByAuthor(authorId, { includeUnpublished: true });
  let reassignedPostsCount = 0;

  if (authoredPosts.length > 0) {
    if (!reassignToAuthorId) {
      redirectWithError(
        redirectBasePath,
        `Author has ${authoredPosts.length} post(s). Select another author to reassign posts before delete.`,
      );
    }

    if (reassignToAuthorId === authorId) {
      redirectWithError(redirectBasePath, "Reassignment target must be a different author.");
    }

    const reassignmentAuthor = authors.find((author) => author.id === reassignToAuthorId);
    if (!reassignmentAuthor) {
      redirectWithError(redirectBasePath, "Selected reassignment author does not exist.");
    }

    await renameAuthorInPosts(authorId, reassignmentAuthor.id);
    reassignedPostsCount = authoredPosts.length;
  }

  const nextAuthors = authors.filter((author) => author.id !== authorId);
  await saveAuthors(nextAuthors);

  revalidatePath("/");
  revalidatePath("/authors");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/authors");

  const params = new URLSearchParams();
  params.set("saved", "author-deleted");
  params.set("moved", String(reassignedPostsCount));
  redirect(`${redirectBasePath}?${params.toString()}`);
}

function parseTextValue(
  formData: FormData,
  fieldName: string,
  fallback: string,
): string {
  const value = String(formData.get(fieldName) ?? "").trim();
  return value || fallback;
}

function parseSiteUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Site URL must be a valid absolute URL (http/https).");
  }
}

function parseLinkRows(raw: string, label: string): CmsLinkItem[] {
  const rows = raw
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  return rows.map((row, index) => {
    const [itemLabel, itemHref, itemExternal] = row.split("|").map((part) => part.trim());

    if (!itemLabel || !itemHref) {
      throw new Error(
        `${label} row ${index + 1} is invalid. Use "Label|Href" or "Label|Href|external".`,
      );
    }

    const externalValue = (itemExternal ?? "").toLowerCase();
    const isExternal =
      externalValue === "external" ||
      externalValue === "true" ||
      externalValue === "yes" ||
      externalValue === "1";

    return isExternal
      ? { label: itemLabel, href: itemHref, external: true }
      : { label: itemLabel, href: itemHref };
  });
}

function parseSocialRows(raw: string): CmsSocialLinkItem[] {
  const rows = raw
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  return rows.map((row, index) => {
    const [platform, href] = row.split("|").map((part) => part.trim());

    if (!platform || !href) {
      throw new Error(
        `Social links row ${index + 1} is invalid. Use "platform|href".`,
      );
    }

    return { platform: platform.toLowerCase(), href };
  });
}

function revalidateCmsPaths(): void {
  revalidatePath("/");
  revalidatePath("/latest");
  revalidatePath("/authors");
  revalidatePath("/about");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/taxonomy");
  revalidatePath("/admin/cms");
}

export async function updateCmsContentAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const current = await getCmsContent();

  try {
    const menuLinks = parseLinkRows(
      String(formData.get("menuLinksRows") ?? ""),
      "Menu links",
    );
    const footerPageLinks = parseLinkRows(
      String(formData.get("footerPagesLinksRows") ?? ""),
      "Footer page links",
    );
    const footerResourceLinks = parseLinkRows(
      String(formData.get("footerResourceLinksRows") ?? ""),
      "Footer resource links",
    );
    const footerSocialLinks = parseSocialRows(
      String(formData.get("footerSocialLinksRows") ?? ""),
    );

    const nextContent: CmsContent = {
      siteConfig: {
        name: parseTextValue(formData, "siteName", current.siteConfig.name),
        title: parseTextValue(formData, "siteTitle", current.siteConfig.title),
        description: parseTextValue(
          formData,
          "siteDescription",
          current.siteConfig.description,
        ),
        url: parseSiteUrl(
          parseTextValue(formData, "siteUrl", current.siteConfig.url),
        ),
        locale: parseTextValue(formData, "siteLocale", current.siteConfig.locale),
      },
      header: {
        homeAriaLabel: parseTextValue(
          formData,
          "headerHomeAriaLabel",
          current.header.homeAriaLabel,
        ),
        searchLabel: parseTextValue(
          formData,
          "headerSearchLabel",
          current.header.searchLabel,
        ),
        contactLabel: parseTextValue(
          formData,
          "headerContactLabel",
          current.header.contactLabel,
        ),
        contactHref: parseTextValue(
          formData,
          "headerContactHref",
          current.header.contactHref,
        ),
        menuLinks,
      },
      home: {
        heroKicker: parseTextValue(formData, "homeHeroKicker", current.home.heroKicker),
        heroTitle: parseTextValue(formData, "homeHeroTitle", current.home.heroTitle),
        heroDescription: parseTextValue(
          formData,
          "homeHeroDescription",
          current.home.heroDescription,
        ),
        heroCtaLabel: parseTextValue(
          formData,
          "homeHeroCtaLabel",
          current.home.heroCtaLabel,
        ),
        heroCtaHref: parseTextValue(
          formData,
          "homeHeroCtaHref",
          current.home.heroCtaHref,
        ),
        featuredHeading: parseTextValue(
          formData,
          "homeFeaturedHeading",
          current.home.featuredHeading,
        ),
        latestHeading: parseTextValue(
          formData,
          "homeLatestHeading",
          current.home.latestHeading,
        ),
        latestViewAllLabel: parseTextValue(
          formData,
          "homeLatestViewAllLabel",
          current.home.latestViewAllLabel,
        ),
        recommendedHeading: parseTextValue(
          formData,
          "homeRecommendedHeading",
          current.home.recommendedHeading,
        ),
        schemaDescription: parseTextValue(
          formData,
          "homeSchemaDescription",
          current.home.schemaDescription,
        ),
      },
      latestPage: {
        metaTitle: parseTextValue(
          formData,
          "latestMetaTitle",
          current.latestPage.metaTitle,
        ),
        metaDescription: parseTextValue(
          formData,
          "latestMetaDescription",
          current.latestPage.metaDescription,
        ),
        heroTitle: parseTextValue(
          formData,
          "latestHeroTitle",
          current.latestPage.heroTitle,
        ),
        heroDescription: parseTextValue(
          formData,
          "latestHeroDescription",
          current.latestPage.heroDescription,
        ),
      },
      authorsPage: {
        metaTitle: parseTextValue(
          formData,
          "authorsMetaTitle",
          current.authorsPage.metaTitle,
        ),
        metaDescription: parseTextValue(
          formData,
          "authorsMetaDescription",
          current.authorsPage.metaDescription,
        ),
        heroTitle: parseTextValue(
          formData,
          "authorsHeroTitle",
          current.authorsPage.heroTitle,
        ),
        heroDescription: parseTextValue(
          formData,
          "authorsHeroDescription",
          current.authorsPage.heroDescription,
        ),
      },
      aboutPage: {
        metaTitle: parseTextValue(
          formData,
          "aboutMetaTitle",
          current.aboutPage.metaTitle,
        ),
        metaDescription: parseTextValue(
          formData,
          "aboutMetaDescription",
          current.aboutPage.metaDescription,
        ),
        heroTitle: parseTextValue(
          formData,
          "aboutHeroTitle",
          current.aboutPage.heroTitle,
        ),
        heroDescription: parseTextValue(
          formData,
          "aboutHeroDescription",
          current.aboutPage.heroDescription,
        ),
        missionParagraph: parseTextValue(
          formData,
          "aboutMissionParagraph",
          current.aboutPage.missionParagraph,
        ),
        valueQuote: parseTextValue(
          formData,
          "aboutValueQuote",
          current.aboutPage.valueQuote,
        ),
        experienceParagraph: parseTextValue(
          formData,
          "aboutExperienceParagraph",
          current.aboutPage.experienceParagraph,
        ),
        closingParagraph: parseTextValue(
          formData,
          "aboutClosingParagraph",
          current.aboutPage.closingParagraph,
        ),
        teamCaption: parseTextValue(
          formData,
          "aboutTeamCaption",
          current.aboutPage.teamCaption,
        ),
        planningCaption: parseTextValue(
          formData,
          "aboutPlanningCaption",
          current.aboutPage.planningCaption,
        ),
      },
      newsletter: {
        title: parseTextValue(
          formData,
          "newsletterTitle",
          current.newsletter.title,
        ),
        description: parseTextValue(
          formData,
          "newsletterDescription",
          current.newsletter.description,
        ),
        emailPlaceholder: parseTextValue(
          formData,
          "newsletterEmailPlaceholder",
          current.newsletter.emailPlaceholder,
        ),
        buttonLabel: parseTextValue(
          formData,
          "newsletterButtonLabel",
          current.newsletter.buttonLabel,
        ),
      },
      footer: {
        brand: parseTextValue(formData, "footerBrand", current.footer.brand),
        copy: parseTextValue(formData, "footerCopy", current.footer.copy),
        pagesHeading: parseTextValue(
          formData,
          "footerPagesHeading",
          current.footer.pagesHeading,
        ),
        resourcesHeading: parseTextValue(
          formData,
          "footerResourcesHeading",
          current.footer.resourcesHeading,
        ),
        socialHeading: parseTextValue(
          formData,
          "footerSocialHeading",
          current.footer.socialHeading,
        ),
        pagesLinks: footerPageLinks,
        resourceLinks: footerResourceLinks,
        socialLinks: footerSocialLinks,
        copyrightText: parseTextValue(
          formData,
          "footerCopyrightText",
          current.footer.copyrightText,
        ),
        backToTopLabel: parseTextValue(
          formData,
          "footerBackToTopLabel",
          current.footer.backToTopLabel,
        ),
      },
    };

    await saveCmsContent(nextContent);
  } catch (error) {
    redirectWithError(
      "/admin/cms",
      error instanceof Error ? error.message : "Failed to save CMS content.",
    );
  }

  revalidateCmsPaths();
  redirect("/admin/cms?saved=cms-updated");
}

export async function resetCmsContentAction(): Promise<void> {
  await requireTrustedAdminMutation();
  await deleteCmsContent();
  revalidateCmsPaths();
  redirect("/admin/cms?saved=cms-reset");
}

function normalizeMediaFolder(folderInput: string): string {
  const normalized = folderInput.trim().toLowerCase();
  return allowedMediaFolders.has(normalized) ? normalized : "general";
}

function getObjectPath(folder: string, fileName: string): string {
  return folder === "general" ? `images/${fileName}` : `images/${folder}/${fileName}`;
}

async function isMediaInUse(publicPath: string): Promise<boolean> {
  const normalized = publicPath.trim();

  const usedByPosts = await isCoverImageUsed(normalized);
  if (usedByPosts) {
    return true;
  }

  const authors = await getAuthors();
  return authors.some((author) => author.avatar === normalized);
}

function buildAdminMediaRedirectTarget(
  redirectTo: string,
  resultKey: "saved" | "error",
  value: string,
): string {
  const trimmed = redirectTo.trim();
  const fallback = "/admin/media";
  const safeBase = trimmed.startsWith("/admin/media") ? trimmed : fallback;
  const [pathnamePart, existingQuery = ""] = safeBase.split("?", 2);
  const pathname = pathnamePart || fallback;
  const params = new URLSearchParams(existingQuery);

  if (resultKey === "saved") {
    params.set("saved", value);
    params.delete("error");
  } else {
    params.set("error", value);
    params.delete("saved");
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export async function uploadMediaAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const redirectTo = String(formData.get("redirectTo") ?? "/admin/media");
  const folder = normalizeMediaFolder(String(formData.get("folder") ?? "general"));
  const file = formData.get("mediaFile");

  if (!(file instanceof File) || file.size === 0) {
    redirect(buildAdminMediaRedirectTarget(redirectTo, "error", "Please choose a media file."));
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    redirect(
      buildAdminMediaRedirectTarget(
        redirectTo,
        "error",
        "File too large. Maximum file size is 5MB.",
      ),
    );
  }

  const extension = inferFileExtension(file);
  if (!extension) {
    redirect(
      buildAdminMediaRedirectTarget(
        redirectTo,
        "error",
        "Unsupported image format. Use SVG, PNG, JPG, WEBP, AVIF, or GIF.",
      ),
    );
  }
  await assertSafeImageFile(file, extension, "Media");

  const baseName = slugify(path.basename(file.name, path.extname(file.name))) || "media-file";
  const fileName = `${baseName}-${Date.now()}${extension}`;
  const objectPath = getObjectPath(folder, fileName);

  try {
    await uploadImageFile({
      file,
      objectPath,
      label: "Media",
      extension,
    });
  } catch (error) {
    redirect(
      buildAdminMediaRedirectTarget(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "Failed to upload media.",
      ),
    );
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/edit/[slug]");
  redirect(buildAdminMediaRedirectTarget(redirectTo, "saved", "media-uploaded"));
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const redirectTo = String(formData.get("redirectTo") ?? "/admin/media");
  const publicPath = String(formData.get("filePath") ?? "").trim();

  if (!publicPath) {
    redirect(buildAdminMediaRedirectTarget(redirectTo, "error", "Missing media path."));
  }

  if (await isMediaInUse(publicPath)) {
    redirect(
      buildAdminMediaRedirectTarget(
        redirectTo,
        "error",
        "Cannot delete this media file because it is currently used by a post or author.",
      ),
    );
  }

  try {
    const asset = await getMediaAssetByPublicUrl(publicPath);
    let objectPath = asset ? getStorageObjectPathFromPublicUrl(publicPath) : null;

    if (!objectPath) {
      objectPath = getStorageObjectPathFromPublicUrl(publicPath);
    }

    if (objectPath) {
      await deleteStorageObject(objectPath);
    }

    if (asset) {
      await deleteMediaAssetByPublicUrl(publicPath);
    }
  } catch (error) {
    redirect(
      buildAdminMediaRedirectTarget(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "Invalid media path.",
      ),
    );
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/edit/[slug]");
  redirect(buildAdminMediaRedirectTarget(redirectTo, "saved", "media-deleted"));
}

function buildNewsletterRedirectTarget(
  redirectTo: string,
  resultKey: "deleted" | "error",
  message?: string,
): string {
  const trimmed = redirectTo.trim();
  const fallback = "/admin/newsletter";
  const safeBase = trimmed.startsWith("/admin/newsletter") ? trimmed : fallback;
  const [pathnamePart, existingQuery = ""] = safeBase.split("?", 2);
  const pathname = pathnamePart || fallback;
  const params = new URLSearchParams(existingQuery);

  if (resultKey === "deleted") {
    params.set("deleted", "1");
    params.delete("error");
  } else {
    params.delete("deleted");
    params.set("error", message ?? "Could not delete subscriber.");
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export async function deleteNewsletterSubscriberAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation();

  const subscriberId = String(formData.get("subscriberId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/newsletter");

  if (!subscriberId) {
    redirect(buildNewsletterRedirectTarget(redirectTo, "error", "Missing subscriber ID."));
  }

  const deleted = await deleteNewsletterSubscriberById(subscriberId);
  if (!deleted) {
    redirect(
      buildNewsletterRedirectTarget(
        redirectTo,
        "error",
        "Subscriber was not found or already removed.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/newsletter");
  redirect(buildNewsletterRedirectTarget(redirectTo, "deleted"));
}

function parseAdminRole(value: string): AdminRole {
  return value === "admin" ? "admin" : "editor";
}

function pickAvailableAuthorId(baseId: string, authors: Author[]): string {
  const normalizedBase = slugify(baseId) || "author";
  const existing = new Set(authors.map((author) => author.id));

  if (!existing.has(normalizedBase)) {
    return normalizedBase;
  }

  let attempt = 2;
  while (existing.has(`${normalizedBase}-${attempt}`)) {
    attempt += 1;
  }

  return `${normalizedBase}-${attempt}`;
}

function defaultAuthorRoleFromUserRole(role: AdminRole): string {
  return role === "admin" ? "Site Administrator" : "Staff Writer";
}

function defaultShortBio(name: string): string {
  return `${name} contributes editorial content across the publication.`;
}

function defaultBio(name: string): string {
  return `${name} writes and edits practical, reader-first articles focused on clarity and depth.`;
}

type AuthorSyncUser = {
  id: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
};

function buildDefaultAuthorProfileForUser(user: Omit<AuthorSyncUser, "isActive">, authorId: string): Author {
  return {
    id: authorId,
    name: user.name,
    role: defaultAuthorRoleFromUserRole(user.role),
    shortBio: defaultShortBio(user.name),
    bio: defaultBio(user.name),
    avatar: "/images/authors/giana-franci.svg",
    adminUserId: user.id,
  };
}

async function createMissingAuthorProfilesForUsers(users: AuthorSyncUser[]): Promise<number> {
  const activeUsers = users.filter((user) => user.isActive);
  if (activeUsers.length === 0) {
    return 0;
  }

  const authors = await getAuthors();
  const nextAuthors = [...authors];
  const linkedUserIds = new Set(
    authors
      .map((author) => author.adminUserId)
      .filter((adminUserId): adminUserId is string => Boolean(adminUserId)),
  );

  let created = 0;

  for (const user of activeUsers) {
    if (linkedUserIds.has(user.id)) {
      continue;
    }

    const authorId = pickAvailableAuthorId(user.name, nextAuthors);
    const authorProfile = buildDefaultAuthorProfileForUser(user, authorId);
    nextAuthors.push(authorProfile);
    linkedUserIds.add(user.id);
    created += 1;
  }

  if (created > 0) {
    await saveAuthors(nextAuthors);
  }

  return created;
}

async function resolveUserFormAuthorAvatar(
  formData: FormData,
  authorId: string,
  fallbackAvatar: string,
): Promise<string> {
  const uploaded = formData.get("authorAvatarFile");

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Author avatar image must be 5MB or smaller.");
    }

    const extension = inferFileExtension(uploaded);
    if (!extension) {
      throw new Error("Unsupported author avatar image format.");
    }
    await assertSafeImageFile(uploaded, extension, "Author avatar");

    const fileName = `${authorId}-${Date.now()}${extension}`;
    const objectPath = `images/authors/${fileName}`;

    return uploadImageFile({
      file: uploaded,
      objectPath,
      label: "Author avatar",
      extension,
    });
  }

  return fallbackAvatar || "/images/authors/giana-franci.svg";
}

function buildUsersRedirectTarget(
  resultKey: "saved" | "error",
  value: string,
  extras: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  params.set(resultKey, value);
  for (const [key, paramValue] of Object.entries(extras)) {
    params.set(key, paramValue);
  }
  return `/admin/users?${params.toString()}`;
}

export async function syncAdminUserAuthorsAction(): Promise<void> {
  await requireTrustedAdminMutation(["admin"]);

  let createdCount = 0;
  try {
    const users = await listAdminUsers();
    createdCount = await createMissingAuthorProfilesForUsers(users);
  } catch (error) {
    redirect(
      buildUsersRedirectTarget(
        "error",
        error instanceof Error ? error.message : "Failed to sync users with author profiles.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/new");
  revalidatePath("/admin/authors");
  revalidatePath("/authors");

  redirect(
    buildUsersRedirectTarget(
      "saved",
      createdCount > 0 ? "authors-synced" : "authors-in-sync",
      { count: String(createdCount) },
    ),
  );
}

export async function createAdminUserAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation(["admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseAdminRole(String(formData.get("role") ?? "editor"));
  const authorIdInput = String(formData.get("authorId") ?? "").trim();
  const authorRoleInput = String(formData.get("authorRole") ?? "").trim();
  const authorShortBioInput = String(formData.get("authorShortBio") ?? "").trim();
  const authorBioInput = String(formData.get("authorBio") ?? "").trim();
  const authorXUrlInput = String(formData.get("authorXUrl") ?? "").trim();
  const authorFallbackAvatar = String(formData.get("authorExistingAvatar") ?? "").trim();
  let createdUser:
    | {
        id: string;
        email: string;
        name: string;
        role: AdminRole;
      }
    | undefined;

  try {
    createdUser = await createAdminUser({
      name,
      email,
      password,
      role,
    });

    const authors = await getAuthors();
    const authorId = pickAvailableAuthorId(authorIdInput || createdUser.name, authors);
    const avatar = await resolveUserFormAuthorAvatar(formData, authorId, authorFallbackAvatar);

    const authorProfile: Author = {
      id: authorId,
      name: createdUser.name,
      role: authorRoleInput || defaultAuthorRoleFromUserRole(createdUser.role),
      shortBio: authorShortBioInput || defaultShortBio(createdUser.name),
      bio: authorBioInput || defaultBio(createdUser.name),
      avatar,
      xUrl: authorXUrlInput || undefined,
      adminUserId: createdUser.id,
    };

    await saveAuthors([...authors, authorProfile]);
  } catch (error) {
    if (createdUser) {
      try {
        await deleteAdminUser(createdUser.id);
      } catch {
        // If rollback fails, we still surface the root error to the caller.
      }
    }

    redirect(
      buildUsersRedirectTarget(
        "error",
        error instanceof Error ? error.message : "Failed to create user and author profile.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/authors");
  revalidatePath("/authors");
  revalidatePath("/admin/users");
  redirect(buildUsersRedirectTarget("saved", "user-created"));
}

export async function updateAdminUserRoleAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation(["admin"]);

  const userId = String(formData.get("userId") ?? "").trim();
  const role = parseAdminRole(String(formData.get("role") ?? "editor"));

  if (!userId) {
    redirect(buildUsersRedirectTarget("error", "Missing user id."));
  }

  try {
    await updateAdminUserRole(userId, role);
    const users = await listAdminUsers();
    await createMissingAuthorProfilesForUsers(users.filter((user) => user.id === userId));
  } catch (error) {
    redirect(
      buildUsersRedirectTarget(
        "error",
        error instanceof Error ? error.message : "Failed to update user role.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/authors");
  revalidatePath("/authors");
  revalidatePath("/admin/users");
  redirect(buildUsersRedirectTarget("saved", "role-updated"));
}

export async function updateAdminUserPasswordAction(formData: FormData): Promise<void> {
  await requireTrustedAdminMutation(["admin"]);

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!userId) {
    redirect(buildUsersRedirectTarget("error", "Missing user id."));
  }

  try {
    await updateAdminUserPassword(userId, password);
  } catch (error) {
    redirect(
      buildUsersRedirectTarget(
        "error",
        error instanceof Error ? error.message : "Failed to update password.",
      ),
    );
  }

  revalidatePath("/admin/users");
  redirect(buildUsersRedirectTarget("saved", "password-updated"));
}

export async function deleteAdminUserAction(formData: FormData): Promise<void> {
  const currentUser = await requireTrustedAdminMutation(["admin"]);

  const userId = String(formData.get("userId") ?? "").trim();
  const reassignToUserId = String(formData.get("reassignToUserId") ?? "").trim();
  if (!userId) {
    redirect(buildUsersRedirectTarget("error", "Missing user id."));
  }

  if (userId === currentUser.id) {
    redirect(buildUsersRedirectTarget("error", "You cannot delete your own account."));
  }

  let reassignedPostsCount = 0;

  try {
    const activeUsers = await listAdminUsers();
    const targetUser =
      reassignToUserId !== ""
        ? activeUsers.find((user) => user.id === reassignToUserId && user.isActive)
        : undefined;

    if (reassignToUserId && !targetUser) {
      throw new Error("Selected reassignment user was not found or is inactive.");
    }

    if (targetUser && targetUser.id === userId) {
      throw new Error("Cannot reassign posts to the same user being deleted.");
    }

    const authors = await getAuthors();
    const linkedAuthor = authors.find((author) => author.adminUserId === userId);

    if (linkedAuthor) {
      const authoredPosts = await getPostsByAuthor(linkedAuthor.id, { includeUnpublished: true });
      if (authoredPosts.length > 0) {
        if (!targetUser) {
          throw new Error(
            `This user has ${authoredPosts.length} post(s). Select another author account to reassign posts before deletion.`,
          );
        }

        const reassignmentAuthor = authors.find((author) => author.adminUserId === targetUser.id);
        if (!reassignmentAuthor) {
          throw new Error(
            "Selected reassignment user does not have a linked author profile. Sync users to authors first.",
          );
        }

        await renameAuthorInPosts(linkedAuthor.id, reassignmentAuthor.id);
        reassignedPostsCount = authoredPosts.length;
      }

      const nextAuthors = authors.filter((author) => author.id !== linkedAuthor.id);
      if (nextAuthors.length === 0) {
        throw new Error("Cannot delete the last linked author profile. Create another user first.");
      }

      await saveAuthors(nextAuthors);
    }

    await deleteAdminUser(userId);
  } catch (error) {
    redirect(
      buildUsersRedirectTarget(
        "error",
        error instanceof Error ? error.message : "Failed to delete user.",
      ),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/authors");
  revalidatePath("/authors");
  revalidatePath("/admin/users");
  redirect(
    buildUsersRedirectTarget("saved", "user-deleted", {
      moved: String(reassignedPostsCount),
    }),
  );
}
