import Image from "next/image";
import type { Metadata } from "next";

import { Newsletter } from "@/components/Newsletter";
import { getCmsContent } from "@/lib/cms";

export async function generateMetadata(): Promise<Metadata> {
  const cmsContent = await getCmsContent();

  return {
    title: cmsContent.aboutPage.metaTitle,
    description: cmsContent.aboutPage.metaDescription,
    alternates: {
      canonical: "/about",
    },
  };
}

export default async function AboutPage() {
  const cmsContent = await getCmsContent();

  return (
    <>
      <section className="container page-hero about-hero">
        <h1>{cmsContent.aboutPage.heroTitle}</h1>
        <p>{cmsContent.aboutPage.heroDescription}</p>
      </section>

      <article className="container about-content" itemScope itemType="https://schema.org/AboutPage">
        <figure>
          <div className="about-image-wrap about-image-large">
            <Image
              src="/images/about/team-collaboration.svg"
              alt="Optinest team collaborating on web design and development strategy"
              fill
              className="post-card-image"
              sizes="(max-width: 768px) 100vw, 80vw"
              priority
            />
          </div>
          <figcaption>{cmsContent.aboutPage.teamCaption}</figcaption>
        </figure>

        <p>{cmsContent.aboutPage.missionParagraph}</p>

        <blockquote>{cmsContent.aboutPage.valueQuote}</blockquote>

        <p>{cmsContent.aboutPage.experienceParagraph}</p>

        <figure>
          <div className="about-image-wrap about-image-feature">
            <Image
              src="/images/about/editorial-planning.svg"
              alt="Team planning AI and SEO-focused web content in a modern workspace"
              fill
              className="post-card-image"
              sizes="100vw"
            />
          </div>
          <figcaption>{cmsContent.aboutPage.planningCaption}</figcaption>
        </figure>

        <p>{cmsContent.aboutPage.closingParagraph}</p>
      </article>

      <section className="container section-gap" id="contact">
        <Newsletter sourcePath="/about" />
      </section>
    </>
  );
}
