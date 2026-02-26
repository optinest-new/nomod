import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { deleteNewsletterSubscriberAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { requireAdminSession } from "@/lib/admin";
import { getNewsletterSubscribers } from "@/lib/newsletter";

const SUBSCRIBERS_PER_PAGE = 25;

type AdminNewsletterPageProps = {
  searchParams: Promise<{ q?: string; page?: string; deleted?: string; error?: string }>;
};

export const metadata: Metadata = {
  title: "Newsletter Subscribers",
  robots: {
    index: false,
    follow: false,
  },
};

function parsePage(pageValue: string | undefined): number {
  const parsed = Number.parseInt(pageValue ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildPageLink(page: number, query: string): string {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/admin/newsletter?${queryString}` : "/admin/newsletter";
}

function buildExportLink(query: string): string {
  if (!query) {
    return "/admin/newsletter/export";
  }

  const params = new URLSearchParams();
  params.set("q", query);
  return `/admin/newsletter/export?${params.toString()}`;
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminNewsletterPage({ searchParams }: AdminNewsletterPageProps) {
  const user = await requireAdminSession();

  const { q, page, deleted, error } = await searchParams;
  const searchQuery = q?.trim() ?? "";
  const normalizedQuery = searchQuery.toLowerCase();

  const subscribers = await getNewsletterSubscribers();
  const filteredSubscribers = normalizedQuery
    ? subscribers.filter((entry) =>
        [entry.email, entry.sourcePath ?? "", entry.submittedAt]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : subscribers;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubscribers.length / SUBSCRIBERS_PER_PAGE),
  );
  const requestedPage = parsePage(page);
  const currentPage = Math.min(requestedPage, totalPages);

  if (requestedPage !== currentPage) {
    redirect(buildPageLink(currentPage, searchQuery));
  }

  const startIndex = (currentPage - 1) * SUBSCRIBERS_PER_PAGE;
  const visibleSubscribers = filteredSubscribers.slice(
    startIndex,
    startIndex + SUBSCRIBERS_PER_PAGE,
  );
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const uniqueCount = new Set(subscribers.map((entry) => entry.email)).size;

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Newsletter Subscribers</h1>
          <p>Captured from newsletter forms across public pages.</p>
        </div>
        <div className="admin-toolbar-actions">
          <a href={buildExportLink(searchQuery)} className="pill-button">
            Export CSV
          </a>
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          <Link href="/admin/media" className="admin-outline-button">
            Media
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

      {deleted ? <p className="admin-success">Subscriber removed.</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <form className="admin-search" method="get" action="/admin/newsletter">
        <label htmlFor="admin-newsletter-search" className="sr-only">
          Search subscribers
        </label>
        <input
          id="admin-newsletter-search"
          type="search"
          name="q"
          placeholder="Search by email or source path..."
          defaultValue={searchQuery}
        />
        <button type="submit" className="admin-outline-button">
          Search
        </button>
        {searchQuery ? (
          <Link href="/admin/newsletter" className="admin-outline-button">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="admin-list-summary">
        Showing {visibleSubscribers.length} of {filteredSubscribers.length} records
        {searchQuery ? ` for "${searchQuery}"` : ""}. Total collected: {subscribers.length}, unique
        emails: {uniqueCount}.
      </p>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Source page</th>
              <th>Submitted at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleSubscribers.length > 0 ? (
              visibleSubscribers.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.email}</td>
                  <td>{entry.sourcePath ?? "-"}</td>
                  <td>{formatTimestamp(entry.submittedAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <form action={deleteNewsletterSubscriberAction}>
                        <input type="hidden" name="subscriberId" value={entry.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={buildPageLink(currentPage, searchQuery)}
                        />
                        <ConfirmSubmitButton
                          className="admin-link-button"
                          label="Delete"
                          confirmMessage={`Delete subscriber ${entry.email}? This action cannot be undone.`}
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No newsletter submissions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="pagination admin-pagination" aria-label="Newsletter list pagination">
          {currentPage > 1 ? (
            <Link
              className="pagination-arrow"
              href={buildPageLink(currentPage - 1, searchQuery)}
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
                  href={buildPageLink(pageNumber, searchQuery)}
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
              href={buildPageLink(currentPage + 1, searchQuery)}
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
    </section>
  );
}
