/**
 * The image ids a description references.
 *
 * Mirrors the walk the API does when it claims a task's uploads, so the
 * attachments block can list what the description points at right now —
 * including a file pasted a moment ago, which is not attached to the task until
 * the task is saved.
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
