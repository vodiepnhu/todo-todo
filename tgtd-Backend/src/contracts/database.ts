export type WorkspaceType = "PERSONAL" | "SHARED";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

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

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at: string | null;
  archived_at: string | null;
}

export interface WorkspaceMembership {
  member: WorkspaceMember;
  workspace: Workspace;
}
