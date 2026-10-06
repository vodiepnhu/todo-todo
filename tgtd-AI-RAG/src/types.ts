export type RagHit = {
  sourceId: string;
  score: number;
  chunkText: string;
  workspaceId?: string;
  projectName?: string;
};
