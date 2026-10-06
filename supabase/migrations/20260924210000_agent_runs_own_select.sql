-- Personal Agent Ops: owners can read all their own runs (home + project).

drop policy if exists agent_runs_select on public.agent_runs;
create policy agent_runs_select on public.agent_runs
  for select using (
    profile_id = auth.uid()
    or (
      workspace_id is not null
      and public.is_workspace_admin(workspace_id)
    )
  );

drop policy if exists agent_spans_select on public.agent_spans;
create policy agent_spans_select on public.agent_spans
  for select using (
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id
        and (
          r.profile_id = auth.uid()
          or (
            r.workspace_id is not null
            and public.is_workspace_admin(r.workspace_id)
          )
        )
    )
  );
