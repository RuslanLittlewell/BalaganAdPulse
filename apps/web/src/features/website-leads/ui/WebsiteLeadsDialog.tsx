import { useEffect, useState } from "react";
import { t } from "@/shared/config/index.js";
import {
  Button, CopyButton, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Label, Loader,
} from "@/shared/ui/index.js";
import { useWebsiteKey, useWebsiteKeyChange } from "../api/api.js";

type Asking = "replace" | "remove";

const MANUAL_EXAMPLE = `balagan.lead({
  name: "Анна",
  phone: "+375291234567",
  email: "anna@example.com",
  fields: { "Комментарий": "Нужен замер" },
}).then((sent) => console.log(sent));`;

const UTM_TAGS = "utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.name}}";

export interface WebsiteLeadsDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export interface WebsiteLeadsPanelProps {
  projectId: string;
  active?: boolean;
}

function Snippet({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function WebsiteLeadsDialog({ projectId, open, onClose }: WebsiteLeadsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] w-[min(640px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("website.title")}</DialogTitle>
          <DialogDescription>{t("website.description")}</DialogDescription>
        </DialogHeader>
        {open ? <WebsiteLeadsPanel key={projectId} projectId={projectId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function WebsiteLeadsPanel({ projectId, active = true }: WebsiteLeadsPanelProps) {
  const key = useWebsiteKey(projectId, { enabled: active });
  const change = useWebsiteKeyChange(projectId);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sites, setSites] = useState("");
  const pending = change.create.isPending || change.rotate.isPending || change.remove.isPending || change.allow.isPending;
  const current = key.data ?? null;
  const tag = current
    ? `<script async src="${window.location.origin}/api/intake/script.js" data-key="${current.key}"></script>`
    : "";

  useEffect(() => {
    setSites(current ? current.allowedSites.join("\n") : "");
  }, [current]);

  async function run(action: () => Promise<unknown>) {
    setFailed(false);
    setInvalid(false);
    try {
      await action();
      setAsking(null);
    } catch {
      setFailed(true);
    }
  }

  const confirm = (choice: Asking) => run(() => (choice === "replace" ? change.rotate.mutateAsync() : change.remove.mutateAsync()));

  async function saveSites() {
    const list = sites.split(/[\n,;]+/).map((site) => site.trim()).filter(Boolean);
    setFailed(false);
    try {
      await change.allow.mutateAsync(list);
      setInvalid(false);
    } catch (error) {
      const refused = error instanceof Error && "status" in error && (error as { status?: number }).status === 400;
      setInvalid(refused);
      setFailed(!refused);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {key.isPending ? (
        <Loader label={t("state.loading")} />
      ) : key.isError ? (
        <p role="alert" className="text-sm text-destructive">{t("website.loadFailed")}</p>
      ) : current ? (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("website.script")}</h3>
            <Snippet value={tag} label={t("website.copy")} />
            <p className="text-xs text-muted-foreground">{t("website.script.hint")}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("website.manual")}</h3>
            <p className="text-xs text-muted-foreground">{t("website.manual.hint")}</p>
            <Snippet value={MANUAL_EXAMPLE} label={t("website.manual.copy")} />
          </section>

          <section className="flex flex-col gap-2">
            <Label htmlFor="website-sites" className="text-sm font-semibold">{t("website.sites")}</Label>
            <textarea
              id="website-sites"
              value={sites}
              rows={3}
              spellCheck={false}
              placeholder="example.com"
              onChange={(event) => setSites(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{t("website.sites.hint")}</p>
            {invalid ? <p role="alert" className="text-sm text-destructive">{t("website.sites.invalid")}</p> : null}
            <div className="flex justify-end">
              <Button type="button" variant="outline" disabled={pending} onClick={() => void saveSites()}>{t("website.sites.save")}</Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("website.utm")}</h3>
            <Snippet value={UTM_TAGS} label={t("website.utm.copy")} />
            <p className="text-xs text-muted-foreground">{t("website.utm.hint")}</p>
          </section>

          {asking ? (
            <div role="group" aria-label={t(`website.${asking}`)} className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
              <p className="text-sm">{t(`website.${asking}.warning`)}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAsking(null)}>{t("action.cancel")}</Button>
                <Button type="button" variant="destructive" disabled={pending} onClick={() => void confirm(asking)}>
                  {t(`website.${asking}.confirm`)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAsking("replace")}>{t("website.replace")}</Button>
              <Button type="button" variant="outline" onClick={() => setAsking("remove")}>{t("website.remove")}</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" disabled={pending} onClick={() => void run(() => change.create.mutateAsync())}>
            {t("website.create")}
          </Button>
        </div>
      )}

      {failed ? <p role="alert" className="text-sm text-destructive">{t("website.failed")}</p> : null}
    </div>
  );
}
