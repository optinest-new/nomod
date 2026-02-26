import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Newsletter } from "@/components/Newsletter";
import { PostCard } from "@/components/PostCard";
import { getAuthors } from "@/lib/authors";
import { getCmsContent } from "@/lib/cms";
import { getLatestPosts } from "@/lib/posts";
import { getSiteConfig } from "@/lib/site";

const POSTS_PER_PAGE = 9;

type LatestPageProps = {
  searchParams: Promise<{ page?: string }>;
};

function getPageLink(page: number): string {
  return page <= 1 ? "/latest" : `/latest?page=${page}`;
}

function parsePage(pageParam: string | undefined): number {
  const parsed = Number.parseInt(pageParam ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getPaginationState(pageParam: string | undefined, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / POSTS_PER_PAGE));
  const requestedPage = parsePage(pageParam);
  const currentPage = Math.min(requestedPage, totalPages);

  return {
    requestedPage,
    totalPages,
    currentPage,
  };
}

export async function generateMetadata({
  searchParams,
}: LatestPageProps): Promise<Metadata> {
  const [siteConfig, cmsContent, allPosts] = await Promise.all([
    getSiteConfig(),
    getCmsContent(),
    getLatestPosts(),
  ]);
  const params = await searchParams;
  const { currentPage } = getPaginationState(params.page, allPosts.length);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const pageLeadPost = allPosts[startIndex] ?? allPosts[0];

  return {
    title: cmsContent.latestPage.metaTitle,
    description: cmsContent.latestPage.metaDescription,
    alternates: {
      canonical: getPageLink(currentPage),
    },
    openGraph: pageLeadPost
      ? {
          title: `${siteConfig.name} | Latest Posts`,
          description: cmsContent.latestPage.metaDescription,
          type: "website",
          url: getPageLink(currentPage),
          images: [
            {
              url: pageLeadPost.coverImage,
              alt: pageLeadPost.coverAlt,
            },
          ],
        }
      : undefined,
    twitter: pageLeadPost
      ? {
          card: "summary_large_image",
          title: `${siteConfig.name} | Latest Posts`,
          description: cmsContent.latestPage.metaDescription,
          images: [pageLeadPost.coverImage],
        }
      : undefined,
  };
}

export default async function LatestPage({ searchParams }: LatestPageProps) {
  const [cmsContent, allPosts, authors] = await Promise.all([
    getCmsContent(),
    getLatestPosts(),
    getAuthors(),
  ]);
  const authorById = new Map(authors.map((author) => [author.id, author.name]));
  const params = await searchParams;
  const { requestedPage, totalPages, currentPage } = getPaginationState(
    params.page,
    allPosts.length,
  );

  if (requestedPage !== currentPage) {
    redirect(getPageLink(currentPage));
  }

  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = allPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <>
      <section className="container page-hero">
        <h1>{cmsContent.latestPage.heroTitle}</h1>
        <p>{cmsContent.latestPage.heroDescription}</p>
      </section>

      <section className="container section-gap" aria-labelledby="latest-grid-title">
        <h2 id="latest-grid-title" className="sr-only">
          All blog posts
        </h2>
        <div className="posts-grid posts-grid-latest">
          {paginatedPosts.map((post, index) => (
            <PostCard
              key={post.slug}
              post={post}
              priority={index < 3}
              authorName={authorById.get(post.authorId)}
            />
          ))}
        </div>

        {totalPages > 1 ? (
          <nav className="pagination" aria-label="Blog list pagination">
            {currentPage > 1 ? (
              <Link className="pagination-arrow" href={getPageLink(currentPage - 1)}>
                Previous
              </Link>
            ) : (
              <span className="pagination-arrow is-disabled" aria-disabled="true">
                Previous
              </span>
            )}

            <ul className="pagination-list">
              {pages.map((page) => (
                <li key={page}>
                  <Link
                    className={`pagination-link${page === currentPage ? " is-active" : ""}`}
                    href={getPageLink(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Link>
                </li>
              ))}
            </ul>

            {currentPage < totalPages ? (
              <Link className="pagination-arrow" href={getPageLink(currentPage + 1)}>
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

      <section className="container section-gap">
        <Newsletter sourcePath="/latest" />
      </section>
    </>
  );
}
