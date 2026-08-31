import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

export interface ModulePageProps {
  title: string;
}

/** A module that exists in the navigation but not yet in the product. Named
 * plainly rather than dressed up: an empty screen that pretends to work is
 * worse than one that says what it is. */
export function ModulePage({ title }: ModulePageProps) {
  return (
    <section className="grid h-full place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4">
          <EmptyState
            title={t("module.soon.title")}
            description={t("module.soon.description")}
          />
        </div>
      </div>
    </section>
  );
}
