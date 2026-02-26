/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { MediaAsset } from "@/lib/media";
import { slugify } from "@/lib/utils";
import { Author, Post } from "@/lib/types";

type AdminPostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  post?: Post;
  submitLabel: string;
  authors: Author[];
  categories: string[];
  mediaAssets: MediaAsset[];
  lockedAuthorId?: string;
};

const defaultContent = `Write your post content here.

## Add a section heading

Explain your first key insight.

## Add practical takeaways

Share actionable steps for readers.`;

const fallbackCoverImage = "/images/posts/morning-routine.svg";

type MediaFilter = "all" | "posts" | "authors" | "about" | "other";
const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/";

function shouldProxySvg(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  return withoutQuery.endsWith(".svg");
}

function getRenderableImageSrc(src: string): string {
  if (!shouldProxySvg(src)) {
    return src;
  }

  try {
    const parsed = new URL(src);
    if (!parsed.pathname.startsWith(STORAGE_PUBLIC_MARKER)) {
      return src;
    }

    const remainder = parsed.pathname.slice(STORAGE_PUBLIC_MARKER.length);
    const [, ...objectPathParts] = remainder.split("/");
    const objectPath = objectPathParts.join("/");

    if (!objectPath) {
      return src;
    }

    return `/api/media/${objectPath}`;
  } catch {
    return src;
  }
}

function toInputDate(dateValue?: string): string {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }

  return dateValue.slice(0, 10);
}

