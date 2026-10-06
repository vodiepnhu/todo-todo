import type { HomeTree } from "@/services/folder-service";
import type { Workspace } from "@/types/database";

export type OwnedProject = Workspace;

export function flattenOwned(tree: HomeTree): OwnedProject[] {
  return [...tree.owned].sort((a, b) => a.name.localeCompare(b.name));
}
