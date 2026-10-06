-- LLM usage / cost aggregates on agent_runs

alter table public.agent_runs
  add column if not exists llm_calls int not null default 0,
  add column if not exists prompt_tokens int not null default 0,
  add column if not exists completion_tokens int not null default 0,
  add column if not exists total_tokens int not null default 0,
  add column if not exists cost_usd numeric(14, 8),
  add column if not exists cost_source text
    check (cost_source is null or cost_source in ('provider', 'estimate', 'unknown'));
