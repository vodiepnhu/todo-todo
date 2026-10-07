import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { ActionType, Item, PendingAction } from "../types/database";
import { env } from "../lib/env";
import {
  deleteItemEmbedding,
  upsertItemEmbedding,
  buildItemChunkText,
} from "@togo-todo/ai-rag";
import { validatePendingPayload } from "@togo-todo/agent";
import { recordAgentEvent } from "../lib/agentops/agentops";
import { createProject } from "./workspace-service";
import { PlanSchema } from "../lib/plans/plan-schema";
import { persistPlan } from "./plan-persist-service";
import { safeMapsRedirect } from "@togo-todo/agent";

export function isConfirmationKeyword(value: string) {
  const normalized = value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return normalized === "confirm" || normalized === "xac nhan";
}

export function formatConfirmationReply(value: string) {
  return value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() === "xac nhan"
    ? "Đã lưu. Kế hoạch đang chờ đã được xác nhận."
    : "Saved. Your pending plan was confirmed.";
}

export async function createPendingAction(
  supabase: SupabaseClient,
  input: {
    workspaceId: string | null;
    actionType: ActionType;
    payload: Record<string, unknown>;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    baseVersion?: number | null;
    userId: string;
  },
): Promise<PendingAction> {
  const expires = new Date(
    Date.now() + env.CONFIRMATION_TTL_MINUTES * 60_000,
  ).toISOString();
  const { data, error } = await supabase
    .from("pending_actions")
    .insert({
      workspace_id: input.workspaceId,
      action_type: input.actionType,
      payload_json: input.payload,
      before_json: input.before ?? null,
      after_json: input.after ?? null,
      base_entity_version: input.baseVersion ?? null,
      initiated_by: input.userId,
      state: "AWAITING_CONFIRM_2",
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PendingAction;
}

export async function findActivePlanPending(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<PendingAction | null> {
  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("initiated_by", userId)
    .eq("action_type", "CREATE")
    .eq("state", "AWAITING_CONFIRM_2")
    .is("before_json", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PendingAction | null) ?? null;
}

export async function updatePendingPlan(
  supabase: SupabaseClient,
  pendingId: string,
  workspaceId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<PendingAction> {
  const expires = new Date(
    Date.now() + env.CONFIRMATION_TTL_MINUTES * 60_000,
  ).toISOString();
  const { data, error } = await supabase
    .from("pending_actions")
    .update({ payload_json: payload, expires_at: expires })
    .eq("id", pendingId)
    .eq("workspace_id", workspaceId)
    .eq("initiated_by", userId)
    .eq("action_type", "CREATE")
    .eq("state", "AWAITING_CONFIRM_2")
    .is("before_json", null)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pending plan not found");
  return data as PendingAction;
}

export async function advanceConfirmation(
  supabase: SupabaseClient,
  pendingId: string,
  userId: string,
): Promise<{ pending: PendingAction; executed?: Item | null; message?: string }> {
  const { data: pending, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("id", pendingId)
    .eq("initiated_by", userId)
    .maybeSingle();
  if (error || !pending) throw error || new Error("Pending not found");

  if (pending.workspace_id) {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", pending.workspace_id)
      .eq("profile_id", userId)
      .is("archived_at", null)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("Forbidden");
  }

  if (
    pending.state !== "AWAITING_CONFIRM_1" &&
    pending.state !== "AWAITING_CONFIRM_2"
  ) {
    throw new Error(`Invalid pending state: ${pending.state}`);
  }
  if (pending.before_json?.__confirmation_claim) {
    throw new Error("Pending action was already confirmed");
  }

  if (new Date(pending.expires_at) < new Date()) {
    const expiryQuery = supabase
      .from("pending_actions")
      .update({ state: "EXPIRED" })
      .eq("id", pendingId)
      .eq("initiated_by", userId)
      .eq("state", pending.state)
      .eq("payload_json", JSON.stringify(pending.payload_json))
      .lte("expires_at", new Date().toISOString());
    const { error: expiryError } = await (
      pending.before_json === null
        ? expiryQuery.is("before_json", null)
        : expiryQuery.eq("before_json", JSON.stringify(pending.before_json))
    );
    if (expiryError) throw expiryError;
    throw new Error("Confirmation expired");
  }

  const payloadSnapshot = JSON.stringify(pending.payload_json ?? {});
  const guard = validatePendingPayload(
    pending.action_type,
    (pending.payload_json ?? {}) as Record<string, unknown>,
  );
  if (!guard.ok) {
    recordAgentEvent({
      event: "confirm_guardrail_reject",
      workspaceId: pending.workspace_id,
      ok: false,
      error: guard.reasons.join("; "),
      pendingId,
      meta: { actionType: pending.action_type },
    });
    throw new Error(`Guardrail blocked execute: ${guard.reasons.join("; ")}`);
  }

  // Version check for updates
  if (
    pending.action_type === "UPDATE" &&
    pending.payload_json?.id &&
    pending.base_entity_version != null
  ) {
    const { data: current } = await supabase
      .from("items")
      .select("version")
      .eq("id", pending.payload_json.id)
      .single();
    if (current && current.version !== pending.base_entity_version) {
      throw new Error(
        "This item changed while you were editing it. Please review the latest version.",
      );
    }
  }

  const claim = {
    __confirmation_claim: randomUUID(),
    previous: pending.before_json,
  };
  const claimQuery = supabase
    .from("pending_actions")
    .update({ before_json: claim })
    .eq("id", pendingId)
    .eq("initiated_by", userId)
    .eq("state", pending.state)
    .eq("payload_json", payloadSnapshot)
    .gt("expires_at", new Date().toISOString());
  const { data: claimed, error: claimError } = await (
    pending.before_json === null
      ? claimQuery.is("before_json", null)
      : claimQuery.eq("before_json", JSON.stringify(pending.before_json))
  ).select("*").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new Error("Pending action changed or was already confirmed");

  let executed: Item | null;
  let writeStarted = false;
  try {
    executed = await executePending(supabase, claimed as PendingAction, userId, () => {
      writeStarted = true;
    });
  } catch (executionError) {
    if (writeStarted) {
      throw new Error("Execution outcome uncertain; pending action requires reconciliation", {
        cause: executionError,
      });
    }
    const { data: restored, error: restoreError } = await supabase
      .from("pending_actions")
      .update({ before_json: pending.before_json })
      .eq("id", pendingId)
      .eq("initiated_by", userId)
      .eq("state", pending.state)
      .eq("before_json", JSON.stringify(claim))
      .select("id")
      .maybeSingle();
    if (restoreError || !restored) {
      throw new AggregateError(
        [executionError, restoreError ?? new Error("Confirmation claim recovery failed")],
        "Execution failed and confirmation claim could not be released",
      );
    }
    throw executionError;
  }

  const { data: done, error: doneErr } = await supabase
    .from("pending_actions")
    .update({ state: "EXECUTED", executed_at: new Date().toISOString(), before_json: pending.before_json })
    .eq("id", pendingId)
    .eq("initiated_by", userId)
    .eq("state", pending.state)
    .eq("before_json", JSON.stringify(claim))
    .select("*")
    .maybeSingle();
  if (doneErr || !done) {
    throw new Error("Execution outcome uncertain; pending action requires reconciliation", {
      cause: doneErr ?? new Error("Pending action finalization returned no row"),
    });
  }

  return { pending: done as PendingAction, executed };
}

async function executePending(
  supabase: SupabaseClient,
  pending: PendingAction,
  userId: string,
  onWrite: () => void,
): Promise<Item | null> {
  const payload = pending.payload_json;
  let item: Item | null = null;
  let summary = "";

  if (pending.action_type === "CREATE_PROJECT") {
    const name = String(payload.name ?? "").trim();
    if (!name) throw new Error("Project name required");
    onWrite();
    const ws = await createProject(supabase, userId, name, {
      description: (payload.description as string | undefined) ?? undefined,
      tags: (payload.tags as string[] | undefined) ?? undefined,
      icon: (payload.icon as string | undefined) ?? undefined,
      color: (payload.color as string | undefined) ?? undefined,
    });
    summary = `Created project ${ws.name}`;
    await supabase
      .from("pending_actions")
      .update({ after_json: { workspace_id: ws.id, name: ws.name } })
      .eq("id", pending.id);
    await supabase.from("audit_logs").insert({
      workspace_id: ws.id,
      actor_profile_id: userId,
      action: "CREATE_PROJECT",
      entity_type: "workspace",
      entity_id: ws.id,
      summary,
    });
    return null;
  }

  if (!pending.workspace_id) {
    throw new Error("Missing workspace for pending action");
  }
  const workspaceId = pending.workspace_id;

  if (pending.action_type === "CREATE") {
    if (payload.schema === "plan" && payload.plan) {
      const plan = PlanSchema.parse(payload.plan);
      if (plan.googleMapsUrl && !safeMapsRedirect(plan.googleMapsUrl)) {
        throw new Error("Untrusted Google Maps URL");
      }
      onWrite();
      item = await persistPlan(supabase, workspaceId, userId, plan);
      summary = `Added plan ${item.title}`;
      const { data: wsMeta } = await supabase
        .from("workspaces")
        .select("name, tags")
        .eq("id", workspaceId)
        .maybeSingle();
      await upsertItemEmbedding(
        supabase,
        item,
        {
          projectName: wsMeta?.name,
          tags: [
            ...((wsMeta?.tags as string[] | null) ?? []),
            ...(plan.categories ?? []),
            ...(plan.tags ?? []),
          ],
        },
        buildItemChunkText(item, {
          placeName: plan.placeName,
          location: plan.location,
          categories: plan.categories,
          tags: plan.tags,
          travel: plan.travel
            ? `${plan.travel.from ?? ""}→${plan.travel.to ?? ""} ${plan.travel.transportMode ?? ""} ${plan.travel.estimatedDurationMin ?? ""}min`
            : null,
          activities: plan.activities,
          preparations: plan.preparations,
          costsSummary: plan.costs
            .map((c) => `${c.category} $${c.estimatedAmount}`)
            .join(", "),
          notes: plan.notes.map((n) => n.content),
        }),
      );
    } else {
      onWrite();
      const { data, error } = await supabase
        .from("items")
        .insert({
          workspace_id: workspaceId,
          item_type: payload.itemType ?? "ACTIVITY",
          subtype: payload.subtype ?? "TASK",
          title: payload.title ?? "Untitled",
          description: payload.description ?? null,
          category: payload.category ?? null,
          category_label: payload.categoryLabel ?? null,
          priority: payload.priority ?? null,
          status: "ACTIVE",
          repeat_mode: payload.repeatMode ?? "ONE_OFF",
          due_at: payload.dueAt ?? null,
          planned_start_at: payload.plannedStartAt ?? null,
          time_precision: payload.timePrecision ?? "UNKNOWN",
          estimated_duration_min: payload.estimatedDurationMin ?? null,
          duration_source: payload.durationSource ?? null,
          best_time: payload.bestTime ?? null,
          created_by: userId,
          last_updated_by: userId,
          source_text: payload.sourceText ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      item = data as Item;
      summary = `Added ${item.title}`;
      const { data: wsMeta } = await supabase
        .from("workspaces")
        .select("name, tags")
        .eq("id", workspaceId)
        .maybeSingle();
      await upsertItemEmbedding(supabase, item, {
        projectName: wsMeta?.name,
        tags: (wsMeta?.tags as string[] | null) ?? [],
      });

      if (payload.placeQuery || payload.googleMapsUrl) {
        const { data: place } = await supabase
          .from("places")
          .insert({
            workspace_id: workspaceId,
            name: (payload.placeQuery as string) || item.title,
            formatted_address: payload.formattedAddress ?? null,
            original_maps_url: payload.googleMapsUrl ?? null,
            google_maps_url: payload.googleMapsUrl ?? null,
            google_place_id: payload.googlePlaceId ?? null,
            latitude: payload.latitude ?? null,
            longitude: payload.longitude ?? null,
          })
          .select("*")
          .single();
        if (place) {
          await supabase.from("item_places").insert({
            item_id: item.id,
            place_id: place.id,
            role: "PRIMARY",
          });
        }
      }
    }
  } else if (pending.action_type === "UPDATE") {
    const id = payload.id as string;
    const { data: existing } = await supabase.from("items").select("*").eq("id", id).single();
    onWrite();
    const { data, error } = await supabase
      .from("items")
      .update({
        title: payload.title ?? existing?.title,
        description: payload.description ?? existing?.description,
        due_at: payload.dueAt !== undefined ? payload.dueAt : existing?.due_at,
        planned_start_at:
          payload.plannedStartAt !== undefined
            ? payload.plannedStartAt
            : existing?.planned_start_at,
        status: payload.status ?? existing?.status,
        last_updated_by: userId,
        version: (existing?.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    item = data as Item;
    summary = `Updated ${item.title}`;
    const { data: wsMeta } = await supabase
      .from("workspaces")
      .select("name, tags")
      .eq("id", workspaceId)
      .maybeSingle();
    await upsertItemEmbedding(supabase, item, {
      projectName: wsMeta?.name,
      tags: (wsMeta?.tags as string[] | null) ?? [],
    });
  } else if (pending.action_type === "DELETE") {
    const id = payload.id as string;
    onWrite();
    const { data, error } = await supabase
      .from("items")
      .update({
        deleted_at: new Date().toISOString(),
        last_updated_by: userId,
        version: (payload.version as number) + 1 || undefined,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    item = data as Item;
    summary = `Deleted ${item.title}`;
    await deleteItemEmbedding(supabase, item.id);
  } else if (pending.action_type === "LOG_EVENT") {
    const itemId = payload.itemId as string | undefined;
    let targetId = itemId;
    if (!targetId && payload.title) {
      const { data: found } = await supabase
        .from("items")
        .select("id")
        .eq("workspace_id", workspaceId)
        .ilike("title", `%${payload.title}%`)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      targetId = found?.id;
      if (!targetId) {
        onWrite();
        const { data: created } = await supabase
          .from("items")
          .insert({
            workspace_id: workspaceId,
            item_type: payload.itemType ?? "ACTIVITY",
            subtype: payload.subtype ?? "TASK",
            title: payload.title,
            status: "ACTIVE",
            repeat_mode: "REPEATABLE",
            created_by: userId,
            last_updated_by: userId,
          })
          .select("*")
          .single();
        targetId = created?.id;
        item = created as Item;
        if (item) await upsertItemEmbedding(supabase, item);
      }
    }
    if (!targetId) throw new Error("No item for event");
    onWrite();
    await supabase.from("item_events").insert({
      workspace_id: workspaceId,
      item_id: targetId,
      event_type: payload.eventType ?? "COMPLETED",
      occurred_at: payload.occurredAt ?? new Date().toISOString(),
      time_precision: payload.timePrecision ?? "APPROXIMATE",
      note: payload.note ?? null,
      recorded_by: userId,
    });
    summary = `Logged ${(payload.eventType as string) || "event"} for ${payload.title || targetId}`;
  }

  await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    actor_profile_id: userId,
    action: pending.action_type,
    entity_type: "item",
    entity_id: item?.id ?? (payload.id as string) ?? null,
    summary,
  });

  await supabase.from("workspace_messages").insert({
    workspace_id: workspaceId,
    sender_profile_id: null,
    message_type: "SYSTEM",
    content: summary,
    linked_entity_type: item ? "item" : null,
    linked_entity_id: item?.id ?? null,
  });

  return item;
}

export async function cancelPending(supabase: SupabaseClient, pendingId: string) {
  const { error } = await supabase
    .from("pending_actions")
    .update({ state: "CANCELLED" })
    .eq("id", pendingId);
  if (error) throw error;
}
