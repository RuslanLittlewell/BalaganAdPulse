export function collectImageIds(description: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "taskImage") {
      const attrs = record.attrs;
      if (attrs && typeof attrs === "object") {
        const id = (attrs as Record<string, unknown>).imageId;
        if (typeof id === "string" && id.length > 0) found.add(id);
      }
    }
    for (const value of Object.values(record)) walk(value);
  };
  walk(description);
  return [...found];
}

export function removeImage(description: unknown, imageId: string): unknown {
  if (!collectImageIds(description).includes(imageId)) return description;

  const references = (node: unknown): boolean => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return false;
    const record = node as Record<string, unknown>;
    if (record.type !== "taskImage") return false;
    const attrs = record.attrs;
    return Boolean(
      attrs && typeof attrs === "object"
      && (attrs as Record<string, unknown>).imageId === imageId,
    );
  };

  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.filter((child) => !references(child)).map(strip);
    if (node === null || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [key, strip(value)]),
    );
  };

  return strip(description);
}
