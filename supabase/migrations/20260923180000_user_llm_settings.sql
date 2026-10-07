-- Encrypted per-user LLM settings.
-- No RLS policies for authenticated/anon → only service_role (API routes) can read/write.
-- Ciphertext is NEVER returned to the browser.

create table if not exists public.user_llm_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'openrouter'
    check (provider in ('openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom')),
  model text not null default '',
  base_url text,
  -- AES-256-GCM payload: base64(iv || ciphertext || authTag). App-layer encryption.
  api_key_ciphertext text,
  api_key_last4 text,
  has_api_key boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_llm_settings enable row level security;

-- Explicit deny for client roles (service_role bypasses RLS)
revoke all on public.user_llm_settings from anon, authenticated;
grant all on public.user_llm_settings to service_role;
