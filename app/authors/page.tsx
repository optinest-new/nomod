import type { Metadata } from "next";

import { AuthorCard } from "@/components/AuthorCard";
import { Newsletter } from "@/components/Newsletter";
import { getAuthors } from "@/lib/authors";
import { getCmsContent } from "@/lib/cms";
import { getPostsByAuthor } from "@/lib/posts";

export async function generateMetadata(): Promise<Metadata> {
  const cmsContent = await getCmsContent();

  return {
    title: cmsContent.authorsPage.metaTitle,
    description: cmsContent.authorsPage.metaDescription,
    alternates: {
      canonical: "/authors",
    },
  };
}

export default async function AuthorsPage() {
  const [cmsContent, authors] = await Promise.all([getCmsContent(), getAuthors()]);
  const counts = new Map(
    await Promise.all(
      authors.map(async (author) => [author.id, (await getPostsByAuthor(author.id)).length] as const),
    ),
  );

  return (
    <>
      <section className="container page-hero">
        <h1>{cmsContent.authorsPage.heroTitle}</h1>
        <p>{cmsContent.authorsPage.heroDescription}</p>
      </section>

      <section className="container section-gap" aria-labelledby="authors-list-title">
        <h2 id="authors-list-title" className="sr-only">
          Author profiles
        </h2>
        <div className="authors-grid">
          {authors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              count={counts.get(author.id) ?? 0}
            />
          ))}
        </div>
      </section>

      <section className="container section-gap">
        <Newsletter sourcePath="/authors" />
      </section>
    </>
  );
}
