import { z } from "zod";

/**
 * Every environment variable the app depends on, validated once at boot.
 * If something is missing, we fail loudly here instead of hitting a cryptic
 * error three layers deep inside a random feature. See supabase/README.md
 * for where each of these values comes from.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
});
