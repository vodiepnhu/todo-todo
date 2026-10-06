-- Multi-project sharing: sharing_enabled + archived members

alter table public.workspaces
  add column if not exists sharing_enabled boolean not null default false;

update public.workspaces
set sharing_enabled = (workspace_type = 'SHARED')
where sharing_enabled is distinct from (workspace_type = 'SHARED');

alter table public.workspace_members
  add column if not exists archived_at timestamptz;

-- Membership helpers: active members only
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.profile_id = auth.uid()
      and m.archived_at is null
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.profile_id = auth.uid()
      and m.role in ('OWNER', 'ADMIN')
      and m.archived_at is null
  );
$$;

-- Signup: personal project stays private
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display text;
begin
  display := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  insert into public.profiles (id, display_name)
  values (new.id, display)
  on conflict (id) do nothing;

  insert into public.workspaces (name, workspace_type, sharing_enabled, created_by)
  values (display || '''s Space', 'PERSONAL', false, new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (ws_id, new.id, 'OWNER');

  return new;
end;
$$;

-- Atomic share toggle
create or replace function public.set_workspace_sharing(ws uuid, enabled boolean)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.workspaces;
begin
  if not public.is_workspace_admin(ws) then
    raise exception 'Not authorized to change sharing';
  end if;

  if enabled then
    update public.workspaces
    set
      sharing_enabled = true,
      workspace_type = 'SHARED',
      updated_at = now()
    where id = ws
    returning * into result;

    insert into public.audit_logs (
      workspace_id, actor_profile_id, action, entity_type, entity_id, summary
    ) values (
      ws, auth.uid(), 'SHARING_ENABLED', 'workspace', ws, 'Sharing enabled'
    );
  else
    update public.workspaces
    set
      sharing_enabled = false,
      workspace_type = 'PERSONAL',
      updated_at = now()
    where id = ws
    returning * into result;

    update public.workspace_members
    set archived_at = now()
    where workspace_id = ws
      and role <> 'OWNER'
      and archived_at is null;

    update public.workspace_invites
    set expires_at = now()
    where workspace_id = ws
      and accepted_at is null
      and expires_at > now();

    insert into public.audit_logs (
      workspace_id, actor_profile_id, action, entity_type, entity_id, summary
    ) values (
      ws, auth.uid(), 'SHARING_DISABLED', 'workspace', ws,
      'Sharing disabled; non-owner members archived'
    );
  end if;

  return result;
end;
$$;

revoke all on function public.set_workspace_sharing(uuid, boolean) from public;
grant execute on function public.set_workspace_sharing(uuid, boolean) to authenticated;

-- Accept invite (handles re-join / un-archive under RLS)
create or replace function public.accept_workspace_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invites;
  sharing boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select * into inv
  from public.workspace_invites
  where token = invite_token
    and accepted_at is null
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if inv.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  select sharing_enabled into sharing
  from public.workspaces
  where id = inv.workspace_id;

  if not coalesce(sharing, false) then
    raise exception 'Sharing is disabled for this project';
  end if;

  insert into public.workspace_members (workspace_id, profile_id, role, archived_at)
  values (inv.workspace_id, auth.uid(), inv.role, null)
  on conflict (workspace_id, profile_id) do update
  set
    role = excluded.role,
    archived_at = null,
    joined_at = coalesce(public.workspace_members.joined_at, now());

  update public.workspace_invites
  set accepted_at = now()
  where id = inv.id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, action, entity_type, entity_id, summary
  ) values (
    inv.workspace_id, auth.uid(), 'MEMBER_JOINED', 'workspace', inv.workspace_id,
    'Member joined via invite'
  );

  return inv.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;

-- Invites only when sharing is on
drop policy if exists invites_insert on public.workspace_invites;
create policy invites_insert on public.workspace_invites for insert with check (
  public.is_workspace_admin(workspace_id)
  and exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.sharing_enabled = true
  )
);

-- Profiles visible only via active co-membership
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.profile_id = auth.uid()
      and them.profile_id = profiles.id
      and me.archived_at is null
      and them.archived_at is null
  )
);
