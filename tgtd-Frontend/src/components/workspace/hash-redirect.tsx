"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client redirect that preserves hash fragments (HTTP Location cannot). */
export function HashRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return <p className="text-sm text-muted">Redirecting…</p>;
}
