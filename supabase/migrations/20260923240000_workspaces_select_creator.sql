-- Allow creators to SELECT a workspace they just inserted (before membership row exists).
-- Needed for PostgREST INSERT ... RETURNING / supabase .insert().select().single().

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select using (
  public.is_workspace_member(id)
  or created_by = auth.uid()
);
