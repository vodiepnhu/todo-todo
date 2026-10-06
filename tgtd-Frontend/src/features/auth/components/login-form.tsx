"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/server/supabase/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { isLocalDemoEnabled, resolveLoginEmail, safeNextPath } from "../domain/login";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const demoEnabled = isLocalDemoEnabled();
  const [identifier, setIdentifier] = useState(demoEnabled ? "demo" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(search.get("error") ? "Authentication failed" : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: resolveLoginEmail(identifier, demoEnabled),
        password,
      });
      if (signInError) throw signInError;
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_50%)] px-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted">Sign in to your shared space</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder={demoEnabled ? "Email or demo" : "Email"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="text-sm text-danger">Unable to sign in. Check your credentials.</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        {demoEnabled && (
          <p className="text-center text-xs text-muted">
            Local demo: <code>demo</code> / <code>123456</code>
          </p>
        )}
        <p className="text-center text-sm text-muted">
          No account? <Link className="text-primary underline" href="/signup">Sign up</Link>
        </p>
      </Card>
    </div>
  );
}
