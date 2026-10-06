import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listHomeTree } from "@/services/folder-service";
import { OnboardingClient } from "@/components/workspace/onboarding-client";
import { HomeShell } from "@/components/home/home-shell";

export default async function ProjectsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tree = await listHomeTree(supabase, user.id);
  const hasAny = tree.owned.length > 0 || tree.sharedWithMe.length > 0;

  if (!hasAny) {
    return <OnboardingClient userId={user.id} />;
  }

  return <HomeShell userId={user.id} initialTree={tree} />;
}
