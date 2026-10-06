import { redirect } from "next/navigation";
import { paths } from "@/lib/paths";

export default async function LegacyProjectRedirect({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(paths.project(workspaceId));
}
