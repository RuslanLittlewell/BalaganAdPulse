import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, cn, ROUTES, type Currency } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  RollingNumber,
  useAlerts,
} from "@/shared/ui/index.js";
import { useCan } from "@/features/permissions/index.js";
import {
  formatChange,
  formatMoney,
  monthTitle,
  useDeleteReport,
  useEditReport,
  useReport,
  useReportAction,
  type Report,
  type ReportEdit,
} from "@/entities/report/index.js";
import { BestAds } from "./BestAds.js";
import { NumberEditor } from "./NumberEditor.js";
import { ReportCover } from "./ReportCover.js";
import { ReportText } from "./ReportText.js";
import { TrendChart } from "./TrendChart.js";

function changeHint(fraction: string | null): string | undefined {
  const change = formatChange(fraction);
  return change === null ? undefined : `${change} ${t("report.vsPrevious")}`;
}

function EditableFigure({
  label,
  value,
  hint,
  editable,
  editLabel,
  initial,
  pending,
  onSave,
  computed,
  onReset,
}: {
  label: string;
  value: number | string;
  hint?: string;
  editable: boolean;
  editLabel: string;
  initial: number | null;
  pending: boolean;
  onSave: (value: number | null, done: () => void) => void;
  computed?: number;
  onReset?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-lg border border-border glass-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        <RollingNumber value={value} />
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {hint}
        {onReset ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {t("report.leads.computed")}: {computed}
            </span>
            <Button
              size="sm"
              variant="link"
              className="h-auto px-0"
              onClick={onReset}
            >
              {t("report.leads.reset")}
            </Button>
          </span>
        ) : null}
        {editable && !editing ? (
          <Button
            size="sm"
            variant="link"
            className="h-auto px-0"
            onClick={() => setEditing(true)}
          >
            {editLabel}
          </Button>
        ) : null}
        {editing ? (
          <NumberEditor
            label={label}
            initial={initial}
            pending={pending}
            onCancel={() => setEditing(false)}
            onSave={(next) => onSave(next, () => setEditing(false))}
          />
        ) : null}
      </div>
    </div>
  );
}

function StaffBar({ report }: { report: Report }) {
  const refresh = useReportAction(report, "refresh");
  const publish = useReportAction(
    report,
    report.status === "DRAFT" ? "publish" : "unpublish",
  );
  const remove = useDeleteReport(report);
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const { raise } = useAlerts();
  const failed = () => raise(t("report.saveFailed"));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
      <span
        data-status={report.status}
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          report.status === "DRAFT"
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        {t(`report.status.${report.status}`)}
      </span>
      {report.computedAt ? (
        <span className="text-xs text-muted-foreground">
          {t("report.computedAt")}{" "}
          {new Date(report.computedAt).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate(undefined, { onError: failed })}
        >
          {t("report.refresh")}
        </Button>
        <Button
          size="sm"
          variant={report.status === "DRAFT" ? "default" : "outline"}
          disabled={publish.isPending}
          onClick={() => publish.mutate(undefined, { onError: failed })}
        >
          {report.status === "DRAFT"
            ? t("report.publish")
            : t("report.unpublish")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirming(true)}
        >
          {t("report.delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t("report.delete")}
        description={t("report.delete.description")}
        pending={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => navigate(ROUTES.reports),
            onError: failed,
          })
        }
      />
    </div>
  );
}

function ReportBody({
  report,
  projectName,
  currency,
  actions,
}: {
  report: Report;
  projectName: string;
  currency: Currency;
  actions?: ReactNode;
}) {
  const staff = useCan("update", "report");
  const edit = useEditReport(report);
  const { raise } = useAlerts();
  const money = report.currency ?? currency;
  const save = (change: ReportEdit, done?: () => void) =>
    edit.mutate(change, {
      onSuccess: () => done?.(),
      onError: (error) =>
        raise(
          error instanceof ApiError && error.status < 500
            ? error.message
            : t("report.saveFailed"),
        ),
    });
  const corrected = report.leadsOverride != null;
  const showsCover = staff || report.hasCover;

  return (
    <article
      aria-label={`${t("report.title")} · ${monthTitle(report.month)}`}
      className="flex flex-col gap-6 pb-4"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{projectName}</span>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("report.title")} · {monthTitle(report.month)}
          </h1>
        </div>
        {actions}
      </header>

      {staff ? <StaffBar report={report} /> : null}

      <div className={cn("grid gap-3", showsCover && "lg:grid-cols-2")}>
        <div
          className={cn(
            "grid gap-3",
            showsCover ? "content-start" : "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          <MetricCard
            label={t("report.spend")}
            value={formatMoney(report.spend, money)}
          />
          <EditableFigure
            label={t("report.leads")}
            value={report.leads}
            hint={changeHint(report.change.leads)}
            editable={staff}
            editLabel={t("report.leads.correct")}
            initial={report.leads}
            pending={edit.isPending}
            onSave={(value, done) => save({ leadsOverride: value }, done)}
            computed={report.computedLeads}
            onReset={
              staff && corrected
                ? () => save({ leadsOverride: null })
                : undefined
            }
          />
          <MetricCard
            label={t("report.costPerLead")}
            value={formatMoney(report.costPerLead, money)}
            hint={changeHint(report.change.costPerLead)}
          />
          <EditableFigure
            label={t("report.messengerContacts")}
            value={report.messengerContacts ?? "—"}
            editable={staff}
            editLabel={t("report.edit")}
            initial={report.messengerContacts}
            pending={edit.isPending}
            onSave={(value, done) => save({ messengerContacts: value }, done)}
          />
        </div>
        {showsCover ? <ReportCover report={report} editable={staff} /> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart
          title={t("report.trend.leads")}
          points={report.trend.map((point) => ({
            month: point.month,
            value: point.leads,
            label: String(point.leads),
          }))}
        />
        <TrendChart
          title={t("report.trend.cost")}
          points={report.trend.map((point) => ({
            month: point.month,
            value:
              point.costPerLead === null ? null : Number(point.costPerLead),
            label: formatMoney(point.costPerLead, money),
          }))}
        />
      </div>

      <BestAds
        ads={report.ads}
        running={report.runningAds ?? []}
        currency={money}
        editable={staff}
        pending={edit.isPending}
        onChoose={(adIds) => save({ adIds })}
      />

      <ReportText
        title={t("report.conclusions")}
        value={report.conclusions}
        editable={staff}
        pending={edit.isPending}
        onSave={(value, done) => save({ conclusions: value }, done)}
      />
      <ReportText
        title={t("report.plan")}
        value={report.plan}
        editable={staff}
        pending={edit.isPending}
        onSave={(value, done) => save({ plan: value }, done)}
      />
    </article>
  );
}

export function MonthlyReport({
  reportId,
  projectName,
  currency,
  actions,
}: {
  reportId: string;
  projectName: (projectId: string) => string;
  currency: (projectId: string) => Currency;
  actions?: (report: Report) => ReactNode;
}) {
  const report = useReport(reportId);
  if (report.isPending) return null;
  if (!report.data) return <EmptyState title={t("report.notFound")} />;
  return (
    <ReportBody
      report={report.data}
      projectName={projectName(report.data.projectId)}
      currency={currency(report.data.projectId)}
      actions={actions?.(report.data)}
    />
  );
}
