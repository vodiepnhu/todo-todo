export type WorkspaceType = "PERSONAL" | "SHARED";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type ItemType = "ACTIVITY" | "TODO" | "TOGO";
export type ItemSubtype = "TASK" | "VISIT" | "TASK_AT_PLACE";
export type ItemStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "ARCHIVED";
export type PlanStatus =
  | "PLANNING"
  | "VISITED"
  | "SKIPPED";
export type BestTime =
  | "morning"
  | "afternoon"
  | "sunset"
  | "evening"
  | "anytime";
export type PlanNoteType =
  | "general"
  | "tip"
  | "warning"
  | "personal"
  | "booking"
  | "accessibility"
  | "weather";
export type RepeatMode = "ONE_OFF" | "REPEATABLE" | "RECURRING";
export type TimePrecision = "EXACT" | "DATE_ONLY" | "APPROXIMATE" | "UNKNOWN";
export type EventType =
  | "COMPLETED"
  | "VISITED"
  | "TRIED"
  | "STARTED"
  | "SKIPPED"
  | "CANCELLED";
export type PlaceRole = "PRIMARY" | "ALTERNATIVE" | "ORIGIN" | "DESTINATION";
export type MessageType = "USER" | "AI" | "SYSTEM" | "ACTION";
export type PendingState =
  | "AWAITING_CONFIRM_1"
  | "AWAITING_CONFIRM_2"
  | "EXECUTED"
  | "CANCELLED"
  | "EXPIRED";
export type ActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOG_EVENT"
  | "CREATE_PROJECT";

export type Category =
  | "WORK_STUDY"
  | "ADMIN"
  | "ERRAND"
  | "SHOPPING"
  | "FOOD"
  | "HEALTH_FITNESS"
  | "SOCIAL"
  | "TRAVEL"
  | "NATURE"
  | "ENTERTAINMENT"
  | "HOBBY"
  | "SERVICE"
  | "PERSONAL"
  | "OTHER";

export const CATEGORY_LABELS: Record<Category, string> = {
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

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  default_travel_mode: string;
  agentops_full_payload: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  workspace_type: WorkspaceType;
  sharing_enabled: boolean;
  created_by: string;
  description: string | null;
  tags: string[];
  icon: string | null;
  color: string | null;
  agentops_full_payload: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentRunScope = "project" | "cross";

export type AgentSpanName =
  | "ingest"
  | "policy"
  | "places"
  | "guardrail"
  | "mutation"
  | "rag"
  | "communication";

export interface AgentRun {
  id: string;
  profile_id: string;
  workspace_id: string | null;
  scope: AgentRunScope;
  intent: string | null;
  ok: boolean;
  error: string | null;
  total_ms: number | null;
  message_preview: string;
  pending_id: string | null;
  model: string | null;
  mocked: boolean;
  provider: string | null;
  llm_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  cost_source: "provider" | "estimate" | "unknown" | null;
  created_at: string;
}

export interface AgentSpan {
  id: string;
  run_id: string;
  seq: number;
  agent: AgentSpanName;
  ok: boolean;
  latency_ms: number | null;
  error: string | null;
  summary: Record<string, unknown>;
  payload: unknown | null;
  created_at: string;
}

export interface HomeMessage {
  id: string;
  profile_id: string;
  message_type: MessageType;
  content: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at: string | null;
  archived_at: string | null;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Item {
  id: string;
  workspace_id: string;
  item_type: ItemType;
  subtype: ItemSubtype;
  title: string;
  description: string | null;
  category: Category | null;
  category_label: string | null;
  priority: number | null;
  status: ItemStatus;
  repeat_mode: RepeatMode;
  due_at: string | null;
  planned_start_at: string | null;
  time_precision: TimePrecision;
  estimated_duration_min: number | null;
  duration_source: string | null;
  plan_status: PlanStatus | null;
  best_time: BestTime | null;
  created_by: string;
  last_updated_by: string | null;
  version: number;
  source_text: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Place {
  id: string;
  workspace_id: string;
  name: string;
  formatted_address: string | null;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  original_maps_url: string | null;
  google_maps_url: string | null;
  primary_type: string | null;
  categories: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PlanTravel {
  item_id: string;
  from_text: string | null;
  to_text: string | null;
  transport_mode: string | null;
  estimated_duration_min: number | null;
  departure_time: string | null;
  arrival_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanCost {
  id: string;
  item_id: string;
  category: string;
  estimated_amount: number;
  actual_amount: number | null;
  currency: string;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface PlanActivity {
  id: string;
  item_id: string;
  label: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

export interface PlanPreparation {
  id: string;
  item_id: string;
  label: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

export interface PlanTodo {
  id: string;
  item_id: string;
  task: string;
  status: string;
  priority: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface PlanNote {
  id: string;
  item_id: string;
  note_type: PlanNoteType;
  content: string;
  created_at: string;
}

export interface ItemEvent {
  id: string;
  workspace_id: string;
  item_id: string;
  event_type: EventType;
  occurred_at: string;
  ended_at: string | null;
  time_precision: TimePrecision;
  actual_duration_min: number | null;
  place_id: string | null;
  note: string | null;
  recorded_by: string;
  created_at: string;
}

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  sender_profile_id: string | null;
  message_type: MessageType;
  content: string;
  reply_to_message_id: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface PendingAction {
  id: string;
  workspace_id: string | null;
  action_type: ActionType;
  payload_json: Record<string, unknown>;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  base_entity_version: number | null;
  initiated_by: string;
  state: PendingState;
  created_at: string;
  expires_at: string;
  executed_at: string | null;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
}
