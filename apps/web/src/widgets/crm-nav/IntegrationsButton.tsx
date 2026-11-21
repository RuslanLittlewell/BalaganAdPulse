import { useState } from "react";
import { PlugIcon } from "lucide-react";
import { useCan } from "@/features/permissions/index.js";
import { WebsiteLeadsPanel } from "@/features/website-leads/index.js";
import { Bitrix24Panel } from "@/features/bitrix24/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Tabs } from "@/shared/ui/index.js";
import { useSelectedBoard } from "./CrmNav.js";

type Tab = "website" | "bitrix";

export function IntegrationsButton() {
  const managesWebsite = useCan("update", "lead-intake-key");
  const managesBitrix = useCan("update", "bitrix24-connection");
  const { board } = useSelectedBoard();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("website");
  if (!managesWebsite && !managesBitrix) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(managesWebsite ? [{ id: "website" as const, label: t("crmIntegrations.tab.website") }] : []),
    ...(managesBitrix ? [{ id: "bitrix" as const, label: t("crmIntegrations.tab.bitrix") }] : []),
  ];
  const shown = tabs.some((entry) => entry.id === tab) ? tab : tabs[0]!.id;

  return (
    <>
      <Button type="button" className="h-8" onClick={() => { setTab(tabs[0]!.id); setOpen(true); }}>
        <PlugIcon aria-hidden className="size-3" />
        {t("crmIntegrations.open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] w-[min(640px,calc(100vw-2rem))] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("crmIntegrations.title")}</DialogTitle>
          </DialogHeader>
          {tabs.length > 1 ? (
            <Tabs items={tabs} activeId={shown} onSelect={(id) => setTab(id as Tab)} ariaLabel={t("crmIntegrations.tabs")} />
          ) : null}
          {open && shown === "website" ? (
            board
              ? <WebsiteLeadsPanel key={board.key} projectId={board.key} />
              : <p className="text-sm text-muted-foreground">{t("crmIntegrations.website.noBoard")}</p>
          ) : null}
          {open && shown === "bitrix" ? <Bitrix24Panel /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
