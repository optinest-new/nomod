import Link from "next/link";
import type { Metadata } from "next";

import { requireAdminSession } from "@/lib/admin";
import { getAnalyticsSummary } from "@/lib/analytics";
import { getMediaAssets } from "@/lib/media";
import { getNewsletterSubscribers } from "@/lib/newsletter";
import { getLatestPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Analytics Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toPercentBar(value: number, max: number): string {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export default async function AdminAnalyticsPage() {
  const user = await requireAdminSession();

  const [summary, posts, subscribers, mediaAssets] = await Promise.all([
    getAnalyticsSummary(30),
    getLatestPosts(undefined, { includeUnpublished: true }),
    getNewsletterSubscribers(),
    getMediaAssets(),
  ]);
  const mediaCount = mediaAssets.length;
  const publishedPosts = posts.filter((post) => post.isPublished).length;
  const draftPosts = posts.filter((post) => post.status === "draft").length;
  const scheduledPosts = posts.filter(
    (post) => post.status === "scheduled" && !post.isPublished,
  ).length;

  const maxDailyViews = Math.max(1, ...summary.dailyViews.map((item) => item.views));
  const maxTopPathViews = Math.max(1, ...summary.topPaths.map((item) => item.views));
  const maxTopRefViews = Math.max(1, ...summary.topReferrers.map((item) => item.views));

  return (
    <section className="container admin-shell">
      <div className="admin-toolbar">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>
            Last 30 days of pageview analytics and content operations metrics. Logged in as{" "}
            <strong>{user.name}</strong> ({user.role}).
          </p>
        </div>
        <div className="admin-toolbar-actions">
          {user.role === "admin" ? (
            <Link href="/admin/users" className="admin-outline-button">
              Users
            </Link>
          ) : null}
          <Link href="/admin/cms" className="admin-outline-button">
            Manage CMS
          </Link>
          <Link href="/admin/taxonomy" className="admin-outline-button">
            Manage taxonomy
          </Link>
          <Link href="/admin/media" className="admin-outline-button">
            Media
          </Link>
          <Link href="/admin" className="admin-outline-button">
            Back
          </Link>
        </div>
      </div>

      <div className="admin-analytics-cards">
        <article className="admin-card admin-analytics-card">
          <p>Pageviews (30 days)</p>
          <strong>{summary.totalViews.toLocaleString()}</strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Unique pages</p>
          <strong>{summary.uniquePaths.toLocaleString()}</strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Unique referrers</p>
          <strong>{summary.uniqueReferrers.toLocaleString()}</strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Subscribers</p>
          <strong>{subscribers.length.toLocaleString()}</strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Published posts</p>
          <strong>{publishedPosts.toLocaleString()}</strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Draft / Scheduled</p>
          <strong>
            {draftPosts} / {scheduledPosts}
          </strong>
        </article>
        <article className="admin-card admin-analytics-card">
          <p>Media files</p>
          <strong>{mediaCount.toLocaleString()}</strong>
        </article>
      </div>

      <div className="admin-analytics-grid">
        <article className="admin-card admin-analytics-panel">
          <h2>Daily Views (14 days)</h2>
          <ul className="admin-analytics-bars">
            {summary.dailyViews.map((item) => (
              <li key={item.date}>
                <span>{formatDateLabel(item.date)}</span>
                <div>
                  <i style={{ width: toPercentBar(item.views, maxDailyViews) }} />
                  <strong>{item.views}</strong>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="admin-card admin-analytics-panel">
          <h2>Top Pages</h2>
          {summary.topPaths.length > 0 ? (
            <ul className="admin-analytics-bars">
              {summary.topPaths.map((item) => (
                <li key={item.path}>
                  <span>{item.path}</span>
                  <div>
                    <i style={{ width: toPercentBar(item.views, maxTopPathViews) }} />
                    <strong>{item.views}</strong>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-list-summary">No tracked pageviews yet.</p>
          )}
        </article>

        <article className="admin-card admin-analytics-panel">
          <h2>Top Referrers</h2>
          {summary.topReferrers.length > 0 ? (
            <ul className="admin-analytics-bars">
              {summary.topReferrers.map((item) => (
                <li key={item.referrer}>
                  <span>{item.referrer}</span>
                  <div>
                    <i style={{ width: toPercentBar(item.views, maxTopRefViews) }} />
                    <strong>{item.views}</strong>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-list-summary">No referrer data yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
