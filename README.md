# Nomod (Next.js + Supabase CMS)

Nomod is a Next.js 16 blog/CMS where content, media, admin auth, newsletter data, and analytics all live in Supabase.

## What You Get

- Supabase-backed posts, authors, categories, CMS config, newsletter subscribers, analytics, and admin users/sessions.
- Admin role system: `admin` and `editor` (`editor` can manage everything except users).
- WordPress-style author flow: `Users & Roles` is the source of truth and each user maps to one author profile.
- Editors can create/edit/delete posts only under their linked author profile.
- Media library upload/delete with Supabase Storage (`nomod` bucket by default).
- Markdown post editor with SEO helpers and media picker.

## Tech Stack

- Next.js `16.1.6` (App Router, Turbopack)
- React `19.2.3`
- Supabase (Postgres + Storage)
- TypeScript + ESLint

## Prerequisites

- Node.js 20+ and npm
- A Supabase project
- (Optional for Netlify CLI flow) A Netlify account
- (Optional for Vercel deploy) A Vercel account

## 1. Local Setup

```bash
git clone <your-repo-url>
cd nomod
npm install
cp .env.example .env.local
```

Update `.env.local` with real values:

- `NOMOD_ADMIN_EMAIL`
- `NOMOD_ADMIN_PASSWORD`
- `NOMOD_AUTH_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
- `SUPABASE_STORAGE_BUCKET` (default: `nomod`)

Important:

- Use a **service role/secret** key for server-side access.
- Do not use `sb_publishable_*` / anon keys for `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Supabase Setup

### 2.1 Create Database Schema

Run the SQL in:

- `supabase/schema.sql`

This creates all required tables/indexes, including:

- `posts`
- `authors`
- `categories`
- `cms_content`
- `newsletter_subscribers`
- `analytics_events`
- `admin_users`
- `admin_sessions`
- `login_rate_limits`
- `media_assets`

### 2.2 Create Storage Bucket

Create a **public** bucket named:

- `nomod`

If you use a different bucket name, set that in `SUPABASE_STORAGE_BUCKET`.

### 2.3 Enable Author <-> User Linking (Required for Author CMS)

If your project was created before this feature, run this SQL once:

```sql
alter table authors
  add column if not exists admin_user_id uuid;

create unique index if not exists authors_admin_user_id_uidx
  on authors (admin_user_id)
  where admin_user_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'authors_admin_user_id_fkey'
  ) then
    alter table authors
      add constraint authors_admin_user_id_fkey
      foreign key (admin_user_id) references admin_users(id) on delete set null;
  end if;
end
$$;
```

Then open `/admin/users` and run **Sync users to authors** once to backfill linked author profiles for older user accounts.

## 3. Migrate Existing Local Content and Media (Optional)

If you already have local markdown/json/media data in this repo:

```bash
npm run migrate:supabase
```

This migrates:

- `content/posts/*.md` into `posts`
- `content/meta/*.json` data into CMS/taxonomy/newsletter/admin/analytics tables
- `public/images/**/*` into Supabase Storage and `media_assets`

Run only one part if needed:

```bash
npm run migrate:supabase:content
npm run migrate:supabase:media
```

Optional SVG content-type repair:

```bash
npm run fix:supabase:svg-content-type
```

## 4. Run Locally

```bash
npm run dev
```

Open:

- `http://localhost:3000` (site)
- `http://localhost:3000/admin/login` (admin)

Quality checks:

```bash
npm run lint
npm run build
```

## 5. Deploy to Vercel

### 5.1 Deploy via Vercel Dashboard

1. Import your Git repo in Vercel.
2. Framework preset: `Next.js` (auto-detected).
3. Add environment variables in Project Settings:
   - `NOMOD_ADMIN_EMAIL`
   - `NOMOD_ADMIN_PASSWORD`
   - `NOMOD_AUTH_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
   - `SUPABASE_STORAGE_BUCKET`
4. Deploy.

### 5.2 Deploy via Vercel CLI (Optional)

```bash
npm i -g vercel
vercel
vercel --prod
```

Then set the same environment variables in Vercel project settings (or via CLI).

## 6. Deploy to Netlify

Netlify supports deploying this Next.js app. Use either Git UI or CLI.

### 6.1 Deploy via Netlify UI

1. Add new site from Git in Netlify.
2. Build command: `npm run build`
3. Publish directory: leave blank for Next.js runtime auto-detection (if Netlify requires one, use `.next`).
4. Set environment variables:
   - `NOMOD_ADMIN_EMAIL`
   - `NOMOD_ADMIN_PASSWORD`
   - `NOMOD_AUTH_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
   - `SUPABASE_STORAGE_BUCKET`
5. Deploy site.

### 6.2 Deploy via Netlify CLI

```bash
npx netlify status
npx netlify init
npx netlify deploy
npx netlify deploy --prod
```

If already linked to a site, `netlify init` may be skipped.

## 7. Post-Deploy Checklist

1. Confirm home page and `/latest` posts render.
2. Confirm `/admin/login` works.
3. Confirm editor role cannot access `/admin/users`.
4. Confirm `/admin/users` shows no missing author links (or run sync).
5. Upload an image in `/admin/media` and verify it appears in editor/media library.
6. Confirm public images resolve from `.../storage/v1/object/public/nomod/...`.

## 8. Common Errors

### `Supabase request failed (401) ... row-level security policy ... admin_users`

Cause:

- App is using anon/publishable key instead of service role key.

Fix:

- Set `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) correctly.
- Restart the server/deployment after updating env vars.

### `Cannot specify encType or method for a form that specifies a function as the action`

Cause:

- A Server Action form includes manual `encType`/`method`.

Fix:

- Remove explicit `encType`/`method` from that Server Action form.

### Images not rendering (especially SVG)

Cause:

- Wrong bucket path in data or incorrect SVG content type from storage response.

Fix:

- Ensure `SUPABASE_STORAGE_BUCKET=nomod`.
- Re-run media migration if needed.
- Run `npm run fix:supabase:svg-content-type` if required.

## 9. Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint codebase
- `npm run migrate:supabase` - migrate all local content/media to Supabase
- `npm run migrate:supabase:content` - migrate only content/meta
- `npm run migrate:supabase:media` - migrate only media
- `npm run fix:supabase:svg-content-type` - re-upload SVGs with `image/svg+xml`
# nomod
