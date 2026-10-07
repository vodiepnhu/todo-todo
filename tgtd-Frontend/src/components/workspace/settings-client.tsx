"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createInvite,
  createViewLink,
  deleteProject,
  setSharingEnabled,
  updateProjectMetadata,
} from "@/services/workspace-service";
import type { InvitePermissions } from "@/services/workspace-service";
import { ProjectAppearancePicker } from "@/components/workspace/project-appearance-picker";
import { normalizeHex } from "@/lib/project-appearance";
import { paths } from "@/lib/paths";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";

export function SettingsClient({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const router = useRouter();
  const { dictionary, locale } = useLocale();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<InvitePermissions>({
    canAdd: true,
    canEdit: true,
    canDelete: true,
  });
  const [members, setMembers] = useState<
    { role: string; profiles: { display_name: string | null } | null }[]
  >([]);
  const [sharingEnabled, setSharingEnabledState] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function reload() {
    const supabase = createClient();
    const [{ data: mem }, { data: ws }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("role, profiles(display_name)")
        .eq("workspace_id", workspaceId)
        .is("archived_at", null),
      supabase
        .from("workspaces")
        .select("name, sharing_enabled, description, tags, icon, color")
        .eq("id", workspaceId)
        .single(),
    ]);
    setMembers((mem ?? []) as unknown as typeof members);
    setSharingEnabledState(!!ws?.sharing_enabled);
    setProjectName(ws?.name ?? "");
    setDescription(ws?.description ?? "");
    setTagsText(((ws?.tags as string[] | null) ?? []).join(", "));
    setIcon(ws?.icon ?? "");
    setColor(ws?.color ?? "");
  }

  useEffect(() => {
    void reload();
  }, [workspaceId, userId]);

  async function handleCreateInvite() {
    setBusy(true);
    try {
      const supabase = createClient();
      const data = await createInvite(
        supabase,
        workspaceId,
        userId,
        inviteEmail,
        invitePermissions,
      );
      const url = `${window.location.origin}/join/${data.token}`;
      setInviteUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateViewLink() {
    setBusy(true);
    try {
      const supabase = createClient();
      const data = await createViewLink(supabase, workspaceId);
      const url = `${window.location.origin}/view/${data.token}`;
      setViewUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("View-only link copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "View link failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSharing(next: boolean) {
    if (!next) {
      const ok = window.confirm(
        "Members lose access; history stays in this project. Continue?",
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      await setSharingEnabled(supabase, workspaceId, next);
      setSharingEnabledState(next);
      if (!next) {
        setInviteUrl(null);
        setViewUrl(null);
      }
      toast.success(next ? "Sharing enabled" : "Sharing disabled");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sharing");
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectMetadata() {
    const name = projectName.trim();
    if (!name) {
      toast.error("Project name required");
      return;
    }
    const iconValue = icon.trim() || null;
    const colorTrimmed = color.trim();
    let colorValue: string | null = null;
    if (colorTrimmed) {
      colorValue = normalizeHex(colorTrimmed);
      if (!colorValue) {
        toast.error("Invalid color — use #rrggbb");
        return;
      }
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateProjectMetadata(supabase, workspaceId, {
        name,
        description: description.trim() || null,
        tags,
        icon: iconValue,
        color: colorValue,
      });
      toast.success("Project details saved");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProject() {
    if (deleteConfirm.trim() !== projectName.trim()) {
      toast.error("Type the exact project name to confirm delete");
      return;
    }
    const ok = window.confirm(
      `Delete project "${projectName}" permanently? All todos, togos, and chat in it will be removed.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await deleteProject(supabase, workspaceId);
      toast.success("Project deleted");
      router.push(paths.projects());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete project");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function runSearch() {
    const supabase = createClient();
    const q = `%${search}%`;
    const { data } = await supabase
      .from("items")
      .select("title, item_type")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .ilike("title", q)
      .limit(10);
    setSearchResults(
      (data ?? []).map((i) => `${i.item_type}: ${i.title}`).join("\n") ||
        "No results",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{dictionary.nav.settings}</h2>
        <LanguageSwitcher />
      </div>
      <Card className="space-y-2">
        <p className="text-sm font-medium">{dictionary.settings.personal}</p>
        <p className="text-xs text-muted">
          {dictionary.settings.personalDescription}
        </p>
        <Link
          href={paths.account()}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium hover:bg-primary-soft/60"
        >
          {dictionary.settings.openPersonal}
        </Link>
      </Card>
      <Card className="space-y-3">
        <p className="text-sm font-medium">{dictionary.settings.project}</p>
        <p className="text-xs text-muted">
          {dictionary.settings.projectDescription}
        </p>
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={dictionary.settings.name}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={dictionary.settings.description}
        />
        <Input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder={dictionary.settings.tags}
        />
        <ProjectAppearancePicker
          name={projectName}
          icon={icon}
          color={color}
          onIconChange={setIcon}
          onColorChange={setColor}
        />
        <Button onClick={() => void saveProjectMetadata()} disabled={busy}>
          {dictionary.settings.saveProject}
        </Button>
      </Card>
      <Card className="space-y-3">
        <p className="text-sm font-medium">{dictionary.settings.sharing}</p>
        <p className="text-xs text-muted">
          {sharingEnabled
            ? dictionary.settings.sharedDescription
            : dictionary.settings.privateDescription}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={sharingEnabled ? "outline" : "default"}
            disabled={busy || !sharingEnabled}
            onClick={() => void handleToggleSharing(false)}
          >
            {dictionary.settings.private}
          </Button>
          <Button
            variant={sharingEnabled ? "default" : "outline"}
            disabled={busy || sharingEnabled}
            onClick={() => void handleToggleSharing(true)}
          >
            {dictionary.settings.shared}
          </Button>
        </div>
        {sharingEnabled && (
          <>
            <p className="text-sm font-medium">{dictionary.settings.members}</p>
            {members.map((m, i) => (
              <p key={i} className="text-sm text-muted">
                {m.profiles?.display_name ?? "Member"} · {m.role}
              </p>
            ))}
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={dictionary.settings.accountEmail}
              autoComplete="email"
            />
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              {([
                ["canAdd", locale === "vi" ? "Thêm" : "Add"],
                ["canEdit", locale === "vi" ? "Sửa" : "Edit"],
                ["canDelete", locale === "vi" ? "Xóa" : "Delete"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={invitePermissions[key]}
                    onChange={(e) =>
                      setInvitePermissions((current) => ({
                        ...current,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <Button onClick={() => void handleCreateInvite()} disabled={busy || !inviteEmail.trim()}>
              {dictionary.settings.createInvite}
            </Button>
            {inviteUrl && (
              <p className="break-all text-xs text-primary">{inviteUrl}</p>
            )}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted">{dictionary.settings.viewLinkDescription}</p>
              <Button variant="outline" onClick={() => void handleCreateViewLink()} disabled={busy}>
                {dictionary.settings.createViewLink}
              </Button>
              {viewUrl && <p className="break-all text-xs text-primary">{viewUrl}</p>}
            </div>
          </>
        )}
      </Card>
      <Card className="space-y-3">
        <p className="text-sm font-medium">{dictionary.settings.search}</p>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dictionary.settings.searchItems}
          />
          <Button onClick={runSearch}>{dictionary.settings.search}</Button>
        </div>
        {searchResults && (
          <pre className="whitespace-pre-wrap text-xs text-muted">
            {searchResults}
          </pre>
        )}
      </Card>
      <Card className="space-y-3 border-rose-200">
        <p className="text-sm font-medium text-rose-700">{dictionary.settings.dangerZone}</p>
        <p className="text-xs text-muted">
          {dictionary.settings.deleteDescription}
        </p>
        <Input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder={projectName || dictionary.settings.projectName}
          disabled={busy}
        />
        <Button
          variant="danger"
          disabled={busy || deleteConfirm.trim() !== projectName.trim()}
          onClick={() => void handleDeleteProject()}
        >
          {dictionary.settings.deleteProject}
        </Button>
      </Card>
      <Button variant="outline" onClick={logout}>
        {dictionary.settings.signOut}
      </Button>
    </div>
  );
}
