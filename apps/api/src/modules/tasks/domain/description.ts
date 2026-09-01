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

/**
 * The same description with every reference to one image taken out.
 *
 * Deleting an attachment has to reach the text as well as the row: a
 * description left pointing at an object that no longer exists shows a link
 * that can never open. Structural rather than positional — the node is dropped
 * wherever it sits, however deeply it is nested — so a quote or a list holding
 * the image is handled like any other place.
 *
 * Returns the original value untouched when nothing referenced the image, so a
 * caller can tell a real edit from a no-op by identity.
 */
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
