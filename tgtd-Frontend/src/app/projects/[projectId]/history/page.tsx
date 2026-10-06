import { HashRedirect } from "@/components/workspace/hash-redirect";
import { paths } from "@/lib/paths";

export default async function HistoryRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <HashRedirect to={paths.projectHistory(projectId)} />;
}
