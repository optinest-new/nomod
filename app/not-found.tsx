import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 | Page Not Found",
  description: "The page you requested could not be found.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFoundPage() {
  return (
    <section className="container page-hero not-found-shell">
      <p className="hero-kicker">Error 404</p>
      <h1>Page Not Found</h1>
      <p>
        The page you are looking for may have moved, been deleted, or never existed.
      </p>

      <div className="not-found-card">
        <p className="not-found-code">404</p>
        <p>
          Try heading back to the homepage or browse the latest articles.
        </p>
        <div className="not-found-actions">
          <Link href="/" className="pill-button">
            Back to home
          </Link>
          <Link href="/latest" className="admin-outline-button">
            Browse latest posts
          </Link>
        </div>
      </div>
    </section>
  );
}

