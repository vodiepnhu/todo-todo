"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { QuickAddModal } from "@/components/items/quick-add-modal";
import { createProject } from "@/services/workspace-service";
import { toast } from "sonner";

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
      toast.error("Project name required");
      return;
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const ws = await createProject(supabase, userId, name);
      const opt = { id: ws.id, name: ws.name };
      onProjectCreated?.(opt);
      setWorkspaceId(ws.id);
      toast.success(`Created ${ws.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <Card className="w-full max-w-lg space-y-3 p-5">
        <h2 className="text-lg font-semibold">Add to which project?</h2>
        <p className="text-xs text-muted">
          Pick an existing project or create a new one, then fill the activity
          form.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-muted">No projects yet — create one below.</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-primary-soft/40"
                  onClick={() => setWorkspaceId(p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">New project</p>
          <Input
            placeholder="Project name"
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
            {creating ? "Creating…" : "Create & continue"}
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cancel
        </Button>
      </Card>
    </div>
  );
}
