import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve(import.meta.dirname, "../../src");
const rank: Record<string, number> = {
  shared: 0,
  entities: 1,
  features: 2,
  widgets: 3,
  pages: 4,
  app: 5,
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

describe("FSD boundaries", () => {
  it("keeps production imports directed toward lower layers", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
      const relative = path.relative(sourceRoot, file);
      const sourceLayer = relative.split(path.sep)[0];
      if (!(sourceLayer in rank)) continue;

      const imports = readFileSync(file, "utf8").matchAll(/from\s+["']@\/([^/]+)/g);
      for (const match of imports) {
        const targetLayer = match[1];
        if (targetLayer in rank && rank[targetLayer] > rank[sourceLayer]) {
          violations.push(`${relative} imports upward from ${targetLayer}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
