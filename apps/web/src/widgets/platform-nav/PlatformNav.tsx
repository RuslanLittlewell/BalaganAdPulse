import { NavLink } from "react-router-dom";
import { Building2Icon } from "lucide-react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { t } from "@/shared/config/index.js";
import { ROUTES } from "@/shared/lib/index.js";
import {
  SectionLabel,
  Sidebar,
  SIDEBAR_ICON_CLASS_NAME,
  sidebarLabelClassName,
  sidebarLinkClassName,
  sidebarNavClassName,
} from "@/shared/ui/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

export function PlatformNav() {
  const { collapsed } = useNavCollapse();
  const label = t("nav.organizations");
  const link = (
    <NavLink
      to={ROUTES.organizations}
      className={({ isActive }) => sidebarLinkClassName(collapsed, isActive)}
    >
      <Building2Icon className={SIDEBAR_ICON_CLASS_NAME} aria-hidden="true" />
      <span className={sidebarLabelClassName(collapsed)}>{label}</span>
    </NavLink>
  );

  return (
    <Sidebar
      header={
        <div
          className={`flex min-h-13 items-center text-xl font-semibold text-sidebar-foreground ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          {collapsed ? t("platform.brand").slice(0, 1) : t("platform.brand")}
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
          {collapsed ? <WarmTooltip content={label} side="right">{link}</WarmTooltip> : link}
        </nav>
      </WarmTooltipGroup>
    </Sidebar>
  );
}
