"use server";

import { revalidatePath } from "next/cache";

import { addNewsletterSubscriber, getNewsletterSubscribers } from "@/lib/newsletter";
import { assertSameOriginRequest } from "@/lib/security";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NewsletterActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function sanitizeSourcePath(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return undefined;
  }

  return trimmed;
}

export async function subscribeNewsletterAction(
  _prevState: NewsletterActionState,
  formData: FormData,
): Promise<NewsletterActionState> {
  try {
    await assertSameOriginRequest();
  } catch {
    return {
      status: "error",
      message: "Request blocked for security reasons. Please refresh and try again.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
    };
  }

  const existing = await getNewsletterSubscribers();
  if (existing.some((entry) => entry.email === email)) {
    return {
      status: "success",
      message: "You are already subscribed with this email.",
    };
  }

  const sourcePath = sanitizeSourcePath(String(formData.get("sourcePath") ?? ""));

  try {
    await addNewsletterSubscriber({
      email,
      sourcePath,
    });
  } catch {
    return {
      status: "error",
      message: "Could not save your subscription right now. Please try again.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/newsletter");

  return {
    status: "success",
    message: "Thanks, you are subscribed.",
  };
}
