import { useEffect } from "react";
import { create } from "zustand";
import { projectsApi, type Project } from "../api/api.js";

export type ProjectsStatus = "idle" | "loading" | "ready" | "failed";

interface ProjectsStore {
  projects: Project[] | undefined;
  status: ProjectsStatus;
}

export const useProjectsStore = create<ProjectsStore>(() => ({
  projects: undefined,
  status: "idle",
}));

let session = 0;
let loading: Promise<void> | null = null;

function fetchProjects(): Promise<void> {
  const era = session;
  useProjectsStore.setState({ status: "loading" });
  loading = projectsApi.list()
    .then((projects) => {
      if (era === session) useProjectsStore.setState({ projects, status: "ready" });
    })
    .catch(() => {
      if (era === session) useProjectsStore.setState({ status: "failed" });
    })
    .finally(() => {
      if (era === session) loading = null;
    });

  return loading;
}

export function loadProjects(): Promise<void> {
  if (loading) return loading;
  if (useProjectsStore.getState().status === "ready") return Promise.resolve();
  return fetchProjects();
}

export function refreshProjects(): Promise<void> {
  return fetchProjects();
}

export function resetProjects(): void {
  session += 1;
  loading = null;
  useProjectsStore.setState({ projects: undefined, status: "idle" });
}

export type ProjectsResult = {
  readonly isFetching: boolean;
  readonly refetch: () => Promise<void>;
} & (
  | { readonly data: Project[]; readonly isPending: false; readonly isSuccess: true; readonly isError: false }
  | { readonly data: undefined; readonly isPending: true; readonly isSuccess: false; readonly isError: false }
  | { readonly data: undefined; readonly isPending: false; readonly isSuccess: false; readonly isError: true }
);

export function useProjects(clientId?: string): ProjectsResult {
  const projects = useProjectsStore((state) => state.projects);
  const status = useProjectsStore((state) => state.status);

  useEffect(() => { void loadProjects(); }, []);

  const common = { isFetching: status === "loading", refetch: refreshProjects } as const;

  if (status === "failed") {
    return { ...common, data: undefined, isPending: false, isSuccess: false, isError: true };
  }
  if (status !== "ready" || projects === undefined) {
    return { ...common, data: undefined, isPending: true, isSuccess: false, isError: false };
  }
  return {
    ...common,
    data: clientId === undefined
      ? projects
      : projects.filter((project) => project.clientId === clientId),
    isPending: false,
    isSuccess: true,
    isError: false,
  };
}
