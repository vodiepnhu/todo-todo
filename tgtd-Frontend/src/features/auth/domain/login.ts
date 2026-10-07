export const LOCAL_DEMO_EMAIL = "demo@local.test";

export function isLocalDemoEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT === "true"
  );
}

export function resolveLoginEmail(identifier: string, allowDemoAlias: boolean) {
  const value = identifier.trim();
  if (allowDemoAlias && value.toLowerCase() === "demo") {
    return LOCAL_DEMO_EMAIL;
  }
  return value;
}

export function safeNextPath(value: string | null | undefined) {
  if (value === "/app") return "/projects";
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/projects";
  }
  return value;
}

export function googleAuthRedirectUrl(origin: string) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", "/projects");
  return url.toString();
}
