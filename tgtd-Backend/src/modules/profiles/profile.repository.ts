import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../../contracts/database";

export interface ProfileRepository {
  getByUserId(userId: string): Promise<Profile | null>;
}

function throwProfileQueryError(
  error: { message?: string } | Error,
): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || "Profile query failed");
}

export function createProfileRepository(
  supabase: SupabaseClient,
): ProfileRepository {
  return {
    async getByUserId(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throwProfileQueryError(error);
      return (data as Profile | null) ?? null;
    },
  };
}
