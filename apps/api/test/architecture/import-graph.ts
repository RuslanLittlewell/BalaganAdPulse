import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const layers = ["domain", "application", "infrastructure", "presentation"] as const;
type Layer = (typeof layers)[number];

const forbiddenPackages: Partial<Record<Layer, readonly RegExp[]>> = {
  domain: [/^express(?:\/|$)/, /^zod$/, /^@prisma\/client$/, /^@aws-sdk\//],
  application: [/^express(?:\/|$)/, /^zod$/, /^@prisma\/client$/, /^@aws-sdk\//],
  presentation: [/^@prisma\/client$/, /^@aws-sdk\//],
};

function moduleLocation(file: string) {
  const parts = file.split("/");
  if (parts[0] !== "modules" || parts.length < 3) return undefined;
  const layer = layers.includes(parts[2] as Layer) ? (parts[2] as Layer) : undefined;
  return { module: parts[1], layer };
}

function importsFrom(source: string): string[] {
  const imports: string[] = [];
  const pattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
}

function resolveRelative(file: string, specifier: string): string {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  return resolved.replace(/\.js$/, ".ts");
}

export function analyseSourceText(file: string, source: string): string[] {
  const errors: string[] = [];
  const location = moduleLocation(file);

  for (const specifier of importsFrom(source)) {
    if (/^(\.\.\/)+shared\//.test(specifier)) {
      errors.push("the shared kernel is reached through #shared/, never relatively");
    }
  }
  if (!location?.layer && !file.startsWith("composition/")) return errors;

  for (const specifier of importsFrom(source)) {
    if (location?.layer && forbiddenPackages[location.layer]?.some((rule) => rule.test(specifier))) {
      errors.push(`${location.layer} may not import ${specifier}`);
    }
    if (!specifier.startsWith(".")) continue;
    const target = resolveRelative(file, specifier);
    const targetLocation = moduleLocation(target);
    if (!location || !targetLocation) continue;

    if (location.module !== targetLocation.module && target !== `modules/${targetLocation.module}/index.ts`) {
      errors.push("cross-module imports must use the public index");
    }
    const forbiddenLayers: Partial<Record<Layer, readonly Layer[]>> = {
      domain: ["application", "infrastructure", "presentation"],
      application: ["infrastructure", "presentation"],
      infrastructure: ["presentation"],
      presentation: ["infrastructure"],
    };
    if (targetLocation.layer && forbiddenLayers[location.layer]?.includes(targetLocation.layer)) {
      errors.push(`${location.layer} may not import ${targetLocation.layer}`);
    }
  }

  if (!file.startsWith("composition/") && /\bnew\s+[A-Z]\w*(?:Adapter|Repository|Client)\s*\(/.test(source)) {
    errors.push("concrete adapters may only be constructed in composition");
  }
  return errors;
}

export function listTypeScriptSources(root: string): string[] {
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const absolute = path.join(directory, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (entry.endsWith(".ts")) result.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  };
  visit(root);
  return result.sort();
}

export function checkSourceTree(root: string, legacyAllowList: ReadonlySet<string>): string[] {
  return listTypeScriptSources(root).flatMap((file) => {
    if (legacyAllowList.has(file) || file.endsWith(".d.ts")) return [];
    const source = readFileSync(path.join(root, file), "utf8");
    return analyseSourceText(file, source).map((error) => `${file}: ${error}`);
  });
}
