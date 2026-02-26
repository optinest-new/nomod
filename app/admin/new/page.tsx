import Link from "next/link";
import type { Metadata } from "next";

import { createPostAction } from "@/app/admin/actions";
import { AdminPostForm } from "@/components/AdminPostForm";
import { requireAdminSession } from "@/lib/admin";
import { getAuthorByAdminUserId, getAuthors } from "@/lib/authors";
import { getCategories } from "@/lib/categories";
import { getMediaAssets } from "@/lib/media";

export const metadata: Metadata = {
  title: "New Post",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminNewPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminNewPage({ searchParams }: AdminNewPageProps) {
  const user = await requireAdminSession();
  const { error } = await searchParams;
  const [authors, categories, mediaAssets, linkedAuthor] = await Promise.all([
    getAuthors(),
    getCategories(),
    getMediaAssets(),
    user.role === "editor" ? getAuthorByAdminUserId(user.id) : Promise.resolve(undefined),
  ]);
  const lockedAuthorId = user.role === "editor" ? linkedAuthor?.id : undefined;
  const accessError =
    user.role === "editor" && !linkedAuthor
      ? "Your account is not linked to an author profile. Ask an admin to link it in Author CMS."
      : null;

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Create Post</h1>
          <p>Add a new post to Supabase.</p>
        </div>
        <div className="admin-toolbar-actions">
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          <Link href="/admin/media" className="admin-outline-button">
            Media
          </Link>
          <Link href="/admin/newsletter" className="admin-outline-button">
            Newsletter
          </Link>
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-outline-button">
              Users
            </Link>
          ) : null}
          <Link href="/admin/cms" className="admin-outline-button">
            Manage CMS
          </Link>
          <Link href="/admin/taxonomy" className="admin-outline-button">
            Manage taxonomy
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {accessError ? <p className="admin-error">{accessError}</p> : null}

      {!accessError ? (
        <AdminPostForm
          action={createPostAction}
          submitLabel="Create post"
          authors={authors}
          categories={categories}
          mediaAssets={mediaAssets}
          lockedAuthorId={lockedAuthorId}
        />
      ) : null}
    </section>
  );
}
