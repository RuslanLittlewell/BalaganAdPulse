import { useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { cn, reportPath, ROUTES } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { useClients } from "@/entities/client/index.js";
import { useProjects, type Project } from "@/entities/project/index.js";
import { formatMoney, monthTitle, useAllReports } from "@/entities/report/index.js";
import { useCan } from "@/features/permissions/index.js";
import { ReportDownload } from "@/features/report-pdf/index.js";
import { MonthlyReport } from "@/widgets/monthly-report/index.js";
import { NewReportDialog } from "./NewReportDialog.js";

const ALL = "all";

function ReportsList({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const reports = useAllReports(filter === ALL ? undefined : filter);
  const staff = useCan("update", "report");
  const creates = useCan("create", "report");
  const names = new Map(projects.map((project) => [project.id, project]));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.reports")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label={t("report.filter")} className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("report.filter.all")}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {creates ? (
            <Button onClick={() => setCreating(true)}><PlusIcon /> {t("report.new")}</Button>
          ) : null}
        </div>
      </div>

      {reports.data && reports.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("report.empty")}</p>
      ) : (
        <table aria-label={t("report.list")} className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 font-medium">{t("report.month")}</th>
              <th className="py-2 font-medium">{t("report.project")}</th>
              <th className="py-2 text-right font-medium">{t("report.spend")}</th>
              <th className="py-2 text-right font-medium">{t("report.leads")}</th>
              <th className="py-2 text-right font-medium">{t("report.costPerLead")}</th>
              {staff ? <th className="py-2 pl-4 font-medium">{t("report.status")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {(reports.data ?? []).map((report) => {
              const project = names.get(report.projectId);
              const currency = report.currency ?? project?.budgetCurrency ?? null;
              return (
                <tr key={report.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2">
                    <Link to={reportPath(report.id)} className="font-medium text-foreground hover:underline">
                      {monthTitle(report.month)}
                    </Link>
                  </td>
                  <td className="py-2 text-muted-foreground">{project?.name ?? ""}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(report.spend, currency)}</td>
                  <td className="py-2 text-right tabular-nums">{report.leads}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(report.costPerLead, currency)}</td>
                  {staff ? (
                    <td className="py-2 pl-4">
                      <span
                        data-status={report.status}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          report.status === "DRAFT" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        {t(`report.status.${report.status}`)}
                      </span>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {creating ? (
        <NewReportDialog
          projects={projects}
          initialProjectId={filter === ALL ? undefined : filter}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </section>
  );
}

function ReportView({ projects }: { projects: Project[] }) {
  const { reportId } = useParams<{ reportId: string }>();
  const clients = useClients();
  const byId = new Map(projects.map((project) => [project.id, project]));
  const clientName = (projectId: string) =>
    clients.data?.find((client) => client.id === byId.get(projectId)?.clientId)?.name ?? "";
  if (!reportId) return null;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Link
        to={ROUTES.reports}
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" /> {t("report.back")}
      </Link>
      <MonthlyReport
        reportId={reportId}
        projectName={(projectId) => byId.get(projectId)?.name ?? ""}
        currency={(projectId) => byId.get(projectId)?.budgetCurrency ?? null}
        actions={(report) => (
          <ReportDownload
            report={report}
            projectName={byId.get(report.projectId)?.name ?? ""}
            clientName={clientName(report.projectId)}
            currency={report.currency ?? byId.get(report.projectId)?.budgetCurrency ?? null}
          />
        )}
      />
    </div>
  );
}

export function ReportsPage() {
  const projects = useProjects();
  if (projects.isPending) return null;
  const list = projects.data ?? [];
  return (
    <Routes>
      <Route path="/" element={<ReportsList projects={list} />} />
      <Route path=":reportId" element={<ReportView projects={list} />} />
    </Routes>
  );
}
