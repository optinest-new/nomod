import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/admin/actions";
import {
  getDefaultAdminCredentials,
  hasCustomAdminCredentials,
  isAdminSession,
} from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminSession()) {
    redirect("/admin");
  }

  const { error } = await searchParams;
  const hasCustomCredentials = hasCustomAdminCredentials();
  const defaults = getDefaultAdminCredentials();
  const showDefaultCredentialsHint =
    !hasCustomCredentials && process.env.NODE_ENV !== "production";

  return (
    <section className="container admin-shell">
      <div className="admin-auth-card">
        <h1>Admin Login</h1>
        <p>Sign in to manage blog content stored in Supabase.</p>

        {showDefaultCredentialsHint ? (
          <p className="admin-alert">
            Using default credentials: <code>{defaults.email}</code> /{" "}
            <code>{defaults.password}</code>. Set <code>NOMOD_ADMIN_EMAIL</code>,{" "}
            <code>NOMOD_ADMIN_PASSWORD</code>, and <code>NOMOD_AUTH_SECRET</code> in
            your environment for production.
          </p>
        ) : null}

        {error ? <p className="admin-error">{error}</p> : null}

        <form action={loginAction} className="admin-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="pill-button">
            Login
          </button>
        </form>
      </div>
    </section>
  );
}
