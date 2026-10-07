"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { HomeTree } from "@/services/folder-service";
import { listHomeTree } from "@/services/folder-service";
import { HomeChatClient } from "@/components/home/home-chat-client";
import { HomeAddModal } from "@/components/home/home-add-modal";
import {
  SharingConfirmModal,
  type SharingInvite,
  type SharingDialogMode,
} from "@/components/home/sharing-confirm-modal";
import { flattenOwned, projectCardBackground } from "@/lib/home-projects";
import {
  listHomeActivityStats,
  type HomeActivityStats,
  type HomeWorkspaceStat,
} from "@/lib/home-activity-stats";
import type { Item, Workspace } from "@/types/database";
import { toast } from "sonner";
import { Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/paths";
import {
  EditItemModal,
  type ActivityPlanSave,
} from "@/components/items/edit-item-modal";
import { createInvite, createProject, createViewLink, setSharingEnabled } from "@/services/workspace-service";
import { updatePlan } from "@/services/plan-persist-service";
import type { HomeActivityItem, HomeTodayItem } from "@/lib/home-activity-stats";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";
import { FunnyLogo } from "@/components/ui/funny-logo";
import { HomePlacesSection } from "@/components/home/home-places-section";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTimeOnly(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return `rgba(15, 118, 110, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ActivityCount({ count }: { count: number }) {
  return (
    <span
      className="shrink-0 rounded-md bg-surface/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/75"
      aria-label={`${count} activities`}
      title={`${count} activities`}
    >
      {count}
    </span>
  );
}

function ProjectCard({
  project,
  fallbackColor,
  canToggleSharing,
  stat,
  sharingBusy,
  onRequestSharingChange,
}: {
  project: Workspace;
  fallbackColor: string;
  canToggleSharing: boolean;
  stat?: HomeWorkspaceStat;
  sharingBusy?: boolean;
  onRequestSharingChange?: (project: Workspace) => void;
}) {
  const shared = project.sharing_enabled;
  const accent = project.color || fallbackColor;
  const { dictionary } = useLocale();

  return (
    <Link
      href={paths.project(project.id)}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-white/80 p-0 shadow-[-3px_-3px_10px_rgba(255,255,255,0.9),3px_5px_15px_rgba(147,175,212,0.2)]",
          "transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[-4px_-4px_14px_rgba(255,255,255,1),5px_8px_20px_rgba(147,175,212,0.3)]",
        )}
        style={{ background: `linear-gradient(145deg, #ffffff, ${withAlpha(accent, 0.08)})` }}
      >
        <div className="h-1.5 w-full" style={{ background: accent }} aria-hidden />
        <div className="space-y-2 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold tracking-tight text-foreground">
              {project.icon ? `${project.icon} ` : ""}
              {project.name}
            </p>
            {stat ? <ActivityCount count={stat.activeCount} /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canToggleSharing ? (
              <button
                type="button"
                data-testid={`sharing-toggle-${project.id}`}
                disabled={sharingBusy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRequestSharingChange?.(project);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition shadow-xs",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border/70 bg-white/90 text-foreground/70 hover:bg-primary-soft/50",
                )}
              >
                {shared ? dictionary.settings.shared : dictionary.settings.private}
              </button>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border/70 bg-white/90 text-foreground/70",
                )}
              >
                {shared ? dictionary.settings.shared : dictionary.settings.private}
              </span>
            )}
          </div>
          {stat?.next ? (
            <p className="truncate text-[11px] font-medium text-foreground/65">
              {dictionary.home.next}: {stat.next.title} · {formatWhen(stat.next.at)}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-foreground/45">{dictionary.home.noUpcoming}</p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function ProjectRow({
  project,
  fallbackColor,
  canToggleSharing,
  stat,
  sharingBusy,
  onRequestSharingChange,
}: {
  project: Workspace;
  fallbackColor: string;
  canToggleSharing: boolean;
  stat?: HomeWorkspaceStat;
  sharingBusy?: boolean;
  onRequestSharingChange?: (project: Workspace) => void;
}) {
  const shared = project.sharing_enabled;
  const accent = project.color || fallbackColor;
  const { dictionary, locale } = useLocale();

  return (
    <Link
      href={paths.project(project.id)}
      className="group block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div
        className="neu-card p-4 transition-all duration-200 hover:-translate-y-1"
        style={{ background: projectCardBackground(accent) }}
      >
        <div className="flex items-center justify-between mb-2">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-[-2px_-2px_6px_rgba(255,255,255,0.95),3px_4px_10px_rgba(147,175,212,0.25)] border border-white/90"
            style={{
              background: `linear-gradient(135deg, #ffffff 0%, ${withAlpha(accent, 0.16)} 100%)`,
            }}
          >
            {project.icon || "✈️"}
          </div>

          <div className="flex items-center gap-1.5">
            {canToggleSharing ? (
              <button
                type="button"
                data-testid={`sharing-toggle-${project.id}`}
                disabled={sharingBusy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRequestSharingChange?.(project);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition shadow-xs",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border/70 bg-white/90 text-foreground/75 hover:bg-primary-soft/50",
                )}
              >
                {shared ? dictionary.settings.shared : dictionary.settings.private}
              </button>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-xs",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border/70 bg-white/90 text-foreground/75",
                )}
              >
                {shared ? dictionary.settings.shared : dictionary.settings.private}
              </span>
            )}
          </div>
        </div>

        {project.tags && project.tags.length > 0 ? (
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-primary mb-0.5 truncate">
            {project.tags.join(" · ")}
          </div>
        ) : null}

        <p className="font-heading text-base font-bold text-foreground truncate">
          {project.name}
        </p>

        <div className="mt-0.5 text-[12px] font-medium text-muted">
          📅 {stat ? `${stat.activeCount} ${locale === "vi" ? "hoạt động & địa điểm" : "activities"}` : `0 ${locale === "vi" ? "hoạt động" : "activities"}`}
        </div>

        <div className="neu-inset mt-2.5 flex items-center justify-between px-3 py-1.5 text-xs">
          <span className="truncate text-[11.5px] text-muted">
            {stat?.next ? `${dictionary.home.next}: ${stat.next.title}` : dictionary.home.noUpcoming}
          </span>
          {stat?.next ? (
            <span className="shrink-0 font-extrabold text-primary tabular-nums text-[11.5px] ml-2">
              {formatTimeOnly(stat.next.at)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function HomeShell({
  userId,
  initialTree,
}: {
  userId: string;
  initialTree: HomeTree;
}) {
  const router = useRouter();
  const { dictionary, locale } = useLocale();
  const [tree, setTree] = useState(initialTree);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAllWishlist, setShowAllWishlist] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [stats, setStats] = useState<HomeActivityStats>({
    byWorkspace: {},
    today: [],
    activities: [],
  });
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharingDialog, setSharingDialog] = useState<{
    project: Workspace;
    mode: SharingDialogMode;
    inviteUrl: string | null;
  } | null>(null);
  const [viewing, setViewing] = useState<{
    item: Item;
    projectName: string;
    canEdit: boolean;
    canDelete: boolean;
  } | null>(null);
  const [openingTodayId, setOpeningTodayId] = useState<string | null>(null);

  const ownedProjects = useMemo(() => flattenOwned(tree), [tree]);
  const projectCount = ownedProjects.length + tree.sharedWithMe.length;

  const allProjects = useMemo(
    () => [...ownedProjects, ...tree.sharedWithMe],
    [ownedProjects, tree.sharedWithMe],
  );
  const visibleWishlistProjects = showAllWishlist
    ? ownedProjects
    : ownedProjects.slice(0, 4);

  const colorByProject = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProjects) {
      map.set(p.id, p.color || "#0f766e");
    }
    return map;
  }, [allProjects]);

  function patchSharingLocal(projectId: string, enabled: boolean) {
    setTree((t) => ({
      ...t,
      owned: t.owned.map((p) =>
        p.id === projectId ? { ...p, sharing_enabled: enabled } : p,
      ),
    }));
  }

  async function reload() {
    const supabase = createClient();
    setTree(await listHomeTree(supabase, userId));
  }

  async function loadStats(projects: Array<{ id: string; name: string }>) {
    try {
      const supabase = createClient();
      setStats(await listHomeActivityStats(supabase, projects));
    } catch {
      /* keep prior stats */
    }
  }

  function openSharingDialog(project: Workspace) {
    setSharingDialog({
      project,
      mode: project.sharing_enabled ? "private" : "share",
      inviteUrl: null,
    });
  }

  async function confirmShare(inviteInput: SharingInvite) {
    if (!sharingDialog) return;
    const project = sharingDialog.project;
    setSharingId(project.id);
    try {
      const supabase = createClient();
      await setSharingEnabled(supabase, project.id, true);
      patchSharingLocal(project.id, true);
      const invite = await createInvite(
        supabase,
        project.id,
        userId,
        inviteInput.email,
        inviteInput.permissions,
      );
      const url = `${window.location.origin}/join/${invite.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied");
      } catch {
        toast.success("Sharing enabled");
      }
      setSharingDialog({ project: { ...project, sharing_enabled: true }, mode: "invite", inviteUrl: url });
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not enable sharing",
      );
    } finally {
      setSharingId(null);
    }
  }

  async function confirmView() {
    if (!sharingDialog) return;
    const project = sharingDialog.project;
    setSharingId(project.id);
    try {
      const supabase = createClient();
      await setSharingEnabled(supabase, project.id, true);
      patchSharingLocal(project.id, true);
      const viewLink = await createViewLink(supabase, project.id);
      const url = `${window.location.origin}/view/${viewLink.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("View-only link copied");
      } catch {
        toast.success("Sharing enabled");
      }
      setSharingDialog({ project: { ...project, sharing_enabled: true }, mode: "view", inviteUrl: url });
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create view link",
      );
    } finally {
      setSharingId(null);
    }
  }

  async function confirmPrivate() {
    if (!sharingDialog) return;
    const project = sharingDialog.project;
    setSharingId(project.id);
    try {
      const supabase = createClient();
      await setSharingEnabled(supabase, project.id, false);
      patchSharingLocal(project.id, false);
      toast.success("Project is private");
      setSharingDialog(null);
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not make project private",
      );
    } finally {
      setSharingId(null);
    }
  }

  async function openActivityById(itemId: string, projectNameFallback: string) {
    setOpeningTodayId(itemId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Activity not found");
        return;
      }
      const item = data as Item;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role, can_edit, can_delete")
        .eq("workspace_id", item.workspace_id)
        .eq("profile_id", userId)
        .maybeSingle();
      const projectName =
        allProjects.find((project) => project.id === item.workspace_id)?.name ??
        projectNameFallback;
      const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
      setViewing({
        item,
        projectName,
        canEdit: isAdmin || membership?.can_edit === true,
        canDelete: isAdmin || membership?.can_delete === true,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open activity",
      );
    } finally {
      setOpeningTodayId(null);
    }
  }

  async function openTodayActivity(row: HomeTodayItem) {
    await openActivityById(row.id, row.workspaceName);
  }

  async function saveViewingItem(payload: ActivityPlanSave) {
    if (!viewing?.canEdit) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    try {
      const data = await updatePlan(supabase, payload.id, payload.plan, {
        expectedVersion: payload.version,
        userId: user?.id ?? null,
      });
      toast.success("Saved");
      setViewing({
        item: data as Item,
        projectName: viewing?.projectName ?? "Project",
        canEdit: viewing?.canEdit ?? false,
        canDelete: viewing?.canDelete ?? false,
      });
      await loadStats(allProjects.map((p) => ({ id: p.id, name: p.name })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      if (
        e instanceof Error &&
        e.message.includes("changed elsewhere")
      ) {
        setViewing(null);
        await loadStats(allProjects.map((p) => ({ id: p.id, name: p.name })));
      }
    }
  }

  async function handleNewProject(e?: React.FormEvent) {
    e?.preventDefault();
    const name = projectName.trim();
    if (!name) {
      toast.error("Enter a project name");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const ws = await createProject(supabase, userId, name);
      setProjectName("");
      setAdding(false);
      await reload();
      toast.success("Project created");
      router.push(paths.projectSettings(ws.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setTree(initialTree);
  }, [initialTree]);

  useEffect(() => {
    void loadStats(allProjects.map((p) => ({ id: p.id, name: p.name })));
    const onRefresh = () => {
      void loadStats(allProjects.map((p) => ({ id: p.id, name: p.name })));
    };
    window.addEventListener("planner:refresh", onRefresh);
    return () => window.removeEventListener("planner:refresh", onRefresh);
  }, [allProjects]);

  return (
    <div className="home-atmosphere min-h-dvh">
      {/* Ambient Glow Orbs from mockup */}
      <div className="ambient-orb orb-1" aria-hidden />
      <div className="ambient-orb orb-2" aria-hidden />
      <div className="ambient-orb orb-3" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1180px] flex-col px-4 py-6 sm:px-6 sm:py-8">
        {/* Navbar Serenity Style matching mockup */}
        <nav className="neu-card mb-8 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <FunnyLogo />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-[#e0f2fe] px-3.5 py-1 text-xs font-bold text-primary shadow-xs">
              ☀️ {projectCount} {dictionary.home.projects}
            </span>
            <LanguageSwitcher />
            <Link
              href={paths.account()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/90 bg-white/90 px-4 py-2 text-xs font-bold text-foreground shadow-xs transition hover:bg-primary-soft hover:text-primary"
            >
              <UserRound className="h-4 w-4" />
              {dictionary.home.account}
            </Link>
          </div>
        </nav>

        {/* Hero Section matching mockup with user's requested text adjustments */}
        <div className="mb-10 flex flex-col gap-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/90 bg-[#fef3c7] px-3.5 py-1 text-xs font-bold text-[#b45309] shadow-xs">
              <span>🌴</span>
              <span>{locale === "vi" ? "Hành trình tiếp theo của bạn" : "Your next adventure"}</span>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-[1.2] tracking-tight text-foreground">
              {locale === "vi" ? "Chuyến phiêu lưu tiếp theo" : "Where are we going"}{" "}
              <br />
              <span className="gradient-text">
                {locale === "vi" ? "sẽ bắt đầu ở đâu nhỉ?" : "for our next adventure?"}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium text-muted leading-relaxed">
              {locale === "vi"
                ? 'Lên lịch lẹ lên, không có "để bữa nào" nữa!!!'
                : 'Lock it in already — no more "maybe one day", we\'re actually going!'}
            </p>
          </div>
        </div>

        {/* Main 2-column layout matching mockup */}
        <div className="grid flex-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          {/* Left Column: Sắp diễn ra & Danh sách chuyến đi */}
          <aside className="space-y-7 lg:sticky lg:top-4">
            {/* Section: Sắp diễn ra */}
            <section className="space-y-3" data-testid="today-strip">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>📅</span> {dictionary.home.today}
                </h2>
                <span className="text-[11.5px] font-bold text-primary">
                  Sydney (AEST)
                </span>
              </div>

              <div className="neu-card p-4">
                {stats.today.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-white/70 px-4 py-5 text-sm font-medium text-foreground/55 shadow-xs">
                    {dictionary.home.nothingDue}
                  </div>
                ) : (
                  <ol className="neu-inset p-3 space-y-0">
                    {stats.today.map((row, idx) => {
                      const color =
                        colorByProject.get(row.workspaceId) ?? "#0284c7";
                      const last = idx === stats.today.length - 1;
                      return (
                        <li
                          key={row.id}
                          className="relative flex gap-3 pb-3 last:pb-0 border-b border-dashed border-border/60 last:border-b-0 pt-2 first:pt-0"
                        >
                          <span
                            className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white shadow-xs"
                            style={{ background: color }}
                            aria-hidden
                          />
                          <button
                            type="button"
                            data-testid={`today-activity-${row.id}`}
                            disabled={openingTodayId === row.id}
                            onClick={() => void openTodayActivity(row)}
                            className="min-w-0 flex-1 rounded-xl text-left transition duration-150 hover:bg-primary-soft/50 p-1 disabled:opacity-60"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="min-w-0 break-words text-sm font-bold text-foreground">
                                {row.title}
                              </p>
                              <time
                                className="shrink-0 text-xs font-extrabold tabular-nums"
                                style={{ color }}
                              >
                                {formatTimeOnly(row.at)}
                              </time>
                            </div>
                            <span
                              className="mt-1 inline-flex max-w-full rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground/75"
                              style={{ background: withAlpha(color, 0.18) }}
                            >
                              {row.workspaceName}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-3.5 rounded-2xl justify-center font-bold text-xs"
                  data-testid="home-add-activity"
                  onClick={() => setAddActivityOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {dictionary.home.addActivity}
                </Button>
              </div>
            </section>

            {/* Section: Chuyến đi của bạn */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>🧳</span> {dictionary.home.myProjects}
                </h2>
                <span className="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-xs font-bold text-primary">
                  {ownedProjects.length} {locale === "vi" ? "chuyến đi" : "projects"}
                </span>
              </div>

              <div className="space-y-3">
                {adding ? (
                  <div className="neu-card p-4">
                    <form
                      className="space-y-2.5"
                      onSubmit={(e) => void handleNewProject(e)}
                    >
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder={dictionary.home.newProject}
                        disabled={busy}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={busy}
                          className="flex-1"
                        >
                          {dictionary.home.createProject}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setAdding(false);
                            setProjectName("");
                          }}
                        >
                          {dictionary.home.cancel}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                <button
                  type="button"
                  data-testid="new-project-card"
                  onClick={() => setAdding(true)}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-white/60 p-3 text-center",
                    "font-heading text-sm font-bold text-foreground/75 shadow-xs transition duration-200",
                    "hover:border-primary hover:bg-primary-soft/60 hover:text-primary",
                    adding && "hidden",
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden /> {dictionary.home.newProject}
                </button>

                {visibleWishlistProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    fallbackColor="#0284c7"
                    canToggleSharing
                    stat={stats.byWorkspace[p.id]}
                    sharingBusy={sharingId === p.id}
                    onRequestSharingChange={openSharingDialog}
                  />
                ))}

                {ownedProjects.length > 4 ? (
                  <button
                    type="button"
                    data-testid="wishlist-toggle"
                    aria-expanded={showAllWishlist}
                    onClick={() => setShowAllWishlist((current) => !current)}
                    className="w-full rounded-xl py-2 text-xs font-bold text-primary transition hover:bg-primary-soft/60"
                  >
                    {showAllWishlist
                      ? (locale === "vi" ? "Thu gọn" : "Show less")
                      : (locale === "vi" ? `Xem tất cả (${ownedProjects.length})` : `See all (${ownedProjects.length})`)}
                  </button>
                ) : null}
              </div>
            </section>

            {/* Section: Shared with me */}
            {tree.sharedWithMe.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span>🤝</span> {dictionary.home.sharedWithMe}
                  </h2>
                  <span className="text-xs font-bold text-muted">
                    {tree.sharedWithMe.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tree.sharedWithMe.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      fallbackColor="#0284c7"
                      canToggleSharing={false}
                      stat={stats.byWorkspace[p.id]}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </aside>

          {/* Right Column: AI Assistant & Planner */}
          <section className="min-w-0 space-y-8">
            <HomeChatClient
              userId={userId}
              settingsHref={paths.accountLlm()}
              projects={allProjects.map((project) => ({ id: project.id, name: project.name, color: project.color }))}
              onAdd={() => setAddActivityOpen(true)}
            />
            <HomePlacesSection
              activities={stats.activities}
              locale={locale}
              onAdd={() => setAddActivityOpen(true)}
              onOpen={(activity: HomeActivityItem) =>
                void openActivityById(activity.id, activity.workspaceName)
              }
            />
          </section>
        </div>
      </div>

      {sharingDialog ? (
        <SharingConfirmModal
          project={sharingDialog.project}
          mode={sharingDialog.mode}
          inviteUrl={sharingDialog.inviteUrl}
          busy={sharingId === sharingDialog.project.id}
          onCancel={() => {
            if (!sharingId) setSharingDialog(null);
          }}
          onConfirmShare={(invite) => void confirmShare(invite)}
          onConfirmView={() => void confirmView()}
          onConfirmPrivate={() => void confirmPrivate()}
          onDone={() => setSharingDialog(null)}
        />
      ) : null}

      {viewing ? (
        <EditItemModal
          item={viewing.item}
          projectName={viewing.projectName}
          initialMode="view"
          onClose={() => setViewing(null)}
          onSave={saveViewingItem}
          canEdit={viewing.canEdit}
          canDelete={viewing.canDelete}
        />
      ) : null}

      <HomeAddModal
        open={addActivityOpen}
        onClose={() => setAddActivityOpen(false)}
        userId={userId}
        projects={allProjects.map((p) => ({ id: p.id, name: p.name }))}
        onProjectCreated={(p) => {
          setTree((current) => ({
            ...current,
            owned: current.owned.some((x) => x.id === p.id)
              ? current.owned
              : [
                  {
                    id: p.id,
                    name: p.name,
                    workspace_type: "PERSONAL",
                    sharing_enabled: false,
                    created_by: userId,
                    description: null,
                    tags: [],
                    icon: null,
                    color: null,
                    agentops_full_payload: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  ...current.owned,
                ],
          }));
        }}
      />
    </div>
  );
}
