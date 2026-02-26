export type Author = {
  id: string;
  name: string;
  role: string;
  shortBio: string;
  bio: string;
  avatar: string;
  xUrl?: string;
  adminUserId?: string;
  postCount?: number;
};

export type PostFrontmatter = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  authorId: string;
  coverImage: string;
  coverAlt: string;
  status?: "published" | "draft" | "scheduled";
  publishAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  featured?: boolean;
  recommended?: boolean;
};

export type Post = PostFrontmatter & {
  content: string;
  readingTimeText: string;
  readingTimeMinutes: number;
  status: "published" | "draft" | "scheduled";
  isPublished: boolean;
};
