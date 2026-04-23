-- Threads auto-publishing admin enhancements
-- Run this in Supabase SQL editor before importing the text queue CSV.

create table if not exists threads_posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  image_url text,
  scheduled_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'failed')),
  thread_id text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table threads_posts add column if not exists template_id text;
alter table threads_posts add column if not exists category text;
alter table threads_posts add column if not exists cta_type text;
alter table threads_posts add column if not exists link_included boolean not null default false;
alter table threads_posts add column if not exists image_upload_recommended boolean not null default false;
alter table threads_posts add column if not exists recommended_styles text[] not null default '{}';
alter table threads_posts add column if not exists quality_note text;
alter table threads_posts add column if not exists source text not null default 'manual';

create unique index if not exists threads_posts_template_id_key
  on threads_posts(template_id);

create index if not exists threads_posts_status_scheduled_idx
  on threads_posts(status, scheduled_at);

create index if not exists threads_posts_image_recommended_idx
  on threads_posts(image_upload_recommended, status);
