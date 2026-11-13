import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, TextField } from "@/shared/ui/index.js";
import { useDisconnectDataset, useSaveDataset, type Dataset, type DatasetSettings } from "../api/conversions.js";
import { ConversionEventList } from "./ConversionEventList.js";

export function datasetFailure(error: unknown): string {
  const code = error instanceof ApiError ? (error.details[0] as { code?: string } | undefined)?.code : undefined;
  switch (code) {
    case "TOKEN":
      return t("capi.error.token");
    case "PROVIDER":
      return t("capi.error.provider");
    case "CONFIGURATION":
      return t("meta.error.configuration");
    default:
      return error instanceof ApiError && error.status === 400 ? t("capi.error.invalid") : t("capi.error.provider");
  }
}

export function DatasetSettingsDialog({ projectId, dataset, onClose }: { projectId: string; dataset: Dataset | null; onClose: () => void }) {
  const save = useSaveDataset(projectId);
  const disconnect = useDisconnectDataset(projectId);
  const [datasetId, setDatasetId] = useState(dataset?.datasetId ?? "");
  const [token, setToken] = useState("");
  const [testEventCode, setTestEventCode] = useState(dataset?.testEventCode ?? "");
  const [currency, setCurrency] = useState(dataset?.currency ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  const pending = save.isPending || disconnect.isPending;
  const needsToken = !dataset || dataset.datasetId !== datasetId.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const settings: DatasetSettings = {
      datasetId: datasetId.trim(),
      testEventCode: testEventCode.trim() || null,
      ...(token.trim() ? { token: token.trim() } : {}),
      ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
    };
    setToken("");
    save.mutate(settings, { onError: (error) => setFailure(datasetFailure(error)) });
  };

  const remove = () => {
    setFailure(null);
    disconnect.mutate(undefined, { onSuccess: onClose, onError: (error) => setFailure(datasetFailure(error)) });
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="h-auto max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("capi.settings")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit} aria-label={t("capi.dataset")}>
          <TextField
            label={t("capi.dataset.id")}
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
            required
            inputMode="numeric"
            pattern="[0-9]{5,20}"
            autoComplete="off"
            disabled={pending}
          />
          {dataset && <p className="text-xs text-muted-foreground">{t("capi.dataset.name")} {dataset.datasetName}</p>}
          <TextField
            label={needsToken ? t("capi.dataset.token") : t("capi.dataset.tokenKeep")}
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required={needsToken}
            maxLength={8192}
            autoComplete="new-password"
            disabled={pending}
          />
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <TextField
              label={t("capi.dataset.testCode")}
              value={testEventCode}
              onChange={(event) => setTestEventCode(event.target.value)}
              maxLength={64}
              autoComplete="off"
              disabled={pending}
            />
            <TextField
              label={t("capi.dataset.currency")}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              maxLength={3}
              pattern="[A-Za-z]{3}"
              autoComplete="off"
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("capi.dataset.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            {dataset && (
              <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                {t("capi.disconnect")}
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {save.isPending ? t("capi.saving") : dataset ? t("action.save") : t("capi.connect")}
            </Button>
          </DialogFooter>
        </form>
        <ConversionEventList projectId={projectId} />
      </DialogContent>
    </Dialog>
  );
}
