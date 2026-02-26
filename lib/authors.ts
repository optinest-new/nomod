import { Author } from "@/lib/types";
import { normalizeLegacyMediaPath, readSupabaseJson, supabaseRequest } from "@/lib/supabase";

type AuthorRow = {
  id: string;
  name: string;
  role: string;
  short_bio: string;
  bio: string;
  avatar: string;
  x_url?: string | null;
  admin_user_id?: string | null;
};

const defaultAuthors: Author[] = [
  {
    id: "abram-lubin",
    name: "Abram Lubin",
    role: "Photography Editor",
    shortBio: "Shapes visual storytelling systems with sharp composition and editorial intent.",
    bio: "Abram leads visual direction across feature stories, from art direction to final image sequencing. He writes about image systems, narrative pacing, and how photography decisions influence trust and readability on modern publishing sites.",
    avatar: "/images/authors/abram-lubin.svg",
    xUrl: "https://x.com",
  },
  {
    id: "giana-franci",
    name: "Giana Franci",
    role: "Senior Writer",
    shortBio: "Writes practical editorial frameworks for consistency, clarity, and growth.",
    bio: "Giana focuses on repeatable writing workflows, audience-first messaging, and long-form content structure. Her pieces help teams publish high-quality work consistently without sacrificing craft, voice, or strategic focus.",
    avatar: "/images/authors/giana-franci.svg",
    xUrl: "https://x.com",
  },
  {
    id: "carla-dokidis",
    name: "Carla Dokidis",
    role: "Culture Columnist",
    shortBio: "Interprets digital culture shifts with context, nuance, and clarity.",
    bio: "Carla analyzes how platform behavior, social norms, and identity trends shape what audiences value online. She writes at the intersection of culture, ethics, and media, translating broad shifts into clear editorial decisions.",
    avatar: "/images/authors/carla-dokidis.svg",
    xUrl: "https://x.com",
  },
  {
    id: "daniel-foster",
    name: "Daniel Foster",
    role: "Technology Editor",
    shortBio: "Translates AI and platform changes into clear product and content strategy.",
    bio: "Daniel covers emerging web and AI trends with a systems-thinking lens grounded in execution. He helps readers connect technical shifts to practical outcomes in product, SEO, analytics, and publishing operations.",
    avatar: "/images/authors/daniel-foster.svg",
    xUrl: "https://x.com",
  },
  {
    id: "richard-miller",
    name: "Richard Miller",
    role: "Design Writer",
    shortBio: "Covers design systems, typography, and interface decisions that scale.",
    bio: "Richard writes about design tokens, layout systems, and interface clarity for content-led products. His work breaks down complex design choices into practical patterns teams can apply across editorial and product surfaces.",
    avatar: "/images/authors/richard-miller.svg",
    xUrl: "https://x.com",
  },
];

function sanitizeAuthor(value: unknown): Author | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<AuthorRow> &
    Partial<{
      shortBio: string;
      xUrl: string;
      adminUserId: string;
    }>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const role = typeof record.role === "string" ? record.role.trim() : "";
  const shortBio =
    typeof record.short_bio === "string"
      ? record.short_bio.trim()
      : typeof record.shortBio === "string"
        ? record.shortBio.trim()
        : "";
  const bio = typeof record.bio === "string" ? record.bio.trim() : "";
  const avatarRaw = typeof record.avatar === "string" ? record.avatar.trim() : "";
  const avatar = normalizeLegacyMediaPath(avatarRaw);
  const xUrl =
    typeof record.x_url === "string"
      ? record.x_url.trim()
      : typeof record.xUrl === "string"
        ? record.xUrl.trim()
        : undefined;
  const adminUserId =
    typeof record.admin_user_id === "string"
      ? record.admin_user_id.trim()
      : typeof record.adminUserId === "string"
        ? record.adminUserId.trim()
        : undefined;

  if (!id || !name || !role || !shortBio || !bio || !avatar) {
    return null;
  }

  return {
    id,
    name,
    role,
    shortBio,
    bio,
    avatar,
    xUrl,
    adminUserId: adminUserId || undefined,
  } satisfies Author;
}

function sanitizeAuthors(input: unknown): Author[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .map((item) => sanitizeAuthor(item))
    .filter((author): author is Author => Boolean(author));

  const seenIds = new Set<string>();
  const uniqueAuthors: Author[] = [];

  for (const author of normalized) {
    if (seenIds.has(author.id)) {
      continue;
    }
    seenIds.add(author.id);
    uniqueAuthors.push(author);
  }

  return uniqueAuthors;
}

function toAuthorRow(author: Author): AuthorRow {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    short_bio: author.shortBio,
    bio: author.bio,
    avatar: author.avatar,
    x_url: author.xUrl ?? null,
    admin_user_id: author.adminUserId ?? null,
  };
}

function isMissingAdminUserIdColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("admin_user_id") && message.includes("column");
}

function isAuthorStillReferencedByPostsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("posts_author_id_fkey") ||
    (message.includes("is still referenced from table") && message.includes("posts"))
  );
}

