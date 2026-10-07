import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthenticatedShellPage() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=configuration");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/projects");
  redirect("/projects");
}
