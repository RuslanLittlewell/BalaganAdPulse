import net from "node:net";

export interface WebhookAddress {
  readonly base: string;
  readonly host: string;
}

const PATH = /^\/rest\/\d+\/[A-Za-z0-9]+\/?$/;

export function parseWebhookAddress(raw: string): WebhookAddress | null {
  const text = raw.trim();
  if (!URL.canParse(text)) return null;
  const url = new URL(text);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (net.isIP(host) !== 0 || !host.includes(".") || host === "localhost" || host.endsWith(".local")) return null;
  if (!PATH.test(url.pathname)) return null;
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return { base: `${url.origin}${path}`, host };
}
