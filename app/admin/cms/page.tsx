import Link from "next/link";
import type { Metadata } from "next";

import { resetCmsContentAction, updateCmsContentAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  getCmsContent,
  type CmsLinkItem,
  type CmsSocialLinkItem,
} from "@/lib/cms";
import { requireAdminSession } from "@/lib/admin";

export const metadata: Metadata = {
  title: "CMS Settings",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminCmsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function linksToRows(links: CmsLinkItem[]): string {
  return links
    .map((link) => {
      const externalFlag = link.external ? "|external" : "";
      return `${link.label}|${link.href}${externalFlag}`;
    })
    .join("\n");
}

function socialToRows(links: CmsSocialLinkItem[]): string {
  return links.map((item) => `${item.platform}|${item.href}`).join("\n");
}

function getSavedMessage(saved: string | undefined): string | null {
  switch (saved) {
    case "cms-updated":
      return "CMS settings updated.";
    case "cms-reset":
      return "CMS settings reset to defaults.";
    default:
      return null;
  }
}

export default async function AdminCmsPage({ searchParams }: AdminCmsPageProps) {
  const user = await requireAdminSession();
  const { error, saved } = await searchParams;

  const cms = await getCmsContent();
  const savedMessage = getSavedMessage(saved);

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>CMS Settings</h1>
          <p>Manage global settings and per-page content from one place.</p>
        </div>
        <div className="admin-toolbar-actions">
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-outline-button">
              Users
            </Link>
          ) : null}
          <Link href="/admin/media" className="admin-outline-button">
            Media
          </Link>
          <Link href="/admin/newsletter" className="admin-outline-button">
            Newsletter
          </Link>
          <Link href="/admin/authors" className="admin-outline-button">
            Authors CMS
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
          <form action={resetCmsContentAction}>
            <ConfirmSubmitButton
              className="admin-outline-button admin-danger-button"
              label="Reset to defaults"
              confirmMessage="Reset CMS settings to defaults? This removes your custom site config and content overrides."
            />
          </form>
        </div>
      </div>

      {savedMessage ? <p className="admin-success">{savedMessage}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <form action={updateCmsContentAction} className="admin-form admin-card admin-cms-form">
        <div className="admin-cms-layout">
          <aside className="admin-cms-sidebar" aria-label="CMS navigation">
            <p className="admin-cms-sidebar-title">Global</p>
            <a href="#cms-site-config">Site config</a>
            <a href="#cms-header">Header</a>
            <a href="#cms-newsletter">Newsletter</a>
            <a href="#cms-footer">Footer</a>

            <p className="admin-cms-sidebar-title">Pages</p>
            <a href="#cms-page-home">Home page</a>
            <a href="#cms-page-latest">Latest page</a>
            <a href="#cms-page-authors">Authors page</a>
            <a href="#cms-page-about">About page</a>
            <a href="/admin/authors">Author profiles CMS</a>

            <button type="submit" className="pill-button admin-cms-save-button">
              Save CMS settings
            </button>
          </aside>

          <div className="admin-cms-content">
            <section id="cms-site-config" className="admin-cms-section">
              <h2>Site Config</h2>
              <div className="admin-grid">
                <label>
                  Site name
                  <input name="siteName" defaultValue={cms.siteConfig.name} required />
                </label>
                <label>
                  Locale
                  <input name="siteLocale" defaultValue={cms.siteConfig.locale} required />
                </label>
                <label className="admin-grid-span-2">
                  Site title
                  <input name="siteTitle" defaultValue={cms.siteConfig.title} required />
                </label>
                <label className="admin-grid-span-2">
                  Site description
                  <textarea
                    name="siteDescription"
                    rows={3}
                    defaultValue={cms.siteConfig.description}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Canonical site URL
                  <input name="siteUrl" type="url" defaultValue={cms.siteConfig.url} required />
                </label>
              </div>
            </section>

            <section id="cms-header" className="admin-cms-section">
              <h2>Header</h2>
              <div className="admin-grid">
                <label>
                  Home aria label
                  <input name="headerHomeAriaLabel" defaultValue={cms.header.homeAriaLabel} required />
                </label>
                <label>
                  Search label
                  <input name="headerSearchLabel" defaultValue={cms.header.searchLabel} required />
                </label>
                <label>
                  Contact label
                  <input name="headerContactLabel" defaultValue={cms.header.contactLabel} required />
                </label>
                <label>
                  Contact href
                  <input name="headerContactHref" defaultValue={cms.header.contactHref} required />
                </label>
                <label className="admin-grid-span-2">
                  Menu links (one per line)
                  <textarea name="menuLinksRows" rows={6} defaultValue={linksToRows(cms.header.menuLinks)} />
                </label>
              </div>
              <p className="admin-alert">
                Line format: <code>Label|Href</code> or <code>Label|Href|external</code>.
              </p>
            </section>

            <section id="cms-page-home" className="admin-cms-section">
              <h2>Home Page</h2>
              <div className="admin-grid">
                <label>
                  Hero kicker
                  <input name="homeHeroKicker" defaultValue={cms.home.heroKicker} required />
                </label>
                <label>
                  Hero CTA label
                  <input name="homeHeroCtaLabel" defaultValue={cms.home.heroCtaLabel} required />
                </label>
                <label>
                  Hero CTA href
                  <input name="homeHeroCtaHref" defaultValue={cms.home.heroCtaHref} required />
                </label>
                <label>
                  Featured heading
                  <input name="homeFeaturedHeading" defaultValue={cms.home.featuredHeading} required />
                </label>
                <label>
                  Latest heading
                  <input name="homeLatestHeading" defaultValue={cms.home.latestHeading} required />
                </label>
                <label>
                  Latest link label
                  <input name="homeLatestViewAllLabel" defaultValue={cms.home.latestViewAllLabel} required />
                </label>
                <label>
                  Recommended heading
                  <input name="homeRecommendedHeading" defaultValue={cms.home.recommendedHeading} required />
                </label>
                <label className="admin-grid-span-2">
                  Hero title
                  <input name="homeHeroTitle" defaultValue={cms.home.heroTitle} required />
                </label>
                <label className="admin-grid-span-2">
                  Hero description
                  <textarea
                    name="homeHeroDescription"
                    rows={3}
                    defaultValue={cms.home.heroDescription}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Homepage schema description
                  <textarea
                    name="homeSchemaDescription"
                    rows={2}
                    defaultValue={cms.home.schemaDescription}
                    required
                  />
                </label>
              </div>
            </section>

            <section id="cms-page-latest" className="admin-cms-section">
              <h2>Latest Page</h2>
              <div className="admin-grid">
                <label>
                  Meta title
                  <input name="latestMetaTitle" defaultValue={cms.latestPage.metaTitle} required />
                </label>
                <label>
                  Hero title
                  <input name="latestHeroTitle" defaultValue={cms.latestPage.heroTitle} required />
                </label>
                <label className="admin-grid-span-2">
                  Meta description
                  <textarea
                    name="latestMetaDescription"
                    rows={2}
                    defaultValue={cms.latestPage.metaDescription}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Hero description
                  <textarea
                    name="latestHeroDescription"
                    rows={3}
                    defaultValue={cms.latestPage.heroDescription}
                    required
                  />
                </label>
              </div>
            </section>

            <section id="cms-page-authors" className="admin-cms-section">
              <h2>Authors Page</h2>
              <div className="admin-grid">
                <label>
                  Meta title
                  <input name="authorsMetaTitle" defaultValue={cms.authorsPage.metaTitle} required />
                </label>
                <label>
                  Hero title
                  <input name="authorsHeroTitle" defaultValue={cms.authorsPage.heroTitle} required />
                </label>
                <label className="admin-grid-span-2">
                  Meta description
                  <textarea
                    name="authorsMetaDescription"
                    rows={2}
                    defaultValue={cms.authorsPage.metaDescription}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Hero description
                  <textarea
                    name="authorsHeroDescription"
                    rows={3}
                    defaultValue={cms.authorsPage.heroDescription}
                    required
                  />
                </label>
              </div>
            </section>

            <section id="cms-page-about" className="admin-cms-section">
              <h2>About Page</h2>
              <div className="admin-grid">
                <label>
                  Meta title
                  <input name="aboutMetaTitle" defaultValue={cms.aboutPage.metaTitle} required />
                </label>
                <label>
                  Hero title
                  <input name="aboutHeroTitle" defaultValue={cms.aboutPage.heroTitle} required />
                </label>
                <label className="admin-grid-span-2">
                  Meta description
                  <textarea
                    name="aboutMetaDescription"
                    rows={2}
                    defaultValue={cms.aboutPage.metaDescription}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Hero description
                  <textarea
                    name="aboutHeroDescription"
                    rows={3}
                    defaultValue={cms.aboutPage.heroDescription}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Mission paragraph
                  <textarea
                    name="aboutMissionParagraph"
                    rows={4}
                    defaultValue={cms.aboutPage.missionParagraph}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Value quote
                  <textarea
                    name="aboutValueQuote"
                    rows={2}
                    defaultValue={cms.aboutPage.valueQuote}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Experience paragraph
                  <textarea
                    name="aboutExperienceParagraph"
                    rows={4}
                    defaultValue={cms.aboutPage.experienceParagraph}
                    required
                  />
                </label>
                <label className="admin-grid-span-2">
                  Closing paragraph
                  <textarea
                    name="aboutClosingParagraph"
                    rows={4}
                    defaultValue={cms.aboutPage.closingParagraph}
                    required
                  />
                </label>
                <label>
                  Team image caption
                  <input name="aboutTeamCaption" defaultValue={cms.aboutPage.teamCaption} required />
                </label>
                <label>
                  Planning image caption
                  <input
                    name="aboutPlanningCaption"
                    defaultValue={cms.aboutPage.planningCaption}
                    required
                  />
                </label>
              </div>
            </section>

            <section id="cms-newsletter" className="admin-cms-section">
              <h2>Newsletter</h2>
              <div className="admin-grid">
                <label className="admin-grid-span-2">
                  Title
                  <input name="newsletterTitle" defaultValue={cms.newsletter.title} required />
                </label>
                <label className="admin-grid-span-2">
                  Description
                  <textarea
                    name="newsletterDescription"
                    rows={3}
                    defaultValue={cms.newsletter.description}
                    required
                  />
                </label>
                <label>
                  Email placeholder
                  <input
                    name="newsletterEmailPlaceholder"
                    defaultValue={cms.newsletter.emailPlaceholder}
                    required
                  />
                </label>
                <label>
                  Button label
                  <input name="newsletterButtonLabel" defaultValue={cms.newsletter.buttonLabel} required />
                </label>
              </div>
            </section>

            <section id="cms-footer" className="admin-cms-section">
              <h2>Footer</h2>
              <div className="admin-grid">
                <label>
                  Brand
                  <input name="footerBrand" defaultValue={cms.footer.brand} required />
                </label>
                <label>
                  Back to top label
                  <input name="footerBackToTopLabel" defaultValue={cms.footer.backToTopLabel} required />
                </label>
                <label>
                  Pages heading
                  <input name="footerPagesHeading" defaultValue={cms.footer.pagesHeading} required />
                </label>
                <label>
                  Resources heading
                  <input name="footerResourcesHeading" defaultValue={cms.footer.resourcesHeading} required />
                </label>
                <label>
                  Social heading
                  <input name="footerSocialHeading" defaultValue={cms.footer.socialHeading} required />
                </label>
                <label className="admin-grid-span-2">
                  Copyright text
                  <input name="footerCopyrightText" defaultValue={cms.footer.copyrightText} required />
                </label>
                <label className="admin-grid-span-2">
                  Footer copy
                  <textarea name="footerCopy" rows={3} defaultValue={cms.footer.copy} required />
                </label>
                <label className="admin-grid-span-2">
                  Footer pages links (one per line)
                  <textarea
                    name="footerPagesLinksRows"
                    rows={5}
                    defaultValue={linksToRows(cms.footer.pagesLinks)}
                  />
                </label>
                <label className="admin-grid-span-2">
                  Footer resources links (one per line)
                  <textarea
                    name="footerResourceLinksRows"
                    rows={5}
                    defaultValue={linksToRows(cms.footer.resourceLinks)}
                  />
                </label>
                <label className="admin-grid-span-2">
                  Footer social links (one per line)
                  <textarea
                    name="footerSocialLinksRows"
                    rows={5}
                    defaultValue={socialToRows(cms.footer.socialLinks)}
                  />
                </label>
              </div>
              <p className="admin-alert">
                Footer links: <code>Label|Href</code> or <code>Label|Href|external</code>. Social: <code>platform|https://example.com</code>.
              </p>
            </section>

            <div className="admin-form-actions admin-cms-mobile-save">
              <button type="submit" className="pill-button">
                Save CMS settings
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
