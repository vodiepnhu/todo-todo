import { requireAuthenticatedUser } from "../auth/authorization";
import type { Profile } from "../../contracts/database";
import type { ProfileRepository } from "./profile.repository";

export class ProfileError extends Error {
  readonly code = "PROFILE_NOT_FOUND" as const;

  constructor(userId: string) {
    super("Profile not found for user " + userId);
    this.name = "ProfileError";
  }
}

export async function getProfile(
  repository: ProfileRepository,
  userId: string,
): Promise<Profile | null> {
  return repository.getByUserId(requireAuthenticatedUser(userId));
}

export async function requireProfile(
  repository: ProfileRepository,
  userId: string,
): Promise<Profile> {
  const normalizedUserId = requireAuthenticatedUser(userId);
  const profile = await repository.getByUserId(normalizedUserId);
  if (!profile) throw new ProfileError(normalizedUserId);
  return profile;
}

export function getDisplayName(profile: Profile | null): string | null {
  return profile?.display_name ?? null;
}
