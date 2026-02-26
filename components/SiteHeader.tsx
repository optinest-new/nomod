"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { HeaderContent } from "@/lib/cms";

type SiteHeaderProps = {
  siteName: string;
  content: HeaderContent;
};

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function SiteHeader({ siteName, content }: SiteHeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          className="brand"
          href="/"
          aria-label={content.homeAriaLabel}
          onClick={() => setIsMenuOpen(false)}
        >
          {siteName}
        </Link>

        <button
          type="button"
          className={`hamburger${isMenuOpen ? " is-open" : ""}`}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="primary-nav"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-nav"
          aria-label="Primary"
          className={`main-nav${isMenuOpen ? " is-open" : ""}`}
        >
          {content.menuLinks.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            if (isExternalHref(item.href) || item.external) {
              return (
                <a
                  key={`${item.label}-${item.href}`}
                  className="nav-link"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={`${item.label}-${item.href}`}
                className={`nav-link${isActive ? " is-active" : ""}`}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          
          <Link className="pill-button" href={content.contactHref}>
            {content.contactLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
