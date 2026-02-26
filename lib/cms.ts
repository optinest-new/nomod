import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

export type CmsLinkItem = {
  label: string;
  href: string;
  external?: boolean;
};

export type CmsSocialLinkItem = {
  platform: string;
  href: string;
};

export type SiteConfig = {
  name: string;
  title: string;
  description: string;
  url: string;
  locale: string;
};

export type HeaderContent = {
  homeAriaLabel: string;
  searchLabel: string;
  contactLabel: string;
  contactHref: string;
  menuLinks: CmsLinkItem[];
};

export type FooterContent = {
  brand: string;
  copy: string;
  pagesHeading: string;
  resourcesHeading: string;
  socialHeading: string;
  pagesLinks: CmsLinkItem[];
  resourceLinks: CmsLinkItem[];
  socialLinks: CmsSocialLinkItem[];
  copyrightText: string;
  backToTopLabel: string;
};

export type HomePageContent = {
  heroKicker: string;
  heroTitle: string;
  heroDescription: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  featuredHeading: string;
  latestHeading: string;
  latestViewAllLabel: string;
  recommendedHeading: string;
  schemaDescription: string;
};

export type LatestPageContent = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
};

export type AuthorsPageContent = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
};

export type AboutPageContent = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  missionParagraph: string;
  valueQuote: string;
  experienceParagraph: string;
  closingParagraph: string;
  teamCaption: string;
  planningCaption: string;
};

export type NewsletterContent = {
  title: string;
  description: string;
  emailPlaceholder: string;
  buttonLabel: string;
};

export type CmsContent = {
  siteConfig: SiteConfig;
  header: HeaderContent;
  footer: FooterContent;
  home: HomePageContent;
  latestPage: LatestPageContent;
  authorsPage: AuthorsPageContent;
  aboutPage: AboutPageContent;
  newsletter: NewsletterContent;
};

type CmsContentRow = {
  content: unknown;
};

export const defaultCmsContent: CmsContent = {
  siteConfig: {
    name: "Optinest",
    title: "Optinest | Web Design, Web Development, AI and SEO",
    description:
      "Optinest publishes practical guides on web design, web development, AI, and SEO to help teams build faster, rank better, and convert more.",
    url: "http://localhost:3000",
    locale: "en_US",
  },
  header: {
    homeAriaLabel: "Optinest Home",
    searchLabel: "Search",
    contactLabel: "Get in touch",
    contactHref: "/about#contact",
    menuLinks: [
      { href: "/", label: "Home" },
      { href: "/latest", label: "Latest" },
      { href: "/authors", label: "Authors" },
      { href: "/about", label: "About" },
    ],
  },
  footer: {
    brand: "Optinest",
    copy:
      "Optinest is a focused publication for teams building modern websites. We share practical web design, web development, AI, and SEO insights you can apply right away.",
    pagesHeading: "Pages",
    resourcesHeading: "Topics",
    socialHeading: "Social",
    pagesLinks: [
      { href: "/", label: "Home" },
      { href: "/latest", label: "Latest" },
      { href: "/authors", label: "Authors" },
      { href: "/about", label: "About" },
    ],
    resourceLinks: [
      { href: "/latest", label: "Web Design" },
      { href: "/latest", label: "Web Development" },
      { href: "/latest", label: "AI" },
      { href: "/latest", label: "SEO" },
    ],
    socialLinks: [
      { platform: "facebook", href: "https://facebook.com" },
      { platform: "x", href: "https://x.com" },
      { platform: "instagram", href: "https://instagram.com" },
      { platform: "tiktok", href: "https://tiktok.com" },
    ],
    copyrightText: "2026 © Optinest. Built for modern digital growth.",
    backToTopLabel: "Back to top",
  },
  home: {
    heroKicker: "Web Design, Development, AI, and SEO",
    heroTitle: "Practical Strategies for Web Design, Development, AI, and SEO",
    heroDescription:
      "Explore implementation-focused guides, real workflows, and growth playbooks for building better websites and ranking stronger in search.",
    heroCtaLabel: "Explore latest articles",
    heroCtaHref: "/latest",
    featuredHeading: "Featured",
    latestHeading: "Latest",
    latestViewAllLabel: "View all",
    recommendedHeading: "Recommended",
    schemaDescription:
      "Actionable web design, web development, AI, and SEO insights for modern teams.",
  },
  latestPage: {
    metaTitle: "Latest Web Design, Development, AI, and SEO Posts",
    metaDescription:
      "Browse the newest Optinest articles on web design, web development, AI, and SEO, with practical frameworks and implementation details.",
    heroTitle: "Latest Posts on Web Design, Development, AI, and SEO",
    heroDescription:
      "Read the newest guides, case-based lessons, and practical breakdowns to improve website quality, performance, and organic growth.",
  },
  authorsPage: {
    metaTitle: "Authors",
    metaDescription:
      "Meet the Optinest contributors covering web design, web development, AI, and SEO with practical, execution-ready advice.",
    heroTitle: "Authors",
    heroDescription:
      "Meet the specialists behind our web design, web development, AI, and SEO content.",
  },
  aboutPage: {
    metaTitle: "About Optinest",
    metaDescription:
      "Learn about Optinest, a publication dedicated to web design, web development, AI, and SEO best practices.",
    heroTitle: "About Optinest",
    heroDescription:
      "Optinest is built for teams that want practical guidance on web design, web development, AI, and SEO without the noise.",
    missionParagraph:
      "Our mission is to publish practical, technically sound insights that help teams ship better digital experiences and grow sustainably through search.",
    valueQuote:
      "We value clarity over hype, execution over theory, and long-term growth over shortcuts.",
    experienceParagraph:
      "Every article is designed to be useful in real production work, from component-level design decisions to front-end performance and SEO architecture.",
    closingParagraph:
      "As the web evolves, we continue to share tested workflows, modern frameworks, and actionable playbooks that connect design quality with measurable results.",
    teamCaption: "The Optinest team and workspace.",
    planningCaption: "Planning practical content for modern web teams.",
  },
  newsletter: {
    title: "Get Weekly Web Design, Development, AI, and SEO Insights",
    description:
      "Every week, we send practical strategies, implementation tips, and optimization ideas you can apply to your next release.",
    emailPlaceholder: "Your work email",
    buttonLabel: "Subscribe",
  },
};

function sanitizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function sanitizeOptionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeUrl(value: unknown, fallback: string): string {
  const candidate = sanitizeText(value, fallback);

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function sanitizeLinkItem(value: unknown): CmsLinkItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CmsLinkItem>;
  const label = sanitizeOptionalText(record.label);
  const href = sanitizeOptionalText(record.href);

  if (!label || !href) {
    return null;
  }

  const normalized: CmsLinkItem = { label, href };
  if (record.external === true) {
    normalized.external = true;
  }

  return normalized;
}

function sanitizeLinks(value: unknown, fallback: CmsLinkItem[]): CmsLinkItem[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const links = value
    .map((entry) => sanitizeLinkItem(entry))
    .filter((entry): entry is CmsLinkItem => Boolean(entry));

  return links;
}

function sanitizeSocialLinkItem(value: unknown): CmsSocialLinkItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CmsSocialLinkItem>;
  const platform = sanitizeOptionalText(record.platform).toLowerCase();
  const href = sanitizeOptionalText(record.href);

  if (!platform || !href) {
    return null;
  }

  return { platform, href };
}

function sanitizeSocialLinks(value: unknown, fallback: CmsSocialLinkItem[]): CmsSocialLinkItem[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const links = value
    .map((entry) => sanitizeSocialLinkItem(entry))
    .filter((entry): entry is CmsSocialLinkItem => Boolean(entry));

  return links;
}