function toInputDateTimeLocal(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function wordCount(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function h2Count(content: string): number {
  return Array.from(content.matchAll(/^##\s+/gm)).length;
}

function containsKeyword(value: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  return value.toLowerCase().includes(normalizedKeyword);
}

export function AdminPostForm({
  action,
  post,
  submitLabel,
  authors,
  categories,
  mediaAssets,
  lockedAuthorId,
}: AdminPostFormProps) {
  const defaultCoverImage = post?.coverImage ?? fallbackCoverImage;

  const [titleValue, setTitleValue] = useState(post?.title ?? "");
  const [slugValue, setSlugValue] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug));
  const [excerptValue, setExcerptValue] = useState(post?.excerpt ?? "");
  const [statusValue, setStatusValue] = useState<"published" | "draft" | "scheduled">(
    post?.status ?? "published",
  );
  const [publishAtValue, setPublishAtValue] = useState(toInputDateTimeLocal(post?.publishAt));
  const [focusKeywordValue, setFocusKeywordValue] = useState(post?.focusKeyword ?? "");
  const [seoTitleValue, setSeoTitleValue] = useState(post?.seoTitle ?? post?.title ?? "");
  const [seoTitleTouched, setSeoTitleTouched] = useState(Boolean(post?.seoTitle));
  const [seoDescriptionValue, setSeoDescriptionValue] = useState(
    post?.seoDescription ?? post?.excerpt ?? "",
  );
  const [seoDescriptionTouched, setSeoDescriptionTouched] = useState(Boolean(post?.seoDescription));
  const [selectedCoverImage, setSelectedCoverImage] = useState(defaultCoverImage);
  const [previewImage, setPreviewImage] = useState(defaultCoverImage);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("posts");
  const [mediaSearch, setMediaSearch] = useState("");
  const [content, setContent] = useState(post?.content ?? defaultContent);
  const [showPreview, setShowPreview] = useState(false);

  const blobUrlRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = Array.from(
    new Set(
      [...categories, post?.category ?? ""]
        .map((category) => category.trim())
        .filter(Boolean),
    ),
  );
  const authorOptions = Array.from(
    new Map(authors.map((author) => [author.id, author])).values(),
  );
  const selectedAuthorId = lockedAuthorId ?? post?.authorId ?? authorOptions[0]?.id ?? "";
  const selectedAuthor = authorOptions.find((author) => author.id === selectedAuthorId);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const filteredMediaAssets = useMemo(() => {
    const normalizedQuery = mediaSearch.trim().toLowerCase();

    return mediaAssets
      .filter((asset) => mediaFilter === "all" || asset.kind === mediaFilter)
      .filter((asset) => {
        if (!normalizedQuery) {
          return true;
        }

        return `${asset.fileName} ${asset.path} ${asset.directory}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 18);
  }, [mediaAssets, mediaFilter, mediaSearch]);

  const contentWords = wordCount(content);
  const contentH2Count = h2Count(content);
  const titleLength = titleValue.trim().length;
  const seoTitleLength = seoTitleValue.trim().length;
  const seoDescriptionLength = seoDescriptionValue.trim().length;
  const publishAtIsoValue = useMemo(() => {
    if (!publishAtValue) {
      return "";
    }

    const parsed = new Date(publishAtValue);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return parsed.toISOString();
  }, [publishAtValue]);

  const seoChecks = [
    {
      id: "title-length",
      label: "Title length is between 50 and 60 characters",
      passed: titleLength >= 50 && titleLength <= 60,
      detail: `${titleLength} characters`,
    },
    {
      id: "seo-title-length",
      label: "SEO title length is between 50 and 60 characters",
      passed: seoTitleLength >= 50 && seoTitleLength <= 60,
      detail: `${seoTitleLength} characters`,
    },
    {
      id: "seo-description-length",
      label: "Meta description is 140-160 characters",
      passed: seoDescriptionLength >= 140 && seoDescriptionLength <= 160,
      detail: `${seoDescriptionLength} characters`,
    },
    {
      id: "keyword-title",
      label: "Focus keyword appears in title",
      passed: focusKeywordValue.trim().length > 0 && containsKeyword(titleValue, focusKeywordValue),
      detail: focusKeywordValue.trim() ? `Keyword: ${focusKeywordValue.trim()}` : "Add a focus keyword",
    },
    {
      id: "keyword-description",
      label: "Focus keyword appears in meta description",
      passed:
        focusKeywordValue.trim().length > 0 &&
        containsKeyword(seoDescriptionValue, focusKeywordValue),
      detail: focusKeywordValue.trim() ? `Keyword: ${focusKeywordValue.trim()}` : "Add a focus keyword",
    },
    {
      id: "content-length",
      label: "Content has at least 300 words",
      passed: contentWords >= 300,
      detail: `${contentWords} words`,
    },
    {
      id: "headings",
      label: "Content has at least 2 H2 sections",
      passed: contentH2Count >= 2,
      detail: `${contentH2Count} H2 headings`,
    },
    {
      id: "slug",
      label: "Slug is concise and SEO friendly",
      passed: slugValue.length >= 3 && slugValue.length <= 80 && /^[a-z0-9-]+$/.test(slugValue),
      detail: slugValue || "Add a slug",
    },
  ];

  const seoPassedCount = seoChecks.filter((check) => check.passed).length;
  const seoScore = Math.round((seoPassedCount / seoChecks.length) * 100);

  function handleTitleChange(nextTitle: string) {
    setTitleValue(nextTitle);

    if (!slugTouched) {
      setSlugValue(slugify(nextTitle));
    }

    if (!seoTitleTouched) {
      setSeoTitleValue(nextTitle);
    }
  }

  function handleExcerptChange(nextExcerpt: string) {
    setExcerptValue(nextExcerpt);

    if (!seoDescriptionTouched) {
      setSeoDescriptionValue(nextExcerpt);
    }
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPreviewImage(selectedCoverImage);
      return;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    const nextPreview = URL.createObjectURL(file);
    blobUrlRef.current = nextPreview;
    setPreviewImage(nextPreview);
  }

  function selectLibraryImage(path: string) {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }

    setSelectedCoverImage(path);
    setPreviewImage(path);
  }

  function focusContentEditor() {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    const textarea = contentRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    const replacement = `${before}${selectedText || placeholder}${after}`;
    const nextValue = `${content.slice(0, start)}${replacement}${content.slice(end)}`;

    setContent(nextValue);
    requestAnimationFrame(() => {
      focusContentEditor();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + (selectedText || placeholder).length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function prefixSelection(prefix: string, fallback: string) {
    const textarea = contentRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end) || fallback;
    const lines = selectedText.split("\n").map((line) => `${prefix}${line}`).join("\n");
    const nextValue = `${content.slice(0, start)}${lines}${content.slice(end)}`;

    setContent(nextValue);
    requestAnimationFrame(() => {
      focusContentEditor();
      textarea.setSelectionRange(start, start + lines.length);
    });
  }

  function insertBlock(block: string) {
    const textarea = contentRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const withSpacing = `${content.slice(0, start)}\n${block}\n${content.slice(end)}`;
    setContent(withSpacing);

    requestAnimationFrame(() => {
      focusContentEditor();
      textarea.setSelectionRange(start + 1, start + 1 + block.length);
    });
  }

  return (
    <form action={action} className="admin-form admin-card">
      {post ? <input type="hidden" name="oldSlug" value={post.slug} /> : null}
      <input type="hidden" name="existingCoverImage" value={selectedCoverImage} />
      <input type="hidden" name="publishAt" value={publishAtIsoValue} />

      <div className="admin-grid">
        <label>
          Title
          <input
            name="title"
            value={titleValue}
            onChange={(event) => handleTitleChange(event.target.value)}
            required
          />
        </label>

        <label>
          Slug
          <input
            name="slug"
            value={slugValue}
            onChange={(event) => {
              setSlugTouched(true);
              setSlugValue(slugify(event.target.value));
            }}
            placeholder="auto-from-title"
          />
        </label>

        <label className="admin-grid-span-2">
          Excerpt
          <textarea
            name="excerpt"
            rows={3}
            value={excerptValue}
            onChange={(event) => handleExcerptChange(event.target.value)}
            required
          />
        </label>

        <label>
          Date
          <input
            name="date"
            type="date"
            defaultValue={toInputDate(post?.date)}
            required
          />
        </label>

        <label>
          Publishing status
          <select
            name="status"
            value={statusValue}
            onChange={(event) =>
              setStatusValue(event.target.value as "published" | "draft" | "scheduled")
            }
            required
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </label>

        <label>
          Schedule publish (date &amp; time)
          <input
            name="publishAtLocal"
            type="datetime-local"
            value={publishAtValue}
            onChange={(event) => setPublishAtValue(event.target.value)}
            required={statusValue === "scheduled"}
          />
        </label>

        <label>
          Category
          <select
            name="category"
            defaultValue={post?.category ?? categoryOptions[0] ?? "Lifestyle"}
            required
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        {lockedAuthorId ? (
          <label>
            Author
            <input
              value={selectedAuthor ? `${selectedAuthor.name} (${selectedAuthor.role})` : lockedAuthorId}
              disabled
            />
            <input type="hidden" name="authorId" value={selectedAuthorId} />
          </label>
        ) : (
          <label>
            Author
            <select name="authorId" defaultValue={selectedAuthorId} required>
              {authorOptions.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Focus keyword
          <input
            name="focusKeyword"
            value={focusKeywordValue}
            onChange={(event) => setFocusKeywordValue(event.target.value)}
            placeholder="e.g. AI-powered web design"
          />
        </label>

        <label>
          SEO title
          <input
            name="seoTitle"
            value={seoTitleValue}
            onChange={(event) => {
              setSeoTitleTouched(true);
              setSeoTitleValue(event.target.value);
            }}
            placeholder="Default uses post title"
          />
        </label>

        <label className="admin-grid-span-2">
          SEO meta description
          <textarea
            name="seoDescription"
            rows={3}
            value={seoDescriptionValue}
            onChange={(event) => {
              setSeoDescriptionTouched(true);
              setSeoDescriptionValue(event.target.value);
            }}
            placeholder="Default uses excerpt"
          />
        </label>

        <div className="admin-grid-span-2 admin-seo-assistant">
          <div className="admin-seo-assistant-header">
            <h3>SEO Assistant</h3>
            <span className="admin-seo-score">{seoScore}%</span>
          </div>
          <ul className="admin-seo-checks">
            {seoChecks.map((check) => (
              <li key={check.id} className={check.passed ? "is-pass" : "is-warn"}>
                <span className="admin-seo-check-indicator" aria-hidden="true" />
                <div>
                  <p>{check.label}</p>
                  <small>{check.detail}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <label>
          Featured image upload
          <input
            ref={coverFileInputRef}
            name="coverImageFile"
            type="file"
            accept="image/*,.svg"
            onChange={handleImageFileChange}
          />
        </label>

        <label className="admin-grid-span-2">
          Cover image alt text
          <input name="coverAlt" defaultValue={post?.coverAlt ?? ""} required />
        </label>

        <div className="admin-grid-span-2 admin-image-preview-wrap">
          <p className="admin-image-preview-label">Featured image preview</p>
          <div className="admin-image-preview">
            <img src={getRenderableImageSrc(previewImage)} alt="Featured image preview" />
          </div>
          <p className="admin-image-preview-path">
            Selected image path: <code>{selectedCoverImage}</code>
          </p>
        </div>

        <div className="admin-grid-span-2 admin-editor-media-library">
          <div className="admin-editor-media-header">
            <p className="admin-image-preview-label">Media library</p>
            <Link href="/admin/media" className="admin-outline-button">
              Open full media library
            </Link>
          </div>

          <div className="admin-editor-media-filters">
            <input
              type="search"
              value={mediaSearch}
              onChange={(event) => setMediaSearch(event.target.value)}
              placeholder="Search media by name or path..."
            />
            <select
              value={mediaFilter}
              onChange={(event) => setMediaFilter(event.target.value as MediaFilter)}
            >
              <option value="all">All</option>
              <option value="posts">Posts</option>
              <option value="authors">Authors</option>
              <option value="about">About</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="admin-editor-media-grid">
            {filteredMediaAssets.length > 0 ? (
              filteredMediaAssets.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  className={`admin-editor-media-item${
                    selectedCoverImage === asset.path ? " is-active" : ""
                  }`}
                  onClick={() => selectLibraryImage(asset.path)}
                >
                  <span className="admin-editor-media-thumb">
                    <img src={getRenderableImageSrc(asset.path)} alt={asset.fileName} loading="lazy" />
                  </span>
                  <span className="admin-editor-media-name">{asset.fileName}</span>
                </button>
              ))
            ) : (
              <p className="admin-editor-media-empty">No media matched your search.</p>
            )}
          </div>
        </div>

        <label className="admin-checkbox">
          <input name="featured" type="checkbox" defaultChecked={Boolean(post?.featured)} />
          Featured post
        </label>

        <label className="admin-checkbox">
          <input
            name="recommended"
            type="checkbox"
            defaultChecked={Boolean(post?.recommended)}
          />
          Recommended post
        </label>

        <label className="admin-grid-span-2">
          Markdown content
          <div className="admin-markdown-editor">
            <div className="admin-markdown-toolbar" role="toolbar" aria-label="Markdown toolbar">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("## ", "", "Section heading")}
              >
                H2
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("### ", "", "Subheading")}
              >
                H3
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("**", "**", "bold text")}
              >
                Bold
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("*", "*", "italic text")}
              >
                Italic
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("[", "](https://example.com)", "link text")}
              >
                Link
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("![", "](https://example.com/image.jpg)", "alt text")}
              >
                Image
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => prefixSelection("> ", "Quote line")}
              >
                Quote
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => wrapSelection("`", "`", "inline code")}
              >
                Code
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => prefixSelection("- ", "List item")}
              >
                UL
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => prefixSelection("1. ", "List item")}
              >
                OL
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertBlock("---")}
              >
                HR
              </button>
              <button
                type="button"
                className={`admin-toolbar-preview-toggle${showPreview ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPreview((value) => !value)}
              >
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>

            {showPreview ? (
              <div className="admin-markdown-preview markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                ref={contentRef}
                className="admin-markdown-textarea"
                name="content"
                rows={20}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
              />
            )}
          </div>
        </label>
      </div>

      <div className="admin-form-actions">
        <button type="submit" className="pill-button">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
