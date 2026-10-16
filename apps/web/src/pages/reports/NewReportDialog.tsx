import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, reportPath } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useAlerts,
} from "@/shared/ui/index.js";
import type { Project } from "@/entities/project/index.js";
import { monthTitle, useGenerateReport, useProjectReports } from "@/entities/report/index.js";

export function NewReportDialog({
  projects,
  initialProjectId,
  onClose,
}: {
  projects: Project[];
  initialProjectId?: string;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [month, setMonth] = useState<string | undefined>();
  const available = useProjectReports(projectId).data?.available;
  const generate = useGenerateReport();
  const navigate = useNavigate();
  const { raise } = useAlerts();

  const create = () => {
    if (!projectId || !month) return;
    generate.mutate({ projectId, month }, {
      onSuccess: (report) => navigate(reportPath(report.id)),
      onError: (error) => raise(error instanceof ApiError && error.status < 500 ? error.message : t("report.generateFailed")),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report.new")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-project">{t("report.project")}</Label>
            <Select value={projectId} onValueChange={(next) => { setProjectId(next); setMonth(undefined); }}>
              <SelectTrigger id="report-project" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-month">{t("report.month")}</Label>
            <Select value={month} onValueChange={setMonth} disabled={!available || available.length === 0}>
              <SelectTrigger id="report-month" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(available ?? []).map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>{monthTitle(candidate)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available && available.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("report.month.none")}</p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button disabled={!projectId || !month || generate.isPending} onClick={create}>{t("report.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
