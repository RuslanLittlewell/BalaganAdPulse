import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEGACY_ALLOW_LIST, LEGACY_SOURCE_INVENTORY } from "./legacy-inventory.js";
import { analyseSourceText, checkSourceTree, listTypeScriptSources } from "./import-graph.js";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
const sourceRoot = path.join(apiRoot, "src");

describe("hexagonal architecture boundaries", () => {
  it("keeps the legacy inventory complete and unique", () => {
    const actual = listTypeScriptSources(sourceRoot).filter((file) => !file.startsWith("modules/") && !file.startsWith("shared/") && !file.startsWith("composition/"));
    const inventory = LEGACY_SOURCE_INVENTORY.map(({ path: file }) => file).sort();
    expect(new Set(inventory).size).toBe(inventory.length);
    expect(inventory).toEqual(actual);
  });

  it.each([
    ["modules/invites/domain/invite.ts", 'import "../application/create-invite.js";', "domain may not import application"],
    ["modules/invites/domain/invite.ts", 'import { z } from "zod";', "domain may not import zod"],
    ["modules/invites/application/create-invite.ts", 'import "../infrastructure/prisma/repository.js";', "application may not import infrastructure"],
    ["modules/invites/presentation/http/routes.ts", 'import "../../infrastructure/prisma/repository.js";', "presentation may not import infrastructure"],
    ["modules/invites/infrastructure/prisma/repository.ts", 'import "../../presentation/http/routes.js";', "infrastructure may not import presentation"],
    ["modules/members/application/list.ts", 'import "../../invites/application/redeem.js";', "cross-module imports must use the public index"],
    ["modules/invites/presentation/http/routes.ts", 'import { PrismaInviteRepository } from "../../infrastructure/prisma/repository.js"; new PrismaInviteRepository();', "concrete adapters may only be constructed in composition"],
  ])("rejects %s: %s", (file, source, expected) => {
    expect(analyseSourceText(file, source)).toContain(expected);
  });

  it("accepts the current tree through the shrinking legacy allow-list", () => {
    expect(checkSourceTree(sourceRoot, LEGACY_ALLOW_LIST)).toEqual([]);
  });

  /** The acceptance criterion for the migration: nothing outside the three
   * roots, and no compatibility adapter left behind. */
  it("leaves no source file outside modules, shared and composition", () => {
    const stragglers = listTypeScriptSources(sourceRoot).filter((file) =>
      !file.startsWith("modules/") && !file.startsWith("shared/") && !file.startsWith("composition/"));
    expect(stragglers).toEqual([]);
    expect(LEGACY_ALLOW_LIST.size).toBe(0);
  });

  it("keeps no legacy service, controller or route file anywhere", () => {
    const legacyShaped = listTypeScriptSources(sourceRoot).filter((file) =>
      /\.(service|controller|routes)\.ts$/.test(file));
    expect(legacyShaped).toEqual([]);
  });

  /** Stated as its own check rather than left to the import graph: these are
   * the couplings that make a use case impossible to test without a database,
   * an HTTP request or an environment. */
  it("keeps domain and application free of frameworks, persistence and process globals", () => {
    const inner = listTypeScriptSources(sourceRoot).filter((file) =>
      /^modules\/[^/]+\/(domain|application)\//.test(file));
    expect(inner.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of inner) {
      const source = readFileSync(path.join(sourceRoot, file), "utf8");
      for (const [label, pattern] of [
        ["express", /from\s+["']express["']/],
        ["zod", /from\s+["']zod["']/],
        ["@prisma/client", /from\s+["']@prisma\/client["']/],
        ["@aws-sdk", /from\s+["']@aws-sdk\//],
        ["a process global", /\bprocess\.(env|argv|exit)\b/],
      ] as const) {
        if (pattern.test(source)) offenders.push(`${file}: imports ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps no compatibility adapter left over from the migration", () => {
    const compatibility = listTypeScriptSources(sourceRoot).filter((file) =>
      /legacy|compat/i.test(file));
    expect(compatibility).toEqual([]);
  });
});
