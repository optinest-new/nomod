import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/posts";
import { getSiteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteConfig, posts] = await Promise.all([getSiteConfig(), getAllPosts()]);

  const staticPages = ["", "/latest", "/authors", "/about"].map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const postPages = posts.map((post) => ({
    url: `${siteConfig.url}/latest/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...postPages];
}
