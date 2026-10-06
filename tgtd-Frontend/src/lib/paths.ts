/** Canonical app paths — keep links consistent. */

export const paths = {
  projects: () => "/projects",
  project: (id: string) => `/projects/${id}`,
  projectChat: (id: string) => `/projects/${id}/chat`,
  projectToday: (id: string) => `/projects/${id}#today`,
  projectLists: (id: string) => `/projects/${id}/lists`,
  projectHistory: (id: string) => `/projects/${id}#history`,
  projectDashboard: (id: string) => `/projects/${id}`,
  projectSettings: (id: string) => `/projects/${id}/settings`,
  account: () => "/account",
  accountLlm: () => "/account/llm",
  accountAgentops: () => "/account/agentops",
  login: () => "/login",
  signup: () => "/signup",
} as const;
