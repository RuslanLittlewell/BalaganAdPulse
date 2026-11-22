import { useState } from "react";
import { t } from "@/shared/config/index.js";
import { Button, CopyButton } from "@/shared/ui/index.js";
import { useTwoFactorChanges, type TwoFactorSetup } from "../api/api.js";
import { BackupCodes } from "./BackupCodes.js";
import { CodeForm } from "./CodeForm.js";
import { twoFactorError } from "./errors.js";

const APP_STORE = "https://apps.apple.com/app/google-authenticator/id388497605";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2";
const STORE_LINK = "text-primary underline-offset-4 hover:underline";

function InstallLinks() {
  return (
    <p className="text-xs text-muted-foreground">
      {t("twoFactor.install")}{" "}
      <a href={APP_STORE} target="_blank" rel="noopener noreferrer" className={STORE_LINK}>{t("twoFactor.appStore")}</a>
      {" · "}
      <a href={GOOGLE_PLAY} target="_blank" rel="noopener noreferrer" className={STORE_LINK}>{t("twoFactor.googlePlay")}</a>
    </p>
  );
}

export function TwoFactorEnrolment({ onDone }: { onDone: () => void }) {
  const { setup, confirm } = useTwoFactorChanges();
  const [started, setStarted] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      setStarted(await setup.mutateAsync());
    } catch (failure) {
      setError(twoFactorError(failure));
    }
  };

  const finish = async (code: string) => {
    setError(null);
    try {
      setCodes((await confirm.mutateAsync(code)).backupCodes);
    } catch (failure) {
      setError(twoFactorError(failure));
    }
  };

  if (codes) {
    return (
      <div className="flex flex-col gap-3">
        <BackupCodes codes={codes} />
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>{t("twoFactor.done")}</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("twoFactor.off.hint")}</p>
        <InstallLinks />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="button" disabled={setup.isPending} onClick={() => void start()}>{t("twoFactor.enable")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("twoFactor.scan")}</p>
      <InstallLinks />
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(started.qrSvg)}`}
        alt={t("twoFactor.qr")}
        className="size-44 self-center rounded-md bg-white p-1"
      />
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
        <span className="text-xs text-muted-foreground">{t("twoFactor.key")}</span>
        <code className="min-w-0 flex-1 break-all text-xs">{started.key}</code>
        <CopyButton value={started.key} label={t("twoFactor.copyKey")} />
      </div>
      <CodeForm
        label={t("twoFactor.codeToConfirm")}
        submitLabel={t("twoFactor.confirm")}
        pending={confirm.isPending}
        error={error}
        onSubmit={(code) => void finish(code)}
      />
    </div>
  );
}
