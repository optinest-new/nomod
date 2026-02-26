"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MIN_VISIBLE_MS = 220;
const HIDE_AFTER_COMPLETE_MS = 220;
const AUTO_COMPLETE_MS = 8000;

function isPublicPath(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}

export function PublicNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const startAtRef = useRef<number | null>(null);
  const trickleRef = useRef<number | null>(null);
  const completeRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const autoRef = useRef<number | null>(null);

  function clearTimers() {
    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (completeRef.current) {
      window.clearTimeout(completeRef.current);
      completeRef.current = null;
    }
    if (hideRef.current) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    if (autoRef.current) {
      window.clearTimeout(autoRef.current);
      autoRef.current = null;
    }
  }

  function startProgress() {
    if (typeof window === "undefined") {
      return;
    }

    if (!isPublicPath(window.location.pathname) || isVisible) {
      return;
    }

    clearTimers();
    startAtRef.current = Date.now();
    setProgress(12);
    setIsVisible(true);

    trickleRef.current = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 90) {
          return value;
        }

        const next = value + Math.max(1, (90 - value) * 0.14);
        return next > 90 ? 90 : next;
      });
    }, 140);

    autoRef.current = window.setTimeout(() => {
      finishProgress();
    }, AUTO_COMPLETE_MS);
  }

  function finishProgress() {
    if (!isVisible) {
      return;
    }

    const startedAt = startAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const wait = elapsed < MIN_VISIBLE_MS ? MIN_VISIBLE_MS - elapsed : 0;

    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (autoRef.current) {
      window.clearTimeout(autoRef.current);
      autoRef.current = null;
    }

    completeRef.current = window.setTimeout(() => {
      setProgress(100);
      hideRef.current = window.setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
        startAtRef.current = null;
      }, HIDE_AFTER_COMPLETE_MS);
    }, wait);
  }

  useEffect(() => {
    if (!isPublicPath(pathname)) {
      clearTimers();
      setIsVisible(false);
      setProgress(0);
      startAtRef.current = null;
      return;
    }

    if (isVisible) {
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      const targetAttr = (anchor.getAttribute("target") ?? "").trim().toLowerCase();
      if (targetAttr && targetAttr !== "_self") {
        return;
      }

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) {
        return;
      }

      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      if (!isPublicPath(window.location.pathname) || !isPublicPath(destination.pathname)) {
        return;
      }

      startProgress();
    }

    function handlePopState() {
      if (isPublicPath(window.location.pathname)) {
        startProgress();
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  return (
    <div
      className={`public-nav-progress${isVisible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      <div
        className="public-nav-progress-bar"
        style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress / 100))})` }}
      />
    </div>
  );
}
