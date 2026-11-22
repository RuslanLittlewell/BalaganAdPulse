import dns from "node:dns";
import https from "node:https";
import net from "node:net";

type Resolve = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export interface PostResult {
  readonly status: number;
  readonly body: string;
}

export type Post = (url: URL, body: string, timeoutMs: number) => Promise<PostResult>;

export class RefusedAddressError extends Error {
  constructor(host: string) {
    super(`Refused to connect to ${host}`);
    this.name = "RefusedAddressError";
  }
}

const MAX_RESPONSE_BYTES = 5_000_000;
const systemResolve: Resolve = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

export function pinnedLookup(isReserved: (address: string) => boolean, resolve: Resolve = systemResolve) {
  return (
    hostname: string,
    options: dns.LookupOptions | number,
    callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
  ) => {
    const all = typeof options === "object" && options.all === true;
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0) return callback(Object.assign(new Error(`not found: ${hostname}`), { code: "ENOTFOUND" }), "");
        if (addresses.some((entry) => isReserved(entry.address))) return callback(new RefusedAddressError(hostname), "");
        if (all) return callback(null, addresses);
        callback(null, addresses[0]!.address, addresses[0]!.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, ""),
    );
  };
}

export function createPinnedPost(isReserved: (address: string) => boolean, resolve?: Resolve): Post {
  const lookup = pinnedLookup(isReserved, resolve);
  return (url, body, timeoutMs) => new Promise((resolvePost, reject) => {
    if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || net.isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0) {
      reject(new RefusedAddressError(url.host));
      return;
    }
    const request = https.request(url, {
      method: "POST",
      agent: false,
      lookup: lookup as never,
      timeout: timeoutMs,
      headers: { "content-type": "application/json", accept: "application/json", "content-length": Buffer.byteLength(body) },
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("The portal answered with too much data"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolvePost({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("The portal did not answer in time")));
    request.on("error", reject);
    request.end(body);
  });
}
