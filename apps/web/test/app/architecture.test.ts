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

const COMMENT = /^\s*(\/\/|\/\*|\{\s*\/\*)/;
const DIRECTIVE = /^\s*\/\/\/\s*</;
const VENDORED = path.join("shared", "ui", "ui");

describe("source conventions", () => {
  const commented = (source: string) =>
    source.split("\n").filter((line) => COMMENT.test(line) && !DIRECTIVE.test(line)).length;

  it("keeps the sources free of comments", () => {
    const offenders = sourceFiles(sourceRoot)
      .map((file) => path.relative(sourceRoot, file))
      .filter((file) => !file.startsWith(VENDORED))
      .filter((file) => commented(readFileSync(path.join(sourceRoot, file), "utf8")) > 0);
    expect(offenders).toEqual([]);
  });

  it("catches a comment wherever one is written", () => {
    expect(commented("const a = 1;\n// why\n")).toBe(1);
    expect(commented("  {/* why */}\n")).toBe(1);
    expect(commented('/// <reference types="vitest" />\n')).toBe(0);
  });
});
