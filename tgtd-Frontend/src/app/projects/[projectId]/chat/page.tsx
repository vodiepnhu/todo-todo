import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "@/components/chat/chat-client";
import { redirect } from "next/navigation";
import { paths } from "@/lib/paths";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(paths.login());
  return <ChatClient workspaceId={projectId} userId={user.id} />;
}
