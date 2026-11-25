import { useState } from "react";
import { t } from "@/shared/config/index.js";
import { Button, Loader } from "@/shared/ui/index.js";
import { useWebsiteKey, useWebsiteKeyChange } from "../api/api.js";
import { Snippet } from "./Snippet.js";

export interface MarquizPanelProps {
  projectId: string;
}

export function MarquizPanel({ projectId }: MarquizPanelProps) {
  const key = useWebsiteKey(projectId);
  const change = useWebsiteKeyChange(projectId);
  const [failed, setFailed] = useState(false);
  const current = key.data ?? null;

  async function create() {
    setFailed(false);
    try {
      await change.create.mutateAsync();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {key.isPending ? (
        <Loader label={t("state.loading")} />
      ) : key.isError ? (
        <p role="alert" className="text-sm text-destructive">{t("website.loadFailed")}</p>
      ) : current ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("marquiz.address")}</h3>
          <Snippet value={`${window.location.origin}/api/intake/marquiz/${current.key}`} label={t("marquiz.copy")} />
          <p className="text-xs text-muted-foreground">{t("marquiz.hint")}</p>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("marquiz.noKey")}</p>
          <div className="flex justify-end">
            <Button type="button" disabled={change.create.isPending} onClick={() => void create()}>
              {t("website.create")}
            </Button>
          </div>
        </div>
      )}
      {failed ? <p role="alert" className="text-sm text-destructive">{t("website.failed")}</p> : null}
    </div>
  );
}
