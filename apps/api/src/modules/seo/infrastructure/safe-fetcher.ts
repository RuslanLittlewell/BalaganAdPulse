import dns from "node:dns";
import http, { type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import type { FetchOutcome, PageFetcher } from "../application/ports.js";
import https from "node:https";
import net, { BlockList } from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

export const MAX_REDIRECTS = 5;
export const PAGE_TIMEOUT_MS = 15_000;
export const PAGE_MAX_BYTES = 2_000_000;

type Resolve = (hostname: string) => Promise<{ address: string; family: number }[]>;

const systemResolve: Resolve = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

const RESERVED_V4: readonly [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const RESERVED_V6: readonly [string, number][] = [
  ["::", 127], ["64:ff9b::", 96], ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
];

export function reservedAddresses(): BlockList {
  const list = new BlockList();
  for (const [address, prefix] of RESERVED_V4) list.addSubnet(address, prefix, "ipv4");
  for (const [address, prefix] of RESERVED_V6) list.addSubnet(address, prefix, "ipv6");
  return list;
}

class RefusedAddress extends Error {}
class TimedOut extends Error {}

function bare(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

interface RawResponse {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

export class SafeFetcher implements PageFetcher {
  private readonly reserved: BlockList;
  private readonly resolve: Resolve;
  private readonly timeoutMs: number;

  constructor(
    private readonly userAgent: string,
    options: { reserved?: BlockList; resolve?: Resolve; timeoutMs?: number } = {},
  ) {
    this.reserved = options.reserved ?? reservedAddresses();
    this.resolve = options.resolve ?? systemResolve;
    this.timeoutMs = options.timeoutMs ?? PAGE_TIMEOUT_MS;
  }

  isReserved(address: string): boolean {
    const mapped = address.toLowerCase().startsWith("::ffff:") ? address.slice(7) : null;
    if (mapped && net.isIPv4(mapped)) return this.reserved.check(mapped, "ipv4");
    const family = net.isIP(address);
    if (family === 0) return true;
    return this.reserved.check(address, family === 6 ? "ipv6" : "ipv4");
  }

  async fetch(address: string, isAllowed: (address: string) => boolean, options: { maxBytes?: number } = {}): Promise<FetchOutcome> {
    const started = Date.now();
    const elapsed = () => Date.now() - started;
    let current = address;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!URL.canParse(current)) return { kind: "unreachable", reason: "BAD_ADDRESS", ms: elapsed() };
      const url = new URL(current);
      if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "unreachable", reason: "BAD_ADDRESS", ms: elapsed() };
      const host = bare(url.hostname);
      if (net.isIP(host) && this.isReserved(host)) return { kind: "unreachable", reason: "REFUSED_ADDRESS", ms: elapsed() };
      let response: RawResponse;
      try {
        response = await this.request(url, this.timeoutMs - elapsed(), options.maxBytes ?? PAGE_MAX_BYTES);
      } catch (error) {
        const reason = error instanceof RefusedAddress ? "REFUSED_ADDRESS" : error instanceof TimedOut ? "TIMEOUT" : "NETWORK";
        return { kind: "unreachable", reason, ms: elapsed() };
      }
      const location = response.headers.location;
      if (response.status >= 300 && response.status < 400 && location && URL.canParse(location, url)) {
        const next = new URL(location, url).toString();
        if (!isAllowed(next)) return { kind: "off-site", status: response.status, location: next, ms: elapsed() };
        current = next;
        continue;
      }
      const type = response.headers["content-type"];
      return {
        kind: "response",
        status: response.status,
        finalUrl: url.toString(),
        contentType: typeof type === "string" ? type : null,
        headers: response.headers,
        body: response.body,
        ms: elapsed(),
      };
    }
    return { kind: "unreachable", reason: "TOO_MANY_REDIRECTS", ms: elapsed() };
  }

  private lookup = (
    hostname: string,
    options: dns.LookupOptions | number,
    callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
  ) => {
    const all = typeof options === "object" && options.all === true;
    this.resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0) return callback(Object.assign(new Error(`not found: ${hostname}`), { code: "ENOTFOUND" }), "");
        if (addresses.some((entry) => this.isReserved(entry.address))) return callback(new RefusedAddress(hostname), "");
        if (all) return callback(null, addresses);
        callback(null, addresses[0]!.address, addresses[0]!.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, ""),
    );
  };

  private request(url: URL, remainingMs: number, maxBytes: number): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      if (remainingMs <= 0) return reject(new TimedOut());
      const client = url.protocol === "https:" ? https : http;
      const request = client.request(url, {
        method: "GET",
        agent: false,
        lookup: this.lookup as never,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }, (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          clearTimeout(timer);
          return resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
        }
        this.readBody(response, maxBytes).then(
          (body) => {
            clearTimeout(timer);
            resolve({ status, headers: response.headers, body });
          },
          (error: unknown) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
      const timer = setTimeout(() => request.destroy(new TimedOut()), remainingMs);
      request.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      request.end();
    });
  }

  private readBody(response: IncomingMessage, maxBytes: number): Promise<Buffer> {
    const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
    const decoded: Readable = encoding === "gzip" || encoding === "x-gzip"
      ? response.pipe(zlib.createGunzip())
      : encoding === "br"
        ? response.pipe(zlib.createBrotliDecompress())
        : encoding === "deflate"
          ? response.pipe(zlib.createInflate())
          : response;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(Buffer.concat(chunks).subarray(0, maxBytes));
      };
      decoded.on("data", (chunk: Buffer) => {
        if (done) return;
        chunks.push(chunk);
        size += chunk.length;
        if (size >= maxBytes) {
          finish();
          response.destroy();
        }
      });
      decoded.on("end", finish);
      decoded.on("error", (error) => {
        if (done) return;
        done = true;
        reject(error);
      });
      response.on("aborted", finish);
    });
  }
}
