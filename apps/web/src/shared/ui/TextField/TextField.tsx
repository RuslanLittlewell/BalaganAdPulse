import { useId, type InputHTMLAttributes } from "react";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** A tighter row for dense forms: shorter input, less air around it. */
  compact?: boolean;
}

/** shadcn's Label and Input wired together: one id, and an error that the input
 * points at through `aria-describedby` rather than one that only reads visually. */
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
