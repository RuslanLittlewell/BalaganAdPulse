import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import {
  AvatarPreview,
  avatarChoices,
  avatarPng,
  randomAvatarOptions,
  type AvatarOptions,
} from "./avatar.js";
import { fieldLabels, optionLabel } from "./labels.js";

interface Props {
  open: boolean;
  initial: AvatarOptions;
  onClose: () => void;
  onSave: (options: AvatarOptions, png: Blob) => Promise<void>;
}

export function AvatarEditorDialog({ open, initial, onClose, onSave }: Props) {
  const { control, watch, reset, handleSubmit } = useForm<AvatarOptions>({
    defaultValues: initial,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) reset(initial);
  }, [open, initial, reset]);
  const values = watch();
  const preview = useMemo(
    () => ({ ...initial, ...values }),
    [initial, values],
  ) as AvatarOptions;

  const submit = handleSubmit(async (options) => {
    setBusy(true);
    try {
      await onSave(options, await avatarPng(options));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="w-[min(900px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("avatar.title")}</DialogTitle>
        </DialogHeader>
        <form
          className={"grid gap-6 md:grid-cols-[220px_1fr]"}
          onSubmit={(event) => void submit(event)}
        >
          <aside
            className={
              "sticky top-0 grid self-start gap-4 [&>img]:aspect-square [&>img]:w-full [&>img]:rounded-full [&>img]:bg-muted"
            }
          >
            <AvatarPreview options={preview} />
            <Button
              type="button"
              variant="outline"
              onClick={() => reset(randomAvatarOptions())}
            >
              {t("avatar.random")}
            </Button>
          </aside>
          <div className={"grid grid-cols-1 gap-3 sm:grid-cols-2"}>
            {(Object.keys(avatarChoices) as (keyof AvatarOptions)[]).map((key) => (
              <Controller
                key={key}
                control={control}
                name={key}
                render={({ field }) => (
                  <div className="grid gap-1">
                    <Label htmlFor={key} className="text-xs text-muted-foreground">
                      {fieldLabels[key]}
                    </Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={key} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {avatarChoices[key].map((option) => (
                          <SelectItem key={option} value={option}>
                            {optionLabel(key, option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            ))}
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("avatar.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
