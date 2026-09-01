import { LoaderCircle } from "lucide-react";
import { t } from "@/shared/config/index.js";

export interface LoaderProps {
  label?: string;
  size?: "sm" | "md";
}

export function Loader({ label, size = "md" }: LoaderProps) {
  return (
    <div
      className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      data-size={size}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wider">
        {label ?? t("state.loading")}
      </span>
    </div>
  );
}
