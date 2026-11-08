import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ApiError, navigation } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, SearchableSelect } from "@/shared/ui/index.js";
import { seoApi, seoSitesKey } from "@/entities/seo/index.js";

export function analyticsFailureOf(error: unknown): string {
  const code = error instanceof ApiError ? (error.details[0] as { code?: string } | undefined)?.code : undefined;
  switch (code) {
    case "TOKEN":
      return t("seo.traffic.error.token");
    case "PROPERTY":
    case "SITE":
      return t("seo.traffic.error.property");
    case "CONFIGURATION":
      return t("seo.error.configuration");
    default:
      return t("seo.traffic.error.provider");
  }
}

export async function startAnalyticsSignIn(projectId: string, siteId: string): Promise<void> {
  const { url } = await seoApi.authorizeAnalytics(projectId, siteId);
  navigation.go(url);
}

export function AnalyticsReturn({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const returned = params.get("analytics");
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (returned === null) return;
    if (returned === "failed") setFailed(true);
    else setAuthorization(returned);
    setParams((current) => {
      current.delete("analytics");
      return current;
    }, { replace: true });
  }, [returned, setParams]);

  return (
    <>
      {failed && (
        <section className="flex items-center gap-2 rounded-lg border border-border glass-card p-3">
          <p role="alert" className="text-xs text-destructive">{t("seo.traffic.error.signIn")}</p>
          <Button variant="outline" size="sm" onClick={() => setFailed(false)}>{t("action.close")}</Button>
        </section>
      )}
      {authorization && <PropertyChoiceDialog projectId={projectId} authorization={authorization} onClose={() => setAuthorization(null)} />}
    </>
  );
}

function PropertyChoiceDialog({ projectId, authorization, onClose }: { projectId: string; authorization: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const choices = useQuery({
    queryKey: ["seo-properties", projectId, authorization],
    queryFn: () => seoApi.properties(projectId, authorization),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const [chosen, setChosen] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const link = async () => {
    const siteId = choices.data?.siteId;
    if (!siteId) return;
    setPending(true);
    setFailure(null);
    try {
      await seoApi.linkAnalytics(projectId, siteId, { authorization, propertyId: chosen });
      await queryClient.invalidateQueries({ queryKey: seoSitesKey(projectId) });
      await queryClient.invalidateQueries({ queryKey: ["seo", projectId, siteId, "traffic"] });
      onClose();
    } catch (error) {
      setFailure(analyticsFailureOf(error));
      setPending(false);
    }
  };

  const list = choices.data?.properties ?? [];
  const loadFailure = choices.isError ? analyticsFailureOf(choices.error) : null;

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !pending) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("seo.traffic.choose")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {choices.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">{t("seo.traffic.loading")}</p>
          ) : loadFailure ? (
            <p role="alert" className="text-xs text-destructive">{loadFailure}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("seo.traffic.empty")}</p>
          ) : (
            <SearchableSelect
              id="seo-property"
              ariaLabel={t("seo.traffic.property")}
              value={chosen}
              placeholder={t("seo.traffic.property")}
              searchLabel={t("select.search")}
              emptyLabel={t("select.search.empty")}
              disabled={pending}
              options={list.map((choice) => ({ value: choice.propertyId, label: choice.name }))}
              onValueChange={setChosen}
            />
          )}
          <p className="text-xs text-muted-foreground">{t("seo.traffic.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="button" disabled={pending || !chosen} onClick={() => void link()}>
              {pending ? t("meta.saving") : t("meta.connect")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
