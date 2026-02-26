"use client";

import { useEffect, useMemo, useState } from "react";

export type TocHeading = {
  id: string;
  text: string;
};

type PostTableOfContentsProps = {
  headings: TocHeading[];
};

const ACTIVE_OFFSET_PX = 140;

export function PostTableOfContents({ headings }: PostTableOfContentsProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);

  useEffect(() => {
    if (headingIds.length === 0) {
      return;
    }

    const updateActiveHeading = () => {
      let nextActiveId = headingIds[0];

      for (const id of headingIds) {
        const element = document.getElementById(id);
        if (!element) {
          continue;
        }

        const top = element.getBoundingClientRect().top;
        if (top - ACTIVE_OFFSET_PX <= 0) {
          nextActiveId = id;
        } else {
          break;
        }
      }

      setActiveId((previousId) => (previousId === nextActiveId ? previousId : nextActiveId));
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);

    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [headingIds]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="toc toc-sticky" aria-label="Table of contents">
      <h2>Table of Contents</h2>
      <ol>
        {headings.map((heading) => {
          const isActive = heading.id === activeId;

          return (
            <li key={heading.id}>
              <a
                className={`toc-link${isActive ? " is-active" : ""}`}
                href={`#${heading.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setActiveId(heading.id)}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
