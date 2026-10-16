import { ImageIcon } from "lucide-react";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Dropzone, Loader, useAlerts } from "@/shared/ui/index.js";
import { useRemoveCover, useReportCover, useUploadCover, type Report } from "@/entities/report/index.js";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const FRAME = "relative h-full min-h-64 overflow-hidden rounded-lg border";

function Picture({ report }: { report: Report }) {
  const picture = useReportCover(report);
  return picture.data ? (
    <img src={picture.data} alt={t("report.cover")} className="absolute inset-0 size-full object-contain" />
  ) : (
    <div className="grid size-full place-items-center"><Loader size="sm" /></div>
  );
}

function Placeholder() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
      <ImageIcon aria-hidden className="size-8" />
      <span className="text-sm text-foreground">{t("report.cover.drop")}</span>
      <span className="text-xs">{t("report.cover.hint")}</span>
    </div>
  );
}

export function ReportCover({ report, editable }: { report: Report; editable: boolean }) {
  const upload = useUploadCover(report);
  const remove = useRemoveCover(report);
  const { raise } = useAlerts();
  const failed = (error: unknown) =>
    raise(error instanceof ApiError && error.status < 500 ? error.message : t("report.cover.failed"));

  if (!report.hasCover && !editable) return null;

  const choose = (file: File) => {
    if (!ACCEPTED.includes(file.type) || file.size > MAX_BYTES) {
      raise(t("report.cover.invalid"));
      return;
    }
    upload.mutate(file, { onError: failed });
  };

  if (!editable) {
    return (
      <section aria-label={t("report.cover")} className={`${FRAME} border-border bg-muted/40`}>
        <Picture report={report} />
      </section>
    );
  }

  return (
    <section aria-label={t("report.cover")} className="relative h-full">
      <Dropzone
        label={report.hasCover ? t("report.cover.replace") : t("report.cover.upload")}
        accept={ACCEPTED}
        disabled={upload.isPending}
        onFile={choose}
        className={`${FRAME} group peer ${report.hasCover ? "border-border bg-muted/40" : "border-dashed border-border bg-muted/20 hover:bg-muted/40"}`}
      >
        {upload.isPending ? (
          <div className="grid size-full place-items-center"><Loader size="sm" /></div>
        ) : report.hasCover ? (
          <Picture report={report} />
        ) : (
          <Placeholder />
        )}
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/80 text-sm font-medium text-foreground group-data-[dragging]:flex">
          {t("report.cover.dropping")}
        </span>
      </Dropzone>
      {report.hasCover ? (
        <Button
          size="sm"
          variant="secondary"
          className="absolute right-2 top-2 shadow-sm peer-data-[dragging]:invisible"
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onError: failed })}
        >
          {t("report.cover.remove")}
        </Button>
      ) : null}
    </section>
  );
}
