import { t } from "@/shared/config/index.js";
import { CopyButton } from "@/shared/ui/index.js";

export function BackupCodes({ codes }: { codes: readonly string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{t("twoFactor.backupCodes")}</h4>
        <CopyButton value={codes.join("\n")} label={t("twoFactor.copyCodes")} />
      </div>
      <ul aria-label={t("twoFactor.backupCodes")} className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <p className="text-xs text-muted-foreground">{t("twoFactor.backupCodes.hint")}</p>
    </section>
  );
}
