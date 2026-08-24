create extension if not exists pgcrypto;

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Private World',
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('OWNER', 'USER')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id),
  unique (user_id)
);

create table if not exists public.media_devices (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  owner_id text not null,
  device_key text not null,
  platform text not null default 'android' check (platform = 'android'),
  model text,
  app_version text,
  last_scan_started_at timestamptz,
  last_scan_completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, owner_id, device_key),
  unique (id, owner_id)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  owner_id text not null,
  device_id uuid,
  source_media_id text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  mime_type text not null,
  filename text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_at_source timestamptz,
  modified_at_source timestamptz,
  content_hash text,
  storage_path text not null unique,
  thumbnail_path text,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  status text not null default 'pending'
	check (status in ('pending', 'uploading', 'processing', 'completed', 'failed', 'deleted')),
  upload_attempts integer not null default 0 check (upload_attempts >= 0),
  last_error text,
  uploaded_at timestamptz,
  deleted_at timestamptz,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (device_id, owner_id) references public.media_devices(id, owner_id) on delete set null
);

create unique index if not exists media_source_identity_idx
  on public.media (space_id, owner_id, device_id, source_media_id, modified_at_source, file_size);

create index if not exists media_space_created_idx
  on public.media (space_id, created_at_source desc);

create index if not exists media_space_type_idx
  on public.media (space_id, media_type, created_at_source desc);

create index if not exists media_owner_idx
  on public.media (space_id, owner_id, created_at_source desc);

create index if not exists media_content_hash_idx
  on public.media (space_id, owner_id, content_hash)
  where content_hash is not null;

create index if not exists media_status_idx
  on public.media (status);

create table if not exists public.media_sync_settings (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id text not null,
  enabled boolean not null default false,
  photos_enabled boolean not null default true,
  videos_enabled boolean not null default true,
  wifi_only boolean not null default true,
  charging_only boolean not null default false,
  background_sync_enabled boolean not null default true,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_media_ownership_change()
returns trigger
language plpgsql
as $$
begin
  if new.space_id <> old.space_id or new.owner_id <> old.owner_id then
	raise exception 'media space and owner are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists spaces_updated_at on public.spaces;
drop trigger if exists media_devices_updated_at on public.media_devices;
drop trigger if exists media_updated_at on public.media;
drop trigger if exists media_sync_settings_updated_at on public.media_sync_settings;
drop trigger if exists media_ownership_immutable on public.media;

create trigger media_devices_updated_at
before update on public.media_devices
for each row execute function public.set_updated_at();

create trigger media_updated_at
before update on public.media
for each row execute function public.set_updated_at();

create trigger media_sync_settings_updated_at
before update on public.media_sync_settings
for each row execute function public.set_updated_at();

create trigger media_ownership_immutable
before update on public.media
for each row execute function public.prevent_media_ownership_change();

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
	select 1
	from public.space_members
	where space_id = target_space_id
	  and user_id = auth.uid()::text
  );
$$;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.media_devices enable row level security;
alter table public.media enable row level security;
alter table public.media_sync_settings enable row level security;

drop policy if exists spaces_member_select on public.spaces;
create policy spaces_member_select
  on public.spaces for select
  to authenticated
  using (public.is_space_member(id));

drop policy if exists space_members_self_select on public.space_members;
create policy space_members_self_select
  on public.space_members for select
  to authenticated
  using (user_id = auth.uid()::text or public.is_space_member(space_id));

drop policy if exists media_devices_member_select on public.media_devices;
create policy media_devices_member_select
  on public.media_devices for select
  to authenticated
  using (public.is_space_member(space_id));

drop policy if exists media_devices_self_insert on public.media_devices;
create policy media_devices_self_insert
  on public.media_devices for insert
  to authenticated
  with check (public.is_space_member(space_id) and owner_id = auth.uid()::text);

drop policy if exists media_devices_self_update on public.media_devices;
create policy media_devices_self_update
  on public.media_devices for update
  to authenticated
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists media_member_select on public.media;
create policy media_member_select
  on public.media for select
  to authenticated
  using (public.is_space_member(space_id) and deleted_at is null);

drop policy if exists media_self_insert on public.media;
create policy media_self_insert
  on public.media for insert
  to authenticated
  with check (public.is_space_member(space_id) and owner_id = auth.uid()::text);

drop policy if exists media_self_update on public.media;
create policy media_self_update
  on public.media for update
  to authenticated
  using (owner_id = auth.uid()::text)
	with check (owner_id = auth.uid()::text);

drop policy if exists media_sync_settings_self_select on public.media_sync_settings;
create policy media_sync_settings_self_select
  on public.media_sync_settings for select
  to authenticated
  using (user_id = auth.uid()::text and public.is_space_member(space_id));

drop policy if exists media_sync_settings_self_insert on public.media_sync_settings;
create policy media_sync_settings_self_insert
  on public.media_sync_settings for insert
  to authenticated
  with check (user_id = auth.uid()::text and public.is_space_member(space_id));

drop policy if exists media_sync_settings_self_update on public.media_sync_settings;
create policy media_sync_settings_self_update
  on public.media_sync_settings for update
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text and public.is_space_member(space_id));

insert into storage.buckets (id, name, public)
values ('private-world-media', 'private-world-media', false)
on conflict (id) do update set public = false;

drop policy if exists private_world_media_select on storage.objects;
drop policy if exists private_world_media_insert on storage.objects;
drop policy if exists private_world_media_update on storage.objects;
drop policy if exists private_world_media_delete on storage.objects;

create policy private_world_media_select
  on storage.objects for select
  to authenticated
  using (
	bucket_id = 'private-world-media'
	and public.is_space_member(split_part(name, '/', 1)::uuid)
  );

create policy private_world_media_insert
  on storage.objects for insert
  to authenticated
  with check (
	bucket_id = 'private-world-media'
	and public.is_space_member(split_part(name, '/', 1)::uuid)
	and split_part(name, '/', 2) = auth.uid()::text
  );

create policy private_world_media_update
  on storage.objects for update
  to authenticated
  using (
	bucket_id = 'private-world-media'
	and public.is_space_member(split_part(name, '/', 1)::uuid)
	and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
	bucket_id = 'private-world-media'
	and public.is_space_member(split_part(name, '/', 1)::uuid)
	and split_part(name, '/', 2) = auth.uid()::text
  );

create policy private_world_media_delete
  on storage.objects for delete
  to authenticated
  using (
	bucket_id = 'private-world-media'
	and public.is_space_member(split_part(name, '/', 1)::uuid)
	and split_part(name, '/', 2) = auth.uid()::text
  );
