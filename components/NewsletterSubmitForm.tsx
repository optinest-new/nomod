"use client";

import { useActionState, useRef, useState } from "react";
import type { FormEvent } from "react";

import { subscribeNewsletterAction } from "@/app/actions/newsletter";

type NewsletterSubmitFormProps = {
  sourcePath: string;
  emailPlaceholder: string;
  buttonLabel: string;
};

type NewsletterActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: NewsletterActionState = {
  status: "idle",
  message: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkNewsletterEmailExists(email: string): Promise<boolean> {
  const response = await fetch(
    `/api/newsletter/exists?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { exists?: boolean };
  return Boolean(payload.exists);
}

export function NewsletterSubmitForm({
  sourcePath,
  emailPlaceholder,
  buttonLabel,
}: NewsletterSubmitFormProps) {
  const [state, formAction, isPending] = useActionState(subscribeNewsletterAction, initialState);
  const [clientState, setClientState] = useState<NewsletterActionState>(initialState);
  const [isChecking, setIsChecking] = useState(false);
  const bypassCheckRef = useRef(false);

  const visibleState = clientState.status !== "idle" ? clientState : state;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (bypassCheckRef.current) {
      bypassCheckRef.current = false;
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      setClientState({
        status: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    setIsChecking(true);
    let exists = false;
    try {
      exists = await checkNewsletterEmailExists(email);
    } finally {
      setIsChecking(false);
    }

    if (exists) {
      setClientState({
        status: "success",
        message: "You are already subscribed with this email.",
      });
      return;
    }

    setClientState(initialState);
    bypassCheckRef.current = true;
    form.requestSubmit();
  }

  return (
    <>
      <form className="newsletter-form" action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="sourcePath" value={sourcePath} />
        <label className="sr-only" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder={emailPlaceholder}
          required
          autoComplete="email"
          onChange={() => {
            if (clientState.status !== "idle") {
              setClientState(initialState);
            }
          }}
        />
        <button type="submit" disabled={isPending || isChecking}>
          {isChecking ? "Checking..." : isPending ? "Submitting..." : buttonLabel}
        </button>
      </form>

      {visibleState.status !== "idle" ? (
        <p
          className={`newsletter-notice${visibleState.status === "success" ? " is-success" : " is-error"}`}
          role="status"
          aria-live="polite"
        >
          {visibleState.message}
        </p>
      ) : null}
    </>
  );
}
