import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import type { Currency } from "@/shared/lib/index.js";
import { Button, useAlerts } from "@/shared/ui/index.js";
import type { Report } from "@/entities/report/index.js";
import { buildDeck } from "../model/slides.js";
import { loadPictures } from "../model/pictures.js";

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportDownload({
  report,
  projectName,
  clientName,
  currency,
}: {
  report: Report;
  projectName: string;
  clientName: string;
  currency: Currency;
}) {
  const [busy, setBusy] = useState(false);
  const { raise } = useAlerts();

  const download = async () => {
    setBusy(true);
    try {
      const deck = buildDeck({ report, projectName, clientName, currency });
      const [{ renderDeck }, pictures] = await Promise.all([
        import("./render.js"),
        loadPictures(report),
      ]);
      save(await renderDeck(deck, pictures), deck.fileName);
    } catch {
      raise(t("report.downloadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}>
      <DownloadIcon /> {busy ? t("report.downloading") : t("report.download")}
    </Button>
  );
}
