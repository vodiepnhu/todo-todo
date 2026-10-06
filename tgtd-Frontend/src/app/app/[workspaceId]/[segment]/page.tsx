import { redirect } from "next/navigation";
import { paths } from "@/lib/paths";

const MAP: Record<string, (id: string) => string> = {
  home: (id) => paths.project(id),
  chat: (id) => paths.projectChat(id),
  // Hash anchors can't ride HTTP redirects — land on dashboard root.
  today: (id) => paths.project(id),
  activities: (id) => paths.projectLists(id),
  lists: (id) => paths.projectLists(id),
  todo: (id) => paths.projectLists(id),
  togo: (id) => paths.projectLists(id),
  history: (id) => paths.project(id),
  dashboard: (id) => paths.project(id),
  settings: (id) => paths.projectSettings(id),
};

export default async function LegacySegmentRedirect({
  params,
}: {
  params: Promise<{ workspaceId: string; segment: string }>;
}) {
  const { workspaceId, segment } = await params;
  const to = MAP[segment]?.(workspaceId) ?? paths.project(workspaceId);
  redirect(to);
}
