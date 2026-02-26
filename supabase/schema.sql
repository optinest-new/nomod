create extension if not exists pgcrypto;

create table if not exists cms_content (
  id integer primary key default 1,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  constraint cms_content_singleton check (id = 1)
);

create table if not exists categories (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists authors (
  id text primary key,
  name text not null,
  role text not null,
  short_bio text not null,
  bio text not null,
  avatar text not null,
  x_url text,
  admin_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists posts (
  slug text primary key,
  title text not null,
  excerpt text not null,
  date date not null,
  category text not null,
  author_id text not null references authors(id) on update cascade,
  cover_image text not null,
  cover_alt text not null,
  status text not null check (status in ('published', 'draft', 'scheduled')),
  publish_at timestamptz,
  seo_title text,
  seo_description text,
  focus_keyword text,
  featured boolean not null default false,
  recommended boolean not null default false,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_date_idx on posts (date desc);
create index if not exists posts_status_idx on posts (status);
create index if not exists posts_publish_at_idx on posts (publish_at);
create index if not exists posts_author_id_idx on posts (author_id);
create index if not exists posts_category_idx on posts (category);

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source_path text,
  submitted_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_submitted_at_idx
  on newsletter_subscribers (submitted_at desc);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('pageview')),
  path text not null,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on analytics_events (created_at desc);
create index if not exists analytics_events_path_idx
  on analytics_events (path);
create index if not exists analytics_events_referrer_idx
  on analytics_events (referrer);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'editor')),
  password_hash text not null,
  password_salt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists admin_users_active_role_idx
  on admin_users (is_active, role);

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

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references admin_users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor')),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  user_agent text
);

create index if not exists admin_sessions_user_id_idx
  on admin_sessions (user_id);
create index if not exists admin_sessions_expires_at_idx
  on admin_sessions (expires_at);

create table if not exists login_rate_limits (
  key text primary key,
  count integer not null,
  first_attempt_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_rate_limits_updated_at_idx
  on login_rate_limits (updated_at);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique,
  public_url text not null unique,
  file_name text not null,
  extension text not null,
  directory text not null,
  kind text not null check (kind in ('posts', 'authors', 'about', 'other')),
  size_bytes bigint not null,
  modified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_kind_idx
  on media_assets (kind);
create index if not exists media_assets_modified_at_idx
  on media_assets (modified_at desc);
