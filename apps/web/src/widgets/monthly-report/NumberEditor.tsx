import { useState, type FormEvent } from "react";
import { t } from "@/shared/config/index.js";
import { Button, Input } from "@/shared/ui/index.js";

export function NumberEditor({
  label,
  initial,
  pending,
  onSave,
  onCancel,
}: {
  label: string;
  initial: number | null;
  pending: boolean;
  onSave: (value: number | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const invalid = value.trim() !== "" && !/^\d{1,7}$/.test(value.trim());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    onSave(value.trim() === "" ? null : Number(value.trim()));
  };

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
      <Input
        autoFocus
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {invalid ? <p role="alert" className="text-xs text-destructive">{t("report.field.invalid")}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || invalid}>{t("action.save")}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t("action.cancel")}</Button>
      </div>
    </form>
  );
}
