import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kpiApi, type KpiInput, type KpiScope } from "./api.js";

export const kpiKey = (scope: KpiScope) =>
  ["kpi", scope.kind, scope.kind === "organization" ? null : scope.id] as const;

export function useKpi(scope: KpiScope | undefined) {
  return useQuery({
    queryKey: scope ? kpiKey(scope) : ["kpi", "none"],
    queryFn: () => kpiApi.read(scope!),
    enabled: scope !== undefined,
  });
}

export function useSaveKpi(scope: KpiScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: KpiInput) => kpiApi.save(scope, body),
    onSuccess: (saved) => qc.setQueryData(kpiKey(scope), saved),
  });
}

export function useClearKpi(scope: KpiScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => kpiApi.clear(scope),
    onSuccess: () => qc.setQueryData(kpiKey(scope), null),
  });
}
