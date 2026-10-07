import { useLocation } from "react-router-dom";

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

export const useActiveProjectId = () => parseSelection(useLocation().pathname).projectId;
export const useActiveCampaignId = () => parseSelection(useLocation().pathname).campaignId;
