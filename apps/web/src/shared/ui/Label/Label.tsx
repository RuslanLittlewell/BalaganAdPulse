import type { ComponentProps } from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/shared/lib/utils";

export const LABEL_CLASS =
  "flex items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none " +
  "group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 " +
  "text-xs text-muted-foreground";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn(LABEL_CLASS, className)} {...props} />;
}
