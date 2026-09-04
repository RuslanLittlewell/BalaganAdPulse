import { useId, type InputHTMLAttributes } from "react";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  compact?: boolean;
}

export function TextField({ label, error, id, compact = false, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-2"}>
      <Label
        className="font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground"
        htmlFor={inputId}
      >
        {label}
      </Label>
      <Input
        id={inputId}
        className={compact ? "h-9" : "h-11"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error != null && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
