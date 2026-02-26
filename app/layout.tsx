import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { Suspense } from "react";

import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { PublicNavigationProgress } from "@/components/PublicNavigationProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCmsContent } from "@/lib/cms";
import { getFeaturedPosts } from "@/lib/posts";
import { getSiteConfig } from "@/lib/site";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const themeInitScript = `
(() => {
  try {
    const key = "nomod-theme";
    const stored = localStorage.getItem(key);
    const theme = stored === "dark" || stored === "light" ? stored : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export async function generateMetadata(): Promise<Metadata> {
  const [siteConfig, featuredPosts] = await Promise.all([
    getSiteConfig(),
    getFeaturedPosts(1),
  ]);
  const featuredPostForMeta = featuredPosts[0];
  const defaultOgImage = featuredPostForMeta?.coverImage ?? "/images/posts/morning-routine.svg";
  const defaultOgAlt = featuredPostForMeta?.coverAlt ?? "Nomod featured post image";

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.title,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: siteConfig.url,
      title: siteConfig.title,
      description: siteConfig.description,
      siteName: siteConfig.name,
      images: [
        {
          url: defaultOgImage,
          alt: defaultOgAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.title,
      description: siteConfig.description,
      images: [defaultOgImage],
    },
    category: "blog",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cmsContent = await getCmsContent();

  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${manrope.variable} ${playfair.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Suspense fallback={null}>
          <PublicNavigationProgress />
        </Suspense>
        <div className="site-shell" id="top">
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          <SiteHeader siteName={cmsContent.siteConfig.name} content={cmsContent.header} />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
