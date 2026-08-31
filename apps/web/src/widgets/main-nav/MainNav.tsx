import { NavLink, useMatch } from "react-router-dom";
import {
  ArchiveIcon,
  ChartColumnIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/shared/config/index.js";
import { ROUTES } from "@/shared/lib/index.js";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import {
  SectionLabel,
  Sidebar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/index.js";

interface Module {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const MODULES: Module[] = [
  { to: ROUTES.dashboard, label: t("nav.dashboard"), icon: LayoutDashboardIcon, end: true },
  { to: ROUTES.projects, label: t("nav.projects"), icon: FolderKanbanIcon },
  { to: ROUTES.tasks, label: t("nav.tasks"), icon: ListTodoIcon },
  { to: ROUTES.reports, label: t("nav.reports"), icon: ChartColumnIcon },
  { to: ROUTES.archive, label: t("nav.archive"), icon: ArchiveIcon },
];

/**
 * One module. Collapsed, the label lives only in the accessible name, so the
 * tooltip is what gives it back to the eye; expanded, the label is right there
 * and a tooltip would only repeat it.
 */
function ModuleLink({ module, collapsed }: { module: Module; collapsed: boolean }) {
  const { to, label, icon: Icon, end } = module;
  /* Active is computed here rather than through NavLink's `className` callback:
   * a tooltip trigger clones its child and merges `className` as a string, so a
   * function would be stringified into the attribute and every class lost.
   * `aria-current` still comes from NavLink itself. */
  const isActive = useMatch({ path: to, end: end ?? false }) != null;
  const link = (
    <NavLink
      to={to}
      end={end}
      className={[
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        collapsed ? "size-10 justify-center p-0" : "px-3 py-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      ].join(" ")}
    >
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function MainNav() {
  const { collapsed } = useNavCollapse();

  return (
    <Sidebar
      header={
        <div
          className={`flex min-h-16 items-center text-xl font-bold text-sidebar-foreground ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
        >
          {collapsed ? t("brand.title").slice(0, 1) : t("brand.title")}
        </div>
      }
    >
      {!collapsed && <SectionLabel>{t("nav.sections")}</SectionLabel>}
      <TooltipProvider delayDuration={200}>
        <nav
          className={
            collapsed
              ? "flex flex-col items-center gap-1 px-0 pt-2"
              : "flex flex-col gap-1 px-2"
          }
          aria-label={t("nav.sections")}
        >
        {MODULES.map((module) => (
          <ModuleLink key={module.to} module={module} collapsed={collapsed} />
        ))}
        </nav>
      </TooltipProvider>
    </Sidebar>
  );
}
