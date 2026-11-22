import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { t } from "@/shared/config/index.js";
import { Button, OneTimeCode, TextField, useAlerts, type CodeSlotsStatus } from "@/shared/ui/index.js";
import { useAuth } from "../../model/AuthProvider.js";
import { codeOf, lockMessage } from "../../lib/signInErrors.js";

export interface TwoFactorStepProps {
  challenge: string;
  onDone: () => void;
  onRestart: () => void;
}

const LINK_CLASS = "self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function TwoFactorStep({ challenge, onDone, onRestart }: TwoFactorStepProps) {
  const { completeTwoFactor } = useAuth();
  const { raise } = useAlerts();
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [status, setStatus] = useState<CodeSlotsStatus>("idle");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const verify = async (value: string) => {
    setInvalid(false);
    setPending(true);
    try {
      await completeTwoFactor(challenge, value.trim());
      setStatus("success");
      onDone();
    } catch (error) {
      const lock = lockMessage(error);
      const reason = codeOf(error);
      if (lock) setBlocked(lock);
      else if (reason === "INVALID_CODE") {
        setInvalid(true);
        setStatus("error");
      } else if (reason === "TWO_FACTOR_CHALLENGE_EXPIRED") setExpired(true);
      else raise(t("state.error.title"));
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void verify(code);
  };

  const typed = (next: string) => {
    setCode(next);
    if (next && status === "error") {
      setStatus("idle");
      setInvalid(false);
    }
  };

  if (expired || blocked) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">{blocked ?? t("twoFactor.expired")}</p>
        {blocked ? <Link to="/password-reset" className={LINK_CLASS}>{t("auth.locked.recover")}</Link> : null}
        <Button type="button" variant="outline" onClick={onRestart}>{t("twoFactor.restart")}</Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <p className="text-sm text-muted-foreground">{backup ? t("twoFactor.step.backupHint") : t("twoFactor.step.hint")}</p>
      {backup ? (
        <TextField
          label={t("twoFactor.backupCode")}
          value={code}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          error={invalid ? t("twoFactor.invalid") : undefined}
          onChange={(event) => typed(event.target.value)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <OneTimeCode
            label={t("twoFactor.code")}
            autoFocus
            status={status}
            disabled={pending}
            onChange={typed}
            onComplete={(full) => void verify(full)}
          />
          {invalid ? <p role="alert" className="text-sm text-destructive">{t("twoFactor.invalid")}</p> : null}
        </div>
      )}
      <Button type="submit" className="h-9" disabled={pending || code.trim().length < (backup ? 10 : 6)} aria-busy={pending}>
        {t("twoFactor.submit")}
      </Button>
      <button
        type="button"
        className={LINK_CLASS}
        onClick={() => { setBackup((current) => !current); setCode(""); setInvalid(false); setStatus("idle"); }}
      >
        {backup ? t("twoFactor.useApp") : t("twoFactor.useBackup")}
      </button>
    </form>
  );
}
