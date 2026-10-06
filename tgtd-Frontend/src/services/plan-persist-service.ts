import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/types/database";
import { seedPlanFromDescription } from "@/lib/plans/legacy-description";
import type {
  BestTime,
  Plan,
  PlanDraft,
  PlanNoteType,
  PlanStatus,
  PlanTodoPriority,
  PlanTodoStatus,
} from "@/lib/plans/plan-schema";
import {
  PlanSchema,
  emptyPlan,
  planStatusToItemStatus,
} from "@/lib/plans/plan-schema";

export type PlanInsert = { table: string; row: Record<string, unknown> };

const PLAN_CHILD_TABLES = [
  "plan_travel",
  "plan_costs",
  "plan_activities",
  "plan_food",
  "plan_preparations",
  "plan_todos",
  "plan_notes",
] as const;

function normalizePlanStatus(status: string | null | undefined): PlanStatus {
  return status === "VISITED" || status === "SKIPPED" ? status : "PLANNING";
}

export function buildPlanChildInserts(
  plan: Plan,
  itemId: string,
): PlanInsert[] {
  const out: PlanInsert[] = [];
  if (plan.travel) {
    out.push({
      table: "plan_travel",
      row: {
        item_id: itemId,
        from_text: plan.travel.from,
        to_text: plan.travel.to,
        transport_mode: plan.travel.transportMode,
        estimated_duration_min: plan.travel.estimatedDurationMin,
        departure_time: plan.travel.departureTime,
        arrival_time: plan.travel.arrivalTime,
        notes: plan.travel.notes,
      },
    });
  }
  plan.costs.forEach((c, i) => {
    out.push({
      table: "plan_costs",
      row: {
        item_id: itemId,
        category: c.category,
        estimated_amount: c.estimatedAmount,
        actual_amount: c.actualAmount,
        currency: c.currency || "AUD",
        note: c.note,
        sort_order: i,
      },
    });
  });
  plan.activities.forEach((label, i) => {
    out.push({
      table: "plan_activities",
      row: { item_id: itemId, label, done: false, sort_order: i },
    });
  });
  plan.foodToTry.forEach((label, i) => {
    out.push({
      table: "plan_food",
      row: { item_id: itemId, label, done: false, sort_order: i },
    });
  });
  plan.preparations.forEach((label, i) => {
    out.push({
      table: "plan_preparations",
      row: { item_id: itemId, label, done: false, sort_order: i },
    });
  });
  plan.todos.forEach((t, i) => {
    out.push({
      table: "plan_todos",
      row: {
        item_id: itemId,
        task: t.task,
        status: t.status,
        priority: t.priority,
        note: t.note,
        sort_order: i,
      },
    });
  });
  plan.notes.forEach((n) => {
    out.push({
      table: "plan_notes",
      row: {
        item_id: itemId,
        note_type: n.type,
        content: n.content,
      },
    });
  });
  return out;
}

export async function persistPlan(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  plan: Plan,
): Promise<Item> {
  const { data: item, error } = await supabase
    .from("items")
    .insert({
      workspace_id: workspaceId,
      item_type: "ACTIVITY",
      subtype: "TASK",
      title: plan.placeName,
      description: null,
      status: planStatusToItemStatus(plan.status),
      plan_status: plan.status,
      best_time: plan.experience?.bestTime ?? null,
      planned_start_at: plan.plannedStartAt,
      estimated_duration_min: plan.experience?.estimatedDurationMin ?? null,
      duration_source:
        plan.experience?.estimatedDurationMin != null ? "plan_form" : null,
      time_precision: plan.plannedStartAt ? "DATE_ONLY" : "UNKNOWN",
      created_by: userId,
      last_updated_by: userId,
      source_text: plan.sourceText,
      repeat_mode: "ONE_OFF",
    })
    .select("*")
    .single();
  if (error || !item) throw error || new Error("Failed to create plan item");

  const { data: place, error: placeErr } = await supabase
    .from("places")
    .insert({
      workspace_id: workspaceId,
      name: plan.placeName,
      formatted_address: plan.location,
      original_maps_url: plan.googleMapsUrl,
      google_maps_url: plan.googleMapsUrl,
      google_place_id: plan.googlePlaceId,
      latitude: plan.latitude,
      longitude: plan.longitude,
      categories: plan.categories,
      tags: plan.tags?.length ? plan.tags : plan.categories,
    })
    .select("*")
    .single();
  if (placeErr) throw placeErr;
  if (place) {
    const { error: linkErr } = await supabase.from("item_places").insert({
      item_id: item.id,
      place_id: place.id,
      role: "PRIMARY",
    });
    if (linkErr) throw linkErr;
  }

  for (const { table, row } of buildPlanChildInserts(plan, item.id)) {
    const { error: childErr } = await supabase.from(table).insert(row);
    if (childErr) throw childErr;
  }

  return item as Item;
}

