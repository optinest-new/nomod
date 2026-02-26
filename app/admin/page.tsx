import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { deletePostAction, logoutAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { requireAdminSession } from "@/lib/admin";
import { getAuthorByAdminUserId } from "@/lib/authors";
import { getLatestPosts } from "@/lib/posts";

const ADMIN_POSTS_PER_PAGE = 9;

type AdminIndexPageProps = {
  searchParams: Promise<{
    deleted?: string;
    error?: string;
    q?: string;
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

function parsePage(pageValue: string | undefined): number {
  const parsed = Number.parseInt(pageValue ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildAdminListLink(page: number, query: string): string {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/admin?${queryString}` : "/admin";
}

function getPostStatusLabel(
  status: "published" | "draft" | "scheduled",
  isPublished: boolean,
): string {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "scheduled") {
    return isPublished ? "Published (scheduled)" : "Scheduled";
  }

  return "Published";
}

function formatScheduleDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminIndexPage({ searchParams }: AdminIndexPageProps) {
  const user = await requireAdminSession();
  const [posts, linkedAuthor] = await Promise.all([
    getLatestPosts(undefined, { includeUnpublished: true }),
    user.role === "editor" ? getAuthorByAdminUserId(user.id) : Promise.resolve(undefined),
  ]);
  const { deleted, error, q, page } = await searchParams;
  const authorScopedPosts =
    user.role === "editor" && linkedAuthor
      ? posts.filter((post) => post.authorId === linkedAuthor.id)
      : posts;
  const searchQuery = q?.trim() ?? "";
  const normalizedQuery = searchQuery.toLowerCase();
  const filteredPosts = normalizedQuery
    ? authorScopedPosts.filter((post) =>
        [post.title, post.slug, post.category, post.excerpt, post.status, post.publishAt ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : authorScopedPosts;

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / ADMIN_POSTS_PER_PAGE));
  const requestedPage = parsePage(page);
  const currentPage = Math.min(requestedPage, totalPages);

  if (requestedPage !== currentPage) {
    redirect(buildAdminListLink(currentPage, searchQuery));
  }

  const startIndex = (currentPage - 1) * ADMIN_POSTS_PER_PAGE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + ADMIN_POSTS_PER_PAGE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <section className="container admin-shell">
      <div className="admin-dashboard-layout">
        <aside className="admin-dashboard-sidebar" aria-label="Admin navigation">
          <p className="admin-sidebar-title">Navigation</p>
          <Link href="/admin/analytics" className="admin-sidebar-link">
            Analytics
          </Link>
          <Link href="/admin/media" className="admin-sidebar-link">
            Media
          </Link>
          <Link href="/admin/newsletter" className="admin-sidebar-link">
            Newsletter
          </Link>
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-sidebar-link">
              Users
            </Link>
          ) : null}
          <Link href="/admin/cms" className="admin-sidebar-link">
            Manage CMS
          </Link>
          <Link href="/admin/authors" className="admin-sidebar-link">
            Authors CMS
          </Link>
          <Link href="/admin/taxonomy" className="admin-sidebar-link">
            Manage taxonomy
          </Link>
          <Link href="/admin/new" className="admin-sidebar-link is-primary">
            New post
          </Link>
          <form action={logoutAction} className="admin-sidebar-form">
            <button type="submit" className="admin-sidebar-link admin-sidebar-button">
              Logout
            </button>
          </form>
        </aside>

        <div className="admin-dashboard-content">
          <div className="admin-dashboard-header">
            <h1>Blog Admin</h1>
            <p>
              Currently logged in: <strong>{user.name}</strong> ({user.email}) -{" "}
              {user.role}.
            </p>
          </div>

          {deleted ? <p className="admin-success">Post deleted.</p> : null}
          {error ? <p className="admin-error">{error}</p> : null}
          {user.role === "editor" && !linkedAuthor ? (
            <p className="admin-error">
              Your account is not linked to an author profile. Ask an admin to link it in Author CMS.
            </p>
          ) : null}

          <form className="admin-search" method="get" action="/admin">
            <label htmlFor="admin-search-input" className="sr-only">
              Search posts
            </label>
            <input
              id="admin-search-input"
              type="search"
              name="q"
              placeholder="Search by title, slug, category..."
              defaultValue={searchQuery}
            />
            <button type="submit" className="admin-outline-button">
              Search
            </button>
            {searchQuery ? (
              <Link href="/admin" className="admin-outline-button">
                Clear
              </Link>
            ) : null}
          </form>

          <p className="admin-list-summary">
            Showing {visiblePosts.length} of {filteredPosts.length} posts
            {searchQuery ? ` for "${searchQuery}"` : ""}.
          </p>

          <div className="admin-card admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePosts.map((post) => (
                  <tr key={post.slug}>
                    <td>{post.title}</td>
                    <td>
                      <code>{post.slug}</code>
                    </td>
                    <td>{String(post.date).slice(0, 10)}</td>
                    <td>
                      <span className={`admin-status-badge is-${post.status}`}>
                        {getPostStatusLabel(post.status, post.isPublished)}
                      </span>
                      {post.status === "scheduled" ? (
                        <span className="admin-status-subtext">
                          {formatScheduleDate(post.publishAt)}
                        </span>
                      ) : null}
                    </td>
                    <td>{post.category}</td>
                    <td>
                      <div className="admin-row-actions">
                        {post.isPublished ? (
                          <Link href={`/latest/${post.slug}`} target="_blank">
                            View
                          </Link>
                        ) : (
                          <span className="admin-status-subtext">Not live</span>
                        )}
                        <Link href={`/admin/edit/${post.slug}`}>Edit</Link>
                        <form action={deletePostAction}>
                          <input type="hidden" name="slug" value={post.slug} />
                          <ConfirmSubmitButton
                            className="admin-link-button"
                            label="Delete"
                            confirmMessage={`Delete "${post.title}"? This action cannot be undone.`}
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav className="pagination admin-pagination" aria-label="Admin post list pagination">
              {currentPage > 1 ? (
                <Link
                  className="pagination-arrow"
                  href={buildAdminListLink(currentPage - 1, searchQuery)}
                >
                  Previous
                </Link>
              ) : (
                <span className="pagination-arrow is-disabled" aria-disabled="true">
                  Previous
                </span>
              )}

              <ul className="pagination-list">
                {pageNumbers.map((pageNumber) => (
                  <li key={pageNumber}>
                    <Link
                      className={`pagination-link${pageNumber === currentPage ? " is-active" : ""}`}
                      href={buildAdminListLink(pageNumber, searchQuery)}
                      aria-current={pageNumber === currentPage ? "page" : undefined}
                    >
                      {pageNumber}
                    </Link>
                  </li>
                ))}
              </ul>

              {currentPage < totalPages ? (
                <Link
                  className="pagination-arrow"
                  href={buildAdminListLink(currentPage + 1, searchQuery)}
                >
                  Next
                </Link>
              ) : (
                <span className="pagination-arrow is-disabled" aria-disabled="true">
                  Next
                </span>
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}
