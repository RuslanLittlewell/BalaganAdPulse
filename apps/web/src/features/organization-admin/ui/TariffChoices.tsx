import { TARIFFS, type Tariff } from "@adpulse/access-policy";
import { tariffAudience, tariffName, tariffPrice } from "@/entities/tariff/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { LABEL_CLASS } from "@/shared/ui/index.js";

export interface TariffChoicesProps {
  selected: Tariff;
  onChange: (next: Tariff) => void;
}

export function TariffChoices({ selected, onChange }: TariffChoicesProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn(LABEL_CLASS, "mb-2")}>{t("platform.form.tariff")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {TARIFFS.map((tariff) => (
          <label
            key={tariff}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-2 transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              selected === tariff ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tariff"
                  value={tariff}
                  aria-label={tariffName(tariff)}
                  aria-describedby={`tariff-${tariff}-audience`}
                  checked={selected === tariff}
                  onChange={() => onChange(tariff)}
                  className="size-3.5 accent-primary"
                />
                <span className="text-sm font-medium">{tariffName(tariff)}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{tariffPrice(tariff)}</span>
            </span>
            <span id={`tariff-${tariff}-audience`} className="text-xs text-muted-foreground">
              {tariffAudience(tariff)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
