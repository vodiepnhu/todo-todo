import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth/components/logout-button";
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
  if (!user) redirect("/login?next=/app");

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email ??
    "Authenticated user";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_#b8d4cc_0%,_#f2f7f5_40%,_#fff_75%)] px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-border/80 bg-surface/90 p-8 shadow-[0_1px_0_0_var(--primary-soft)]">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Planner</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Authenticated application shell</h1>
        <p className="mt-4 text-muted">Signed in as <strong className="text-foreground">{displayName}</strong>.</p>
        <p className="mt-2 text-sm text-primary">Authentication active</p>
        <div className="mt-8"><LogoutButton /></div>
      </section>
    </main>
  );
}
