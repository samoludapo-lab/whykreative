create table workspaces (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  email text not null unique,
  name text not null,
  role text not null check (role in ('owner', 'admin', 'creator', 'viewer')),
  created_at timestamptz not null default now()
);

create table provider_connections (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  provider text not null,
  encrypted_secret_ref text not null,
  connected_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table projects (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  title text not null,
  platform text not null default 'TikTok',
  format text not null default '9:16',
  created_at timestamptz not null default now()
);

create table assets (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  project_id uuid references projects(id),
  provider text not null,
  prompt text,
  file_url text not null,
  thumbnail_url text,
  format text not null,
  material_tags text[] not null default '{}',
  style_tags text[] not null default '{}',
  reuse_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table render_jobs (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  project_id uuid not null references projects(id),
  title text not null,
  status text not null,
  priority text not null default 'Normal',
  progress integer not null default 0,
  storyboard_json jsonb not null,
  cost_estimate_json jsonb not null,
  storage_key text,
  tiktok_draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_events (
  id uuid primary key,
  job_id uuid not null references render_jobs(id),
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
