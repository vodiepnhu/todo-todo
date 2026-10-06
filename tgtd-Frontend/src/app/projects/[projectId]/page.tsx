import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DashboardClient workspaceId={projectId} />;
}
