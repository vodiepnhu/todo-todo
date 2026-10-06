import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountShell } from "@/components/account/account-shell";
import { LlmSettingsCard } from "@/components/workspace/llm-settings-card";

export default async function AccountLlmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AccountShell active="llm">
      <div className="mx-auto max-w-3xl">
        <LlmSettingsCard />
      </div>
    </AccountShell>
  );
}
