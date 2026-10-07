-- Keep encrypted API keys separate for each provider.
-- Legacy columns stay in user_llm_settings during rollout for rollback compatibility.

create table if not exists public.user_llm_provider_keys (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (
    provider in ('openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom', 'shopaikey', 'nvidia')
  ),
  api_key_ciphertext text,
  api_key_last4 text,
  has_api_key boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_llm_provider_keys enable row level security;

revoke all on public.user_llm_provider_keys from anon, authenticated;
grant all on public.user_llm_provider_keys to service_role;

alter table public.user_llm_settings
  drop constraint if exists user_llm_settings_provider_check;

alter table public.user_llm_settings
  add constraint user_llm_settings_provider_check
  check (provider in ('openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom', 'shopaikey', 'nvidia'));

alter table public.user_llm_provider_keys
  drop constraint if exists user_llm_provider_keys_provider_check;

alter table public.user_llm_provider_keys
  add constraint user_llm_provider_keys_provider_check
  check (provider in ('openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom', 'shopaikey', 'nvidia'));

insert into public.user_llm_provider_keys (
  user_id,
  provider,
  api_key_ciphertext,
  api_key_last4,
  has_api_key
)
select
  user_id,
  provider,
  api_key_ciphertext,
  api_key_last4,
  has_api_key
from public.user_llm_settings
where has_api_key = true
  and api_key_ciphertext is not null
on conflict (user_id, provider) do nothing;
