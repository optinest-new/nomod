import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { deletePostAction, updatePostAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AdminPostForm } from "@/components/AdminPostForm";
import { requireAdminSession } from "@/lib/admin";
import { getAuthorByAdminUserId, getAuthors } from "@/lib/authors";
import { getCategories } from "@/lib/categories";
import { getMediaAssets } from "@/lib/media";
import { getPostBySlug } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Edit Post",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminEditPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function AdminEditPage({ params, searchParams }: AdminEditPageProps) {
  const user = await requireAdminSession();

  const { slug } = await params;
  const { error, saved } = await searchParams;
  const [post, authors, categories, mediaAssets, linkedAuthor] = await Promise.all([
    getPostBySlug(slug, { includeUnpublished: true }),
    getAuthors(),
    getCategories(),
    getMediaAssets(),
    user.role === "editor" ? getAuthorByAdminUserId(user.id) : Promise.resolve(undefined),
  ]);

  if (!post) {
    notFound();
  }

  if (user.role === "editor") {
    if (!linkedAuthor) {
      redirect(
        "/admin?error=Your account is not linked to an author profile. Ask an admin to link it in Author CMS.",
      );
    }

    if (post.authorId !== linkedAuthor.id) {
      redirect("/admin?error=Editors can only edit posts from their linked author profile.");
    }
  }

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Edit Post</h1>
          <p>Update frontmatter and markdown body.</p>
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
          <form action={deletePostAction}>
            <input type="hidden" name="slug" value={post.slug} />
            <ConfirmSubmitButton
              className="admin-outline-button admin-danger-button"
              label="Delete"
              confirmMessage={`Delete "${post.title}"? This action cannot be undone.`}
            />
          </form>
        </div>
      </div>

      {saved ? <p className="admin-success">Changes saved.</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <AdminPostForm
        action={updatePostAction}
        post={post}
        submitLabel="Save changes"
        authors={authors}
        categories={categories}
        mediaAssets={mediaAssets}
        lockedAuthorId={user.role === "editor" ? linkedAuthor?.id : undefined}
      />
    </section>
  );
}
