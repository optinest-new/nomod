"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminPostToolbarProps = {
  slug: string;
};

type SessionState = "loading" | "authenticated" | "guest";

export function AdminPostToolbar({ slug }: AdminPostToolbarProps) {
  const [sessionState, setSessionState] = useState<SessionState>("loading");

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/admin/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Session check failed.");
        }

        const payload = (await response.json()) as { authenticated?: boolean };
        if (!isActive) {
          return;
        }

        setSessionState(payload.authenticated ? "authenticated" : "guest");
      } catch {
        if (!isActive) {
          return;
        }

        setSessionState("guest");
      }
    }

    void loadSession();

    return () => {
      isActive = false;
    };
  }, []);

  if (sessionState !== "authenticated") {
    return null;
  }

  return (
    <div className="admin-post-toolbar" role="region" aria-label="Admin post tools">
      <Link href={`/admin/edit/${slug}`} className="pill-button">
        Edit post
      </Link>
      <Link href="/admin" className="admin-outline-button">
        Admin
      </Link>
      <Link href="/admin/new" className="admin-outline-button">
        New post
      </Link>
    </div>
  );
}

