-- Private World music metadata. Audio bytes stay in the private
-- private-world-media bucket; the trusted API verifies Firebase identity and
-- space membership before it issues a signed upload or download URL.

create table if not exists public.private_world_music (
  id uuid primary key,
  space_id uuid not null references public.spaces(id) on delete cascade,
  uploaded_by text not null,
  uploaded_by_name text not null,
  storage_path text not null unique,
  original_filename text not null,
  title text not null,
  artist text,
  album text,
  mime_type text not null check (mime_type in (
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/opus', 'application/octet-stream'
  )),
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  artwork_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like format('spaces/%s/music/%s.%%', space_id, id))
);

create index if not exists private_world_music_space_created_idx
  on public.private_world_music (space_id, created_at desc);
create index if not exists private_world_music_uploaded_by_idx
  on public.private_world_music (uploaded_by);

drop trigger if exists private_world_music_updated_at on public.private_world_music;
create trigger private_world_music_updated_at
before update on public.private_world_music
for each row execute function public.set_updated_at();

-- No Supabase client role receives direct access. Firebase is the app's auth
-- provider, so direct auth.uid() RLS policies would be incorrect. The server
-- (using the service role) enforces Firebase identity + space membership and
-- only grants short-lived, path-specific storage URLs.
alter table public.private_world_music enable row level security;

-- Keep the media bucket private. The server's service-role client owns music
-- object operations; end users only receive an expiring signed URL/token for
-- an exact, server-generated spaces/{spaceId}/music/{musicId}.{ext} path.
insert into storage.buckets (id, name, public)
values ('private-world-media', 'private-world-media', false)
on conflict (id) do update set public = false;
