import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountShell } from "@/components/account/account-shell";
import { AgentOpsDashboard } from "@/components/account/agentops-dashboard";

export default async function AccountAgentOpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AccountShell active="agentops">
      <AgentOpsDashboard />
    </AccountShell>
  );
}
