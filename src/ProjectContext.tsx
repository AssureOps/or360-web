import { createContext, useContext } from "react";

export type Project = {
  id: string;
  name: string;
  status: string;
  org_id: string;
  go_live_date?: string | null;
  start_date?: string | null;
  handover_target_date?: string | null;
};

export const ProjectCtx = createContext<{ project: Project | null }>({ project: null });
export const useProject = () => useContext(ProjectCtx);