export async function loadPlanDraft(
  supabase: SupabaseClient,
  itemId: string,
): Promise<PlanDraft> {
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (itemErr || !item) throw itemErr || new Error("Item not found");

  const { data: link } = await supabase
    .from("item_places")
    .select("place_id")
    .eq("item_id", itemId)
    .eq("role", "PRIMARY")
    .maybeSingle();

  let place: {
    name: string;
    formatted_address: string | null;
    google_maps_url: string | null;
    original_maps_url: string | null;
    google_place_id: string | null;
    latitude: number | null;
    longitude: number | null;
    categories: string[] | null;
    tags: string[] | null;
  } | null = null;
  if (link?.place_id) {
    const { data } = await supabase
      .from("places")
      .select(
        "name, formatted_address, google_maps_url, original_maps_url, google_place_id, latitude, longitude, categories, tags",
      )
      .eq("id", link.place_id)
      .maybeSingle();
    place = data;
  }

  const [
    { data: travel },
    { data: activities },
    { data: food },
    { data: preparations },
    { data: todos },
    { data: costs },
    { data: notes },
  ] = await Promise.all([
    supabase.from("plan_travel").select("*").eq("item_id", itemId).maybeSingle(),
    supabase
      .from("plan_activities")
      .select("label, sort_order")
      .eq("item_id", itemId)
      .order("sort_order"),
    supabase
      .from("plan_food")
      .select("label, sort_order")
      .eq("item_id", itemId)
      .order("sort_order"),
    supabase
      .from("plan_preparations")
      .select("label, sort_order")
      .eq("item_id", itemId)
      .order("sort_order"),
    supabase
      .from("plan_todos")
      .select("task, status, priority, note, sort_order")
      .eq("item_id", itemId)
      .order("sort_order"),
    supabase
      .from("plan_costs")
      .select(
        "category, estimated_amount, actual_amount, currency, note, sort_order",
      )
      .eq("item_id", itemId)
      .order("sort_order"),
    supabase
      .from("plan_notes")
      .select("note_type, content")
      .eq("item_id", itemId),
  ]);

  const draft: PlanDraft = {
    ...emptyPlan(),
    placeName: place?.name ?? (item.title as string),
    location: place?.formatted_address ?? null,
    googleMapsUrl:
      place?.google_maps_url ?? place?.original_maps_url ?? null,
    googlePlaceId: place?.google_place_id ?? null,
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    categories: place?.categories ?? [],
    tags: place?.tags ?? [],
    status: normalizePlanStatus(item.plan_status as string | null),
    plannedStartAt: (item.planned_start_at as string | null) ?? null,
    sourceText: (item.source_text as string | null) ?? null,
    experience:
      item.best_time != null || item.estimated_duration_min != null
        ? {
            estimatedDurationMin:
              (item.estimated_duration_min as number | null) ?? null,
            recommendedStartTime: null,
            recommendedEndTime: null,
            bestTime: (item.best_time as BestTime | null) ?? null,
            flexibility: null,
          }
        : null,
    travel: travel
      ? {
          from: travel.from_text,
          to: travel.to_text,
          transportMode: travel.transport_mode,
          estimatedDurationMin: travel.estimated_duration_min,
          departureTime: travel.departure_time,
          arrivalTime: travel.arrival_time,
          notes: travel.notes,
        }
      : null,
    activities: (activities ?? []).map((a) => a.label as string),
    foodToTry: (food ?? []).map((f) => f.label as string),
    preparations: (preparations ?? []).map((p) => p.label as string),
    todos: (todos ?? []).map((t) => ({
      task: t.task as string,
      status: t.status as PlanTodoStatus,
      priority: (t.priority as PlanTodoPriority | null) ?? null,
      note: (t.note as string | null) ?? null,
    })),
    costs: (costs ?? []).map((c) => ({
      category: c.category as string,
      estimatedAmount: Number(c.estimated_amount) || 0,
      actualAmount:
        c.actual_amount == null ? null : Number(c.actual_amount),
      currency: (c.currency as string) || "AUD",
      note: (c.note as string | null) ?? null,
    })),
    notes: (notes ?? []).map((n) => ({
      type: n.note_type as PlanNoteType,
      content: n.content as string,
    })),
  };

  return seedPlanFromDescription(draft, item.description as string | null);
}

