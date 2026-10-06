import { describe, expect, it } from "vitest";
import type { ProfileRepository } from "../../src/modules/profiles/profile.repository";
import {
  getDisplayName,
  getProfile,
  requireProfile,
} from "../../src/modules/profiles/profile";
import type { Profile } from "../../src/contracts/database";

const profile: Profile = {
  id: "user-1",
  display_name: "Demo",
  avatar_url: null,
  timezone: "UTC",
  default_travel_mode: "driving",
  agentops_full_payload: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("profile use cases", () => {
  it("gets profile through repository", async () => {
    const repository: ProfileRepository = {
      getByUserId: async () => profile,
    };

    await expect(getProfile(repository, profile.id)).resolves.toEqual(profile);
  });

  it("requires an existing profile", async () => {
    const repository: ProfileRepository = {
      getByUserId: async () => null,
    };

    await expect(requireProfile(repository, profile.id)).rejects.toMatchObject({
      code: "PROFILE_NOT_FOUND",
    });
  });

  it("reads display name without creating profile behavior", () => {
    expect(getDisplayName(profile)).toBe("Demo");
    expect(getDisplayName({ ...profile, display_name: null })).toBeNull();
    expect(getDisplayName(null)).toBeNull();
  });
});
