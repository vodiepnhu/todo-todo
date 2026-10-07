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
import { useLocale } from "@/lib/i18n";

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
  const { locale } = useLocale();
  const vi = locale === "vi";
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
    else toast.success(vi ? "Đã lưu hồ sơ" : "Profile saved");
  }

  async function changePassword() {
    if (!email) {
      toast.error(vi ? "Tài khoản này chưa có email" : "No email on this account");
      return;
    }
    const evaluation = evaluatePassword(newPassword);
    if (!evaluation.ok) {
      toast.error(vi ? "Mật khẩu chưa đáp ứng yêu cầu" : (evaluation.message ?? "Password does not meet requirements"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(vi ? "Mật khẩu mới không khớp" : "New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error(vi ? "Mật khẩu mới phải khác mật khẩu hiện tại" : "New password must be different from the current one");
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
        toast.error(vi ? "Mật khẩu hiện tại không đúng" : "Current password is incorrect");
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
      toast.success(vi ? "Đã cập nhật mật khẩu" : "Password updated");
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
        <p className="text-sm font-medium">{vi ? "Tài khoản" : "Account"}</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Email</span>
          <Input value={email || "—"} readOnly className="bg-primary-soft/50" />
        </label>
        <p className="text-xs text-muted">{vi ? "Đăng nhập bằng" : "Sign-in"}: {signInMethods}</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">
            {vi ? "Tên hiển thị" : "Display name"}
          </span>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={vi ? "Tên hiển thị" : "Display name"}
          />
        </label>
        <p className="text-xs text-muted">{vi ? "Múi giờ" : "Timezone"}: Australia/Sydney</p>
        <Button onClick={() => void saveProfile()}>{vi ? "Lưu hồ sơ" : "Save profile"}</Button>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">{vi ? "Mật khẩu" : "Password"}</p>
        {canChangePassword ? (
          <>
            <p className="text-xs text-muted">
              {vi ? `Dùng mật khẩu mạnh: ${PASSWORD_MIN}–${PASSWORD_MAX} ký tự, gồm chữ hoa, chữ thường, số và ký hiệu.` : `Use a strong password: ${PASSWORD_MIN}–${PASSWORD_MAX} characters with upper, lower, number, and symbol.`}
            </p>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder={vi ? "Mật khẩu hiện tại" : "Current password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={vi ? "Mật khẩu mới" : "New password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              maxLength={PASSWORD_MAX}
            />
            <PasswordRequirements password={newPassword} />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={vi ? "Xác nhận mật khẩu mới" : "Confirm new password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              maxLength={PASSWORD_MAX}
            />
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <p className="text-xs text-danger">{vi ? "Mật khẩu không khớp" : "Passwords do not match"}</p>
            ) : null}
            <Button
              onClick={() => void changePassword()}
              disabled={busy || !canSubmitPassword}
            >
              {busy ? (vi ? "Đang cập nhật…" : "Updating…") : (vi ? "Cập nhật mật khẩu" : "Update password")}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted">
            {vi ? "Chỉ tài khoản đăng ký bằng email và mật khẩu mới đổi được mật khẩu." : "Password change is only available for accounts registered with email and password."}
          </p>
        )}
      </Card>

      <Button variant="outline" onClick={() => void logout()}>
        {vi ? "Đăng xuất" : "Sign out"}
      </Button>
    </div>
  );
}
