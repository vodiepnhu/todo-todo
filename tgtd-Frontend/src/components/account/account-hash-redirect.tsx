"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { paths } from "@/lib/paths";

/** Legacy `/account#llm` and `/account#agentops` → nested routes. */
export function AccountHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "llm") router.replace(paths.accountLlm());
    else if (hash === "agentops") router.replace(paths.accountAgentops());
  }, [router]);
  return null;
}
