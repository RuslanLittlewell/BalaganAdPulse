import { describe, expect, it } from "vitest";
import { createContainer } from "../../src/composition/create-container.js";
import { createRoutes, ROUTE_MOUNTS } from "../../src/composition/create-routes.js";
import { apiDocument } from "../../src/composition/openapi.js";
import { openApiPath } from "../../src/shared/presentation/openapi.js";

interface Layer {
  readonly handle?: { readonly stack?: readonly Layer[] };
  readonly route?: { readonly path: string; readonly methods: Record<string, boolean> };
}

const mountedOperations = (): string[] => {
  const stack = (createRoutes(createContainer()) as unknown as { stack: Layer[] }).stack;
  return stack.flatMap((layer, index) =>
    (layer.handle?.stack ?? []).flatMap((inner) =>
      inner.route
        ? Object.keys(inner.route.methods)
            .filter((method) => method !== "_all")
            .map((method) => `${method} ${openApiPath(ROUTE_MOUNTS[index].path, inner.route!.path)}`)
        : []));
};

const describedOperations = (): string[] => {
  const { paths } = apiDocument();
  return Object.entries(paths).flatMap(([path, methods]) =>
    Object.keys(methods).map((method) => `${method} ${path}`));
};

describe("the document and the routers", () => {
  it("describes every endpoint the API mounts, and no other", () => {
    const mounted = mountedOperations();
    expect(mounted.length).toBeGreaterThan(20);
    expect(describedOperations().sort()).toEqual([...mounted].sort());
  });

  it("finds each mounted endpoint exactly once", () => {
    const mounted = mountedOperations();
    expect(new Set(mounted).size).toBe(mounted.length);
  });
});
