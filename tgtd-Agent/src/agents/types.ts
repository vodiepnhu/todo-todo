import type { PlannerRequest } from "../schemas/planner";
import type { ActionType, Item } from "../types/database";
import type { RagHit } from "./rag-agent";

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

export type OrchestratorDeps = {
  ingest: (input: {
    message: string;
    currentDate: string;
    currentDatetime: string;
    workspaceTimezone: string;
    userId: string;
    recentChat?: string;
  }) => Promise<IngestResult>;
  listItems: (workspaceId: string) => Promise<Item[]>;
  createPending: (input: CreatePendingInput) => Promise<{ id: string }>;
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
};
