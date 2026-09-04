export type TargetArea =
  | "identity" | "invites" | "members" | "clients" | "projects"
  | "campaigns" | "records" | "audit" | "shared" | "composition";

export type LegacyLayer = "composition" | "presentation" | "infrastructure" | "mixed";

const sourcesByTarget = {
  identity: [], invites: [], members: [], clients: [], projects: [],
  campaigns: [], records: [], audit: [], shared: [], composition: [],
} as const satisfies Record<TargetArea, readonly string[]>;

function classifyLayer(path: string): LegacyLayer {
  if (path === "app.ts") return "composition";
  if (/\.(controller|routes|schema)\.ts$/.test(path) || path.startsWith("middleware/") || path.startsWith("types/")) return "presentation";
  if (path.startsWith("lib/") || ["config.ts", "server.ts", "shutdown.ts", "seed.ts"].includes(path)) return "infrastructure";
  return "mixed";
}

export const LEGACY_SOURCE_INVENTORY = Object.entries(sourcesByTarget).flatMap(
  ([target, paths]) => paths.map((path) => ({ path, currentLayer: classifyLayer(path), target: target as TargetArea })),
);

export const LEGACY_ALLOW_LIST = new Set(LEGACY_SOURCE_INVENTORY.map(({ path }) => path));
