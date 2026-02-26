import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { Newsletter } from "@/components/Newsletter";
import { PostCard } from "@/components/PostCard";
import { getAuthors } from "@/lib/authors";
import { getCmsContent } from "@/lib/cms";
import { getRenderableImageSrc, shouldUnoptimizeImage } from "@/lib/media";
import { getFeaturedPosts, getLatestPosts, getRecommendedPosts } from "@/lib/posts";

export async function generateMetadata(): Promise<Metadata> {
  const [cmsContent, featuredPosts] = await Promise.all([getCmsContent(), getFeaturedPosts(1)]);
  const featuredPost = featuredPosts[0];
  const siteTitle = cmsContent.siteConfig.title;

  return {
    title: {
      absolute: siteTitle,
    },
    description: cmsContent.siteConfig.description,
    alternates: {
      canonical: "/",
    },
    openGraph: featuredPost
      ? {
          title: siteTitle,
          description: cmsContent.siteConfig.description,
          type: "website",
          url: "/",
          images: [
            {
              url: featuredPost.coverImage,
              alt: featuredPost.coverAlt,
            },
          ],
        }
      : undefined,
    twitter: featuredPost
      ? {
          card: "summary_large_image",
          title: siteTitle,
          description: cmsContent.siteConfig.description,
          images: [featuredPost.coverImage],
        }
      : undefined,
  };
}

export default async function HomePage() {
  const [cmsContent, featured, latest, recommended, authors] = await Promise.all([
    getCmsContent(),
    getFeaturedPosts(4),
    getLatestPosts(6),
    getRecommendedPosts(4),
    getAuthors(),
  ]);
  const { home, siteConfig } = cmsContent;
  const authorById = new Map(authors.map((author) => [author.id, author.name]));
  const featuredMainUnoptimized =
    featured[0] ? shouldUnoptimizeImage(featured[0].coverImage) : false;
  const featuredMainSrc =
    featured[0] ? getRenderableImageSrc(featured[0].coverImage) : "";

  const blogListSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: siteConfig.name,
    description: home.schemaDescription,
    blogPost: latest.slice(0, 4).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      url: `/latest/${post.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }}
      />

      <section className="hero container">
        <p className="hero-kicker">{home.heroKicker}</p>
        <h1>{home.heroTitle}</h1>
        <p>{home.heroDescription}</p>
        <div className="hero-actions">
          <Link className="pill-button" href={home.heroCtaHref}>
            {home.heroCtaLabel}
          </Link>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="container section-gap" aria-labelledby="featured-title">
          <div className="section-head">
            <h2 id="featured-title">{home.featuredHeading}</h2>
          </div>
          <div className="featured-layout">
            <article className="featured-main">
              <Link href={`/latest/${featured[0].slug}`}>
                <div className="featured-main-image-wrap">
                  <Image
                    src={featuredMainSrc}
                    alt={featured[0].coverAlt}
                    fill
                    className="post-card-image"
                    sizes="(max-width: 768px) 100vw, 55vw"
                    priority
                    unoptimized={featuredMainUnoptimized}
                  />
                </div>
              </Link>
              <div className="post-card-meta">
                <span>{featured[0].category}</span>
                <span aria-hidden="true">•</span>
                <span>{featured[0].readingTimeText}</span>
              </div>
              <h3 className="featured-main-title">
                <Link href={`/latest/${featured[0].slug}`}>{featured[0].title}</Link>
              </h3>
              <p>{featured[0].excerpt}</p>
              {authorById.get(featured[0].authorId) ? (
                <p className="post-card-author">
                  Written by <strong>{authorById.get(featured[0].authorId)}</strong>
                </p>
              ) : null}
            </article>

            <div className="featured-side">
              {featured.slice(1).map((post) => (
                <article key={post.slug} className="featured-side-item">
                  <Link href={`/latest/${post.slug}`}>
                    <div className="featured-side-image-wrap">
                      <Image
                        src={getRenderableImageSrc(post.coverImage)}
                        alt={post.coverAlt}
                        fill
                        className="post-card-image"
                        sizes="(max-width: 768px) 100vw, 24vw"
                        unoptimized={shouldUnoptimizeImage(post.coverImage)}
                      />
                    </div>
                  </Link>
                  <h3>
                    <Link href={`/latest/${post.slug}`}>{post.title}</Link>
                  </h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="container section-gap" aria-labelledby="latest-title">
        <div className="section-head">
          <h2 id="latest-title">{home.latestHeading}</h2>
          <Link href="/latest">{home.latestViewAllLabel}</Link>
        </div>
        <div className="posts-grid">
          {latest.map((post, index) => (
            <PostCard
              key={post.slug}
              post={post}
              priority={index < 2}
              authorName={authorById.get(post.authorId)}
            />
          ))}
        </div>
      </section>

      <section className="container section-gap" aria-labelledby="recommended-title">
        <div className="section-head">
          <h2 id="recommended-title">{home.recommendedHeading}</h2>
        </div>
        <div className="recommended-row">
          {recommended.map((post) => (
            <article key={post.slug} className="recommended-item">
              <Link href={`/latest/${post.slug}`}>
                <div className="recommended-image-wrap">
                  <Image
                    src={getRenderableImageSrc(post.coverImage)}
                    alt={post.coverAlt}
                    fill
                    className="post-card-image"
                    sizes="(max-width: 768px) 80vw, 22vw"
                    unoptimized={shouldUnoptimizeImage(post.coverImage)}
                  />
                </div>
              </Link>
              <h3>
                <Link href={`/latest/${post.slug}`}>{post.title}</Link>
              </h3>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-gap">
        <Newsletter sourcePath="/" />
      </section>
    </>
  );
}
