-- Project delete: OWNER only via RPC (cascades child rows)

create or replace function public.delete_workspace(ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.profile_id = auth.uid()
      and m.role = 'OWNER'
      and m.archived_at is null
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the project owner can delete this project';
  end if;

  delete from public.workspaces where id = ws;
end;
$$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;

-- Also allow direct delete for owners (PostgREST clients)
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id
      and m.profile_id = auth.uid()
      and m.role = 'OWNER'
      and m.archived_at is null
  )
);
