"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Workspace } from "@/types/database";
import { useLocale } from "@/lib/i18n";

export type SharingDialogMode = "share" | "private" | "invite" | "view";
export type SharingInvite = {
  email: string;
  permissions: {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
};

export function SharingConfirmModal({
  project,
  mode,
  inviteUrl,
  busy,
  onCancel,
  onConfirmShare,
  onConfirmView,
  onConfirmPrivate,
  onDone,
}: {
  project: Workspace;
  mode: SharingDialogMode;
  inviteUrl: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirmShare: (invite: SharingInvite) => void;
  onConfirmView: () => void;
  onConfirmPrivate: () => void;
  onDone: () => void;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [shareKind, setShareKind] = useState<"view" | "account">("account");
  const [permissions, setPermissions] = useState({
    canAdd: true,
    canEdit: true,
    canDelete: true,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const { locale } = useLocale();
  const vi = locale === "vi";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    if ((mode === "invite" || mode === "view") && inviteUrl) {
      inputRef.current?.select();
    }
  }, [mode, inviteUrl]);

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      inputRef.current?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="sharing-confirm-modal"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "share" ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-foreground">
              {vi ? `Chia sẻ “${project.name}”?` : `Share “${project.name}”?`}
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              {vi ? "Chọn chia sẻ công khai chỉ xem, hoặc mời tài khoản kèm quyền thao tác." : "Choose a public view-only link, or invite an account with activity permissions."}
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">{vi ? "Cách chia sẻ" : "Sharing method"}</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="sharing-kind"
                  value="view"
                  checked={shareKind === "view"}
                  onChange={() => setShareKind("view")}
                  data-testid="sharing-choice-view"
                />
                <span>
                  <strong className="block text-foreground">{vi ? "Chỉ xem qua link" : "Only view via link"}</strong>
                  <span className="text-foreground/65">{vi ? "Không cần tài khoản; chỉ xem danh sách hoạt động." : "No account required; view the activity list only."}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="sharing-kind"
                  value="account"
                  checked={shareKind === "account"}
                  onChange={() => setShareKind("account")}
                  data-testid="sharing-choice-account"
                />
                <span>
                  <strong className="block text-foreground">{vi ? "Mời tài khoản" : "Invite an account"}</strong>
                  <span className="text-foreground/65">{vi ? "Email tài khoản bắt buộc; chọn quyền thêm, sửa, xóa." : "Account email required; choose add, edit, and delete permissions."}</span>
                </span>
              </label>
            </fieldset>
            {shareKind === "account" ? (
              <>
                <label className="mt-4 block text-sm font-medium" htmlFor="share-email">
                  {vi ? "Email tài khoản" : "Account email"}
                </label>
                <Input
                  id="share-email"
                  type="email"
                  value={email}
                  placeholder="person@example.com"
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="sharing-email"
                />
                <fieldset className="mt-4 space-y-2">
                  <legend className="text-sm font-medium">{vi ? "Quyền truy cập" : "Permissions"}</legend>
                  {([
                    ["canAdd", vi ? "Thêm hoạt động" : "Add activities"],
                    ["canEdit", vi ? "Chỉnh sửa hoạt động" : "Edit activities"],
                    ["canDelete", vi ? "Xóa hoạt động" : "Delete activities"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-foreground/80">
                      <input
                        type="checkbox"
                        checked={permissions[key]}
                        onChange={(e) =>
                          setPermissions((current) => ({
                            ...current,
                            [key]: e.target.checked,
                          }))
                        }
                        data-testid={`sharing-permission-${key}`}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onCancel}
              >
                {vi ? "Hủy" : "Cancel"}
              </Button>
              <Button
                type="button"
                data-testid={shareKind === "view" ? "sharing-confirm-view" : "sharing-confirm-share"}
                disabled={busy || (shareKind === "account" && !email.trim())}
                onClick={() => shareKind === "view" ? onConfirmView() : onConfirmShare({ email, permissions })}
              >
                {busy ? (vi ? "Đang chia sẻ…" : "Sharing…") : shareKind === "view" ? (vi ? "Tạo link chỉ xem" : "Create view link") : (vi ? "Mời & tạo liên kết" : "Invite & create link")}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "private" ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-foreground">
              {vi ? `Chuyển “${project.name}” sang chế độ riêng tư?` : `Make “${project.name}” private?`}
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              {vi ? "Các thành viên không phải chủ sở hữu sẽ mất quyền truy cập (được lưu trữ). Lịch sử hoạt động vẫn được giữ lại. Liên kết mời sẽ không còn dùng được cho người tham gia mới." : "Non-owner members will lose access (archived). Activity history stays in the project. Invite links stop working for new joins."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onCancel}
              >
                {vi ? "Hủy" : "Cancel"}
              </Button>
              <Button
                type="button"
                variant="danger"
                data-testid="sharing-confirm-private"
                disabled={busy}
                onClick={onConfirmPrivate}
              >
                {busy ? (vi ? "Đang cập nhật…" : "Updating…") : (vi ? "Đặt riêng tư" : "Make private")}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "invite" || mode === "view" ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-foreground">
              {mode === "view" ? (vi ? "Liên kết chỉ xem đã sẵn sàng" : "View-only link ready") : (vi ? "Liên kết mời đã sẵn sàng" : "Invite link ready")}
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
                {mode === "view" ? (vi ? <>Gửi liên kết này cho người cần xem <strong>{project.name}</strong>. Không cần tài khoản.</> : <>Send this link to anyone who needs to view <strong>{project.name}</strong>. No account required.</>) : (vi ? <>Gửi liên kết này cho <strong>{project.name}</strong>. Email tài khoản phải trùng với email đã được mời.</> : <>Send this link to <strong>{project.name}</strong>. Account email must match invite email.</>)}
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                ref={inputRef}
                readOnly
                value={inviteUrl ?? ""}
                data-testid="sharing-invite-url"
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="secondary"
                data-testid="sharing-copy-link"
                onClick={() => void copyLink()}
              >
                {copied ? (vi ? "Đã sao chép" : "Copied") : (vi ? "Sao chép" : "Copy")}
              </Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" data-testid="sharing-done" onClick={onDone}>
                {vi ? "Xong" : "Done"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
