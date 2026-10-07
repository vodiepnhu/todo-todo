-- Account-bound project invites with activity permissions.

alter table public.workspace_members
  add column if not exists can_add boolean not null default true,
  add column if not exists can_edit boolean not null default true,
  add column if not exists can_delete boolean not null default true;

alter table public.workspace_invites
  add column if not exists can_add boolean not null default true,
  add column if not exists can_edit boolean not null default true,
  add column if not exists can_delete boolean not null default true;

-- Legacy unbound links must not remain usable after email binding ships.
update public.workspace_invites
set expires_at = least(expires_at, now())
where email is null
  and accepted_at is null;

create or replace function public.can_workspace_action(ws uuid, action_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.profile_id = auth.uid()
      and m.archived_at is null
      and (
        m.role in ('OWNER', 'ADMIN')
        or action_name = 'VIEW'
        or (action_name = 'CREATE' and m.can_add)
        or (action_name = 'UPDATE' and m.can_edit)
        or (action_name = 'DELETE' and m.can_delete)
        or (action_name = 'LOG_EVENT' and m.can_edit)
      )
  );
$$;

create or replace function public.can_workspace_change(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_workspace_action(ws, 'CREATE')
      or public.can_workspace_action(ws, 'UPDATE')
      or public.can_workspace_action(ws, 'DELETE');
$$;

create or replace function public.can_item_action(item uuid, action_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.can_workspace_action(i.workspace_id, action_name)
     from public.items i
     where i.id = item),
    false
  );
$$;

create or replace function public.preview_workspace_invite(invite_token text)
returns table(name text, sharing_enabled boolean, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, w.sharing_enabled, i.expires_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = invite_token
    and i.accepted_at is null;
$$;

revoke all on function public.preview_workspace_invite(text) from public;
grant execute on function public.preview_workspace_invite(text) to anon, authenticated;

create or replace function public.accept_workspace_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invites;
  sharing boolean;
  account_email text;
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

  select lower(trim(email)) into account_email
  from auth.users
  where id = auth.uid();

  if inv.email is null or lower(trim(inv.email)) <> coalesce(account_email, '') then
    raise exception 'Invite email does not match account';
  end if;

  insert into public.workspace_members (
    workspace_id, profile_id, role, can_add, can_edit, can_delete, archived_at
  )
  values (
    inv.workspace_id, auth.uid(), inv.role, inv.can_add, inv.can_edit, inv.can_delete, null
  )
  on conflict (workspace_id, profile_id) do update
  set
    role = excluded.role,
    can_add = excluded.can_add,
    can_edit = excluded.can_edit,
    can_delete = excluded.can_delete,
    archived_at = null,
    joined_at = coalesce(public.workspace_members.joined_at, now());

  update public.workspace_invites
  set accepted_at = now()
  where id = inv.id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, action, entity_type, entity_id, summary
  ) values (
    inv.workspace_id, auth.uid(), 'MEMBER_JOINED', 'workspace', inv.workspace_id,
    'Member joined via email invite'
  );

  return inv.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;

drop policy if exists invites_select on public.workspace_invites;
create policy invites_select on public.workspace_invites for select using (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists invites_insert on public.workspace_invites;
create policy invites_insert on public.workspace_invites for insert with check (
  public.is_workspace_admin(workspace_id)
  and email is not null
  and length(trim(email)) > 0
  and exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.sharing_enabled = true
  )
);

drop policy if exists invites_update on public.workspace_invites;
create policy invites_update on public.workspace_invites for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists items_all on public.items;
create policy items_select on public.items for select using (
  public.can_workspace_action(workspace_id, 'VIEW')
);
create policy items_insert on public.items for insert with check (
  public.can_workspace_action(workspace_id, 'CREATE')
);
create policy items_update on public.items for update
  using (
    public.can_workspace_action(workspace_id, 'UPDATE')
    or (public.can_workspace_action(workspace_id, 'DELETE') and deleted_at is null)
  )
  with check (
    public.can_workspace_action(workspace_id, 'UPDATE')
    or (public.can_workspace_action(workspace_id, 'DELETE') and deleted_at is not null)
  );
create policy items_delete on public.items for delete using (
  public.can_workspace_action(workspace_id, 'DELETE')
);

drop policy if exists places_all on public.places;
create policy places_select on public.places for select using (
  public.can_workspace_action(workspace_id, 'VIEW')
);
create policy places_insert on public.places for insert with check (
  public.can_workspace_action(workspace_id, 'CREATE')
);
create policy places_update on public.places for update using (
  public.can_workspace_action(workspace_id, 'UPDATE')
) with check (
  public.can_workspace_action(workspace_id, 'UPDATE')
);
create policy places_delete on public.places for delete using (
  public.can_workspace_action(workspace_id, 'DELETE')
);

