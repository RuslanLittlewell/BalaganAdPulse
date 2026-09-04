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
import { useAuth } from "@/features/auth/index.js";
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
  agencyOnly?: boolean;
}

const MODULES: Module[] = [
  { to: ROUTES.dashboard, label: t("nav.dashboard"), icon: LayoutDashboardIcon, end: true },
  { to: ROUTES.projects, label: t("nav.projects"), icon: FolderKanbanIcon },
  { to: ROUTES.tasks, label: t("nav.tasks"), icon: ListTodoIcon },
  { to: ROUTES.reports, label: t("nav.reports"), icon: ChartColumnIcon, agencyOnly: true },
  { to: ROUTES.archive, label: t("nav.archive"), icon: ArchiveIcon, agencyOnly: true },
];

function ModuleLink({ module, collapsed }: { module: Module; collapsed: boolean }) {
  const { to, label, icon: Icon, end } = module;
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
  const { role } = useAuth();

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
        {MODULES.filter((module) => !module.agencyOnly || role !== "CLIENT").map((module) => (
          <ModuleLink key={module.to} module={module} collapsed={collapsed} />
        ))}
        </nav>
      </TooltipProvider>
    </Sidebar>
  );
}
