import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils.js";
import { Separator } from "../ui/separator.js";

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
}

export const sidebarNavClassName = (collapsed: boolean) =>
  cn(
    "flex flex-row gap-1 p-1 *:min-w-0 *:flex-1 md:flex-col md:*:flex-none",
    collapsed ? "md:items-center md:px-0 md:pt-2 md:pb-0" : "md:px-2 md:py-0",
  );

export const sidebarLinkClassName = (collapsed: boolean, active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-2xs font-medium transition-colors",
    "md:flex-none md:flex-row md:rounded-md md:text-sm",
    collapsed ? "md:size-10 md:p-0" : "md:justify-start md:gap-3 md:px-3 md:py-2",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
  );

export const SIDEBAR_ICON_CLASS_NAME = "size-5 shrink-0 md:size-6";

export const sidebarLabelClassName = (collapsed: boolean) =>
  cn("max-w-full truncate", collapsed && "md:sr-only");

export function Sidebar({ header, children, action, footer }: SidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col md:h-full">
      {header != null && <div className="hidden md:block" data-region="header">{header}</div>}
      <div className="min-h-0 flex-1 overflow-x-auto md:overflow-auto" data-region="list">
        {children}
      </div>
      {action != null && (
        <div className="p-3" data-region="action">
          {action}
        </div>
      )}
      {footer != null && (
        <>
          <Separator />
          <div className="mt-auto p-3" data-region="footer">
            {footer}
          </div>
        </>
      )}
    </aside>
  );
}
