import { useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { ArrowLeftIcon, FileTextIcon, PlusIcon } from "lucide-react";
import { isCustomer } from "@adpulse/access-policy";
import { ariaSortOf, cn, reportPath, ROUTES, useTableSort, type SortValue } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  SearchableSelect,
  SortButton,
} from "@/shared/ui/index.js";
import { useClients } from "@/entities/client/index.js";
import { useProjects, type Project } from "@/entities/project/index.js";
import { formatMoney, monthTitle, useAllReports, type ReportSummary } from "@/entities/report/index.js";
import { useAuth } from "@/features/auth/index.js";
import { useCan } from "@/features/permissions/index.js";
import { ReportDownload } from "@/features/report-pdf/index.js";
import { MonthlyReport } from "@/widgets/monthly-report/index.js";
import { NewReportDialog } from "./NewReportDialog.js";

const ALL = "all";

type SortableColumn = "month" | "project" | "spend" | "leads" | "costPerLead" | "status";

const optionalNumber = (value: string | null) => (value === null ? null : Number(value));

const sortValues = (names: Map<string, Project>): Record<SortableColumn, (report: ReportSummary) => SortValue> => ({
  month: (report) => report.month,
  project: (report) => names.get(report.projectId)?.name,
  spend: (report) => optionalNumber(report.spend),
  leads: (report) => report.leads,
  costPerLead: (report) => optionalNumber(report.costPerLead),
  status: (report) => t(`report.status.${report.status}`),
});

function ReportHeader({
  column,
  label,
  sorting,
  align,
  className,
}: {
  column: SortableColumn;
  label: string;
  sorting: ReturnType<typeof useTableSort<ReportSummary, SortableColumn>>;
  align?: "start" | "end";
  className?: string;
}) {
  const direction = sorting.directionOf(column);
  return (
    <th scope="col" aria-sort={ariaSortOf(direction)} className={cn("py-2 font-medium", className)}>
      <SortButton label={label} direction={direction} align={align} onSort={() => sorting.toggle(column)} />
    </th>
  );
}

function ReportFiles({ reports, names }: { reports: ReportSummary[]; names: Map<string, Project> }) {
  return (
    <ul aria-label={t("report.list")} className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            to={reportPath(report.id)}
            className="flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid aspect-[4/5] w-19 place-items-center rounded-xl bg-primary shadow-sm dark:bg-white/10">
              <FileTextIcon aria-hidden strokeWidth={1.5} className="size-10 text-white" />
            </span>
            <span className="font-medium text-foreground">{monthTitle(report.month)}</span>
            <span className="text-xs text-muted-foreground">{names.get(report.projectId)?.name ?? ""}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReportsList({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const reports = useAllReports(filter === ALL ? undefined : filter);
  const { role } = useAuth();
  const staff = useCan("update", "report");
  const creates = useCan("create", "report");
  const holdsDraft = staff && (reports.data ?? []).some((report) => report.status === "DRAFT");
  const names = new Map(projects.map((project) => [project.id, project]));
  const sorting = useTableSort(reports.data ?? [], sortValues(names));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.reports")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={filter}
            onValueChange={setFilter}
            pinned={[{ value: ALL, label: t("report.filter.all") }]}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
            searchLabel={t("select.search")}
            emptyLabel={t("select.search.empty")}
            ariaLabel={t("report.filter")}
            className="w-45"
          />
          {creates ? (
            <Button onClick={() => setCreating(true)}><PlusIcon /> {t("report.new")}</Button>
          ) : null}
        </div>
      </div>

      {reports.data && reports.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("report.empty")}</p>
      ) : role !== null && isCustomer(role) ? (
        <ReportFiles reports={reports.data ?? []} names={names} />
      ) : (
        <table aria-label={t("report.list")} className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <ReportHeader column="month" label={t("report.month")} sorting={sorting} />
              <ReportHeader column="project" label={t("report.project")} sorting={sorting} />
              <ReportHeader column="spend" label={t("report.spend")} sorting={sorting} align="end" />
              <ReportHeader column="leads" label={t("report.leads")} sorting={sorting} align="end" />
              <ReportHeader column="costPerLead" label={t("report.costPerLead")} sorting={sorting} align="end" />
              {staff ? <ReportHeader column="status" label={t("report.status")} sorting={sorting} className="pl-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {sorting.rows.map((report) => {
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
                    <td className="py-2 pl-3">
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
      {holdsDraft ? <p className="text-xs text-muted-foreground">{t("report.draft.listHint")}</p> : null}

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
    <div className="flex min-h-0 flex-col gap-3">
      <Link
        to={ROUTES.reports}
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-3" /> {t("report.back")}
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
