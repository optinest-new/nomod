import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { deleteAuthorAction, updateAuthorAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { listAdminUsers, requireAdminSession } from "@/lib/admin";
import { getAuthors } from "@/lib/authors";
import { getRenderableImageSrc, shouldUnoptimizeImage } from "@/lib/media";

export const metadata: Metadata = {
  title: "Author CMS",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminAuthorsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string; moved?: string }>;
};

function getSavedMessage(saved: string | undefined, moved: string | undefined): string | null {
  switch (saved) {
    case "author-added":
      return "Author profile added.";
    case "author-updated":
      return "Author profile updated.";
    case "author-deleted": {
      const movedCount = Number.parseInt(moved ?? "0", 10);
      const safeCount = Number.isNaN(movedCount) ? 0 : Math.max(0, movedCount);
      if (safeCount <= 0) {
        return "Author profile deleted.";
      }

      return safeCount === 1
        ? "Author profile deleted and 1 post reassigned."
        : `Author profile deleted and ${safeCount} posts reassigned.`;
    }
    default:
      return null;
  }
}

export default async function AdminAuthorsPage({ searchParams }: AdminAuthorsPageProps) {
  const user = await requireAdminSession();
  const { error, saved, moved } = await searchParams;
  const [authors, adminUsers] = await Promise.all([
    getAuthors(),
    user.role === "admin" ? listAdminUsers() : Promise.resolve([]),
  ]);
  const visibleAuthors =
    user.role === "admin" ? authors : authors.filter((author) => author.adminUserId === user.id);
  const savedMessage = getSavedMessage(saved, moved);

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Author CMS</h1>
          <p>Update author bios, social links, and avatars for each user profile.</p>
        </div>
        <div className="admin-toolbar-actions">
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-outline-button">
              Users
            </Link>
          ) : null}
          <Link href="/admin/analytics" className="admin-outline-button">
            Analytics
          </Link>
          <Link href="/admin/media" className="admin-outline-button">
            Media
          </Link>
          <Link href="/admin/taxonomy" className="admin-outline-button">
            Taxonomy
          </Link>
          <Link href="/admin/cms" className="admin-outline-button">
            Manage CMS
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
        </div>
      </div>

      {savedMessage ? <p className="admin-success">{savedMessage}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-alert">
        Author profiles are created from <Link href="/admin/users">Users &amp; Roles</Link> and should remain linked one-to-one with users.
      </p>
      {user.role === "admin" ? (
        (() => {
          const linkedUserIds = new Set(
            authors
              .map((author) => author.adminUserId)
              .filter((adminUserId): adminUserId is string => Boolean(adminUserId)),
          );
          const missingLinkedUsers = adminUsers.filter(
            (adminUser) => adminUser.isActive && !linkedUserIds.has(adminUser.id),
          );

          if (missingLinkedUsers.length === 0) {
            return null;
          }

          return (
            <p className="admin-error">
              {missingLinkedUsers.length} active user account
              {missingLinkedUsers.length === 1 ? " is" : "s are"} missing author profiles.
              <Link href="/admin/users"> Go to Users &amp; Roles to sync.</Link>
            </p>
          );
        })()
      ) : null}
      <div className="admin-authors-layout">
        <aside className="admin-authors-sidebar" aria-label="Author CMS navigation">
          <p className="admin-authors-sidebar-title">Sections</p>
          <a href="#update-authors">Update authors</a>
          <p className="admin-authors-sidebar-title">Profiles</p>
          {visibleAuthors.map((author) => (
            <a key={author.id} href={`#author-${author.id}`}>
              {author.name}
            </a>
          ))}
        </aside>

        <div className="admin-authors-content">
          <section id="update-authors" className="admin-card admin-taxonomy-card">
            <h2>Update Existing Authors</h2>
            <div className="admin-stack">
              {visibleAuthors.map((author) => (
                <article id={`author-${author.id}`} key={author.id} className="admin-card admin-taxonomy-card">
                  <div className="admin-toolbar">
                    <div>
                      <h3>{author.name}</h3>
                      <p>
                        ID: <code>{author.id}</code>
                      </p>
                    </div>
                    <Image
                      src={getRenderableImageSrc(author.avatar)}
                      alt={`Portrait of ${author.name}`}
                      width={64}
                      height={64}
                      unoptimized={shouldUnoptimizeImage(author.avatar)}
                      className="author-avatar"
                    />
                  </div>

                  <form action={updateAuthorAction} className="admin-form admin-taxonomy-form">
                    <input type="hidden" name="previousAuthorId" value={author.id} />
                    <input type="hidden" name="existingAvatar" value={author.avatar} />
                    <input type="hidden" name="redirectTo" value="/admin/authors" />

                    <div className="admin-grid">
                      <label>
                        Name
                        <input name="name" defaultValue={author.name} required />
                      </label>
                      <label>
                        Author ID
                        <input name="authorId" defaultValue={author.id} required />
                      </label>
                      <label>
                        Role
                        <input name="role" defaultValue={author.role} required />
                      </label>
                      {user.role === "admin" ? (
                        <label>
                          Linked user
                          <select name="adminUserId" defaultValue={author.adminUserId ?? ""} required>
                            <option value="" disabled>
                              Select user
                            </option>
                            {adminUsers
                              .filter((adminUser) => adminUser.isActive)
                              .map((adminUser) => (
                                <option key={adminUser.id} value={adminUser.id}>
                                  {adminUser.name} ({adminUser.email})
                                </option>
                              ))}
                          </select>
                        </label>
                      ) : (
                        <label>
                          Linked user
                          <input value={`${user.name} (${user.email})`} disabled />
                          <input type="hidden" name="adminUserId" value={user.id} />
                        </label>
                      )}
                      <label>
                        Social URL (optional)
                        <input name="xUrl" defaultValue={author.xUrl ?? ""} />
                      </label>
                      <label className="admin-grid-span-2">
                        Short bio
                        <input name="shortBio" defaultValue={author.shortBio} required />
                      </label>
                      <label className="admin-grid-span-2">
                        Full bio
                        <textarea name="bio" rows={4} defaultValue={author.bio} required />
                      </label>
                      <label className="admin-grid-span-2">
                        Replace avatar (optional)
                        <input name="avatarFile" type="file" accept="image/*,.svg" />
                      </label>
                    </div>

                    <button type="submit" className="pill-button admin-taxonomy-button">
                      Update author
                    </button>
                  </form>
                  {user.role === "admin" ? (
                    <form action={deleteAuthorAction} className="admin-form admin-taxonomy-form">
                      <input type="hidden" name="authorId" value={author.id} />
                      <input type="hidden" name="redirectTo" value="/admin/authors" />
                      <label>
                        Reassign posts to
                        <select name="reassignToAuthorId" defaultValue="">
                          <option value="">Select author if posts exist</option>
                          {authors
                            .filter((candidate) => candidate.id !== author.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <ConfirmSubmitButton
                        label="Delete author"
                        className="admin-link-button"
                        confirmMessage={`Delete author ${author.name}? If posts exist, selected reassignment will transfer them first.`}
                      />
                    </form>
                  ) : null}
                </article>
              ))}
              {visibleAuthors.length === 0 ? (
                <p className="admin-status-subtext">
                  No author profile is linked to your current user account yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
