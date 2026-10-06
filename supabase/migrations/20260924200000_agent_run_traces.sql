-- Agent run traces: durable per-agent spans for orchestrator turns

alter table public.workspaces
  add column if not exists agentops_full_payload boolean not null default false;

alter table public.profiles
  add column if not exists agentops_full_payload boolean not null default false;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  scope text not null check (scope in ('project', 'cross')),
  intent text,
  ok boolean not null default false,
  error text,
  total_ms int,
  message_preview text not null default '',
  pending_id uuid,
  model text,
  mocked boolean not null default false,
  provider text,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_workspace_created_idx
  on public.agent_runs (workspace_id, created_at desc);

create index if not exists agent_runs_home_created_idx
  on public.agent_runs (profile_id, created_at desc)
  where workspace_id is null;

create table if not exists public.agent_spans (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  seq int not null,
  agent text not null check (
    agent in (
      'ingest',
      'policy',
      'places',
      'guardrail',
      'mutation',
      'rag',
      'communication'
    )
  ),
  ok boolean not null,
  latency_ms int,
  error text,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

create index if not exists agent_spans_run_seq_idx
  on public.agent_spans (run_id, seq);

alter table public.agent_runs enable row level security;
alter table public.agent_spans enable row level security;

drop policy if exists agent_runs_select on public.agent_runs;
create policy agent_runs_select on public.agent_runs
  for select using (
    (
      workspace_id is not null
      and public.is_workspace_admin(workspace_id)
    )
    or (
      workspace_id is null
      and profile_id = auth.uid()
    )
  );

drop policy if exists agent_runs_insert on public.agent_runs;
create policy agent_runs_insert on public.agent_runs
  for insert with check (profile_id = auth.uid());

drop policy if exists agent_runs_update on public.agent_runs;
create policy agent_runs_update on public.agent_runs
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists agent_spans_select on public.agent_spans;
create policy agent_spans_select on public.agent_spans
  for select using (
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id
        and (
          (
            r.workspace_id is not null
            and public.is_workspace_admin(r.workspace_id)
          )
          or (
            r.workspace_id is null
            and r.profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists agent_spans_insert on public.agent_spans;
create policy agent_spans_insert on public.agent_spans
  for insert with check (
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id
        and r.profile_id = auth.uid()
    )
  );

grant all on table public.agent_runs to anon, authenticated, service_role;
grant all on table public.agent_spans to anon, authenticated, service_role;
