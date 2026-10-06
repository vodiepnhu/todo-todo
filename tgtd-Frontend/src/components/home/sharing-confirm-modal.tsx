"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Workspace } from "@/types/database";

export type SharingDialogMode = "share" | "private" | "invite";

export function SharingConfirmModal({
  project,
  mode,
  inviteUrl,
  busy,
  onCancel,
  onConfirmShare,
  onConfirmPrivate,
  onDone,
}: {
  project: Workspace;
  mode: SharingDialogMode;
  inviteUrl: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirmShare: () => void;
  onConfirmPrivate: () => void;
  onDone: () => void;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    if (mode === "invite" && inviteUrl) {
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
              Share “{project.name}”?
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              People with the invite link can join as members — they can view and
              edit activities, and use this project&apos;s chat.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="sharing-confirm-share"
                disabled={busy}
                onClick={onConfirmShare}
              >
                {busy ? "Sharing…" : "Share & create link"}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "private" ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-foreground">
              Make “{project.name}” private?
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              Non-owner members will lose access (archived). Activity history
              stays in the project. Invite links stop working for new joins.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                data-testid="sharing-confirm-private"
                disabled={busy}
                onClick={onConfirmPrivate}
              >
                {busy ? "Updating…" : "Make private"}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "invite" ? (
          <>
            <h3 id={titleId} className="text-lg font-bold text-foreground">
              Invite link ready
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              Send this link. Anyone who joins can edit activities and chat in{" "}
              <strong>{project.name}</strong>.
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
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" data-testid="sharing-done" onClick={onDone}>
                Done
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
