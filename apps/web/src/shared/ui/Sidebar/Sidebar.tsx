import type { ReactNode } from "react";
import { CircleHelpIcon, ListChecksIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils.js";
import { Button } from "../ui/button.js";
import WarmTooltip from "../WarmTooltip/WarmTooltip.js";

export interface SidebarHelp {
  label: string;
  collapsed: boolean;
  onOpen: () => void;
}

export interface SidebarFirstSteps {
  label: string;
  progress: string;
  collapsed: boolean;
  onOpen: () => void;
}

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  firstSteps?: SidebarFirstSteps;
  help?: SidebarHelp;
}

export const sidebarNavClassName = (collapsed: boolean) =>
  cn(
    "flex flex-row gap-1 p-1 *:min-w-0 *:flex-1 md:flex-col md:*:flex-none",
    collapsed ? "md:items-center md:px-0 md:pt-2 md:pb-0" : "md:px-2 md:py-0",
  );

export const sidebarLinkClassName = (collapsed: boolean, active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-2xs font-medium transition-colors",
    "md:flex-none md:flex-row md:rounded-md md:text-sm",
    collapsed ? "md:size-8 md:p-0" : "md:justify-start md:gap-2 md:px-2 md:py-2",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
  );

export const SIDEBAR_ICON_CLASS_NAME = "size-4 shrink-0 md:size-5";

export const sidebarLabelClassName = (collapsed: boolean) =>
  cn("max-w-full truncate", collapsed && "md:sr-only");

function HelpItem({ label, collapsed, onOpen }: SidebarHelp) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      className={cn(sidebarLinkClassName(collapsed, false), "h-auto w-full")}
    >
      <CircleHelpIcon className={SIDEBAR_ICON_CLASS_NAME} aria-hidden="true" />
      <span className={sidebarLabelClassName(collapsed)}>{label}</span>
    </Button>
  );
  if (!collapsed) return button;
  return <WarmTooltip content={label} side="right">{button}</WarmTooltip>;
}

function FirstStepsItem({ label, progress, collapsed, onOpen }: SidebarFirstSteps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      data-attention="true"
      className={cn(sidebarLinkClassName(collapsed, false), "first-steps-attention hidden h-auto w-full md:flex")}
    >
      <ListChecksIcon className={SIDEBAR_ICON_CLASS_NAME} aria-hidden="true" />
      <span className={sidebarLabelClassName(collapsed)}>{label}</span>
      <span className={cn("ml-auto text-xs font-normal tabular-nums", collapsed && "md:sr-only")}>
        {progress}
      </span>
    </Button>
  );
  if (!collapsed) return button;
  return <WarmTooltip content={`${label}: ${progress}`} side="right">{button}</WarmTooltip>;
}

export function Sidebar({ header, children, action, firstSteps, help }: SidebarProps) {
  return (
    <aside className="flex min-h-0 flex-row md:h-full md:flex-col">
      {header != null && <div className="hidden md:block" data-region="header">{header}</div>}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto md:overflow-auto" data-region="list">
        {children}
      </div>
      {action != null && (
        <div className="p-2" data-region="action">
          {action}
        </div>
      )}
      {(help != null || firstSteps != null) && (
        <div
          className={cn(
            "flex shrink-0 p-1 md:mt-auto md:flex-col md:gap-1 md:border-t md:border-border/60",
            (help ?? firstSteps)?.collapsed ? "md:items-center md:px-0 md:py-2" : "md:p-2",
          )}
          data-region="help"
        >
          {firstSteps != null && <FirstStepsItem {...firstSteps} />}
          {help != null && <HelpItem {...help} />}
        </div>
      )}
    </aside>
  );
}
