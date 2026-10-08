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

const ALIASES = { "#modules/": "modules/", "#shared/": "shared/" } as const;

function resolveSpecifier(file: string, specifier: string): string | undefined {
  const alias = Object.entries(ALIASES).find(([prefix]) => specifier.startsWith(prefix));
  const resolved = alias
    ? alias[1] + specifier.slice(alias[0].length)
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      : undefined;
  return resolved?.replace(/\.js$/, ".ts");
}

function areaOf(file: string): string {
  const parts = file.split("/");
  return parts[0] === "modules" ? parts.slice(0, 2).join("/") : parts[0];
}

export function analyseSourceText(file: string, source: string): string[] {
  const errors: string[] = [];
  const location = moduleLocation(file);

  for (const specifier of importsFrom(source)) {
    if (/^(\.\.\/)+shared\//.test(specifier)) {
      errors.push("the shared kernel is reached through #shared/, never relatively");
    }
    if (/^(\.\.\/){2,}/.test(specifier)) {
      errors.push("a relative import climbs at most one directory; reach further through #modules/ or #shared/");
    }
    const target = specifier.startsWith(".") ? resolveSpecifier(file, specifier) : undefined;
    if (target?.startsWith("modules/") && areaOf(target) !== areaOf(file)) {
      errors.push("another module is reached through #modules/, never relatively");
    }
  }
  if (!location?.layer && !file.startsWith("composition/")) return errors;

  for (const specifier of importsFrom(source)) {
    if (location?.layer && forbiddenPackages[location.layer]?.some((rule) => rule.test(specifier))) {
      errors.push(`${location.layer} may not import ${specifier}`);
    }
    const target = resolveSpecifier(file, specifier);
    if (!target) continue;
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

export function checkSourceTree(root: string): string[] {
  return listTypeScriptSources(root).flatMap((file) => {
    if (file.endsWith(".d.ts")) return [];
    const source = readFileSync(path.join(root, file), "utf8");
    return analyseSourceText(file, source).map((error) => `${file}: ${error}`);
  });
}
