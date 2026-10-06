"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/server/supabase/client";
import { Button } from "@/shared/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={logout} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
