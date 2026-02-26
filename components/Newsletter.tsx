import { NewsletterSubmitForm } from "@/components/NewsletterSubmitForm";
import { getCmsContent } from "@/lib/cms";

type NewsletterProps = {
  sourcePath?: string;
};

export async function Newsletter({ sourcePath = "/" }: NewsletterProps) {
  const { newsletter } = await getCmsContent();

  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title">{newsletter.title}</h2>
      <p>{newsletter.description}</p>
      <NewsletterSubmitForm
        sourcePath={sourcePath}
        emailPlaceholder={newsletter.emailPlaceholder}
        buttonLabel={newsletter.buttonLabel}
      />
    </section>
  );
}
