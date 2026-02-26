import Image from "next/image";
import Link from "next/link";

import { getRenderableImageSrc, shouldUnoptimizeImage } from "@/lib/media";
import { Post } from "@/lib/types";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PostCardProps = {
  post: Post;
  priority?: boolean;
  authorName?: string;
};

export function PostCard({ post, priority = false, authorName }: PostCardProps) {
  const unoptimized = shouldUnoptimizeImage(post.coverImage);
  const imageSrc = getRenderableImageSrc(post.coverImage);

  return (
    <article className="post-card">
      <Link href={`/latest/${post.slug}`} className="post-card-image-link">
        <div className="post-card-image-wrap">
          <Image
            src={imageSrc}
            alt={post.coverAlt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="post-card-image"
            priority={priority}
            unoptimized={unoptimized}
          />
        </div>
      </Link>
      <div className="post-card-meta">
        <span>{post.category}</span>
        <span aria-hidden="true">•</span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </div>
      <h3 className="post-card-title">
        <Link href={`/latest/${post.slug}`}>{post.title}</Link>
      </h3>
      <p className="post-card-excerpt">{post.excerpt}</p>
      {authorName ? (
        <p className="post-card-author">
          Written by <strong>{authorName}</strong>
        </p>
      ) : null}
    </article>
  );
}
