import type { HomeTree } from "@/services/folder-service";
import type { Workspace } from "@/types/database";

export type OwnedProject = Workspace;

export function flattenOwned(tree: HomeTree): OwnedProject[] {
  return [...tree.owned].sort((a, b) => a.name.localeCompare(b.name));
}

export function projectCardBackground(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) {
    return "linear-gradient(135deg, #ffffff 0%, rgba(15, 118, 110, 0.16) 100%)";
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `linear-gradient(135deg, #ffffff 0%, rgba(${r}, ${g}, ${b}, 0.16) 100%)`;
}
