import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { OptionChip, type LeadField } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  DatePicker,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toIso,
} from "@/shared/ui/index.js";
import { NONE } from "../lib/card-values.js";
import { calendarDay } from "../lib/custom-values.js";

const today = () => toIso(new Date());

export function Chips({ field, chosen }: { field: LeadField; chosen: readonly string[] }) {
  const picked = field.options.filter((option) => chosen.includes(option.id));
  if (picked.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {picked.map((option) => <OptionChip key={option.id} name={option.name} color={option.color} />)}
    </span>
  );
}

export function DateEditor({ id, value, editable, onChange }: { id: string; value: string; editable: boolean; onChange: (value: string) => void }) {
  const [picking, setPicking] = useState(false);
  if (!editable) return <span id={id} className="px-2 text-sm">{value ? calendarDay(value) : ""}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <DatePicker
        value={value || today()}
        open={picking}
        onOpenChange={setPicking}
        labels={{
          dialog: t("crm.card.custom.pickDate"),
          previousMonth: t("crm.card.custom.previousMonth"),
          nextMonth: t("crm.card.custom.nextMonth"),
        }}
        onSelect={(day) => { onChange(day); setPicking(false); }}
      >
        <Button id={id} type="button" variant="ghost" className="h-7 min-w-0 justify-start gap-2 px-2 font-normal">
          <CalendarIcon aria-hidden className="size-3 shrink-0" />
          <span className={value ? "truncate" : "truncate text-muted-foreground/60"}>
            {value ? calendarDay(value) : t("crm.card.custom.pickDate")}
          </span>
        </Button>
      </DatePicker>
      {value ? (
        <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t("crm.card.custom.clearDate")} onClick={() => onChange("")}>
          <X aria-hidden className="size-3" />
        </Button>
      ) : null}
    </span>
  );
}

export function ChoiceEditor({ id, field, value, editable, onChange }: { id: string; field: LeadField; value: string; editable: boolean; onChange: (value: string) => void }) {
  if (!editable) return <span id={id} className="px-2"><Chips field={field} chosen={[value]} /></span>;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-7 w-full border-transparent shadow-none hover:border-input"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("crm.card.custom.none")}</SelectItem>
        {field.options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <OptionChip name={option.name} color={option.color} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChoicesEditor({ id, field, value, editable, onChange }: { id: string; field: LeadField; value: string[]; editable: boolean; onChange: (value: string[]) => void }) {
  if (!editable) return <span id={id} className="px-2"><Chips field={field} chosen={value} /></span>;
  const toggle = (optionId: string) =>
    onChange(value.includes(optionId) ? value.filter((held) => held !== optionId) : [...value, optionId]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex min-h-7 w-full min-w-0 items-center rounded-md border border-transparent px-2 py-1 text-left text-sm hover:border-input"
        >
          {value.length > 0 ? <Chips field={field} chosen={value} /> : <span className="text-muted-foreground/60">{t("crm.card.custom.pick")}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-77 overflow-y-auto">
        {field.options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={value.includes(option.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(option.id)}
          >
            <OptionChip name={option.name} color={option.color} />
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
