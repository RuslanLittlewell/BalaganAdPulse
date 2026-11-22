import { useState } from "react";
import { t } from "@/shared/config/index.js";
import { formatDateTime } from "@/shared/lib/index.js";
import { Button, Loader } from "@/shared/ui/index.js";
import { useTrustedAddresses, useTwoFactorChanges, useTwoFactorStatus } from "../api/api.js";
import { BackupCodes } from "./BackupCodes.js";
import { CodeForm } from "./CodeForm.js";
import { TwoFactorEnrolment } from "./TwoFactorEnrolment.js";
import { twoFactorError } from "./errors.js";

type Asking = "renew" | "disable";

export function TwoFactorSettings() {
  const status = useTwoFactorStatus();
  const enabled = status.data?.enabled ?? false;
  const addresses = useTrustedAddresses(enabled);
  const changes = useTwoFactorChanges();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status.isPending) return <Loader label={t("state.loading")} />;
  if (!status.data) return <p role="alert" className="text-sm text-destructive">{t("twoFactor.failed")}</p>;

  const act = async (choice: Asking, code: string) => {
    setError(null);
    try {
      if (choice === "renew") setCodes((await changes.renew.mutateAsync(code)).backupCodes);
      else await changes.disable.mutateAsync(code);
      setAsking(null);
    } catch (failure) {
      setError(twoFactorError(failure));
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label={t("twoFactor.title")}>
      <h3 className="text-sm font-semibold">{t("twoFactor.title")}</h3>
      {!enabled ? (
        <TwoFactorEnrolment onDone={() => void changes.refresh()} />
      ) : (
        <>
          <p role="status" data-enabled="true" className="text-sm">
            {t("twoFactor.on")} · {t("twoFactor.backupLeft")} {status.data.backupCodesLeft}
          </p>
          {codes ? <BackupCodes codes={codes} /> : null}
          {asking ? (
            <CodeForm
              label={t("twoFactor.codeToConfirm")}
              allowBackup={asking === "disable"}
              submitLabel={asking === "renew" ? t("twoFactor.renew") : t("twoFactor.disable")}
              destructive={asking === "disable"}
              pending={changes.renew.isPending || changes.disable.isPending}
              error={error}
              onSubmit={(code) => void act(asking, code)}
              onCancel={() => { setAsking(null); setError(null); }}
            />
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setCodes(null); setAsking("renew"); }}>{t("twoFactor.renew")}</Button>
              {status.data.required
                ? null
                : <Button type="button" variant="outline" onClick={() => setAsking("disable")}>{t("twoFactor.disable")}</Button>}
            </div>
          )}
          {status.data.required ? <p className="text-xs text-muted-foreground">{t("twoFactor.requiredNote")}</p> : null}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{t("twoFactor.addresses")}</h4>
              {addresses.data && addresses.data.length > 0
                ? <Button type="button" variant="ghost" size="sm" onClick={() => changes.forgetAll.mutate()}>{t("twoFactor.forgetAll")}</Button>
                : null}
            </div>
            <p className="text-xs text-muted-foreground">{t("twoFactor.addresses.hint")}</p>
            {addresses.data && addresses.data.length > 0 ? (
              <ul aria-label={t("twoFactor.addresses")} className="flex flex-col divide-y divide-border text-sm">
                {addresses.data.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 break-all font-mono text-xs">{entry.address}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t("twoFactor.addresses.used")} {formatDateTime(entry.lastUsedAt)}</span>
                    <Button type="button" variant="ghost" size="sm" aria-label={`${t("twoFactor.forget")} ${entry.address}`} onClick={() => changes.forget.mutate(entry.id)}>
                      {t("twoFactor.forget")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("twoFactor.addresses.empty")}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
