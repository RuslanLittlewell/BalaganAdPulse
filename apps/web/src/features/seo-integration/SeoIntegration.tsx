import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { ApiError, formatDateTime, navigation } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ProviderLogo,
  SearchableSelect,
} from "@/shared/ui/index.js";
import { seoApi, seoSiteKey, seoSitesKey, type SeoSite } from "@/entities/seo/index.js";
import { analyticsFailureOf, startAnalyticsSignIn } from "./AnalyticsLink.js";

const NO_PROPERTY = "none";

export function seoFailureText(code: unknown): string {
  switch (code) {
    case "TOKEN":
      return t("seo.error.token");
    case "ACCESS":
      return t("seo.error.access");
    case "CONFIGURATION":
      return t("seo.error.configuration");
    case "SITE":
      return t("seo.error.site");
    case "UNREACHABLE":
      return t("seo.error.unreachable");
    case "ROBOTS":
      return t("seo.error.robots");
    default:
      return t("seo.error.provider");
  }
}

export function seoFailureOf(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return t("seo.error.duplicate");
  const code = error instanceof ApiError ? (error.details[0] as { code?: string } | undefined)?.code : undefined;
  return seoFailureText(code);
}

export async function startSeoSignIn(projectId: string, siteId?: string): Promise<void> {
  const { url } = await seoApi.authorize(projectId, siteId);
  navigation.go(url);
}

