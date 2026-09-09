import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, PlugIcon, CheckIcon } from "lucide-react";
import { ApiError, http } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, TextField } from "@/shared/ui/index.js";
import { useCan } from "@/features/permissions/index.js";

interface Connection {
  accountId: string;
  currency: string;
  timezone: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR" | "AUTH_REQUIRED";
  lastSuccessAt: string | null;
  lastError: string | null;
  nextDailyAt: string;
}
const failureText = (code: unknown) => {
  switch (code) {
    case "TOKEN": return t("meta.error.token");
    case "CURRENCY": return t("meta.error.currency");
    case "CONFIGURATION": return t("meta.error.configuration");
    case "CONFLICT": return t("meta.error.conflict");
    default: return t("meta.error.provider");
  }
};

export function MetaIntegration({ projectId }: { projectId: string }) {
  const allowed = useCan("update", "project");
  const queryClient = useQueryClient();
  const path = `/projects/${projectId}/integrations/meta`;
  const queryKey = ["meta-integration", projectId];
  const connection = useQuery({
    queryKey, queryFn: () => http.get<Connection | null>(path), enabled: allowed,
    refetchInterval: (query) => ["QUEUED", "RUNNING"].includes(query.state.data?.status ?? "") ? 2000 : 60_000,
  });
  const previousSuccess = useRef<string | null | undefined>(undefined);
  useEffect(() => { previousSuccess.current = undefined; }, [projectId]);
  useEffect(() => {
    const success = connection.data?.lastSuccessAt;
    if (success && previousSuccess.current !== undefined && previousSuccess.current !== success) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-sets"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
    }
    if (connection.isSuccess) previousSuccess.current = success ?? null;
  }, [connection.data?.lastSuccessAt, connection.isSuccess, projectId, queryClient]);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const close = () => { setOpen(false); setToken(""); setFailure(null); };
  const busy = connection.data?.status === "QUEUED" || connection.data?.status === "RUNNING";
  const run = async (action: () => Promise<void>) => {
    setPending(true); setFailure(null);
    try { await action(); } catch (error) {
      const code = error instanceof ApiError ? (error.details[0] as { code?: string } | undefined)?.code : undefined;
      setFailure(failureText(code));
    } finally { setPending(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submittedToken = token;
    setToken("");
    void run(async () => {
      const saved = await http.put<Connection>(path, { accountId: accountId.trim(), token: submittedToken.trim() });
      queryClient.setQueryData(queryKey, saved);
      close();
    });
  };
  if (!allowed) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4" aria-label={t("meta.title")}>
      <div className="grid gap-1">
        <h2 className="text-sm font-semibold">{t("meta.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("meta.schedule")}</p>
        {connection.data && <p className="text-xs" role="status">{t(`meta.status.${connection.data.status}`)} · {connection.data.accountId} · {connection.data.currency}</p>}
        {connection.data?.lastSuccessAt && <p className="text-xs text-muted-foreground">{t("meta.lastSuccess")} {new Date(connection.data.lastSuccessAt).toLocaleString("ru-RU")}</p>}
        {connection.data?.lastError && <p role="alert" className="text-xs text-destructive">{failureText(connection.data.lastError)}</p>}
        {connection.isError && <p role="alert" className="text-xs text-destructive">{t("meta.error.read")}</p>}
        {failure && !open && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      </div>
      <div className="flex gap-2">
        {connection.isError && <Button variant="outline" size="sm" onClick={() => void connection.refetch()}>{t("state.retry")}</Button>}
        {connection.data && <Button variant="outline" size="sm" disabled={pending || busy} onClick={() => void run(async () => { queryClient.setQueryData(queryKey, await http.post<Connection>(`${path}/sync`, {})); })}><RefreshCwIcon className={pending || busy ? "animate-spin" : undefined} />{t("meta.refresh")}</Button>}
        <Button variant="outline" size="sm" disabled={pending || connection.isPending || connection.isError} onClick={() => { setAccountId(connection.data?.accountId ?? ""); setToken(""); setFailure(null); setOpen(true); }}>{connection.data ? <CheckIcon className="text-emerald-500" /> : <PlugIcon />}{t("meta.api")}</Button>
      </div>
      <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("meta.settings")}</DialogTitle></DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <TextField label={t("meta.accountId")} value={accountId} onChange={(event) => setAccountId(event.target.value)} required pattern="(act_)?[0-9]{1,30}" autoComplete="off" placeholder="act_123456789" disabled={pending} />
            <TextField label={t("meta.token")} type="password" value={token} onChange={(event) => setToken(event.target.value)} required maxLength={8192} autoComplete="new-password" disabled={pending} />
            <p className="text-xs text-muted-foreground">{t("meta.help")}</p>
            {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
            <DialogFooter className="flex-wrap gap-2">
              {connection.data && <Button type="button" variant="destructive" disabled={pending} onClick={() => void run(async () => { await http.del(path); queryClient.setQueryData(queryKey, null); close(); })}>{t("meta.disconnect")}</Button>}
              <Button type="button" variant="outline" onClick={close}>{t("action.cancel")}</Button>
              <Button type="submit" disabled={pending}>{pending ? t("meta.saving") : connection.data ? t("action.save") : t("meta.connect")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
