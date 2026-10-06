export const DEMO_EMAIL = "demo@local.test";
export const DEMO_PASSWORD = "123456";
export const DEMO_DISPLAY_NAME = "demo";

export function assertDemoSeedAllowed(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seed is disabled in production");
  }
  if (env.ENABLE_LOCAL_DEMO_ACCOUNT !== "true") {
    throw new Error("Set ENABLE_LOCAL_DEMO_ACCOUNT=true for local demo seeding");
  }
}
