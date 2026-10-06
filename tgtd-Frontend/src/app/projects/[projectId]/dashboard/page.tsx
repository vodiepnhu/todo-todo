import { redirect } from "next/navigation";
import { paths } from "@/lib/paths";

export default async function DashboardRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(paths.project(projectId));
}
