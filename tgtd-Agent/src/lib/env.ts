import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default(""),
  OPENROUTER_FALLBACK_MODEL: z.string().default(""),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY: z.string().optional(),
  DEFAULT_TIMEZONE: z.string().default("Australia/Sydney"),
  CONFIRMATION_TTL_MINUTES: z.coerce.number().default(30),
  /** Master secret for AES-256-GCM of user API keys (≥16 chars). Never expose to client. */
  APP_ENCRYPTION_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_FALLBACK_MODEL: process.env.OPENROUTER_FALLBACK_MODEL,
    GOOGLE_MAPS_SERVER_API_KEY: process.env.GOOGLE_MAPS_SERVER_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
    CONFIRMATION_TTL_MINUTES: process.env.CONFIRMATION_TTL_MINUTES,
    APP_ENCRYPTION_SECRET: process.env.APP_ENCRYPTION_SECRET,
  });
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
}

/** @deprecated use getEnv() — kept for convenience in server modules */
export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return getEnv()[prop as keyof AppEnv];
  },
});

export function hasSupabase() {
  const e = getEnv();
  return Boolean(
    e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function hasOpenRouter() {
  return Boolean(getEnv().OPENROUTER_API_KEY);
}

export function hasGoogleMaps() {
  return Boolean(getEnv().GOOGLE_MAPS_SERVER_API_KEY);
}
