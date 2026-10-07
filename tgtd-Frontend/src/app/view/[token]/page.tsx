import { ViewLinkClient } from "@/components/workspace/view-link-client";

export default async function ViewLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ViewLinkClient token={token} />;
}
