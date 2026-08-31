import type { ReactNode } from "react";
import { Separator } from "../ui/separator.js";

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ header, children, action, footer }: SidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar">
      {header != null && <div data-region="header">{header}</div>}
      <div className="min-h-0 flex-1 overflow-auto" data-region="list">
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
