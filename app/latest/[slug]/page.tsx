import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Newsletter } from "@/components/Newsletter";
import { AdminPostToolbar } from "@/components/AdminPostToolbar";
import { PostCard } from "@/components/PostCard";
import { PostTableOfContents } from "@/components/PostTableOfContents";
import type { TocHeading } from "@/components/PostTableOfContents";
import { getAuthorById, getAuthors } from "@/lib/authors";
import { getRenderableImageSrc, shouldUnoptimizeImage } from "@/lib/media";
import { getAllPosts, getPostBySlug, getRecommendedPosts } from "@/lib/posts";
import { formatDate, slugify } from "@/lib/utils";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

type ExtractedHeading = TocHeading & {
  offset: number;
};

export async function generateStaticParams() {
  return (await getAllPosts()).map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found",
    };
  }

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    alternates: {
      canonical: `/latest/${post.slug}`,
    },
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      type: "article",
      publishedTime: post.publishAt ?? post.date,
      images: [
        {
          url: post.coverImage,
          alt: post.coverAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      images: [post.coverImage],
    },
  };
}

function extractHeadings(markdown: string): ExtractedHeading[] {
  const headingRegex = /^##\s+(.+)$/gm;
  const seenIds = new Map<string, number>();
  const headings: ExtractedHeading[] = [];

  for (const match of markdown.matchAll(headingRegex)) {
    const rawText = match[1];
    const offset = match.index;
    if (!rawText || typeof offset !== "number") {
      continue;
    }

    const text = rawText.trim();
    const baseId = slugify(text) || "section";
    const duplicateCount = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, duplicateCount + 1);

    const id = duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`;
    headings.push({ id, text, offset });
  }

  return headings;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => extractText(item)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children ?? "");
  }

  return "";
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const [author, relatedPosts, authors] = await Promise.all([
    getAuthorById(post.authorId),
    getRecommendedPosts(6),
    getAuthors(),
  ]);
  const authorById = new Map(authors.map((item) => [item.id, item.name]));
  const headings = extractHeadings(post.content);
  const filteredRelatedPosts = relatedPosts.filter((item) => item.slug !== post.slug);
  const headingIdByOffset = new Map(headings.map((heading) => [heading.offset, heading.id]));

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    articleSection: post.category,
    timeRequired: `PT${post.readingTimeMinutes}M`,
    image: post.coverImage,
    author: author
      ? {
          "@type": "Person",
          name: author.name,
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="container post-layout">
        <AdminPostToolbar slug={post.slug} />

        <header className="post-header">
          <p className="eyebrow">{post.category}</p>
          <h1>{post.title}</h1>
          <p className="post-subtitle">{post.excerpt}</p>
          <div className="post-meta-line">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">•</span>
            <span>{post.readingTimeText}</span>
            {author ? (
              <>
                <span aria-hidden="true">•</span>
                <span>{author.name}</span>
              </>
            ) : null}
          </div>
        </header>

        <div className="post-cover-wrap">
          <Image
            src={getRenderableImageSrc(post.coverImage)}
            alt={post.coverAlt}
            fill
            className="post-card-image"
            sizes="(max-width: 920px) 100vw, 920px"
            priority
            unoptimized={shouldUnoptimizeImage(post.coverImage)}
          />
        </div>

        <div className={`post-body-layout${headings.length === 0 ? " no-toc" : ""}`}>
          {headings.length > 0 ? <PostTableOfContents headings={headings} /> : null}

          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children, node }) => {
                  const offset = node?.position?.start?.offset;
                  const fallbackId = slugify(extractText(children)) || "section";
                  const id =
                    typeof offset === "number"
                      ? (headingIdByOffset.get(offset) ?? fallbackId)
                      : fallbackId;

                  return <h2 id={id}>{children}</h2>;
                },
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </div>
      </article>

      <section className="container section-gap" aria-labelledby="related-posts-title">
        <div className="section-head">
          <h2 id="related-posts-title">Related</h2>
        </div>
        <div className="posts-grid">
          {filteredRelatedPosts.slice(0, 3).map((item) => (
            <PostCard key={item.slug} post={item} authorName={authorById.get(item.authorId)} />
          ))}
        </div>
        <div className="post-cta-center">
          <Link className="pill-button" href="/latest">
            Browse all posts
          </Link>
        </div>
      </section>

      <section className="container section-gap">
        <Newsletter sourcePath={`/latest/${post.slug}`} />
      </section>
    </>
  );
}