drop policy if exists events_all on public.item_events;
create policy events_select on public.item_events for select using (
  public.can_workspace_action(workspace_id, 'VIEW')
);
create policy events_insert on public.item_events for insert with check (
  public.can_workspace_action(workspace_id, 'LOG_EVENT')
);
create policy events_update on public.item_events for update using (
  public.can_workspace_action(workspace_id, 'UPDATE')
) with check (
  public.can_workspace_action(workspace_id, 'UPDATE')
);
create policy events_delete on public.item_events for delete using (
  public.can_workspace_action(workspace_id, 'DELETE')
);

drop policy if exists messages_all on public.workspace_messages;
create policy messages_select on public.workspace_messages for select using (
  public.can_workspace_action(workspace_id, 'VIEW')
);
create policy messages_insert on public.workspace_messages for insert with check (
  public.can_workspace_change(workspace_id)
);
create policy messages_update on public.workspace_messages for update using (
  public.can_workspace_action(workspace_id, 'UPDATE')
) with check (
  public.can_workspace_action(workspace_id, 'UPDATE')
);
create policy messages_delete on public.workspace_messages for delete using (
  public.can_workspace_action(workspace_id, 'DELETE')
);

drop policy if exists pending_all on public.pending_actions;
create policy pending_select on public.pending_actions for select using (
  (workspace_id is not null and public.can_workspace_action(workspace_id, 'VIEW'))
  or (workspace_id is null and initiated_by = auth.uid() and action_type::text = 'CREATE_PROJECT')
);
create policy pending_insert on public.pending_actions for insert with check (
  (workspace_id is not null and public.can_workspace_action(workspace_id, action_type::text))
  or (workspace_id is null and initiated_by = auth.uid() and action_type::text = 'CREATE_PROJECT')
);
create policy pending_update on public.pending_actions for update
  using (
    (workspace_id is not null and public.can_workspace_action(workspace_id, action_type::text))
    or (workspace_id is null and initiated_by = auth.uid() and action_type::text = 'CREATE_PROJECT')
  )
  with check (
    (workspace_id is not null and public.can_workspace_action(workspace_id, action_type::text))
    or (workspace_id is null and initiated_by = auth.uid() and action_type::text = 'CREATE_PROJECT')
  );
create policy pending_delete on public.pending_actions for delete using (
  (workspace_id is not null and public.can_workspace_action(workspace_id, action_type::text))
  or (workspace_id is null and initiated_by = auth.uid() and action_type::text = 'CREATE_PROJECT')
);

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (
  public.can_workspace_action(workspace_id, 'VIEW')
);
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert with check (
  public.can_workspace_change(workspace_id)
);

drop policy if exists item_places_all on public.item_places;
create policy item_places_select on public.item_places for select using (
  public.can_item_action(item_id, 'VIEW')
);
create policy item_places_insert on public.item_places for insert with check (
  public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE')
);
create policy item_places_update on public.item_places for update using (
  public.can_item_action(item_id, 'UPDATE')
) with check (
  public.can_item_action(item_id, 'UPDATE')
);
create policy item_places_delete on public.item_places for delete using (
  public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE')
);

drop policy if exists plan_travel_all on public.plan_travel;
create policy plan_travel_select on public.plan_travel for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_travel_insert on public.plan_travel for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_travel_update on public.plan_travel for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_travel_delete on public.plan_travel for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));

drop policy if exists plan_costs_all on public.plan_costs;
create policy plan_costs_select on public.plan_costs for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_costs_insert on public.plan_costs for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_costs_update on public.plan_costs for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_costs_delete on public.plan_costs for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));

drop policy if exists plan_activities_all on public.plan_activities;
create policy plan_activities_select on public.plan_activities for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_activities_insert on public.plan_activities for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_activities_update on public.plan_activities for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_activities_delete on public.plan_activities for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));

drop policy if exists plan_preparations_all on public.plan_preparations;
create policy plan_preparations_select on public.plan_preparations for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_preparations_insert on public.plan_preparations for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_preparations_update on public.plan_preparations for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_preparations_delete on public.plan_preparations for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));

drop policy if exists plan_todos_all on public.plan_todos;
create policy plan_todos_select on public.plan_todos for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_todos_insert on public.plan_todos for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_todos_update on public.plan_todos for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_todos_delete on public.plan_todos for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));

drop policy if exists plan_notes_all on public.plan_notes;
create policy plan_notes_select on public.plan_notes for select using (public.can_item_action(item_id, 'VIEW'));
create policy plan_notes_insert on public.plan_notes for insert with check (public.can_item_action(item_id, 'CREATE') or public.can_item_action(item_id, 'UPDATE'));
create policy plan_notes_update on public.plan_notes for update using (public.can_item_action(item_id, 'UPDATE')) with check (public.can_item_action(item_id, 'UPDATE'));
create policy plan_notes_delete on public.plan_notes for delete using (public.can_item_action(item_id, 'UPDATE') or public.can_item_action(item_id, 'DELETE'));
