import { useId } from "react";
import { ArrowDown, ArrowUp, Settings2 } from "lucide-react";
import type { LeadField } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Label, Popover, PopoverContent, PopoverTrigger, Switch } from "@/shared/ui/index.js";
import { fieldCatalogue, type CatalogueField } from "../lib/catalogue.js";
import type { FieldRef, ViewState } from "../model/viewState.js";

export type Layout = "board" | "tasks" | "table";

export interface OptionsMenuProps {
  view: ViewState;
  fields: readonly LeadField[];
  catalogue?: readonly CatalogueField[];
  columns?: boolean;
  canManageFields: boolean;
  onChange: (change: Partial<ViewState>) => void;
  onBoardFields?: () => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="font-normal">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function OptionsMenu({ view, fields, catalogue, columns, canManageFields, onChange, onBoardFields }: OptionsMenuProps) {
  const cardable = (catalogue ?? fieldCatalogue(fields)).filter((field) => field.cardable);
  const shown = view.cardFields.filter((ref) => cardable.some((field) => field.ref === ref));
  const hidden = cardable.filter((field) => !shown.includes(field.ref));
  const labelOf = (ref: FieldRef) => cardable.find((field) => field.ref === ref)?.label ?? ref;

  const move = (index: number, by: number) => {
    const next = [...shown];
    const [moving] = next.splice(index, 1);
    next.splice(index + by, 0, moving!);
    onChange({ cardFields: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="h-8 gap-1 px-2 text-sm">
          <Settings2 aria-hidden className="size-3.5" />
          {t("crm.view.options")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[min(48rem,90vh)] w-[min(38rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto p-4" aria-label={t("crm.view.options")}>
        <Section title={t(columns ? "crm.record.columns" : "crm.view.cardFields")}>
          <div role="group" aria-label={t(columns ? "crm.record.columns" : "crm.view.cardFields")} className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <h4 className="text-xs text-muted-foreground">{t("crm.view.shownFields")}</h4>
              <ul aria-label={t("crm.view.shownFields")} className="flex flex-col gap-1">
                {shown.map((ref, index) => (
                  <li key={ref} data-card-field={ref} className="flex items-center gap-1">
                    <span className="min-w-0 flex-1"><Toggle label={labelOf(ref)} checked onChange={() => onChange({ cardFields: shown.filter((item) => item !== ref) })} /></span>
                    <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`${t("crm.view.moveFieldUp")}: ${labelOf(ref)}`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp aria-hidden className="size-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`${t("crm.view.moveFieldDown")}: ${labelOf(ref)}`} disabled={index === shown.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown aria-hidden className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h4 className="text-xs text-muted-foreground">{t("crm.view.hiddenFields")}</h4>
              <ul aria-label={t("crm.view.hiddenFields")} className="flex flex-col gap-1">
                {hidden.map((field) => (
                  <li key={field.ref} data-card-field={field.ref} className="flex h-6 items-center">
                    <span className="min-w-0 flex-1"><Toggle label={field.label} checked={false} onChange={() => onChange({ cardFields: [...shown, field.ref] })} /></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title={t("crm.view.options")}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Toggle label={t("crm.view.hideEmpty")} checked={view.hideEmpty} onChange={(hideEmpty) => onChange({ hideEmpty })} />
            <Toggle label={t("crm.view.compact")} checked={view.compact} onChange={(compact) => onChange({ compact })} />
          </div>
        </Section>

        {canManageFields && onBoardFields ? (
          <Button type="button" variant="outline" className="h-8 self-start" onClick={onBoardFields}>{t("crm.view.boardFields")}</Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
