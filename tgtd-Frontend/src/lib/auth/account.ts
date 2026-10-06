export type AuthIdentityLike = { provider?: string | null };

/** True when the user can sign in with email+password (not OAuth-only). */
export function hasEmailPasswordProvider(
  identities: AuthIdentityLike[] | null | undefined,
): boolean {
  if (!identities?.length) return false;
  return identities.some((i) => i.provider === "email");
}

export function formatSignInMethods(
  identities: AuthIdentityLike[] | null | undefined,
): string {
  if (!identities?.length) return "Unknown";
  const labels = [
    ...new Set(
      identities.map((i) => {
        const p = (i.provider ?? "").toLowerCase();
        if (p === "email") return "Email";
        if (p === "google") return "Google";
        return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Unknown";
      }),
    ),
  ];
  return labels.join(" · ") || "Unknown";
}
