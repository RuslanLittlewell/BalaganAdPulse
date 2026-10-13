import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SummaryTile } from "../model/catalogue.js";
import { summaryTilesApi, type ChosenTiles, type SummaryOwner } from "./api.js";

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
    mutationFn: (tiles: SummaryTile[]) => summaryTilesApi.save(owner, tiles),
    onMutate: async (tiles) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<ChosenTiles>(key, { tiles });
    },
    onError: () => qc.invalidateQueries({ queryKey: key }),
  });
}
