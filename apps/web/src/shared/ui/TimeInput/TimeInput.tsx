import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/index.js";
import { Input } from "../ui/input.js";

export interface TimeInputProps
  extends Omit<ComponentProps<"input">, "type" | "value" | "onChange"> {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function TimeInput({ value, onChange, className, ...props }: TimeInputProps) {
  return (
    <Input
      type="time"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        "h-10 cursor-text tabular-nums [color-scheme:light] dark:[color-scheme:dark]",
        "dark:hover:bg-input/50",
        "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
        "[&::-webkit-calendar-picker-indicator]:rounded-sm",
        "[&::-webkit-calendar-picker-indicator]:opacity-50",
        "[&::-webkit-calendar-picker-indicator]:transition-opacity",
        "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
        "[&::-webkit-datetime-edit-fields-wrapper]:p-0",
        className,
      )}
      {...props}
    />
  );
}
