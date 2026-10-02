import { useId, type InputHTMLAttributes } from "react";
import { Input } from "../ui/input.js";
import { Label } from "../Label/Label.js";

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
      <Label htmlFor={inputId}>
        {label}
      </Label>
      <Input
        id={inputId}
        className="h-10"
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
