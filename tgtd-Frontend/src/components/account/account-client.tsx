"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  formatSignInMethods,
  hasEmailPasswordProvider,
} from "@/lib/auth/account";
import {
  evaluatePassword,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/auth/password-policy";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { toast } from "sonner";

export function AccountClient({
  userId,
  initialEmail,
  initialIdentities,
}: {
  userId: string;
  initialEmail: string | null;
  initialIdentities: { provider?: string | null }[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email] = useState(initialEmail ?? "");
  const [identities] = useState(initialIdentities);
  const canChangePassword = hasEmailPasswordProvider(identities);
  const signInMethods = formatSignInMethods(identities);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const newEval = evaluatePassword(newPassword);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword =
    Boolean(currentPassword) &&
    newEval.ok &&
    passwordsMatch &&
    newPassword !== currentPassword;

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();
      setDisplayName(data?.display_name ?? "");
    })();
  }, [userId]);

  async function saveProfile() {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", userId);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  async function changePassword() {
    if (!email) {
      toast.error("No email on this account");
      return;
    }
    const evaluation = evaluatePassword(newPassword);
    if (!evaluation.ok) {
      toast.error(evaluation.message ?? "Password does not meet requirements");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current one");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyErr) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="space-y-3">
        <p className="text-sm font-medium">Account</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Email</span>
          <Input value={email || "—"} readOnly className="bg-primary-soft/50" />
        </label>
        <p className="text-xs text-muted">Sign-in: {signInMethods}</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">
            Display name
          </span>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
          />
        </label>
        <p className="text-xs text-muted">Timezone: Australia/Sydney</p>
        <Button onClick={() => void saveProfile()}>Save profile</Button>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Password</p>
        {canChangePassword ? (
          <>
            <p className="text-xs text-muted">
              Use a strong password: {PASSWORD_MIN}–{PASSWORD_MAX} characters
              with upper, lower, number, and symbol.
            </p>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              maxLength={PASSWORD_MAX}
            />
            <PasswordRequirements password={newPassword} />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              maxLength={PASSWORD_MAX}
            />
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <p className="text-xs text-danger">Passwords do not match</p>
            ) : null}
            <Button
              onClick={() => void changePassword()}
              disabled={busy || !canSubmitPassword}
            >
              {busy ? "Updating…" : "Update password"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted">
            Password change is only available for accounts registered with email
            and password.
          </p>
        )}
      </Card>

      <Button variant="outline" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
