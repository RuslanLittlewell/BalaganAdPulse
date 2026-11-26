import { cn } from "@/shared/lib/index.js";

export function RunningDot({ running }: { running: boolean }) {
  return (
    <span
      data-running={running}
      className={cn("block size-2 rounded-full", running ? "bg-emerald-500" : "bg-destructive")}
    />
  );
}