function toAuthorRowWithoutAdminUserId(author: Author): Omit<AuthorRow, "admin_user_id"> {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    short_bio: author.shortBio,
    bio: author.bio,
    avatar: author.avatar,
    x_url: author.xUrl ?? null,
  };
}

export async function getAuthors(): Promise<Author[]> {
  try {
    let rows: AuthorRow[] = [];

    try {
      const response = await supabaseRequest("/rest/v1/authors", {
        query: {
          select: "id,name,role,short_bio,bio,avatar,x_url,admin_user_id",
          order: "name.asc",
        },
      });
      rows = await readSupabaseJson<AuthorRow[]>(response);
    } catch (error) {
      if (!isMissingAdminUserIdColumnError(error)) {
        throw error;
      }

      const fallbackResponse = await supabaseRequest("/rest/v1/authors", {
        query: {
          select: "id,name,role,short_bio,bio,avatar,x_url",
          order: "name.asc",
        },
      });
      rows = await readSupabaseJson<AuthorRow[]>(fallbackResponse);
    }

    const authors = sanitizeAuthors(rows);
    return authors.length > 0 ? authors : defaultAuthors;
  } catch {
    return defaultAuthors;
  }
}

export async function saveAuthors(
  authors: Author[],
  options: { allowReferencedAuthorDelete?: boolean } = {},
): Promise<void> {
  const normalized = sanitizeAuthors(authors);

  if (normalized.length === 0) {
    throw new Error("Authors cannot be empty.");
  }

  const containsAuthorUserLinks = normalized.some((author) => Boolean(author.adminUserId));
  const timestamp = new Date().toISOString();
  const existing = await getAuthors();
  const nextIds = new Set(normalized.map((author) => author.id));
  const removedAuthors = existing.filter((author) => !nextIds.has(author.id));

  // When an author ID changes but keeps the same linked user, we need to release
  // the old row's admin_user_id before inserting the renamed row.
  if (containsAuthorUserLinks && removedAuthors.length > 0) {
    const nextAdminUserIds = new Set(
      normalized
        .map((author) => author.adminUserId)
        .filter((adminUserId): adminUserId is string => Boolean(adminUserId)),
    );
    const conflictingRemovedAuthors = removedAuthors.filter(
      (author) => author.adminUserId && nextAdminUserIds.has(author.adminUserId),
    );

    try {
      for (const author of conflictingRemovedAuthors) {
        const releaseResponse = await supabaseRequest("/rest/v1/authors", {
          method: "PATCH",
          query: {
            id: `eq.${author.id}`,
          },
          body: {
            admin_user_id: null,
            updated_at: timestamp,
          },
        });
        await readSupabaseJson(releaseResponse);
      }
    } catch (error) {
      if (!isMissingAdminUserIdColumnError(error)) {
        throw error;
      }

      throw new Error(
        "Author-user linking is not enabled yet. Apply the latest SQL schema update to add authors.admin_user_id.",
      );
    }
  }

  try {
    const upsertResponse = await supabaseRequest("/rest/v1/authors", {
      method: "POST",
      query: {
        on_conflict: "id",
      },
      prefer: "resolution=merge-duplicates,return=minimal",
      body: normalized.map((author) => ({
        ...toAuthorRow(author),
        updated_at: timestamp,
      })),
    });
    await readSupabaseJson(upsertResponse);
  } catch (error) {
    if (!isMissingAdminUserIdColumnError(error)) {
      throw error;
    }

    if (containsAuthorUserLinks) {
      throw new Error(
        "Author-user linking is not enabled yet. Apply the latest SQL schema update to add authors.admin_user_id.",
      );
    }

    const fallbackUpsertResponse = await supabaseRequest("/rest/v1/authors", {
      method: "POST",
      query: {
        on_conflict: "id",
      },
      prefer: "resolution=merge-duplicates,return=minimal",
      body: normalized.map((author) => ({
        ...toAuthorRowWithoutAdminUserId(author),
        updated_at: timestamp,
      })),
    });
    await readSupabaseJson(fallbackUpsertResponse);
  }

  for (const author of removedAuthors) {
    try {
      const deleteResponse = await supabaseRequest("/rest/v1/authors", {
        method: "DELETE",
        query: {
          id: `eq.${author.id}`,
        },
      });
      await readSupabaseJson(deleteResponse);
    } catch (error) {
      if (options.allowReferencedAuthorDelete && isAuthorStillReferencedByPostsError(error)) {
        continue;
      }

      throw error;
    }
  }
}

export async function getAuthorById(authorId: string): Promise<Author | undefined> {
  return (await getAuthors()).find((author) => author.id === authorId);
}

export async function getAuthorByAdminUserId(
  adminUserId: string,
): Promise<Author | undefined> {
  const normalized = adminUserId.trim();
  if (!normalized) {
    return undefined;
  }

  return (await getAuthors()).find((author) => author.adminUserId === normalized);
}
