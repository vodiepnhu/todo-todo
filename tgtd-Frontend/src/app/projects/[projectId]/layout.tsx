import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceLayoutClient } from "@/components/workspace/workspace-layout-client";
import { paths } from "@/lib/paths";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(paths.login());

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name)")
    .eq("workspace_id", projectId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!membership) notFound();
  const ws = membership.workspaces as unknown as { id: string; name: string };

  return (
    <WorkspaceLayoutClient
      workspaceId={projectId}
      workspaceName={ws.name}
      userId={user.id}
    >
      {children}
    </WorkspaceLayoutClient>
  );
}
