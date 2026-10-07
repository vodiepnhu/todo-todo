"use client";

import { useState } from "react";
import { createClient } from "@/server/supabase/client";
import { Button } from "@/shared/ui/button";
import { googleAuthRedirectUrl } from "../domain/login";

export function GoogleAuthButton({ label = "Continue with Google" }: { label?: string }) {
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "true") return null;

  async function signInWithGoogle() {
    setError(null);
    const { error: signInError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: googleAuthRedirectUrl(window.location.origin) },
    });
    if (signInError) setError(signInError.message);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void signInWithGoogle()}
      >
        {label}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
