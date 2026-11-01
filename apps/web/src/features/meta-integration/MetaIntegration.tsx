import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { ApiError, formatDateTime, http } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  AddTile,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ProviderLogo,
  Switch,
  TextField,
  type IntegrationProvider,
} from "@/shared/ui/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useModuleEnabled } from "@/features/auth/index.js";
import { LeadsSetupInfo } from "./LeadsSetupInfo.js";
import { GoogleConnectionCard, GoogleReturn, googleFailureOf, startGoogleSignIn } from "@/features/google-integration/index.js";

export interface Connection {
  id: string;
  provider: "META" | "GOOGLE";
  accountId: string;
  currency: string;
  timezone: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR" | "AUTH_REQUIRED";
  lastSuccessAt: string | null;
  lastError: string | null;
  nextDailyAt: string;
  leadsEnabled: boolean;
  leads: LeadImport;
}
interface LeadImport {
  status: "WAITING" | "OK" | "ACCESS_REQUIRED" | "ERROR";
  lastSuccessAt: string | null;
  lastError: string | null;
}

const PROVIDERS: readonly IntegrationProvider[] = ["META", "GOOGLE", "YANDEX", "TIKTOK", "GPT"];
const AVAILABLE: readonly IntegrationProvider[] = ["META", "GOOGLE"];

const integrationsPath = (projectId: string) => `/projects/${projectId}/integrations`;
const integrationsKey = (projectId: string) => ["integrations", projectId];

const leadFailureText = (code: string | null) => {
  switch (code) {
    case null:
    case "TOKEN":
      return null;
    case "ACCESS":
      return t("meta.leads.error.access");
    default:
      return t("meta.leads.error.provider");
  }
};
const failureText = (code: unknown) => {
  switch (code) {
    case "TOKEN":
      return t("meta.error.token");
    case "CURRENCY":
      return t("meta.error.currency");
    case "CONFIGURATION":
      return t("meta.error.configuration");
    case "CONFLICT":
      return t("meta.error.conflict");
    default:
      return t("meta.error.provider");
  }
};
const failureOf = (error: unknown) => {
  if (error instanceof ApiError && error.status === 409) return t("meta.error.duplicate");
  const code = error instanceof ApiError
    ? (error.details[0] as { code?: string } | undefined)?.code
    : undefined;
  return failureText(code);
};

export function useIntegrations(projectId: string, enabled = true) {
  return useQuery({
    queryKey: integrationsKey(projectId),
    queryFn: () => http.get<Connection[]>(integrationsPath(projectId)),
    enabled,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((connection) => ["QUEUED", "RUNNING"].includes(connection.status))
        ? 2000
        : 60_000,
  });
}

function useRefreshOnImport(projectId: string, connections: Connection[] | undefined) {
  const queryClient = useQueryClient();
  const seen = useRef<Map<string, string | null> | null>(null);
  useEffect(() => {
    seen.current = null;
  }, [projectId]);
  useEffect(() => {
    if (connections == null) return;
    const previous = seen.current;
    const imported = previous != null && connections.some((connection) =>
      connection.lastSuccessAt != null
      && previous.has(connection.id)
      && previous.get(connection.id) !== connection.lastSuccessAt);
    if (imported) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-sets"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
    }
    seen.current = new Map(connections.map((connection) => [connection.id, connection.lastSuccessAt]));
  }, [connections, projectId, queryClient]);
}

function useSquareByHeight<T extends HTMLElement>() {
  const [side, setSide] = useState<number>();
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const measure = () => setSide(node.offsetHeight || undefined);
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);
  return { ref, side };
}

export function MetaIntegration({ projectId }: { projectId: string }) {
  const allowed = useCan("update", "integration");
  const connections = useIntegrations(projectId, allowed);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [googleFailure, setGoogleFailure] = useState<string | null>(null);
  const square = useSquareByHeight<HTMLDivElement>();
  useRefreshOnImport(projectId, connections.data);

  if (!allowed) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">{t("integrations.title")}</h2>
      <div className="flex flex-wrap items-stretch gap-2">
        {connections.isError && (
          <section className="flex items-center gap-2 rounded-lg border border-border glass-card p-3">
            <p role="alert" className="text-xs text-destructive">{t("meta.error.read")}</p>
            <Button variant="outline" size="sm" onClick={() => void connections.refetch()}>
              {t("state.retry")}
            </Button>
          </section>
        )}
        <GoogleReturn projectId={projectId} />
        {googleFailure && (
          <section className="flex items-center gap-2 rounded-lg border border-border glass-card p-3">
            <p role="alert" className="text-xs text-destructive">{googleFailure}</p>
            <Button variant="outline" size="sm" onClick={() => setGoogleFailure(null)}>
              {t("action.close")}
            </Button>
          </section>
        )}
        {(connections.data ?? []).map((connection) => connection.provider === "GOOGLE"
          ? <GoogleConnectionCard key={connection.id} projectId={projectId} connection={connection} />
          : <MetaConnectionCard key={connection.id} projectId={projectId} connection={connection} />)}
        <AddTile
          ref={square.ref}
          label={t("integrations.add")}
          style={{ width: square.side }}
          disabled={connections.isPending || connections.isError}
          onClick={() => setChoosing(true)}
          className="min-w-19 shrink-0 self-stretch"
        />
        <ProviderDialog
          open={choosing}
          onClose={() => setChoosing(false)}
          onChoose={(provider) => {
            setChoosing(false);
            if (provider === "GOOGLE") {
              setGoogleFailure(null);
              startGoogleSignIn(projectId).catch((error: unknown) => setGoogleFailure(googleFailureOf(error)));
              return;
            }
            setAdding(true);
          }}
        />
        {adding && <MetaConnectionForm projectId={projectId} onClose={() => setAdding(false)} />}
      </div>
    </section>
  );
}

