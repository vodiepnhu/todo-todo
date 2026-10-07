"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { QuickAddModal } from "@/components/items/quick-add-modal";
import { createProject } from "@/services/workspace-service";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n";

export type HomeProjectOption = { id: string; name: string };

/**
 * Home Add: pick / create project, then reuse project Quick Add.
 */
export function HomeAddModal({
  open,
  onClose,
  userId,
  projects,
  initialText = "",
  onProjectCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  projects: HomeProjectOption[];
  initialText?: string;
  onProjectCreated?: (project: HomeProjectOption) => void;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setWorkspaceId(null);
      setNewName("");
      setCreating(false);
    }
  }, [open]);

  if (!open) return null;

  if (workspaceId) {
    return (
      <QuickAddModal
        open
        onClose={onClose}
        workspaceId={workspaceId}
        userId={userId}
        initialText={initialText}
      />
    );
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      toast.error(vi ? "Cần nhập tên dự án" : "Project name required");
      return;
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const ws = await createProject(supabase, userId, name);
      const opt = { id: ws.id, name: ws.name };
      onProjectCreated?.(opt);
      setWorkspaceId(ws.id);
      toast.success(vi ? `Đã tạo ${ws.name}` : `Created ${ws.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (vi ? "Không thể tạo dự án" : "Could not create project"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/35 backdrop-blur-xs p-4 sm:items-center">
      <Card className="w-full max-w-lg space-y-4 p-6 rounded-3xl border border-white/90 bg-white/95 shadow-2xl backdrop-blur-md">
        <h2 className="text-lg font-semibold">{vi ? "Thêm vào dự án nào?" : "Add to which project?"}</h2>
        <p className="text-xs text-muted">
          {vi ? "Chọn dự án hiện có hoặc tạo dự án mới, sau đó điền form hoạt động." : "Pick an existing project or create a new one, then fill the activity form."}
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-muted">{vi ? "Chưa có dự án — tạo một dự án bên dưới." : "No projects yet — create one below."}</p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border/70 bg-white px-3.5 py-2.5 text-left text-sm font-medium shadow-xs transition hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                  onClick={() => setWorkspaceId(p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">{vi ? "Dự án mới" : "New project"}</p>
          <Input
            placeholder={vi ? "Tên dự án" : "Project name"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <Button
            className="w-full"
            disabled={creating || !newName.trim()}
            onClick={() => void handleCreate()}
          >
            {creating ? (vi ? "Đang tạo…" : "Creating…") : (vi ? "Tạo và tiếp tục" : "Create & continue")}
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          {vi ? "Hủy" : "Cancel"}
        </Button>
      </Card>
    </div>
  );
}
