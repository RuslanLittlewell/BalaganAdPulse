import { create } from "zustand";

export interface Selection {
  projectId?: string;
  campaignId?: string;
}

/** `/projects/<project>/campaigns/<campaign>` — the only shape that carries a
 * selection. Anything else selects nothing. */
const SELECTION_ROUTE = /^\/projects\/([^/]+)(?:\/campaigns\/([^/]+))?/;

export function parseSelection(pathname: string): Selection {
  const match = SELECTION_ROUTE.exec(pathname);
  if (!match) return {};
  return { projectId: match[1], campaignId: match[2] };
}

interface SelectionStore extends Selection {
  select: (selection: Selection) => void;
}

/**
 * What the user is looking at: the open project and the open sheet.
 *
 * The address stays the way in — a link opened cold seeds the store below, and
 * `SelectionSync` keeps it aligned afterwards, which is what makes the back
 * button and a refresh land where they should. What changed is where the rest
 * of the app reads it from: `useParams` only answers inside the route that
 * declared the parameter, and the project list is rendered beside that route,
 * not inside it — so it never saw the open project at all.
 */
export const useSelectionStore = create<SelectionStore>((set) => ({
  ...parseSelection(typeof window === "undefined" ? "" : window.location.pathname),
  // Both keys every time: a merge would leave a stale sheet behind when the
  // new address carries only a project.
  select: ({ projectId, campaignId }) => set({ projectId, campaignId }),
}));

export const useActiveProjectId = () => useSelectionStore((state) => state.projectId);
export const useActiveCampaignId = () => useSelectionStore((state) => state.campaignId);
