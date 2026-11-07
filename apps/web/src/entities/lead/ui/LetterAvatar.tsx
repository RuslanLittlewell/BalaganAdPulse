import { cn } from "@/shared/lib/index.js";

export function LetterAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-sm bg-muted text-2xs font-semibold uppercase text-muted-foreground", className)}>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
