-- Public, read-only project links. Account invites remain email-bound.

create table if not exists public.workspace_view_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workspace_view_links_workspace_id_idx
  on public.workspace_view_links(workspace_id);

alter table public.workspace_view_links enable row level security;

create or replace function public.create_workspace_view_link(ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result_token text;
begin
  if auth.uid() is null or not public.is_workspace_admin(ws) then
    raise exception 'Not authorized to create view link';
  end if;

  if not exists (
    select 1 from public.workspaces
    where id = ws and sharing_enabled = true
  ) then
    raise exception 'Sharing is disabled for this project';
  end if;

  insert into public.workspace_view_links (workspace_id, created_by)
  values (ws, auth.uid())
  returning token into result_token;

  return result_token;
end;
$$;

revoke all on function public.create_workspace_view_link(uuid) from public;
grant execute on function public.create_workspace_view_link(uuid) to authenticated;

create or replace function public.preview_workspace_view_link(view_token text)
returns table(
  name text,
  description text,
  icon text,
  color text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, w.description, w.icon, w.color, l.expires_at
  from public.workspace_view_links l
  join public.workspaces w on w.id = l.workspace_id
  where l.token = view_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and w.sharing_enabled = true;
$$;

revoke all on function public.preview_workspace_view_link(text) from public;
grant execute on function public.preview_workspace_view_link(text) to anon, authenticated;

create or replace function public.list_workspace_view_items(view_token text)
returns table(
  id uuid,
  title text,
  description text,
  subtype text,
  status text,
  due_at timestamptz,
  planned_start_at timestamptz,
  time_precision text,
  estimated_duration_min integer,
  repeat_mode text,
  category text,
  category_label text,
  priority integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.title,
    i.description,
    i.subtype::text,
    i.status::text,
    i.due_at,
    i.planned_start_at,
    i.time_precision::text,
    i.estimated_duration_min,
    i.repeat_mode::text,
    i.category::text,
    i.category_label,
    i.priority
  from public.items i
  where i.deleted_at is null
    and exists (
      select 1
      from public.workspace_view_links l
      join public.workspaces w on w.id = l.workspace_id
      where l.token = view_token
        and l.revoked_at is null
        and (l.expires_at is null or l.expires_at > now())
        and w.sharing_enabled = true
        and i.workspace_id = l.workspace_id
    )
  order by coalesce(i.planned_start_at, i.due_at, i.created_at) asc;
$$;

revoke all on function public.list_workspace_view_items(text) from public;
grant execute on function public.list_workspace_view_items(text) to anon, authenticated;

create or replace function public.revoke_workspace_view_links_when_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sharing_enabled = true and new.sharing_enabled = false then
    update public.workspace_view_links
    set revoked_at = coalesce(revoked_at, now())
    where workspace_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.revoke_workspace_view_links_when_private() from public;

drop trigger if exists revoke_workspace_view_links_when_private on public.workspaces;
create trigger revoke_workspace_view_links_when_private
after update of sharing_enabled on public.workspaces
for each row execute function public.revoke_workspace_view_links_when_private();

-- Refresh PostgREST RPC schema cache after migration deployment.
notify pgrst, 'reload schema';