export async function updatePlan(
  supabase: SupabaseClient,
  itemId: string,
  planInput: Plan,
  opts?: { expectedVersion?: number; userId?: string | null },
): Promise<Item> {
  const plan = PlanSchema.parse(planInput);

  const { data: existing, error: existErr } = await supabase
    .from("items")
    .select("id, workspace_id, version")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();
  if (existErr || !existing) throw existErr || new Error("Item not found");

  if (
    opts?.expectedVersion != null &&
    existing.version !== opts.expectedVersion
  ) {
    throw new Error("Item changed elsewhere — reload and try again");
  }

  const nextVersion =
    opts?.expectedVersion != null
      ? opts.expectedVersion + 1
      : (existing.version as number) + 1;

  let updateQuery = supabase
    .from("items")
    .update({
      title: plan.placeName,
      description: null,
      status: planStatusToItemStatus(plan.status),
      plan_status: plan.status,
      best_time: plan.experience?.bestTime ?? null,
      planned_start_at: plan.plannedStartAt,
      estimated_duration_min: plan.experience?.estimatedDurationMin ?? null,
      duration_source:
        plan.experience?.estimatedDurationMin != null ? "plan_form" : null,
      time_precision: plan.plannedStartAt ? "DATE_ONLY" : "UNKNOWN",
      source_text: plan.sourceText,
      last_updated_by: opts?.userId ?? null,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (opts?.expectedVersion != null) {
    updateQuery = updateQuery.eq("version", opts.expectedVersion);
  }

  const { data: item, error: itemErr } = await updateQuery
    .select("*")
    .maybeSingle();
  if (itemErr) throw itemErr;
  if (!item) throw new Error("Item changed elsewhere — reload and try again");

  const { data: link } = await supabase
    .from("item_places")
    .select("place_id")
    .eq("item_id", itemId)
    .eq("role", "PRIMARY")
    .maybeSingle();

  const placePayload = {
    name: plan.placeName,
    formatted_address: plan.location,
    original_maps_url: plan.googleMapsUrl,
    google_maps_url: plan.googleMapsUrl,
    google_place_id: plan.googlePlaceId,
    latitude: plan.latitude,
    longitude: plan.longitude,
    categories: plan.categories,
    tags: plan.tags?.length ? plan.tags : plan.categories,
  };

  if (link?.place_id) {
    const { error: placeErr } = await supabase
      .from("places")
      .update(placePayload)
      .eq("id", link.place_id);
    if (placeErr) throw placeErr;
  } else {
    const { data: place, error: placeErr } = await supabase
      .from("places")
      .insert({
        workspace_id: existing.workspace_id,
        ...placePayload,
      })
      .select("id")
      .single();
    if (placeErr) throw placeErr;
    if (place) {
      const { error: linkErr } = await supabase.from("item_places").insert({
        item_id: itemId,
        place_id: place.id,
        role: "PRIMARY",
      });
      if (linkErr) throw linkErr;
    }
  }

  for (const table of PLAN_CHILD_TABLES) {
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq("item_id", itemId);
    if (delErr) throw delErr;
  }

  for (const { table, row } of buildPlanChildInserts(plan, itemId)) {
    const { error: childErr } = await supabase.from(table).insert(row);
    if (childErr) throw childErr;
  }

  return item as Item;
}
