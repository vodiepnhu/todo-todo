import { ItemListClient } from "@/components/items/item-list-client";

export default async function ListsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ItemListClient workspaceId={projectId} title="Lists" />;
}
