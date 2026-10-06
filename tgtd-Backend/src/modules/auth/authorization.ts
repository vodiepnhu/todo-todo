export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "AUTH_LOOKUP_FAILED"
  | "FORBIDDEN";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requireAuthenticatedUser(
  userId: string | null | undefined,
): string {
  const normalizedId = userId?.trim();
  if (!normalizedId) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Authenticated user required",
    );
  }
  return normalizedId;
}
