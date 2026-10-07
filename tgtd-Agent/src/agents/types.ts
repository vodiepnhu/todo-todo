import type { PlannerRequest } from "../schemas/planner";
import type { ActionType, Item } from "../types/database";
import type { RagHit } from "./rag-agent";
import type { PlanExtractionResult } from "../lib/ai/extract-plan";
import type { PlanDraft } from "../lib/plans/plan-schema";
import type { Language } from "./language-agent";

export type IngestResult = {
  request: PlannerRequest;
  model: string;
  mocked: boolean;
  latencyMs: number;
  provider?: string;
};

export type CreatePendingInput = {
  workspaceId: string | null;
  actionType: ActionType;
  payload: Record<string, unknown>;
  baseVersion: number | null;
  userId: string;
};

export type ActivePlanPending = {
  id: string;
  workspace_id: string | null;
  action_type: ActionType;
  payload_json: Record<string, unknown>;
  state: string;
  expires_at: string;
};

export type OrchestratorDeps = {
  ingest: (input: {
    message: string;
    currentDate: string;
    currentDatetime: string;
    workspaceTimezone: string;
    userId: string;
    recentChat?: string;
    retrievedContext?: string;
    language?: Language;
  }) => Promise<IngestResult>;
  listItems: (workspaceId: string) => Promise<Item[]>;
  createPending: (input: CreatePendingInput) => Promise<{ id: string }>;
  findActivePlanPending?: (
    workspaceId: string,
    userId: string,
  ) => Promise<ActivePlanPending | null>;
  updatePendingPlan?: (
    pendingId: string,
    workspaceId: string,
    userId: string,
    payload: Record<string, unknown>,
  ) => Promise<ActivePlanPending>;
  extractPlan?: (input: {
    userId: string;
    text: string;
    timezone: string;
    lookupMaps: boolean;
    currentRequest?: string;
    basePlan?: PlanDraft;
    language?: Language;
  }) => Promise<Pick<PlanExtractionResult, "draft"> & Partial<PlanExtractionResult>>;
  extractMapsUrl: (text: string) => string | undefined;
  /** Optional vector retrieve; omit → heuristic-only recommend */
  retrieve?: (workspaceIds: string[], query: string) => Promise<RagHit[]>;
  /** Places agent search (injectable for tests) */
  searchPlace?: (query: string) => Promise<{
    degraded: boolean;
    results: {
      googlePlaceId: string;
      name: string;
      formattedAddress: string;
      latitude: number | null;
      longitude: number | null;
    }[];
  }>;
  safeMapsUrl?: (url: string) => string | null;
};

export type OrchestratorResult = {
  planner: PlannerRequest;
  aiContent: string;
  pendingId: string | null;
  model: string;
  mocked: boolean;
  latencyMs: number;
  provider?: string;
  language?: Language;
};

export type PlannerProgressEvent = {
  step: "understand" | "context" | "places" | "draft" | "check" | "save" | "complete";
  status: "active" | "done";
};
