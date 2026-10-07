import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportsApi, type Report, type ReportEdit } from "./api.js";

export const allReportsKey = (projectId?: string) => ["reports", "all", projectId ?? null] as const;
export const projectReportsKey = (projectId: string) => ["reports", "project", projectId] as const;
export const reportKey = (id: string) => ["report", id] as const;

export function useAllReports(projectId?: string) {
  return useQuery({
    queryKey: allReportsKey(projectId),
    queryFn: () => reportsApi.listAll(projectId),
  });
}

export function useProjectReports(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? projectReportsKey(projectId) : ["reports", "project", "none"],
    queryFn: () => reportsApi.list(projectId!),
    enabled: projectId !== undefined,
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: id ? reportKey(id) : ["report", "none"],
    queryFn: () => reportsApi.read(id!),
    enabled: id !== undefined,
    retry: false,
  });
}

function useStored() {
  const qc = useQueryClient();
  return (report: Report) => {
    qc.setQueryData(reportKey(report.id), report);
    void qc.invalidateQueries({ queryKey: ["reports"] });
  };
}

export function useGenerateReport() {
  const store = useStored();
  return useMutation({
    mutationFn: ({ projectId, month }: { projectId: string; month: string }) => reportsApi.generate(projectId, month),
    onSuccess: store,
  });
}

export function useEditReport(report: Pick<Report, "id" | "projectId">) {
  const store = useStored();
  return useMutation({
    mutationFn: (edit: ReportEdit) => reportsApi.edit(report.projectId, report.id, edit),
    onSuccess: store,
  });
}

export function useReportAction(report: Pick<Report, "id" | "projectId">, action: "refresh" | "publish" | "unpublish") {
  const store = useStored();
  return useMutation({
    mutationFn: () => reportsApi[action](report.projectId, report.id),
    onSuccess: store,
  });
}

export function useDeleteReport(report: Pick<Report, "id" | "projectId">) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reportsApi.remove(report.projectId, report.id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: reportKey(report.id) });
      void qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useReportCover(report: Pick<Report, "id" | "projectId" | "hasCover" | "updatedAt">) {
  return useQuery({
    queryKey: [...reportKey(report.id), "cover", report.updatedAt],
    queryFn: () => reportsApi.cover(report.projectId, report.id),
    enabled: report.hasCover,
    staleTime: Infinity,
  });
}

export function useUploadCover(report: Pick<Report, "id" | "projectId">) {
  const store = useStored();
  return useMutation({
    mutationFn: (image: Blob) => reportsApi.uploadCover(report.projectId, report.id, image),
    onSuccess: store,
  });
}

export function useRemoveCover(report: Pick<Report, "id" | "projectId">) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reportsApi.removeCover(report.projectId, report.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKey(report.id) }),
  });
}
