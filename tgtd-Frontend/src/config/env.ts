import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  SUPABASE_INTERNAL_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("google/gemma-4-31b-it:free"),
  OPENROUTER_FALLBACK_MODEL: z
    .string()
    .default("nvidia/nemotron-3-ultra-550b-a55b:free"),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z.coerce.boolean().default(false),
  NEXT_PUBLIC_DEMO_EMAIL: z.string().optional(),
  NEXT_PUBLIC_DEMO_PASSWORD: z.string().optional(),
  DEFAULT_TIMEZONE: z.string().default("Australia/Sydney"),
  CONFIRMATION_TTL_MINUTES: z.coerce.number().default(30),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_BASE_URL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  LANGSMITH_ENDPOINT: z.string().optional(),
  APP_ENCRYPTION_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }

  cached = parsed.data;
  return cached;
}

export function hasSupabase() {
  const env = getEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
