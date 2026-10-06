-- Allow ShopAIKey as LLM provider (OpenAI-compatible gateway)

alter table public.user_llm_settings
  drop constraint if exists user_llm_settings_provider_check;

alter table public.user_llm_settings
  add constraint user_llm_settings_provider_check
  check (
    provider in (
      'openrouter',
      'openai',
      'anthropic',
      'gemini',
      'ollama',
      'custom',
      'shopaikey'
    )
  );
