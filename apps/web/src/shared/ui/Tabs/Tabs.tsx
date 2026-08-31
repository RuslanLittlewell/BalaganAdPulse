import { memo, type ReactNode } from "react";
import { Button } from "../ui/button.js";
import { Tabs as TabsRoot, TabsList, TabsTrigger } from "../ui/tabs.js";
import { t } from "@/shared/config/index.js";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabItemAction {
  icon: ReactNode;
  label: string;
  onSelect: (id: string) => void;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  itemActions?: TabItemAction[];
  onNew: () => void;
}

/**
 * Memoised: the sheet tabs re-render on every parent render otherwise, and the
 * parent renders on every route change — including one that lands on the sheet
 * already open. Callers must hand over stable props for this to bite; see
 * CampaignTabs, which memoises the arrays it builds.
 */
export const Tabs = memo(function Tabs({
  items,
  activeId,
  onSelect,
  itemActions,
  onNew,
}: TabsProps) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border">
      <TabsRoot
        value={activeId ?? ""}
        onValueChange={onSelect}
        className="min-w-0"
      >
        <TabsList className="h-auto justify-start overflow-x-auto bg-transparent p-0">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <div
                key={item.id}
                className="group flex min-w-0 items-center gap-1 rounded-none px-1"
                data-active={active}
              >
                <TabsTrigger
                  value={item.id}
                  className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                >
                  {item.label}
                </TabsTrigger>
                {active &&
                  itemActions?.map((itemAction) => (
                    <Button
                      key={itemAction.label}
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={itemAction.label}
                      onClick={() => itemAction.onSelect(item.id)}
                    >
                      {itemAction.icon}
                    </Button>
                  ))}
              </div>
            );
          })}
        </TabsList>
      </TabsRoot>
      <Button variant="outline" size="sm" onClick={onNew} className="my-2">
        + {t("campaigns.new")}
      </Button>
    </div>
  );
});
