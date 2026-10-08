alter table public.user_llm_settings
  add column if not exists thinking_mode text not null default 'auto';

alter table public.user_llm_settings
  drop constraint if exists user_llm_settings_thinking_mode_check;

alter table public.user_llm_settings
  add constraint user_llm_settings_thinking_mode_check
  check (thinking_mode in ('auto', 'off', 'on', 'low', 'medium', 'high'));
