"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function shouldTrack(pathname: string): boolean {
  return !pathname.startsWith("/admin") && !pathname.startsWith("/api");
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    if (!pathname || !shouldTrack(pathname)) {
      return;
    }

    const query = searchParams.toString();
    const currentPath = query ? `${pathname}?${query}` : pathname;
    if (lastTrackedRef.current === currentPath) {
      return;
    }

    lastTrackedRef.current = currentPath;

    const payload = JSON.stringify({
      path: currentPath,
      referrer: document.referrer,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
      return;
    }

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }, [pathname, searchParams]);

  return null;
}

