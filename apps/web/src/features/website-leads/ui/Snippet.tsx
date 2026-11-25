import { CopyButton } from "@/shared/ui/index.js";

export function Snippet({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <CopyButton value={value} label={label} />
    </div>
  );
}
