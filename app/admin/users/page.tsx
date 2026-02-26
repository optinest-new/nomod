import Link from "next/link";
import type { Metadata } from "next";

import {
  createAdminUserAction,
  deleteAdminUserAction,
  syncAdminUserAuthorsAction,
  updateAdminUserPasswordAction,
  updateAdminUserRoleAction,
} from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { listAdminUsers, requireAdminSession } from "@/lib/admin";
import { getAuthors } from "@/lib/authors";

export const metadata: Metadata = {
  title: "Users & Roles",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminUsersPageProps = {
  searchParams: Promise<{ saved?: string; error?: string; count?: string; moved?: string }>;
};

function getSavedMessage(
  saved: string | undefined,
  count: string | undefined,
  moved: string | undefined,
): string | null {
  switch (saved) {
    case "user-created":
      return "User and linked author profile created.";
    case "authors-synced": {
      const syncedCount = Number.parseInt(count ?? "0", 10);
      const safeCount = Number.isNaN(syncedCount) ? 0 : Math.max(0, syncedCount);
      return safeCount === 1
        ? "Linked 1 missing author profile."
        : `Linked ${safeCount} missing author profiles.`;
    }
    case "authors-in-sync":
      return "All active users already have linked author profiles.";
    case "role-updated":
      return "User role updated.";
    case "password-updated":
      return "User password updated.";
    case "user-deleted": {
      const movedCount = Number.parseInt(moved ?? "0", 10);
      const safeCount = Number.isNaN(movedCount) ? 0 : Math.max(0, movedCount);
      if (safeCount <= 0) {
        return "User deleted.";
      }

      return safeCount === 1
        ? "User deleted and 1 post reassigned."
        : `User deleted and ${safeCount} posts reassigned.`;
    }
    default:
      return null;
  }
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) {
    return "-";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdminSession(["admin"]);
  const { saved, error, count, moved } = await searchParams;
  const [users, authors] = await Promise.all([listAdminUsers(), getAuthors()]);
  const authorByUserId = new Map(
    authors
      .filter((author) => Boolean(author.adminUserId))
      .map((author) => [author.adminUserId as string, author] as const),
  );
  const savedMessage = getSavedMessage(saved, count, moved);
  const missingLinkedAuthors = users.filter((user) => user.isActive && !authorByUserId.has(user.id));

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Users &amp; Roles</h1>
          <p>Manage authenticated users and permission levels for admin access.</p>
        </div>
        <div className="admin-toolbar-actions">
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
        </div>
      </div>

      {savedMessage ? <p className="admin-success">{savedMessage}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-card admin-users-layout">
        <section>
          <h2>Create User</h2>
          <p className="admin-status-subtext">
            Creating a user here also creates the linked author profile for posting.
          </p>
          <form action={createAdminUserAction} className="admin-form">
            <div className="admin-grid">
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Role
                <select name="role" defaultValue="editor" required>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Password
                <input name="password" type="password" minLength={8} required />
              </label>
              <label>
                Author ID (optional)
                <input name="authorId" placeholder="auto-from-name" />
              </label>
              <label>
                Author role (optional)
                <input name="authorRole" placeholder="Defaults from user role" />
              </label>
              <label className="admin-grid-span-2">
                Author short bio (optional)
                <input name="authorShortBio" placeholder="Short byline text" />
              </label>
              <label className="admin-grid-span-2">
                Author full bio (optional)
                <textarea name="authorBio" rows={3} placeholder="Full author bio" />
              </label>
              <label>
                Author social URL (optional)
                <input name="authorXUrl" placeholder="https://x.com/handle" />
              </label>
              <label>
                Author avatar (optional)
                <input name="authorAvatarFile" type="file" accept="image/*,.svg" />
              </label>
            </div>
            <input type="hidden" name="authorExistingAvatar" value="/images/authors/giana-franci.svg" />
            <div className="admin-form-actions">
              <button type="submit" className="pill-button">
                Create user
              </button>
            </div>
          </form>
        </section>
        <section>
          <h2>Author Link Status</h2>
          <p className="admin-status-subtext">
            Users and authors should be one-to-one. Run sync to create missing author profiles for existing users.
          </p>
          <p className="admin-status-subtext">
            Missing links: <strong>{missingLinkedAuthors.length}</strong>
          </p>
          <form action={syncAdminUserAuthorsAction} className="admin-form">
            <div className="admin-form-actions">
              <button type="submit" className="admin-outline-button">
                Sync users to authors
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Author profile</th>
              <th>Last login</th>
              <th>Role update</th>
              <th>Password reset</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <br />
                  <span className="admin-status-subtext">{user.email}</span>
                </td>
                <td>
                  <span className={`admin-status-badge is-${user.role === "admin" ? "published" : "draft"}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  {authorByUserId.get(user.id) ? (
                    <>
                      <strong>{authorByUserId.get(user.id)?.name}</strong>
                      <br />
                      <span className="admin-status-subtext">
                        <code>{authorByUserId.get(user.id)?.id}</code>
                      </span>
                    </>
                  ) : (
                    <span className="admin-status-subtext">Not linked</span>
                  )}
                </td>
                <td>{formatTimestamp(user.lastLoginAt)}</td>
                <td>
                  <form action={updateAdminUserRoleAction} className="admin-users-inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="role" defaultValue={user.role}>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="admin-outline-button">
                      Save
                    </button>
                  </form>
                </td>
                <td>
                  <form action={updateAdminUserPasswordAction} className="admin-users-inline-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      placeholder="New password"
                      required
                    />
                    <button type="submit" className="admin-outline-button">
                      Update
                    </button>
                  </form>
                </td>
                <td>
                  <form action={deleteAdminUserAction} className="admin-users-inline-form admin-users-delete-form">
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="sr-only" htmlFor={`reassign-user-${user.id}`}>
                      Reassign posts to user
                    </label>
                    <select
                      id={`reassign-user-${user.id}`}
                      name="reassignToUserId"
                      defaultValue=""
                    >
                      <option value="">Reassign posts to (optional)</option>
                      {users
                        .filter(
                          (candidate) =>
                            candidate.id !== user.id &&
                            candidate.isActive &&
                            authorByUserId.has(candidate.id),
                        )
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                    </select>
                    <ConfirmSubmitButton
                      label="Delete user"
                      className="admin-link-button"
                      confirmMessage={`Delete user ${user.email}? If this user has posts, selected reassignment will transfer them before deletion.`}
                    />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
