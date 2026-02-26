/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { deleteMediaAction, uploadMediaAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyTextButton } from "@/components/CopyTextButton";
import { requireAdminSession } from "@/lib/admin";
import { getMediaAssets, getRenderableImageSrc } from "@/lib/media";

const MEDIA_PER_PAGE = 24;

type MediaFilter = "all" | "posts" | "authors" | "about" | "other";

type AdminMediaPageProps = {
  searchParams: Promise<{
    q?: string;
    folder?: string;
    page?: string;
    saved?: string;
    error?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Media Library",
  robots: {
    index: false,
    follow: false,
  },
};

function parsePage(pageValue: string | undefined): number {
  const parsed = Number.parseInt(pageValue ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseFilter(value: string | undefined): MediaFilter {
  const normalized = String(value ?? "all").trim().toLowerCase();
  if (
    normalized === "all" ||
    normalized === "posts" ||
    normalized === "authors" ||
    normalized === "about" ||
    normalized === "other"
  ) {
    return normalized;
  }

  return "all";
}

function buildPageLink(page: number, query: string, filter: MediaFilter): string {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (filter !== "all") {
    params.set("folder", filter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/admin/media?${queryString}` : "/admin/media";
}

function getSavedMessage(value: string | undefined): string | null {
  switch (value) {
    case "media-uploaded":
      return "Media file uploaded.";
    case "media-deleted":
      return "Media file deleted.";
    default:
      return null;
  }
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
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

export default async function AdminMediaPage({ searchParams }: AdminMediaPageProps) {
  const user = await requireAdminSession();

  const { q, folder, page, saved, error } = await searchParams;
  const searchQuery = q?.trim() ?? "";
  const filter = parseFilter(folder);
  const normalizedQuery = searchQuery.toLowerCase();

  const assets = await getMediaAssets();
  const filteredAssets = assets
    .filter((asset) => filter === "all" || asset.kind === filter)
    .filter((asset) => {
      if (!normalizedQuery) {
        return true;
      }

      return [asset.path, asset.fileName, asset.directory, asset.kind]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / MEDIA_PER_PAGE));
  const requestedPage = parsePage(page);
  const currentPage = Math.min(requestedPage, totalPages);

  if (requestedPage !== currentPage) {
    redirect(buildPageLink(currentPage, searchQuery, filter));
  }

  const startIndex = (currentPage - 1) * MEDIA_PER_PAGE;
  const visibleAssets = filteredAssets.slice(startIndex, startIndex + MEDIA_PER_PAGE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const redirectTo = buildPageLink(currentPage, searchQuery, filter);
  const savedMessage = getSavedMessage(saved);

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Media Library</h1>
          <p>Upload, browse, and remove images used across posts and authors.</p>
        </div>
        <div className="admin-toolbar-actions">
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
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

      {savedMessage ? <p className="admin-success">{savedMessage}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <form action={uploadMediaAction} className="admin-form admin-card">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="admin-grid">
          <label>
            Target folder
            <select name="folder" defaultValue="posts">
              <option value="posts">Posts</option>
              <option value="authors">Authors</option>
              <option value="about">About</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="admin-grid-span-2">
            Upload image
            <input name="mediaFile" type="file" accept="image/*,.svg" required />
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="pill-button">
            Upload media
          </button>
        </div>
      </form>

      <form className="admin-search" method="get" action="/admin/media">
        <label htmlFor="admin-media-search" className="sr-only">
          Search media
        </label>
        <input
          id="admin-media-search"
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search by path or filename..."
        />
        <select name="folder" defaultValue={filter} className="admin-search-select">
          <option value="all">All folders</option>
          <option value="posts">Posts</option>
          <option value="authors">Authors</option>
          <option value="about">About</option>
          <option value="other">Other</option>
        </select>
        <button type="submit" className="admin-outline-button">
          Filter
        </button>
        {(searchQuery || filter !== "all") ? (
          <Link href="/admin/media" className="admin-outline-button">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="admin-list-summary">
        Showing {visibleAssets.length} of {filteredAssets.length} media files
        {searchQuery ? ` for "${searchQuery}"` : ""}.
      </p>

      {visibleAssets.length > 0 ? (
        <div className="admin-media-grid">
          {visibleAssets.map((asset) => (
            <article key={asset.path} className="admin-card admin-media-card">
              <div className="admin-media-preview">
                <img src={getRenderableImageSrc(asset.path)} alt={asset.fileName} loading="lazy" />
              </div>
              <div className="admin-media-meta">
                <p className="admin-media-name">{asset.fileName}</p>
                <p className="admin-media-path">
                  <code>{asset.path}</code>
                </p>
                <p className="admin-media-details">
                  {asset.kind} · {formatBytes(asset.sizeBytes)} · Updated {formatTimestamp(asset.modifiedAt)}
                </p>
              </div>
              <div className="admin-row-actions">
                <CopyTextButton value={asset.path} className="admin-outline-button" />
                <a
                  href={getRenderableImageSrc(asset.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-outline-button"
                >
                  Open
                </a>
                <form action={deleteMediaAction}>
                  <input type="hidden" name="filePath" value={asset.path} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <ConfirmSubmitButton
                    className="admin-link-button"
                    label="Delete"
                    confirmMessage={`Delete media file "${asset.fileName}"? This action cannot be undone.`}
                  />
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-card admin-empty-state">
          <p>No media files matched your filters.</p>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="pagination admin-pagination" aria-label="Media pagination">
          {currentPage > 1 ? (
            <Link className="pagination-arrow" href={buildPageLink(currentPage - 1, searchQuery, filter)}>
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
                  href={buildPageLink(pageNumber, searchQuery, filter)}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                >
                  {pageNumber}
                </Link>
              </li>
            ))}
          </ul>

          {currentPage < totalPages ? (
            <Link className="pagination-arrow" href={buildPageLink(currentPage + 1, searchQuery, filter)}>
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
