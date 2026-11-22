import { useEffect, useState, type FormEvent } from "react";
import { t } from "@/shared/config/index.js";
import { Button, OneTimeCode, TextField, type CodeSlotsStatus } from "@/shared/ui/index.js";

export interface CodeFormProps {
  label: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  destructive?: boolean;
  allowBackup?: boolean;
  onSubmit: (code: string) => void;
  onCancel?: () => void;
}

const LINK_CLASS = "self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function CodeForm({ label, submitLabel, pending, error, destructive = false, allowBackup = false, onSubmit, onCancel }: CodeFormProps) {
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeSlotsStatus>("idle");

  useEffect(() => {
    if (error) setStatus("error");
  }, [error]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(code.trim());
  };

  const typed = (next: string) => {
    setCode(next);
    if (next && status === "error") setStatus("idle");
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} noValidate>
      {backup ? (
        <TextField
          label={t("twoFactor.backupCode")}
          value={code}
          autoComplete="off"
          spellCheck={false}
          error={error ?? undefined}
          onChange={(event) => typed(event.target.value)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{label}</span>
          <OneTimeCode label={label} status={status} disabled={pending} onChange={typed} onComplete={(full) => onSubmit(full)} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
      )}
      {allowBackup ? (
        <button type="button" className={LINK_CLASS} onClick={() => { setBackup((current) => !current); setCode(""); setStatus("idle"); }}>
          {backup ? t("twoFactor.useApp") : t("twoFactor.useBackup")}
        </button>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>{t("twoFactor.cancel")}</Button> : null}
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || code.trim().length < (backup ? 10 : 6)}>{submitLabel}</Button>
      </div>
    </form>
  );
}
