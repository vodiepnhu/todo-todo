import assert from "node:assert/strict";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  assertDemoSeedAllowed,
} from "./seed-demo-policy.mjs";

assert.equal(DEMO_EMAIL, "demo@local.test");
assert.equal(DEMO_PASSWORD, "123456");
assert.throws(
  () => assertDemoSeedAllowed({ NODE_ENV: "production", ENABLE_LOCAL_DEMO_ACCOUNT: "true" }),
  /disabled in production/,
);
assert.throws(
  () => assertDemoSeedAllowed({ NODE_ENV: "development", ENABLE_LOCAL_DEMO_ACCOUNT: "false" }),
  /ENABLE_LOCAL_DEMO_ACCOUNT=true/,
);
assert.doesNotThrow(() =>
  assertDemoSeedAllowed({ NODE_ENV: "development", ENABLE_LOCAL_DEMO_ACCOUNT: "true" }),
);

console.log("demo seed policy checks passed");
