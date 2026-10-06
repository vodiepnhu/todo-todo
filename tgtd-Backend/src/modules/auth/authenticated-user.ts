import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "./authorization";

export interface AuthenticatedUserClient {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message?: string } | null;
    }>;
  };
}

export async function getAuthenticatedUserId(
  client: AuthenticatedUserClient,
): Promise<string> {
  let result;
  try {
    result = await client.auth.getUser();
  } catch (error) {
    throw new AuthorizationError(
      "AUTH_LOOKUP_FAILED",
      error instanceof Error ? error.message : "Auth lookup failed",
    );
  }

  if (result.error) {
    throw new AuthorizationError(
      "AUTH_LOOKUP_FAILED",
      result.error.message || "Auth lookup failed",
    );
  }

  return requireAuthenticatedUser(result.data.user?.id);
}
