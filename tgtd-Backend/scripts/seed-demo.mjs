import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_DISPLAY_NAME,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  assertDemoSeedAllowed,
} from "./seed-demo-policy.mjs";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const workspaceRoot = process.cwd();
loadEnvFile(path.resolve(workspaceRoot, ".env.local"));
loadEnvFile(path.resolve(workspaceRoot, "../tgtd-Frontend/.env.local"));
loadEnvFile(path.resolve(workspaceRoot, "../.env.local"));
assertDemoSeedAllowed();

const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || key === "your-service-role-key") {
  throw new Error("Set Supabase URL and SUPABASE_SECRET_KEY before seeding");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

const existing = usersData.users.find(
  (user) => user.email?.toLowerCase() === DEMO_EMAIL,
);
const userResult = existing
  ? await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: DEMO_PASSWORD,
      user_metadata: { ...existing.user_metadata, display_name: DEMO_DISPLAY_NAME },
    })
  : await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: DEMO_DISPLAY_NAME },
    });
if (userResult.error || !userResult.data.user) {
  throw userResult.error ?? new Error("Demo user creation returned no user");
}

const { error: profileError } = await supabase.from("profiles").upsert(
  { id: userResult.data.user.id, display_name: DEMO_DISPLAY_NAME },
  { onConflict: "id" },
);
if (profileError) throw profileError;

console.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
