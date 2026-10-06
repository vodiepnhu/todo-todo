export type LangsmithConfig = {
  apiKey: string;
  project: string;
  endpoint?: string;
};

export function readLangsmithConfig(
  env: NodeJS.ProcessEnv = process.env,
): LangsmithConfig | null {
  const apiKey = env.LANGSMITH_API_KEY?.trim();
  const project = env.LANGSMITH_PROJECT?.trim();
  if (!apiKey || !project) return null;
  const endpoint = env.LANGSMITH_ENDPOINT?.trim() || undefined;
  return { apiKey, project, endpoint };
}