function ProviderDialog({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (provider: IntegrationProvider) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("integrations.choose")}</DialogTitle>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const available = AVAILABLE.includes(provider);
            return (
              <li key={provider}>
                <Button
                  type="button"
                  variant="outline"
                  className="aspect-square h-auto w-full flex-col gap-2 whitespace-normal p-2"
                  disabled={!available}
                  onClick={() => onChoose(provider)}
                >
                  <ProviderLogo provider={provider} className="size-8" />
                  <span className="flex flex-col items-center gap-0.5">
                    <span>{t(`integrations.provider.${provider}`)}</span>
                    {!available && <span className="text-xs text-muted-foreground">{t("integrations.soon")}</span>}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function MetaConnectionCard({ projectId, connection }: { projectId: string; connection: Connection }) {
  const queryClient = useQueryClient();
  const path = `${integrationsPath(projectId)}/${connection.id}`;
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = connection.status === "QUEUED" || connection.status === "RUNNING";
  const store = (saved: Connection) =>
    queryClient.setQueryData<Connection[]>(integrationsKey(projectId), (list) =>
      list?.map((item) => (item.id === saved.id ? saved : item)));
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setPending(false);
    }
  };
  const leads = connection.leadsEnabled ? connection.leads : null;
  const leadFailure = leads && leadFailureText(leads.lastError);

  return (
    <section
      className="flex w-min flex-col justify-between gap-2 rounded-lg border border-border glass-card p-3"
      aria-label={t("meta.title")}
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ProviderLogo provider="META" className="size-3 shrink-0" />
          {t("meta.title")}
        </h2>
        {connection.lastSuccessAt && (
          <p className="text-xs text-muted-foreground">
            {t("meta.lastSuccess")} {formatDateTime(connection.lastSuccessAt)}
          </p>
        )}
        {connection.lastError && (
          <p role="alert" className="text-xs text-destructive">{failureText(connection.lastError)}</p>
        )}
        {leads?.lastSuccessAt && (
          <p className="text-xs text-muted-foreground">
            {t("meta.leads.lastSuccess")} {formatDateTime(leads.lastSuccessAt)}
          </p>
        )}
        {leadFailure && (
          <p role="alert" className="text-xs text-destructive">{leadFailure}</p>
        )}
        {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || busy}
          aria-busy={pending || busy}
          onClick={() => void run(async () => { store(await http.post<Connection>(`${path}/sync`, {})); })}
        >
          <RefreshCwIcon className={pending || busy ? "animate-spin" : undefined} />
          {t("meta.refresh")}
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(true)}>
          <CheckIcon className="text-emerald-500" />
          {t("meta.api")}
        </Button>
      </div>
      {editing && (
        <MetaConnectionForm projectId={projectId} connection={connection} onClose={() => setEditing(false)} />
      )}
    </section>
  );
}

function MetaConnectionForm({
  projectId,
  connection,
  onClose,
}: {
  projectId: string;
  connection?: Connection;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(connection?.accountId ?? "");
  const [token, setToken] = useState("");
  const tracksLeads = useModuleEnabled("CRM");
  const [leadsEnabled, setLeadsEnabled] = useState(connection?.leadsEnabled ?? false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = integrationsKey(projectId);
  const store = (saved: Connection) =>
    queryClient.setQueryData<Connection[]>(key, (list) =>
      list?.map((item) => (item.id === saved.id ? saved : item)));
  const switchLeads = async (enabled: boolean) => {
    setLeadsEnabled(enabled);
    if (!connection) return;
    setFailure(null);
    try {
      store(await http.patch<Connection>(`${integrationsPath(projectId)}/${connection.id}`, { leadsEnabled: enabled }));
    } catch (error) {
      setLeadsEnabled(!enabled);
      setFailure(failureOf(error));
    }
  };
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setFailure(null);
    try {
      await action();
      onClose();
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setPending(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const credentials = { accountId: accountId.trim(), token: token.trim() };
    setToken("");
    void run(async () => {
      if (connection) {
        store(await http.put<Connection>(`${integrationsPath(projectId)}/${connection.id}`, credentials));
      } else {
        const saved = await http.post<Connection>(`${integrationsPath(projectId)}/meta`, { ...credentials, leadsEnabled: tracksLeads && leadsEnabled });
        queryClient.setQueryData<Connection[]>(key, (list) => [...(list ?? []), saved]);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("meta.settings")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <TextField
            label={t("meta.accountId")}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
            pattern="(act_)?[0-9]{1,30}"
            autoComplete="off"
            placeholder="act_123456789"
            disabled={pending}
          />
          <TextField
            label={t("meta.token")}
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            maxLength={8192}
            autoComplete="new-password"
            disabled={pending}
          />
          {tracksLeads && (
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={leadsEnabled}
                  disabled={pending}
                  onCheckedChange={(enabled) => void switchLeads(enabled)}
                />
                {t("meta.leads.toggle")}
              </label>
              <LeadsSetupInfo />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("meta.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            {connection && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    await http.del(`${integrationsPath(projectId)}/${connection.id}`);
                    queryClient.setQueryData<Connection[]>(key, (list) =>
                      list?.filter((item) => item.id !== connection.id));
                  })}
              >
                {t("meta.disconnect")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("meta.saving") : connection ? t("action.save") : t("meta.connect")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
