import { NavLink, useMatch } from "react-router-dom";
import {
  ArchiveIcon,
  ChartColumnIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  ContactIcon,
  type LucideIcon,
} from "lucide-react";
import type { OptionalModule } from "@adpulse/access-policy";
import { t } from "@/shared/config/index.js";
import { ROUTES } from "@/shared/lib/index.js";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { useAuth } from "@/features/auth/index.js";
import {
  SectionLabel,
  Sidebar,
  SIDEBAR_ICON_CLASS_NAME,
  sidebarLabelClassName,
  sidebarLinkClassName,
  sidebarNavClassName,
} from "@/shared/ui/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

interface Module {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  agencyOnly?: boolean;
  module?: OptionalModule;
}

interface ModuleLinkProps {
  module: Module;
  collapsed: boolean;
}

const MODULES: Module[] = [
  {
    to: ROUTES.dashboard,
    label: t("nav.dashboard"),
    icon: LayoutDashboardIcon,
    end: true,
  },
  { to: ROUTES.crm, label: t("nav.crm"), icon: ContactIcon, module: "CRM" },
  { to: ROUTES.projects, label: t("nav.projects"), icon: FolderKanbanIcon },
  { to: ROUTES.tasks, label: t("nav.tasks"), icon: ListTodoIcon, module: "TASKS" },
  {
    to: ROUTES.reports,
    label: t("nav.reports"),
    icon: ChartColumnIcon,
    module: "REPORTS",
  },
  {
    to: ROUTES.archive,
    label: t("nav.archive"),
    icon: ArchiveIcon,
    agencyOnly: true,
  },
];

function ModuleLink({ module, collapsed }: ModuleLinkProps) {
  const { to, label, icon: Icon, end } = module;
  const isActive = useMatch({ path: to, end: end ?? false }) != null;
  const link = (
    <NavLink
      to={to}
      end={end}
      className={sidebarLinkClassName(collapsed, isActive)}
    >
      <Icon className={SIDEBAR_ICON_CLASS_NAME} aria-hidden="true" />
      <span className={sidebarLabelClassName(collapsed)}>{label}</span>
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <WarmTooltip content={label} side="right">
      {link}
    </WarmTooltip>
  );
}

export function MainNav() {
  const { collapsed } = useNavCollapse();
  const { role, modules } = useAuth();

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
      {!collapsed && (
        <div className="hidden md:block">
          <SectionLabel>{t("nav.sections")}</SectionLabel>
        </div>
      )}
      <WarmTooltipGroup>
        <nav className={sidebarNavClassName(collapsed)} aria-label={t("nav.sections")}>
          {MODULES.filter(
            (entry) =>
              (!entry.agencyOnly || role !== "CLIENT") &&
              (!entry.module || modules.includes(entry.module)),
          ).map((module) => (
            <ModuleLink key={module.to} module={module} collapsed={collapsed} />
          ))}
        </nav>
      </WarmTooltipGroup>
    </Sidebar>
  );
}