export function SeoConnectionCard({ projectId, site }: { projectId: string; site: SeoSite }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = site.status === "QUEUED" || site.status === "RUNNING";

  const refresh = async () => {
    setPending(true);
    setFailure(null);
    try {
      const saved = await seoApi.sync(projectId, site.id);
      queryClient.setQueryData<SeoSite[]>(seoSitesKey(projectId), (list) => list?.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setFailure(seoFailureOf(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="flex w-min min-w-56 flex-col justify-between gap-2 rounded-lg border border-border glass-card p-3" aria-label={t("seo.title")}>
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ProviderLogo provider="SEARCH_CONSOLE" className="size-3 shrink-0" />
          {t("seo.title")}
        </h2>
        <p className="truncate text-xs text-foreground">{site.label}</p>
        {site.lastSuccessAt && (
          <p className="text-xs text-muted-foreground">{t("meta.lastSuccess")} {formatDateTime(site.lastSuccessAt)}</p>
        )}
        {site.lastCheckAt && (
          <p className="text-xs text-muted-foreground">{t("seo.lastCheck")} {formatDateTime(site.lastCheckAt)}</p>
        )}
        {site.lastError && <p role="alert" className="text-xs text-destructive">{seoFailureText(site.lastError)}</p>}
        {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={pending || busy || site.status === "AUTH_REQUIRED"} aria-busy={pending || busy} onClick={() => void refresh()}>
          <RefreshCwIcon className={pending || busy ? "animate-spin" : undefined} />
          {t("meta.refresh")}
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setSettings(true)}>
          <CheckIcon className="text-emerald-500" />
          {t("seo.api")}
        </Button>
      </div>
      {settings && <SeoSettingsDialog projectId={projectId} site={site} onClose={() => setSettings(false)} />}
    </section>
  );
}

function SeoSettingsDialog({ projectId, site, onClose }: { projectId: string; site: SeoSite; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signInAgain = async () => {
    setPending(true);
    setFailure(null);
    try {
      if (site.analytics) await startAnalyticsSignIn(projectId, site.id);
      else await startSeoSignIn(projectId, site.id);
    } catch (error) {
      setFailure(seoFailureOf(error));
      setPending(false);
    }
  };

  const connectAnalytics = async () => {
    setPending(true);
    setFailure(null);
    try {
      await startAnalyticsSignIn(projectId, site.id);
    } catch (error) {
      setFailure(analyticsFailureOf(error));
      setPending(false);
    }
  };

  const unlinkAnalytics = async () => {
    setPending(true);
    setFailure(null);
    try {
      await seoApi.unlinkAnalytics(projectId, site.id);
      await queryClient.invalidateQueries({ queryKey: seoSitesKey(projectId) });
      await queryClient.invalidateQueries({ queryKey: [...seoSiteKey(projectId, site.id), "traffic"] });
      setUnlinking(false);
      setPending(false);
    } catch (error) {
      setFailure(analyticsFailureOf(error));
      setPending(false);
      setUnlinking(false);
    }
  };

  const disconnect = async () => {
    setPending(true);
    setFailure(null);
    try {
      await seoApi.disconnect(projectId, site.id);
      queryClient.setQueryData<SeoSite[]>(seoSitesKey(projectId), (list) => list?.filter((item) => item.id !== site.id));
      queryClient.removeQueries({ queryKey: seoSiteKey(projectId, site.id) });
      onClose();
    } catch (error) {
      setFailure(seoFailureOf(error));
      setPending(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Dialog open={!confirming && !unlinking} onOpenChange={(value) => { if (!value) onClose(); }}>
        <DialogContent className="h-auto">
          <DialogHeader>
            <DialogTitle>{t("seo.settings")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm">{t("seo.site")}: <span className="font-medium">{site.label}</span></p>
            <p className="text-xs text-muted-foreground">{t("seo.help")}</p>
            {site.analytics && <p className="text-sm">{t("seo.traffic.property")}: <span className="font-medium">{site.analytics.name}</span></p>}
            {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
            <DialogFooter className="flex-wrap gap-2">
              {site.analytics ? (
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setUnlinking(true)}>
                  {t("seo.traffic.disconnect")}
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={pending} onClick={() => void connectAnalytics()}>
                  {t("seo.traffic.connect")}
                </Button>
              )}
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
                {t("meta.disconnect")}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
              <Button type="button" disabled={pending} onClick={() => void signInAgain()}>{t("google.signInAgain")}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={unlinking}
        title={t("seo.traffic.unlinkTitle")}
        description={t("seo.traffic.unlinkText")}
        confirmLabel={t("seo.traffic.disconnect")}
        pending={pending}
        onConfirm={() => void unlinkAnalytics()}
        onClose={() => setUnlinking(false)}
      />
      <ConfirmDialog
        open={confirming}
        title={t("seo.disconnect.title")}
        description={t("seo.disconnect.text")}
        confirmLabel={t("meta.disconnect")}
        pending={pending}
        onConfirm={() => void disconnect()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

export function SeoReturn({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const returned = params.get("searchConsole");
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (returned === null) return;
    if (returned === "failed") setFailed(true);
    else setAuthorization(returned);
    setParams((current) => {
      current.delete("searchConsole");
      return current;
    }, { replace: true });
  }, [returned, setParams]);

  return (
    <>
      {failed && (
        <section className="flex items-center gap-2 rounded-lg border border-border glass-card p-3">
          <p role="alert" className="text-xs text-destructive">{t("seo.error.signIn")}</p>
          <Button variant="outline" size="sm" onClick={() => setFailed(false)}>{t("action.close")}</Button>
        </section>
      )}
      {authorization && <SiteChoiceDialog projectId={projectId} authorization={authorization} onClose={() => setAuthorization(null)} />}
    </>
  );
}

function SiteChoiceDialog({ projectId, authorization, onClose }: { projectId: string; authorization: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const choices = useQuery({
    queryKey: ["seo-choices", projectId, authorization],
    queryFn: () => seoApi.choices(projectId, authorization),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const [chosen, setChosen] = useState("");
  const [property, setProperty] = useState(NO_PROPERTY);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const renewing = useRef(false);

  const connect = async (siteUrl?: string) => {
    setPending(true);
    setFailure(null);
    try {
      await seoApi.connect(projectId, {
        authorization,
        ...(siteUrl ? { siteUrl } : {}),
        ...(siteUrl && property !== NO_PROPERTY ? { propertyId: property } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: seoSitesKey(projectId) });
      onClose();
    } catch (error) {
      setFailure(error instanceof ApiError && (error.details[0] as { code?: string } | undefined)?.code === "PROPERTY" ? analyticsFailureOf(error) : seoFailureOf(error));
      setPending(false);
    }
  };

  useEffect(() => {
    if (!choices.data?.renewing || renewing.current) return;
    renewing.current = true;
    void connect();
  });

  const list = choices.data?.sites ?? [];
  const properties = choices.data?.properties ?? [];
  const loadFailure = choices.isError ? seoFailureOf(choices.error) : null;

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !pending) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("seo.choose")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {choices.isPending || choices.data?.renewing ? (
            <p className="text-sm text-muted-foreground">{t("seo.loading")}</p>
          ) : loadFailure ? (
            <p role="alert" className="text-xs text-destructive">{loadFailure}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("seo.empty")}</p>
          ) : (
            <SearchableSelect
              id="seo-site"
              ariaLabel={t("seo.site")}
              value={chosen}
              placeholder={t("seo.site")}
              searchLabel={t("select.search")}
              emptyLabel={t("select.search.empty")}
              disabled={pending}
              options={list.map((choice) => ({ value: choice.siteUrl, label: choice.label }))}
              onValueChange={setChosen}
            />
          )}
          {properties.length > 0 && (
            <SearchableSelect
              id="seo-site-property"
              ariaLabel={t("seo.traffic.property")}
              value={property}
              placeholder={t("seo.traffic.property")}
              searchLabel={t("select.search")}
              emptyLabel={t("select.search.empty")}
              disabled={pending}
              options={[{ value: NO_PROPERTY, label: t("seo.traffic.skip") }, ...properties.map((choice) => ({ value: choice.propertyId, label: choice.name }))]}
              onValueChange={setProperty}
            />
          )}
          <p className="text-xs text-muted-foreground">{t("seo.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="button" disabled={pending || !chosen} onClick={() => void connect(chosen)}>
              {pending ? t("meta.saving") : t("meta.connect")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
