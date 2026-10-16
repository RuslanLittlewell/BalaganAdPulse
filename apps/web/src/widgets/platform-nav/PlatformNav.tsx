import { NavLink } from "react-router-dom";
import { Building2Icon } from "lucide-react";
import { useNavCollapse } from "@/features/nav-collapse/index.js";
import { t } from "@/shared/config/index.js";
import { ROUTES } from "@/shared/lib/index.js";
import { SectionLabel, Sidebar } from "@/shared/ui/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

export function PlatformNav() {
  const { collapsed } = useNavCollapse();
  const label = t("nav.organizations");
  const link = (
    <NavLink
      to={ROUTES.organizations}
      className={({ isActive }) => [
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        collapsed ? "size-10 justify-center p-0" : "px-3 py-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      ].join(" ")}
    >
      <Building2Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
    </NavLink>
  );

  return (
    <Sidebar
      header={
        <div
          className={`flex min-h-16 items-center text-xl font-bold text-sidebar-foreground ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
        >
          {collapsed ? t("platform.brand").slice(0, 1) : t("platform.brand")}
        </div>
      }
    >
      {!collapsed && <SectionLabel>{t("nav.sections")}</SectionLabel>}
      <WarmTooltipGroup>
        <nav
          className={collapsed ? "flex flex-col items-center gap-1 px-0 pt-2" : "flex flex-col gap-1 px-2"}
          aria-label={t("nav.sections")}
        >
          {collapsed ? <WarmTooltip content={label} side="right">{link}</WarmTooltip> : link}
        </nav>
      </WarmTooltipGroup>
    </Sidebar>
  );
}
