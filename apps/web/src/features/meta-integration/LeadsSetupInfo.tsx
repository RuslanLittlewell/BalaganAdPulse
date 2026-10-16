import { InfoIcon } from "lucide-react";
import { t, type MessageKey } from "@/shared/config/index.js";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/index.js";

const STEPS: readonly MessageKey[] = [
  "meta.leads.info.permissions",
  "meta.leads.info.page",
  "meta.leads.info.access",
  "meta.leads.info.after",
];

export function LeadsSetupInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("meta.leads.info")}>
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-96 text-sm" aria-label={t("meta.leads.info.title")}>
        <p className="mb-2 font-medium">{t("meta.leads.info.title")}</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
          {STEPS.map((step) => <li key={step}>{t(step)}</li>)}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
