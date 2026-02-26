import Image from "next/image";

import { getRenderableImageSrc, shouldUnoptimizeImage } from "@/lib/media";
import { Author } from "@/lib/types";

type AuthorCardProps = {
  author: Author;
  count: number;
};

export function AuthorCard({ author, count }: AuthorCardProps) {
  const avatarSrc = getRenderableImageSrc(author.avatar);
  const avatarUnoptimized = shouldUnoptimizeImage(author.avatar);

  return (
    <article className="author-card">
      <Image
        src={avatarSrc}
        alt={`Portrait of ${author.name}`}
        width={84}
        height={84}
        className="author-avatar"
        unoptimized={avatarUnoptimized}
      />
      <h3>
        {author.name} <span>({count})</span>
      </h3>
      <p>{author.role}</p>
      <p>{author.shortBio}</p>
      {author.xUrl ? (
        <a
          className="author-social-link"
          href={author.xUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${author.name} on X`}
        >
          X.com
        </a>
      ) : null}
    </article>
  );
}
