import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountClient } from "@/components/account/account-client";
import { AccountShell } from "@/components/account/account-shell";
import { AccountHashRedirect } from "@/components/account/account-hash-redirect";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const identities =
    user.identities?.map((i) => ({ provider: i.provider })) ?? [];

  return (
    <AccountShell active="account">
      <AccountHashRedirect />
      <AccountClient
        userId={user.id}
        initialEmail={user.email ?? null}
        initialIdentities={identities}
      />
    </AccountShell>
  );
}
