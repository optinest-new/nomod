import Link from "next/link";
import type { Metadata } from "next";

import { AdminTaxonomyManager } from "@/components/AdminTaxonomyManager";
import { requireAdminSession } from "@/lib/admin";
import { getCategories } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Manage Taxonomy",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminTaxonomyPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function getSavedMessage(saved: string | undefined): string | null {
  switch (saved) {
    case "category-added":
      return "Category added.";
    case "category-updated":
      return "Category updated.";
    default:
      return null;
  }
}

export default async function AdminTaxonomyPage({ searchParams }: AdminTaxonomyPageProps) {
  const user = await requireAdminSession();
  const { error, saved } = await searchParams;

  const categories = await getCategories();
  const savedMessage = getSavedMessage(saved);

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Manage Categories</h1>
          <p>Update category options used by post creation and editing.</p>
        </div>
        <div className="admin-toolbar-actions">
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-outline-button">
              Users
            </Link>
          ) : null}
          <Link href="/admin/media" className="admin-outline-button">
            Media
          </Link>
          <Link href="/admin/newsletter" className="admin-outline-button">
            Newsletter
          </Link>
          <Link href="/admin/cms" className="admin-outline-button">
            Manage CMS
          </Link>
          <Link href="/admin/authors" className="admin-outline-button">
            Author CMS
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
        </div>
      </div>

      {savedMessage ? <p className="admin-success">{savedMessage}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <AdminTaxonomyManager categories={categories} />
    </section>
  );
}
