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
  type SharingDialogMode,
} from "@/components/home/sharing-confirm-modal";
import { flattenOwned } from "@/lib/home-projects";
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
import { createInvite, createProject, setSharingEnabled } from "@/services/workspace-service";
import { updatePlan } from "@/services/plan-persist-service";
import type { HomeTodayItem } from "@/lib/home-activity-stats";

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

  return (
    <Link
      href={paths.project(project.id)}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-border/90 p-0 shadow-[0_1px_0_0_rgba(15,118,110,0.08)]",
          "transition duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
        )}
        style={{ background: withAlpha(accent, 0.08) }}
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
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-foreground/70",
                )}
              >
                {shared ? "Shared" : "Private"}
              </button>
            ) : (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-foreground/70",
                )}
              >
                {shared ? "Shared" : "Private"}
              </span>
            )}
          </div>
          {stat?.next ? (
            <p className="truncate text-[11px] font-medium text-foreground/65">
              Next: {stat.next.title} · {formatWhen(stat.next.at)}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-foreground/45">No upcoming</p>
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

  return (
    <Link
      href={paths.project(project.id)}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex min-w-0 items-start gap-2 rounded-xl border border-border/80 bg-surface/85 p-2 transition hover:border-primary hover:bg-primary-soft/50">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold leading-5 text-foreground">
              {project.icon ? `${project.icon} ` : ""}
              {project.name}
            </p>
            {stat ? <ActivityCount count={stat.activeCount} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-foreground/70",
                )}
              >
                {shared ? "Shared" : "Private"}
              </button>
            ) : (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  shared
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-foreground/70",
                )}
              >
                {shared ? "Shared" : "Private"}
              </span>
            )}
            {stat?.next ? (
              <span className="min-w-0 break-words text-[10px] font-medium text-foreground/55">
                Next: {stat.next.title} · {formatWhen(stat.next.at)}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-foreground/45">
                No upcoming
              </span>
            )}
          </div>
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
  const [tree, setTree] = useState(initialTree);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [stats, setStats] = useState<HomeActivityStats>({
    byWorkspace: {},
    today: [],
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
  } | null>(null);
  const [openingTodayId, setOpeningTodayId] = useState<string | null>(null);

  const ownedProjects = useMemo(() => flattenOwned(tree), [tree]);
  const projectCount = ownedProjects.length + tree.sharedWithMe.length;

  const allProjects = useMemo(
    () => [...ownedProjects, ...tree.sharedWithMe],
    [ownedProjects, tree.sharedWithMe],
  );

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

  async function confirmShare() {
    if (!sharingDialog) return;
    const project = sharingDialog.project;
    setSharingId(project.id);
    try {
      const supabase = createClient();
      await setSharingEnabled(supabase, project.id, true);
      patchSharingLocal(project.id, true);
      const invite = await createInvite(supabase, project.id, userId);
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

  async function openTodayActivity(row: HomeTodayItem) {
    setOpeningTodayId(row.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("id", row.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Activity not found");
        return;
      }
      setViewing({ item: data as Item, projectName: row.workspaceName });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open activity",
      );
    } finally {
      setOpeningTodayId(null);
    }
  }

  async function saveViewingItem(payload: ActivityPlanSave) {
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
  }, [allProjects]);

  return (
    <div className="home-atmosphere min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
        <header className="border-b border-border/80 bg-surface/75 px-4 py-4 backdrop-blur-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Shared Planner
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold tracking-tight text-foreground">
                Projects ({projectCount})
              </p>
              <p className="text-xs font-medium text-foreground/55">
                Today, projects, and cross-project chat in one place.
              </p>
            </div>
            <nav
              className="flex flex-wrap gap-2 text-sm"
              aria-label="Personal settings"
            >
              <Link
                href={paths.account()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-semibold text-foreground/75 transition hover:bg-primary-soft"
              >
                <UserRound className="h-4 w-4" />
                Account
              </Link>
            </nav>
          </div>
        </header>

        <div className="grid flex-1 gap-5 px-4 py-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-5 lg:sticky lg:top-4">
            <section className="space-y-3" data-testid="today-strip">
              <div className="flex items-end justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Today
                </h2>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                  Australia/Sydney
                </p>
              </div>
              {stats.today.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface/70 px-4 py-5 text-sm font-medium text-foreground/55">
                  Nothing due today
                </div>
              ) : (
                <ol className="relative space-y-0 rounded-2xl border border-border/80 bg-surface/85 p-3 shadow-[0_1px_0_0_rgba(15,118,110,0.06)] backdrop-blur-sm">
                  {stats.today.map((row, idx) => {
                    const color =
                      colorByProject.get(row.workspaceId) ?? "#0f766e";
                    const last = idx === stats.today.length - 1;
                    return (
                      <li
                        key={row.id}
                        className="relative flex gap-3 pb-3 last:pb-0"
                      >
                        {!last ? (
                          <span
                            className="absolute top-3 left-[11px] h-[calc(100%-4px)] w-px bg-border"
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className="relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface"
                          style={{ background: color }}
                          aria-hidden
                        />
                        <button
                          type="button"
                          data-testid={`today-activity-${row.id}`}
                          disabled={openingTodayId === row.id}
                          onClick={() => void openTodayActivity(row)}
                          className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition duration-150 hover:bg-primary-soft/50 disabled:opacity-60"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="min-w-0 break-words text-sm font-semibold text-foreground">
                              {row.title}
                            </p>
                            <time className="shrink-0 text-[11px] font-bold tabular-nums text-foreground/60">
                              {formatTimeOnly(row.at)}
                            </time>
                          </div>
                          <span
                            className="mt-1 inline-flex max-w-full rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-foreground"
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
            </section>

            <section className="space-y-2">
              <Button
                type="button"
                className="w-full justify-start"
                data-testid="home-add-activity"
                onClick={() => setAddActivityOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Activity
              </Button>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/70">
                  My projects
                </h2>
                <span className="text-[11px] font-semibold text-foreground/45">
                  {ownedProjects.length}
                </span>
              </div>
              <div className="max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
                {adding ? (
                  <Card className="border-dashed border-primary/40 bg-surface/90 p-3">
                    <form
                      className="space-y-2"
                      onSubmit={(e) => void handleNewProject(e)}
                    >
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Project name"
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
                          Create
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
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : null}

                <button
                  type="button"
                  data-testid="new-project-card"
                  onClick={() => setAdding(true)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/35 bg-surface/50 px-3 py-2 text-left",
                    "text-sm font-semibold text-foreground/70 transition duration-150",
                    "hover:border-primary hover:bg-primary-soft/60",
                    adding && "hidden",
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden /> New project
                </button>

                {ownedProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    fallbackColor="#0d9488"
                    canToggleSharing
                    stat={stats.byWorkspace[p.id]}
                    sharingBusy={sharingId === p.id}
                    onRequestSharingChange={openSharingDialog}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/70">
                  Shared with me
                </h2>
                <span className="text-[11px] font-semibold text-foreground/45">
                  {tree.sharedWithMe.length}
                </span>
              </div>
              {tree.sharedWithMe.length === 0 ? (
                <p className="text-sm font-medium text-foreground/50">None</p>
              ) : (
                <div className="max-h-[24dvh] space-y-2 overflow-y-auto pr-1">
                  {tree.sharedWithMe.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      fallbackColor="#0f766e"
                      canToggleSharing={false}
                      stat={stats.byWorkspace[p.id]}
                    />
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="min-w-0">
            <HomeChatClient
              userId={userId}
              settingsHref={paths.accountLlm()}
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
          onConfirmShare={() => void confirmShare()}
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
