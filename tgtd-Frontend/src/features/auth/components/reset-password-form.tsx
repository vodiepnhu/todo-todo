"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/server/supabase/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PASSWORD_MAX, PASSWORD_MIN } from "../domain/password-policy";
import { validatePasswordReset } from "../domain/password-reset";

export function ResetPasswordForm() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        setSupabase(createClient());
      } catch {
        setClientReady(true);
        return;
      }
      setClientReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setError(null);
      }
    });

    supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError("This reset link is invalid or has expired.");
      else if (sessionData.session) setReady(true);
      else setError("This reset link is invalid or has expired.");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validatePasswordReset(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmation("");
    } catch {
      setError("Unable to update password. Request a new reset link and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f5f9fd_60%)] px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted">Use a password you have not used before.</p>
        </div>
        {ready && !message && (
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={`New password (${PASSWORD_MIN}+ chars)`}
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
        {clientReady && !supabase && (
          <p className="text-sm text-danger">
            Unable to load password reset. Check your Supabase configuration.
          </p>
        )}
        {error && !ready && supabase && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-primary">{message}</p>}
        {message && <Link className="text-center text-sm text-primary underline" href="/projects">Continue to Planner</Link>}
      </Card>
    </div>
  );
}
