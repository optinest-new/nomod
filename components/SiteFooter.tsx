import Link from "next/link";

import { getCmsContent, type CmsLinkItem, type CmsSocialLinkItem } from "@/lib/cms";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M13.5 21V13.3H16.1L16.5 10.3H13.5V8.4C13.5 7.5 13.8 6.9 15.1 6.9H16.6V4.2C16.3 4.1 15.5 4 14.5 4C12.3 4 10.8 5.3 10.8 7.9V10.3H8.5V13.3H10.8V21H13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 4H8.3L12.3 9.6L17 4H19.7L13.6 11.2L20 20H16.7L12.4 14.1L7.3 20H4.5L11 12.4L5 4ZM8.2 5.8H6.8L16.9 18.2H18.3L8.2 5.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14.7 4H17.2C17.4 5.4 18.3 6.4 19.7 6.8V9.3C18.8 9.2 17.9 8.9 17.2 8.4V13.9C17.2 17 14.7 19.5 11.6 19.5C8.5 19.5 6 17 6 13.9C6 10.8 8.5 8.3 11.6 8.3C11.9 8.3 12.2 8.3 12.4 8.4V11C12.2 10.9 11.9 10.8 11.6 10.8C9.9 10.8 8.5 12.2 8.5 13.9C8.5 15.6 9.9 17 11.6 17C13.3 17 14.7 15.6 14.7 13.9V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function renderLink(link: CmsLinkItem) {
  if (isExternalHref(link.href) || link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer">
        {link.label}
      </a>
    );
  }

  return <Link href={link.href}>{link.label}</Link>;
}

function SocialIcon({ platform }: { platform: string }) {
  switch (platform.toLowerCase()) {
    case "facebook":
      return <FacebookIcon />;
    case "x":
    case "twitter":
      return <XIcon />;
    case "instagram":
      return <InstagramIcon />;
    case "tiktok":
      return <TikTokIcon />;
    default:
      return (
        <span aria-hidden="true" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
          {platform.slice(0, 1).toUpperCase()}
        </span>
      );
  }
}

function socialAriaLabel(item: CmsSocialLinkItem): string {
  const label = item.platform.trim();
  if (!label) {
    return "Social profile";
  }

  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

export async function SiteFooter() {
  const cmsContent = await getCmsContent();
  const { footer } = cmsContent;

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <section>
          <h2 className="footer-brand">{footer.brand}</h2>
          <p className="footer-copy">{footer.copy}</p>
        </section>

        <section>
          <h3 className="footer-heading">{footer.pagesHeading}</h3>
          <ul className="footer-links">
            {footer.pagesLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                {renderLink(link)}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="footer-heading">{footer.resourcesHeading}</h3>
          <ul className="footer-links">
            {footer.resourceLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                {renderLink(link)}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="footer-heading">{footer.socialHeading}</h3>
          <ul className="social-links">
            {footer.socialLinks.map((item) => (
              <li key={`${item.platform}-${item.href}`}>
                <a href={item.href} aria-label={socialAriaLabel(item)} target="_blank" rel="noreferrer">
                  <SocialIcon platform={item.platform} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="container footer-bottom">
        <p>{footer.copyrightText}</p>
        <a href="#top">{footer.backToTopLabel}</a>
      </div>
    </footer>
  );
}
