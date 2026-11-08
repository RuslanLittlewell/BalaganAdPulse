import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kpiApi, projectKpisApi, type KpiInput, type ProjectKpiInput, type SingleKpiScope } from "./api.js";

export const kpiKey = (scope: SingleKpiScope) =>
  ["kpi", scope.kind, scope.kind === "organization" ? null : scope.id] as const;

export const projectKpisKey = (projectId: string) => ["kpi", "project", projectId] as const;

export function useKpi(scope: SingleKpiScope | undefined) {
  return useQuery({
    queryKey: scope ? kpiKey(scope) : ["kpi", "none"],
    queryFn: ({ signal }) => kpiApi.read(scope!, signal),
    enabled: scope !== undefined,
  });
}

export function useSaveKpi(scope: SingleKpiScope) {
  const qc = useQueryClient();
  return useMutation({
    meta: { affectsOnboarding: true },
    mutationFn: (body: KpiInput) => kpiApi.save(scope, body),
    onSuccess: (saved) => qc.setQueryData(kpiKey(scope), saved),
  });
}

export function useClearKpi(scope: SingleKpiScope) {
  const qc = useQueryClient();
  return useMutation({
    meta: { affectsOnboarding: true },
    mutationFn: () => kpiApi.clear(scope),
    onSuccess: () => qc.setQueryData(kpiKey(scope), null),
  });
}

export function useProjectKpis(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? projectKpisKey(projectId) : ["kpi", "project", "none"],
    queryFn: ({ signal }) => projectKpisApi.read(projectId!, signal),
    enabled: projectId !== undefined,
  });
}

export function useSaveProjectKpis(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { affectsOnboarding: true },
    mutationFn: (body: ProjectKpiInput[]) => projectKpisApi.save(projectId, body),
    onSuccess: (saved) => qc.setQueryData(projectKpisKey(projectId), saved),
  });
}
