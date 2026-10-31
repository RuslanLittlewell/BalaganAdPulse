import type { ChosenTiles, SummaryAccount } from "../api/api.js";
import type { SummaryTile } from "./catalogue.js";

const sameAccount = (left: SummaryAccount, right: SummaryAccount) =>
  left.channel === right.channel && left.accountId === right.accountId;

export function tilesOf(chosen: ChosenTiles, account: SummaryAccount | null | undefined): SummaryTile[] {
  const own = account ? chosen.accounts?.find((entry) => sameAccount(entry.account, account)) : undefined;
  return own?.tiles ?? chosen.tiles;
}

export function withTiles(
  chosen: ChosenTiles,
  tiles: SummaryTile[],
  account: SummaryAccount | null | undefined,
): ChosenTiles {
  if (!account) return { ...chosen, tiles };
  const others = (chosen.accounts ?? []).filter((entry) => !sameAccount(entry.account, account));
  return { ...chosen, accounts: [...others, { account, tiles }] };
}
