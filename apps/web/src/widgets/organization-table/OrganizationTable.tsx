import {
  moduleLabel,
  usePlatformOrganizations,
  type PlatformOrganization,
} from "@/entities/platform-organization/index.js";
import {
  OrganizationActions,
  registrationLink,
} from "@/features/organization-admin/index.js";
import { t } from "@/shared/config/index.js";
import {
  ariaSortOf,
  cn,
  formatCalendarDate,
  useTableSort,
  type SortValue,
} from "@/shared/lib/index.js";
import { CopyButton, Loader, SortButton } from "@/shared/ui/index.js";

type SortableColumn =
  | "name"
  | "status"
  | "modules"
  | "members"
  | "firstAdmin"
  | "createdAt";

const SORT_VALUES: Record<
  SortableColumn,
  (organization: PlatformOrganization) => SortValue
> = {
  name: (organization) => organization.name,
  status: (organization) => t(`platform.status.${organization.status}`),
  modules: (organization) => organization.modules.length,
  members: (organization) => organization.activeMembers,
  firstAdmin: (organization) => organization.firstAdmin?.email,
  createdAt: (organization) => Date.parse(organization.createdAt),
};

export function OrganizationTable() {
  const organizations = usePlatformOrganizations();
  const sorting = useTableSort(organizations.data ?? [], SORT_VALUES);

  if (organizations.isPending) return <Loader label={t("state.loading")} />;
  if (organizations.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("platform.organizations.loadFailed")}
      </p>
    );
  }
  if (organizations.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("platform.organizations.empty")}
      </p>
    );
  }

  return (
    <table
      aria-label={t("platform.organizations.list")}
      className="w-full text-sm"
    >
      <thead className="text-left text-xs text-muted-foreground">
        <tr className="border-b">
          <SortableHeader
            column="name"
            label={t("platform.column.name")}
            sorting={sorting}
            className="pl-3"
          />
          <SortableHeader
            column="status"
            label={t("platform.column.status")}
            sorting={sorting}
          />
          <SortableHeader
            column="modules"
            label={t("platform.column.modules")}
            sorting={sorting}
          />
          <SortableHeader
            column="members"
            label={t("platform.column.members")}
            sorting={sorting}
            align="end"
          />
          <SortableHeader
            column="firstAdmin"
            label={t("platform.column.firstAdmin")}
            sorting={sorting}
            className="pl-3"
          />
          <SortableHeader
            column="createdAt"
            label={t("platform.column.createdAt")}
            sorting={sorting}
          />
          <th className="py-2 text-right font-medium">
            {t("platform.column.actions")}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorting.rows.map((organization) => (
          <OrganizationRow key={organization.id} organization={organization} />
        ))}
      </tbody>
    </table>
  );
}

function SortableHeader({
  column,
  label,
  sorting,
  align,
  className,
}: {
  column: SortableColumn;
  label: string;
  sorting: ReturnType<
    typeof useTableSort<PlatformOrganization, SortableColumn>
  >;
  align?: "start" | "end";
  className?: string;
}) {
  const direction = sorting.directionOf(column);
  return (
    <th
      scope="col"
      aria-sort={ariaSortOf(direction)}
      className={cn("py-2 font-medium", className)}
    >
      <SortButton
        label={label}
        direction={direction}
        align={align}
        onSort={() => sorting.toggle(column)}
      />
    </th>
  );
}

function OrganizationRow({
  organization,
}: {
  organization: PlatformOrganization;
}) {
  return (
    <tr className="border-b align-middle" data-status={organization.status}>
      <th
        scope="row"
        className={cn(
          "border-l-4 py-2 pl-2 text-left font-medium",
          organization.status === "ACTIVE"
            ? "border-l-emerald-500"
            : "border-l-red-500",
        )}
      >
        <span className="flex flex-col">
          <span>{organization.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {organization.slug}
          </span>
        </span>
      </th>
      <td className="py-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            organization.status === "ACTIVE"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {t(`platform.status.${organization.status}`)}
        </span>
      </td>
      <td className="py-2">
        <ul
          aria-label={`${t("platform.column.modules")}: ${organization.name}`}
          className="flex flex-wrap gap-1"
        >
          {organization.modules.map((module) => (
            <li
              key={module}
              className="rounded-md border border-border px-1 py-0.5 text-xs"
            >
              {moduleLabel(module)}
            </li>
          ))}
        </ul>
      </td>
      <td className="py-2 text-right tabular-nums">
        {organization.activeMembers}
      </td>
      <td className="py-2 pl-3">
        <FirstAdmin organization={organization} />
      </td>
      <td className="py-2 text-muted-foreground">
        {formatCalendarDate(organization.createdAt)}
      </td>
      <td className="py-2">
        <OrganizationActions organization={organization} />
      </td>
    </tr>
  );
}

function FirstAdmin({ organization }: { organization: PlatformOrganization }) {
  const firstAdmin = organization.firstAdmin;
  if (!firstAdmin)
    return (
      <span className="text-muted-foreground">
        {t("platform.firstAdmin.none")}
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      <span className="flex flex-col">
        <span>{firstAdmin.email}</span>
        <span className="text-xs text-muted-foreground">
          {t(`platform.firstAdmin.${firstAdmin.state}`)}
        </span>
      </span>
      {firstAdmin.registrationUrl && (
        <CopyButton
          value={registrationLink(firstAdmin.registrationUrl)}
          label={t("platform.copyLink")}
        />
      )}
    </span>
  );
}
