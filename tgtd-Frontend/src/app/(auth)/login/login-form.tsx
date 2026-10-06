"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const googleAuthEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

/** Local defaults — set NEXT_PUBLIC_DEMO_* in .env.local / .env.docker */
const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/projects";
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const loginId = email.includes("@")
        ? email.trim()
        : `${email.trim()}@planner.local`;
      const { error: err } = await supabase.auth.signInWithPassword({
        email: loginId,
        password,
      });
      if (err) throw err;
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
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
            placeholder="Email or demo1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={5}
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {googleAuthEnabled && (
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={google}
          >
            Continue with Google
          </Button>
        )}
        <p className="text-center text-xs text-muted">
          Demo: <code>demo1</code> / <code>12345</code>
        </p>
        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link className="text-primary underline" href="/signup">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