function sanitizeCmsContent(value: unknown): CmsContent {
  if (!value || typeof value !== "object") {
    return defaultCmsContent;
  }

  const record = value as Partial<CmsContent>;
  const siteConfigInput = record.siteConfig;
  const headerInput = record.header;
  const footerInput = record.footer;
  const homeInput = record.home;
  const latestPageInput = record.latestPage;
  const authorsPageInput = record.authorsPage;
  const aboutPageInput = record.aboutPage;
  const newsletterInput = record.newsletter;

  return {
    siteConfig: {
      name: sanitizeText(siteConfigInput?.name, defaultCmsContent.siteConfig.name),
      title: sanitizeText(siteConfigInput?.title, defaultCmsContent.siteConfig.title),
      description: sanitizeText(
        siteConfigInput?.description,
        defaultCmsContent.siteConfig.description,
      ),
      url: sanitizeUrl(siteConfigInput?.url, defaultCmsContent.siteConfig.url),
      locale: sanitizeText(siteConfigInput?.locale, defaultCmsContent.siteConfig.locale),
    },
    header: {
      homeAriaLabel: sanitizeText(
        headerInput?.homeAriaLabel,
        defaultCmsContent.header.homeAriaLabel,
      ),
      searchLabel: sanitizeText(headerInput?.searchLabel, defaultCmsContent.header.searchLabel),
      contactLabel: sanitizeText(headerInput?.contactLabel, defaultCmsContent.header.contactLabel),
      contactHref: sanitizeText(headerInput?.contactHref, defaultCmsContent.header.contactHref),
      menuLinks: sanitizeLinks(headerInput?.menuLinks, defaultCmsContent.header.menuLinks),
    },
    footer: {
      brand: sanitizeText(footerInput?.brand, defaultCmsContent.footer.brand),
      copy: sanitizeText(footerInput?.copy, defaultCmsContent.footer.copy),
      pagesHeading: sanitizeText(
        footerInput?.pagesHeading,
        defaultCmsContent.footer.pagesHeading,
      ),
      resourcesHeading: sanitizeText(
        footerInput?.resourcesHeading,
        defaultCmsContent.footer.resourcesHeading,
      ),
      socialHeading: sanitizeText(
        footerInput?.socialHeading,
        defaultCmsContent.footer.socialHeading,
      ),
      pagesLinks: sanitizeLinks(footerInput?.pagesLinks, defaultCmsContent.footer.pagesLinks),
      resourceLinks: sanitizeLinks(
        footerInput?.resourceLinks,
        defaultCmsContent.footer.resourceLinks,
      ),
      socialLinks: sanitizeSocialLinks(
        footerInput?.socialLinks,
        defaultCmsContent.footer.socialLinks,
      ),
      copyrightText: sanitizeText(
        footerInput?.copyrightText,
        defaultCmsContent.footer.copyrightText,
      ),
      backToTopLabel: sanitizeText(
        footerInput?.backToTopLabel,
        defaultCmsContent.footer.backToTopLabel,
      ),
    },
    home: {
      heroKicker: sanitizeText(homeInput?.heroKicker, defaultCmsContent.home.heroKicker),
      heroTitle: sanitizeText(homeInput?.heroTitle, defaultCmsContent.home.heroTitle),
      heroDescription: sanitizeText(
        homeInput?.heroDescription,
        defaultCmsContent.home.heroDescription,
      ),
      heroCtaLabel: sanitizeText(homeInput?.heroCtaLabel, defaultCmsContent.home.heroCtaLabel),
      heroCtaHref: sanitizeText(homeInput?.heroCtaHref, defaultCmsContent.home.heroCtaHref),
      featuredHeading: sanitizeText(
        homeInput?.featuredHeading,
        defaultCmsContent.home.featuredHeading,
      ),
      latestHeading: sanitizeText(homeInput?.latestHeading, defaultCmsContent.home.latestHeading),
      latestViewAllLabel: sanitizeText(
        homeInput?.latestViewAllLabel,
        defaultCmsContent.home.latestViewAllLabel,
      ),
      recommendedHeading: sanitizeText(
        homeInput?.recommendedHeading,
        defaultCmsContent.home.recommendedHeading,
      ),
      schemaDescription: sanitizeText(
        homeInput?.schemaDescription,
        defaultCmsContent.home.schemaDescription,
      ),
    },
    latestPage: {
      metaTitle: sanitizeText(
        latestPageInput?.metaTitle,
        defaultCmsContent.latestPage.metaTitle,
      ),
      metaDescription: sanitizeText(
        latestPageInput?.metaDescription,
        defaultCmsContent.latestPage.metaDescription,
      ),
      heroTitle: sanitizeText(
        latestPageInput?.heroTitle,
        defaultCmsContent.latestPage.heroTitle,
      ),
      heroDescription: sanitizeText(
        latestPageInput?.heroDescription,
        defaultCmsContent.latestPage.heroDescription,
      ),
    },
    authorsPage: {
      metaTitle: sanitizeText(
        authorsPageInput?.metaTitle,
        defaultCmsContent.authorsPage.metaTitle,
      ),
      metaDescription: sanitizeText(
        authorsPageInput?.metaDescription,
        defaultCmsContent.authorsPage.metaDescription,
      ),
      heroTitle: sanitizeText(
        authorsPageInput?.heroTitle,
        defaultCmsContent.authorsPage.heroTitle,
      ),
      heroDescription: sanitizeText(
        authorsPageInput?.heroDescription,
        defaultCmsContent.authorsPage.heroDescription,
      ),
    },
    aboutPage: {
      metaTitle: sanitizeText(
        aboutPageInput?.metaTitle,
        defaultCmsContent.aboutPage.metaTitle,
      ),
      metaDescription: sanitizeText(
        aboutPageInput?.metaDescription,
        defaultCmsContent.aboutPage.metaDescription,
      ),
      heroTitle: sanitizeText(
        aboutPageInput?.heroTitle,
        defaultCmsContent.aboutPage.heroTitle,
      ),
      heroDescription: sanitizeText(
        aboutPageInput?.heroDescription,
        defaultCmsContent.aboutPage.heroDescription,
      ),
      missionParagraph: sanitizeText(
        aboutPageInput?.missionParagraph,
        defaultCmsContent.aboutPage.missionParagraph,
      ),
      valueQuote: sanitizeText(
        aboutPageInput?.valueQuote,
        defaultCmsContent.aboutPage.valueQuote,
      ),
      experienceParagraph: sanitizeText(
        aboutPageInput?.experienceParagraph,
        defaultCmsContent.aboutPage.experienceParagraph,
      ),
      closingParagraph: sanitizeText(
        aboutPageInput?.closingParagraph,
        defaultCmsContent.aboutPage.closingParagraph,
      ),
      teamCaption: sanitizeText(
        aboutPageInput?.teamCaption,
        defaultCmsContent.aboutPage.teamCaption,
      ),
      planningCaption: sanitizeText(
        aboutPageInput?.planningCaption,
        defaultCmsContent.aboutPage.planningCaption,
      ),
    },
    newsletter: {
      title: sanitizeText(newsletterInput?.title, defaultCmsContent.newsletter.title),
      description: sanitizeText(
        newsletterInput?.description,
        defaultCmsContent.newsletter.description,
      ),
      emailPlaceholder: sanitizeText(
        newsletterInput?.emailPlaceholder,
        defaultCmsContent.newsletter.emailPlaceholder,
      ),
      buttonLabel: sanitizeText(
        newsletterInput?.buttonLabel,
        defaultCmsContent.newsletter.buttonLabel,
      ),
    },
  };
}

export async function getCmsContent(): Promise<CmsContent> {
  try {
    const response = await supabaseRequest("/rest/v1/cms_content", {
      query: {
        select: "content",
        id: "eq.1",
        limit: "1",
      },
    });

    const rows = await readSupabaseJson<CmsContentRow[]>(response);
    const content = rows[0]?.content;
    return content ? sanitizeCmsContent(content) : defaultCmsContent;
  } catch {
    return defaultCmsContent;
  }
}

export async function saveCmsContent(content: CmsContent): Promise<void> {
  const sanitized = sanitizeCmsContent(content);

  const response = await supabaseRequest("/rest/v1/cms_content", {
    method: "POST",
    query: {
      on_conflict: "id",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [
      {
        id: 1,
        content: sanitized,
        updated_at: new Date().toISOString(),
      },
    ],
  });

  await readSupabaseJson(response);
}

export async function deleteCmsContent(): Promise<void> {
  const response = await supabaseRequest("/rest/v1/cms_content", {
    method: "DELETE",
    query: {
      id: "eq.1",
    },
  });

  await readSupabaseJson(response);
}
