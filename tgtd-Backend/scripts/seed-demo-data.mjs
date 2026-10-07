import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, assertDemoSeedAllowed } from "./seed-demo-policy.mjs";

const UUID_NAMESPACE = Buffer.from("4f5c4d7e8a9b4c2d91e1a7b3c6d8f012", "hex");
const FIXTURE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/travel-test-seed.json");
const CATEGORY_LABELS = {
  WORK_STUDY: "Work & Study",
  ADMIN: "Admin",
  ERRAND: "Errand",
  SHOPPING: "Shopping",
  FOOD: "Food",
  HEALTH_FITNESS: "Health & Fitness",
  SOCIAL: "Social",
  TRAVEL: "Travel",
  NATURE: "Nature",
  ENTERTAINMENT: "Entertainment",
  HOBBY: "Hobby",
  SERVICE: "Service",
  PERSONAL: "Personal",
  OTHER: "Other",
};

const ITEM_STATUS_BY_PLAN_STATUS = {
  PLANNING: "ACTIVE",
  VISITED: "COMPLETED",
  SKIPPED: "PAUSED",
};

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

export function deterministicUuid(kind, source) {
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([UUID_NAMESPACE, Buffer.from(`${kind}:${source}`)]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function findUserByEmail(result, email) {
  const users = Array.isArray(result) ? result : result?.users ?? [];
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

function mergeValues(...values) {
  return values.reduce((result, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        result[key] = mergeValues(result[key], child);
      } else if (child !== undefined) {
        result[key] = child;
      }
    }
    return result;
  }, {});
}

function clockTime(hour, minute = 0) {
  if (hour == null) return null;
  return `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isoAt(now, dayOffset, hour, minute = 0) {
  if (dayOffset == null) return null;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour ?? 0, minute, 0, 0);
  return date.toISOString();
}

function normalizePlanStatus(value) {
  return ["PLANNING", "VISITED", "SKIPPED"].includes(value) ? value : "PLANNING";
}

function buildChildRows(itemId, form, createdAt) {
  const planTravel = {
    item_id: itemId,
    from_text: form.travel.from,
    to_text: form.travel.to,
    transport_mode: form.travel.transportMode,
    estimated_duration_min: form.travel.estimatedDurationMin,
    departure_time: form.travel.departureTime,
    arrival_time: form.travel.arrivalTime,
    notes: form.travel.notes,
    created_at: createdAt,
    updated_at: createdAt,
  };
  const rows = (table, values) => values.map((value, index) => ({
    id: deterministicUuid(table, `${itemId}:${index}`),
    item_id: itemId,
    ...value,
    sort_order: index,
    created_at: createdAt,
  }));

  return {
    planTravel,
    planActivities: rows("plan-activities", form.activities.map((label) => ({ label, done: false }))),
    planFood: rows("plan-food", form.foodToTry.map((label) => ({ label, done: false }))),
    planPreparations: rows("plan-preparations", form.preparations.map((label) => ({ label, done: false }))),
    planTodos: rows("plan-todos", form.todos.map((todo) => ({
      task: todo.task,
      status: todo.status,
      priority: todo.priority,
      note: todo.note,
    }))),
    planCosts: rows("plan-costs", form.costs.map((cost) => ({
      category: cost.category,
      estimated_amount: cost.estimatedAmount,
      actual_amount: cost.actualAmount,
      currency: cost.currency,
      note: cost.note,
    }))),
    planNotes: form.notes.map((note, index) => ({
      id: deterministicUuid("plan-notes", `${itemId}:${index}`),
      item_id: itemId,
      note_type: note.type,
      content: note.content,
      created_at: createdAt,
    })),
  };
}

export function buildDemoSeed(userId, now = new Date()) {
  const fixture = loadFixture();
  const createdAt = new Date(now).toISOString();
  const projects = [];
  const items = [];
  const places = [];
  const itemPlaces = [];
  const planTravel = [];
  const planActivities = [];
  const planFood = [];
  const planPreparations = [];
  const planTodos = [];
  const planCosts = [];
  const planNotes = [];

  fixture.projects.forEach((projectDefinition, projectIndex) => {
    const projectId = deterministicUuid("demo-project", `${userId}:${projectDefinition.key}`);
    projects.push({
      id: projectId,
      name: projectDefinition.name,
      description: projectDefinition.description,
      workspace_type: "PERSONAL",
      sharing_enabled: false,
      created_by: userId,
      tags: projectDefinition.tags,
      icon: null,
      color: projectDefinition.color,
      created_at: createdAt,
      updated_at: createdAt,
    });

    projectDefinition.activities.forEach((activity) => {
      const itemId = deterministicUuid("demo-item", `${userId}:${projectDefinition.key}:${activity.key}`);
      const placeId = deterministicUuid("demo-place", `${userId}:${projectDefinition.key}:${activity.key}`);
      const form = mergeValues(fixture.formDefaults, projectDefinition.formDefaults, activity.formDefaults);
      const minute = projectIndex * 7;
      const duration = activity.estimatedDurationMin ?? form.experience.estimatedDurationMin;
      const dueAt = isoAt(now, activity.dayOffset, activity.hour, minute);
      const startTime = activity.recommendedStartTime ?? clockTime(activity.hour, minute);
      const endHour = activity.hour == null ? null : activity.hour + Math.ceil(duration / 60);
      const travel = mergeValues(form.travel, {
        to: activity.place.name,
        estimatedDurationMin: form.travel.estimatedDurationMin ?? Math.max(15, Math.ceil(duration / 2)),
        departureTime: form.travel.departureTime ?? startTime,
        arrivalTime: form.travel.arrivalTime ?? clockTime(endHour, minute),
      });
      const experience = mergeValues(form.experience, {
        estimatedDurationMin: duration,
        recommendedStartTime: startTime,
        recommendedEndTime: activity.recommendedEndTime ?? clockTime(endHour, minute),
        bestTime: activity.bestTime ?? form.experience.bestTime,
      });
      const planStatus = normalizePlanStatus(form.planStatus);
      const category = activity.category;
      items.push({
        id: itemId,
        workspace_id: projectId,
        item_type: "ACTIVITY",
        subtype: "TASK",
        title: activity.title,
        description: form.description,
        category,
        category_label: CATEGORY_LABELS[category],
        priority: form.priority,
        status: ITEM_STATUS_BY_PLAN_STATUS[planStatus] ?? form.status,
        repeat_mode: form.repeatMode,
        due_at: dueAt,
        planned_start_at: dueAt,
        time_precision: activity.timePrecision ?? form.timePrecision,
        estimated_duration_min: experience.estimatedDurationMin,
        duration_source: "demo_seed",
        plan_status: planStatus,
        best_time: experience.bestTime,
        created_by: userId,
        last_updated_by: userId,
        version: 1,
        source_text: `${form.sourceText}: ${projectDefinition.name} / ${activity.title}`,
        created_at: createdAt,
        updated_at: createdAt,
        deleted_at: null,
      });
      places.push({
        id: placeId,
        workspace_id: projectId,
        name: activity.place.name,
        formatted_address: activity.place.location,
        google_place_id: null,
        latitude: null,
        longitude: null,
        original_maps_url: activity.place.googleMapsUrl,
        google_maps_url: activity.place.googleMapsUrl,
        primary_type: category.toLowerCase(),
        categories: [category],
        tags: projectDefinition.tags,
        created_at: createdAt,
        updated_at: createdAt,
      });
      itemPlaces.push({
        id: deterministicUuid("demo-item-place", `${itemId}:${placeId}`),
        item_id: itemId,
        place_id: placeId,
        role: "PRIMARY",
        created_at: createdAt,
      });
      const childRows = buildChildRows(itemId, { ...form, travel, experience }, createdAt);
      planTravel.push(childRows.planTravel);
      planActivities.push(...childRows.planActivities);
      planFood.push(...childRows.planFood);
      planPreparations.push(...childRows.planPreparations);
      planTodos.push(...childRows.planTodos);
      planCosts.push(...childRows.planCosts);
      planNotes.push(...childRows.planNotes);
    });
  });

  return {
    projects,
    items,
    places,
    itemPlaces,
    planTravel,
    planActivities,
    planFood,
    planPreparations,
    planTodos,
    planCosts,
    planNotes,
  };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function loadLocalEnv() {
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const root = path.resolve(backendRoot, "..");
  for (const filePath of [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(backendRoot, ".env.local"),
    path.resolve(root, "tgtd-Frontend/.env.local"),
  ]) loadEnvFile(filePath);
}

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function upsert(client, table, values, onConflict = "id") {
  if (!values.length) return;
  const { error } = await client.from(table).upsert(values, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function replaceDemoWorkspaces(client, userId) {
  const { error } = await client
    .from("workspaces")
    .delete()
    .eq("created_by", userId)
    .eq("workspace_type", "PERSONAL");
  if (error) throw new Error(`replace demo workspaces: ${error.message}`);
}

async function seedDemoData() {
  loadLocalEnv();
  assertDemoSeedAllowed();
  const replace = process.argv.slice(2).includes("--replace");
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key === "your-service-role-key") {
    throw new Error("Set Supabase URL and SUPABASE_SECRET_KEY before seeding demo data");
  }

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const users = await rows(client.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  const user = findUserByEmail(users, DEMO_EMAIL);
  if (!user) throw new Error(`Target account not found: ${DEMO_EMAIL}. Run npm run seed:demo first`);
  if (replace) await replaceDemoWorkspaces(client, user.id);

  const seed = buildDemoSeed(user.id, new Date());
  await upsert(client, "workspaces", seed.projects);
  await upsert(client, "workspace_members", seed.projects.map((project) => ({
    workspace_id: project.id,
    profile_id: user.id,
    role: "OWNER",
  })), "workspace_id,profile_id");
  await upsert(client, "places", seed.places);
  await upsert(client, "items", seed.items);
  await upsert(client, "item_places", seed.itemPlaces);
  await upsert(client, "plan_travel", seed.planTravel, "item_id");
  for (const [table, values] of [
    ["plan_activities", seed.planActivities],
    ["plan_food", seed.planFood],
    ["plan_preparations", seed.planPreparations],
    ["plan_todos", seed.planTodos],
    ["plan_costs", seed.planCosts],
    ["plan_notes", seed.planNotes],
  ]) await upsert(client, table, values);

  console.log(`Seeded ${seed.projects.length} projects, ${seed.items.length} activities, and ${seed.places.length} places for ${DEMO_EMAIL}.`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  seedDemoData().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
