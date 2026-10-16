import { AddOrganization } from "@/features/organization-admin/index.js";
import { OrganizationTable } from "@/widgets/organization-table/index.js";
import { t } from "@/shared/config/index.js";

export function OrganizationsPage() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.organizations")}</h1>
        <AddOrganization />
      </div>
      <OrganizationTable />
    </section>
  );
}
