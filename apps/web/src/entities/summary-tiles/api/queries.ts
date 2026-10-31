import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SummaryTile } from "../model/catalogue.js";
import { withTiles } from "../model/accounts.js";
import { summaryTilesApi, type ChosenTiles, type SummaryAccount, type SummaryOwner } from "./api.js";

export interface TileChoice {
  tiles: SummaryTile[];
  account?: SummaryAccount | null;
}

export const summaryTilesKey = (owner: SummaryOwner) =>
  ["summary-tiles", owner.kind, owner.kind === "dashboard" ? null : owner.id] as const;

export function useSummaryTiles(owner: SummaryOwner | undefined) {
  return useQuery({
    queryKey: owner ? summaryTilesKey(owner) : ["summary-tiles", "none"],
    queryFn: () => summaryTilesApi.read(owner!),
    enabled: owner !== undefined,
  });
}

export function useChooseSummaryTiles(owner: SummaryOwner) {
  const qc = useQueryClient();
  const key = summaryTilesKey(owner);
  return useMutation({
    scope: { id: key.join(":") },
    mutationFn: ({ tiles, account = null }: TileChoice) => summaryTilesApi.save(owner, tiles, account),
    onMutate: async ({ tiles, account }) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<ChosenTiles>(key, (current) => withTiles(current ?? { tiles: [] }, tiles, account));
    },
    onError: () => qc.invalidateQueries({ queryKey: key }),
  });
}
