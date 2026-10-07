import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const SOURCE_EMAIL = process.env.SOURCE_DEMO_EMAIL || "demo1@planner.local";
export const TARGET_EMAIL = process.env.TARGET_DEMO_EMAIL || "demo@local.test";

const UUID_NAMESPACE = Buffer.from("7d4e6b7c5f7f4f4b8a4b1e0d2c3a4958", "hex");

export function deterministicUuid(kind, sourceId) {
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([UUID_NAMESPACE, Buffer.from(`${kind}:${sourceId}`)]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  ]) {
    loadEnvFile(filePath);
  }
}

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function upsert(client, table, values, onConflict = "id") {
  if (values.length === 0) return;
  const { error } = await client.from(table).upsert(values, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

function inChunks(values, size = 100) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function upsertInChunks(client, table, values, onConflict = "id") {
  for (const chunk of inChunks(values)) await upsert(client, table, chunk, onConflict);
}

function pick(row, fields) {
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]));
}

async function findUser(client, email) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function copyDrafts() {
  loadLocalEnv();
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key === "your-service-role-key") {
    throw new Error("Set local Supabase URL and SUPABASE_SECRET_KEY before copying drafts");
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const source = await findUser(client, SOURCE_EMAIL);
  const target = await findUser(client, TARGET_EMAIL);
  if (!source) throw new Error(`Source account not found: ${SOURCE_EMAIL}`);
  if (!target) throw new Error(`Target account not found: ${TARGET_EMAIL}`);
  if (source.id === target.id) throw new Error("Source and target accounts must differ");

  const targetWorkspaces = await rows(
    client
      .from("workspaces")
      .select("id, name, workspace_type")
      .eq("created_by", target.id)
      .eq("workspace_type", "PERSONAL")
      .order("created_at", { ascending: true })
      .limit(1),
    "target personal workspace",
  );
  const targetWorkspace = targetWorkspaces[0];
  if (!targetWorkspace) throw new Error(`Target personal workspace not found for ${TARGET_EMAIL}`);

  const sourceWorkspaces = await rows(
    client.from("workspaces").select("id, name, workspace_type").eq("created_by", source.id),
    "source workspaces",
  );
  const sourceWorkspaceIds = sourceWorkspaces.map((workspace) => workspace.id);
  if (sourceWorkspaceIds.length === 0) {
    console.log("No source-owned workspaces found; nothing copied");
    return;
  }

  const sourceItems = await rows(
    client
      .from("items")
      .select("*")
      .in("workspace_id", sourceWorkspaceIds)
      .eq("plan_status", "PLANNING")
      .is("deleted_at", null),
    "source draft items",
  );
  if (sourceItems.length === 0) {
    console.log("No PLANNING draft items found; nothing copied");
    return;
  }

  const sourceItemIds = sourceItems.map((item) => item.id);
  const itemIds = new Map(sourceItemIds.map((id) => [id, deterministicUuid("item", id)]));
  const sourceLinks = await rows(
    client.from("item_places").select("*").in("item_id", sourceItemIds),
    "source item places",
  );
  const sourceEvents = await rows(
    client.from("item_events").select("*").in("item_id", sourceItemIds),
    "source item events",
  );
  const sourcePlaceIds = [
    ...new Set([
      ...sourceLinks.map((link) => link.place_id),
      ...sourceEvents.map((event) => event.place_id).filter(Boolean),
    ]),
  ];
  const sourcePlaces = await rows(
    sourcePlaceIds.length
      ? client.from("places").select("*").in("id", sourcePlaceIds)
      : Promise.resolve({ data: [], error: null }),
    "source places",
  );
  const placeIds = new Map(sourcePlaceIds.map((id) => [id, deterministicUuid("place", id)]));

  const copiedItems = sourceItems.map((item) => ({
    ...pick(item, [
      "item_type", "subtype", "title", "description", "category", "category_label",
      "priority", "status", "repeat_mode", "due_at", "planned_start_at",
      "time_precision", "estimated_duration_min", "duration_source", "version",
      "source_text", "created_at", "updated_at", "deleted_at", "plan_status", "best_time",
    ]),
    id: itemIds.get(item.id),
    workspace_id: targetWorkspace.id,
    created_by: target.id,
    last_updated_by: target.id,
  }));
  const copiedPlaces = sourcePlaces.map((place) => ({
    ...pick(place, [
      "name", "formatted_address", "google_place_id", "latitude", "longitude",
      "original_maps_url", "google_maps_url", "primary_type", "categories", "tags",
      "created_at", "updated_at",
    ]),
    id: placeIds.get(place.id),
    workspace_id: targetWorkspace.id,
  }));
  const copiedLinks = sourceLinks.map((link) => ({
    id: deterministicUuid("item-place", link.id),
    item_id: itemIds.get(link.item_id),
    place_id: placeIds.get(link.place_id),
    role: link.role,
    created_at: link.created_at,
  }));

  await upsertInChunks(client, "places", copiedPlaces);
  await upsertInChunks(client, "items", copiedItems);
  await upsertInChunks(client, "item_places", copiedLinks);

  const sourceAssignees = await rows(
    client.from("item_assignees").select("*").in("item_id", sourceItemIds),
    "source item assignees",
  );
  await upsertInChunks(
    client,
    "item_assignees",
    sourceAssignees
      .filter((row) => row.profile_id === source.id || row.profile_id == null)
      .map((row) => ({
        ...pick(row, ["anyone", "created_at"]),
        id: deterministicUuid("item-assignee", row.id),
        item_id: itemIds.get(row.item_id),
        profile_id: row.profile_id ? target.id : null,
      })),
  );

  await upsertInChunks(
    client,
    "item_events",
    sourceEvents.map((event) => ({
      ...pick(event, [
        "event_type", "occurred_at", "ended_at", "time_precision",
        "actual_duration_min", "note", "created_at",
      ]),
      id: deterministicUuid("item-event", event.id),
      workspace_id: targetWorkspace.id,
      item_id: itemIds.get(event.item_id),
      place_id: event.place_id ? placeIds.get(event.place_id) ?? null : null,
      recorded_by: target.id,
    })),
  );

  const childTables = [
    ["plan_travel", ["from_text", "to_text", "transport_mode", "estimated_duration_min", "departure_time", "arrival_time", "notes", "created_at", "updated_at"]],
    ["plan_costs", ["category", "estimated_amount", "actual_amount", "currency", "note", "sort_order", "created_at"]],
    ["plan_activities", ["label", "done", "sort_order", "created_at"]],
    ["plan_preparations", ["label", "done", "sort_order", "created_at"]],
    ["plan_todos", ["task", "status", "priority", "note", "sort_order", "created_at"]],
    ["plan_notes", ["note_type", "content", "created_at"]],
  ];
  for (const [table, fields] of childTables) {
    const sourceRows = await rows(
      client.from(table).select("*").in("item_id", sourceItemIds),
      `source ${table}`,
    );
    const copiedRows = sourceRows.map((row) => ({
      ...pick(row, fields),
      ...(table === "plan_travel" ? {} : { id: deterministicUuid(table, row.id) }),
      item_id: itemIds.get(row.item_id),
    }));
    await upsertInChunks(
      client,
      table,
      copiedRows,
      table === "plan_travel" ? "item_id" : "id",
    );
  }

  console.log(
    `Copied ${sourceItems.length} draft item(s), ${sourcePlaces.length} place(s), and linked plan data from ${SOURCE_EMAIL} to ${TARGET_EMAIL}.`,
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  copyDrafts().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
