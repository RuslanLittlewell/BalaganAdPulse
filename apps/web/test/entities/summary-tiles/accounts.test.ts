import { tilesOf, withTiles } from "@/entities/summary-tiles/model/accounts.js";

const meta = { channel: "META" as const, accountId: "111" };
const google = { channel: "GOOGLE" as const, accountId: "111" };
const chosen = { tiles: ["CONVERSIONS" as const], accounts: [{ account: meta, tiles: ["CLICKS" as const, "SPEND" as const] }] };

describe("an account's tiles", () => {
  it("are its own when it has them, the project's otherwise", () => {
    expect(tilesOf(chosen, meta)).toEqual(["CLICKS", "SPEND"]);
    expect(tilesOf(chosen, google)).toEqual(["CONVERSIONS"]);
    expect(tilesOf(chosen, null)).toEqual(["CONVERSIONS"]);
    expect(tilesOf({ tiles: ["CPC"] }, meta)).toEqual(["CPC"]);
  });

  it("replace that account's alone, or the project's when no account is named", () => {
    expect(withTiles(chosen, ["CPC"], meta)).toEqual({ tiles: ["CONVERSIONS"], accounts: [{ account: meta, tiles: ["CPC"] }] });
    expect(withTiles(chosen, ["CPC"], google).accounts).toEqual([
      { account: meta, tiles: ["CLICKS", "SPEND"] },
      { account: google, tiles: ["CPC"] },
    ]);
    expect(withTiles(chosen, ["CPC"], null)).toEqual({ ...chosen, tiles: ["CPC"] });
  });
});
