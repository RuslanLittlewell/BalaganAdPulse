import { create } from "zustand";

export interface Selection {
  projectId?: string;
  campaignId?: string;
}

const SELECTION_ROUTE = /^\/projects\/([^/]+)(?:\/campaigns\/([^/]+))?/;

export function parseSelection(pathname: string): Selection {
  const match = SELECTION_ROUTE.exec(pathname);
  if (!match) return {};
  return { projectId: match[1], campaignId: match[2] };
}

interface SelectionStore extends Selection {
  select: (selection: Selection) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  ...parseSelection(typeof window === "undefined" ? "" : window.location.pathname),
  select: ({ projectId, campaignId }) => set({ projectId, campaignId }),
}));

export const useActiveProjectId = () => useSelectionStore((state) => state.projectId);
export const useActiveCampaignId = () => useSelectionStore((state) => state.campaignId);
