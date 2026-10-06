"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/server/supabase/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { PasswordRequirements } from "./password-requirements";
import { evaluatePassword, PASSWORD_MAX, PASSWORD_MIN } from "../domain/password-policy";

export function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evaluation = evaluatePassword(password);
    if (!evaluation.ok) {
      setError(evaluation.message ?? "Password does not meet requirements");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: signUpError } = await createClient().auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || email.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;
      setMessage("Check your email for a confirmation link before signing in.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_50%)] px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Join Planner</h1>
          <p className="text-sm text-muted">Create an account for shared planning.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input
            type="password"
            placeholder={`Password (${PASSWORD_MIN}+ chars)`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            required
          />
          <PasswordRequirements password={password} />
          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}
          <Button className="w-full" disabled={loading || !evaluatePassword(password).ok}>
            {loading ? "Creating..." : "Sign up"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted">
          Have an account? <Link className="text-primary underline" href="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
