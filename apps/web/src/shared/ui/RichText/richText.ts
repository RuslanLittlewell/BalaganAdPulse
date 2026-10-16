export const RICH_TEXT_CLASS = [
  "p-3 text-sm outline-none",
  "[&_a]:cursor-pointer",
  "[&_p]:my-1",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm",
  "[&_pre>code]:bg-transparent [&_pre>code]:p-0",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold",
  "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_hr]:my-4 [&_hr]:border-border",
].join(" ");

export interface LinkClick {
  readonly target: EventTarget | null;
  readonly button: number;
  preventDefault(): void;
}

export function followLink(event: LinkClick): boolean {
  if (event.button !== 0) return false;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  event.preventDefault();
  window.open(anchor.href, "_blank", "noopener,noreferrer");
  return true;
}
