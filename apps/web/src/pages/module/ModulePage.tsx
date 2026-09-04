import { EmptyState } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

export interface ModulePageProps {
  title: string;
}

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
