/**
 * The image ids a description references.
 *
 * The description is a ProseMirror document, and an image node carries the id
 * of the stored object rather than its bytes. Walking it is how saving a task
 * claims the uploads its text points at, and how deleting one knows which
 * objects to take with it.
 */
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
