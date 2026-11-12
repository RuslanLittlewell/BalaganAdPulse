import { useLocation } from "react-router-dom";
import { useShareScope } from "@/shared/lib/index.js";

export interface Selection {
  projectId?: string;
  campaignId?: string;
}

const SELECTION_ROUTE = /^\/projects\/([^/]+)(?:\/campaigns\/([^/]+))?/;
const SHARED_CAMPAIGN_ROUTE = /^\/share\/[^/]+\/campaigns\/([^/]+)/;

export function parseSelection(pathname: string): Selection {
  const match = SELECTION_ROUTE.exec(pathname);
  if (!match) return {};
  return { projectId: match[1], campaignId: match[2] };
}

export function parseSharedCampaign(pathname: string): string | undefined {
  return SHARED_CAMPAIGN_ROUTE.exec(pathname)?.[1];
}

export const useActiveProjectId = () => {
  const shared = useShareScope();
  const { pathname } = useLocation();
  return shared ? shared.projectId : parseSelection(pathname).projectId;
};

export const useActiveCampaignId = () => {
  const shared = useShareScope();
  const { pathname } = useLocation();
  return shared ? parseSharedCampaign(pathname) : parseSelection(pathname).campaignId;
};
