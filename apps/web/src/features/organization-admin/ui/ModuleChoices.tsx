import { CheckIcon } from "lucide-react";
import {
  ALWAYS_ON_MODULES,
  MODULES,
  isOptionalModule,
  type ModuleKey,
  type OptionalModule,
} from "@adpulse/access-policy";
import { moduleLabel } from "@/entities/platform-organization/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { LABEL_CLASS } from "@/shared/ui/index.js";

export interface ModuleChoicesProps {
  selected: readonly OptionalModule[];
  onChange: (next: OptionalModule[]) => void;
}

export function ModuleChoices({ selected, onChange }: ModuleChoicesProps) {
  const toggle = (module: OptionalModule) =>
    onChange(selected.includes(module)
      ? selected.filter((candidate) => candidate !== module)
      : [...selected, module]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn(LABEL_CLASS, "mb-2")}>{t("platform.form.modules")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {MODULES.map((module) => {
          const locked = (ALWAYS_ON_MODULES as readonly ModuleKey[]).includes(module);
          const checked = locked || (isOptionalModule(module) && selected.includes(module));
          return (
            <ModuleChoice
              key={module}
              module={module}
              checked={checked}
              locked={locked}
              onToggle={() => { if (isOptionalModule(module)) toggle(module); }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

function ModuleChoice({
  module, checked, locked, onToggle,
}: { module: ModuleKey; checked: boolean; locked: boolean; onToggle: () => void }) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 transition-colors",
        locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted",
      )}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <input
          type="checkbox"
          aria-label={moduleLabel(module)}
          checked={checked}
          disabled={locked}
          onChange={onToggle}
          className="peer absolute size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className={cn(
            "grid size-4 place-items-center rounded-md border-2 transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {checked && <CheckIcon className="size-3" strokeWidth={3} />}
        </span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{moduleLabel(module)}</span>
        {locked && <span className="text-xs text-muted-foreground">{t("platform.form.alwaysOn")}</span>}
      </span>
    </label>
  );
}
