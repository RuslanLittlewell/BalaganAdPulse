import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { OPTION_COLORS, OPTION_LIMIT, OPTION_NAME_LIMIT, OptionSwatch, type OptionColor } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { newOption, type OptionDraft } from "../lib/fieldDraft.js";

export interface OptionsEditorProps {
  options: OptionDraft[];
  error?: string;
  onChange: (options: OptionDraft[]) => void;
}

export function OptionsEditor({ options, error, onChange }: OptionsEditorProps) {
  const replace = (key: string, change: Partial<OptionDraft>) =>
    onChange(options.map((option) => (option.key === key ? { ...option, ...change } : option)));

  const shift = (index: number, by: number) => {
    const next = [...options];
    const [moving] = next.splice(index, 1);
    next.splice(index + by, 0, moving!);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("crm.fields.options")}</legend>
      <ol aria-label={t("crm.fields.options")} className="flex flex-col gap-1">
        {options.map((option, index) => (
          <li key={option.key} data-option={option.name} className="flex items-center gap-1">
            <Select value={option.color} onValueChange={(color) => replace(option.key, { color: color as OptionColor })}>
              <SelectTrigger aria-label={`${t("crm.fields.optionColor")} ${index + 1}`} className="h-8 w-14 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTION_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    <OptionSwatch color={color} />
                    <span className="sr-only">{t(`crm.fields.color.${color}`)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor={`option-${option.key}`} className="sr-only">{`${t("crm.fields.optionName")} ${index + 1}`}</Label>
            <Input
              id={`option-${option.key}`}
              className="h-8 min-w-0 flex-1"
              maxLength={OPTION_NAME_LIMIT}
              value={option.name}
              onChange={(event) => replace(option.key, { name: event.target.value })}
            />
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("crm.fields.moveOptionUp")} disabled={index === 0} onClick={() => shift(index, -1)}>
              <ArrowUp aria-hidden className="size-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("crm.fields.moveOptionDown")} disabled={index === options.length - 1} onClick={() => shift(index, 1)}>
              <ArrowDown aria-hidden className="size-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("crm.fields.removeOption")} onClick={() => onChange(options.filter((candidate) => candidate.key !== option.key))}>
              <X aria-hidden className="size-3" />
            </Button>
          </li>
        ))}
      </ol>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {options.length < OPTION_LIMIT ? (
        <Button type="button" variant="ghost" className="w-fit gap-1" onClick={() => onChange([...options, newOption(options.length)])}>
          <Plus aria-hidden className="size-3" />
          {t("crm.fields.addOption")}
        </Button>
      ) : null}
    </fieldset>
  );
}
