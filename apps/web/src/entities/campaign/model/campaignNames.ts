import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { campaignsApi, type ProjectCampaignReference } from "../api/api.js";

export type CampaignNamesStatus = "idle" | "loading" | "ready" | "failed";

interface CampaignNamesStore {
  references: ProjectCampaignReference[] | undefined;
  status: CampaignNamesStatus;
}

export const useCampaignNamesStore = create<CampaignNamesStore>(() => ({
  references: undefined,
  status: "idle",
}));

let session = 0;
let loading: Promise<void> | null = null;

export function loadCampaignNames(): Promise<void> {
  if (loading) return loading;
  if (useCampaignNamesStore.getState().status === "ready") return Promise.resolve();

  const era = session;
  useCampaignNamesStore.setState({ status: "loading" });
  loading = campaignsApi.names()
    .then((references) => {
      if (era === session) useCampaignNamesStore.setState({ references, status: "ready" });
    })
    .catch(() => {
      if (era === session) useCampaignNamesStore.setState({ status: "failed" });
    })
    .finally(() => {
      if (era === session) loading = null;
    });

  return loading;
}

export function resetCampaignNames(): void {
  session += 1;
  loading = null;
  useCampaignNamesStore.setState({ references: undefined, status: "idle" });
}

export function useCampaignNames() {
  const references = useCampaignNamesStore((state) => state.references);
  const status = useCampaignNamesStore((state) => state.status);

  useEffect(() => { void loadCampaignNames(); }, []);

  return {
    data: references,
    isPending: status === "idle" || status === "loading",
    isSuccess: status === "ready",
    isError: status === "failed",
  };
}

export function useProjectCampaignNames(projectId: string | undefined) {
  const { data, ...rest } = useCampaignNames();

  const held = useMemo(
    () => (projectId === undefined
      ? []
      : (data ?? []).filter((reference) => reference.projectId === projectId)),
    [data, projectId],
  );

  return { data: held, ...rest };
}

export function useCampaignNameById(): Map<string, string> {
  const { data } = useCampaignNames();

  return useMemo(
    () => new Map((data ?? []).map((reference) => [reference.id, reference.name] as const)),
    [data],
  );
}
