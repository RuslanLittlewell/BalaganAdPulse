import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { BlockList } from "node:net";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { SafeFetcher } from "../../src/modules/seo/infrastructure/safe-fetcher.js";

let server: http.Server;
let origin: string;
const seen: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seen.push(String(req.headers["user-agent"]));
    if (req.url === "/page") return res.end("<title>Окна</title>");
    if (req.url === "/moved") return res.writeHead(301, { Location: "/page" }).end();
    if (req.url === "/away") return res.writeHead(302, { Location: "https://other.example/x" }).end();
    if (req.url?.startsWith("/loop")) return res.writeHead(302, { Location: `/loop${Number(req.url.slice(5) || 0) + 1}` }).end();
    if (req.url === "/big") return res.end("x".repeat(5000));
    if (req.url === "/zipped") return res.writeHead(200, { "Content-Encoding": "gzip", "Content-Type": "text/html" }).end(gzipSync("<h1>сжато</h1>"));
    if (req.url === "/slow") return;
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "::1", resolve));
  origin = `http://[::1]:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const open = new BlockList();
const local = (options: { timeoutMs?: number } = {}) => new SafeFetcher("AdPulseBot/1.0", { reserved: open, ...options });
const anywhere = () => true;
const onLocal = (address: string) => address.startsWith(origin);

describe("fetching a page safely", () => {
  it("reads a page and names itself", async () => {
    const outcome = await local().fetch(`${origin}/page`, anywhere);
    expect(outcome).toMatchObject({ kind: "response", status: 200, finalUrl: `${origin}/page` });
    expect(outcome.kind === "response" && outcome.body.toString()).toBe("<title>Окна</title>");
    expect(seen.at(-1)).toBe("AdPulseBot/1.0");
  });

  it("follows a redirect on the site", async () => {
    expect(await local().fetch(`${origin}/moved`, onLocal)).toMatchObject({ kind: "response", status: 200, finalUrl: `${origin}/page` });
  });

  it("does not follow a redirect off the site and says where it went", async () => {
    expect(await local().fetch(`${origin}/away`, onLocal)).toMatchObject({ kind: "off-site", status: 302, location: "https://other.example/x" });
  });

  it("gives up after five redirects", async () => {
    expect(await local().fetch(`${origin}/loop`, onLocal)).toMatchObject({ kind: "unreachable", reason: "TOO_MANY_REDIRECTS" });
  });

  it("reads no more than it was allowed", async () => {
    const outcome = await local().fetch(`${origin}/big`, anywhere, { maxBytes: 1000 });
    expect(outcome.kind === "response" && outcome.body.length).toBe(1000);
  });

  it("unpacks a compressed page", async () => {
    const outcome = await local().fetch(`${origin}/zipped`, anywhere);
    expect(outcome.kind === "response" && outcome.body.toString()).toBe("<h1>сжато</h1>");
  });

  it("stops waiting for a page that does not answer", async () => {
    expect(await local({ timeoutMs: 300 }).fetch(`${origin}/slow`, anywhere)).toMatchObject({ kind: "unreachable", reason: "TIMEOUT" });
  });
});

describe("refusing addresses inside the network", () => {
  it("refuses a loopback address written in the URL", async () => {
    expect(await new SafeFetcher("AdPulseBot/1.0").fetch(`${origin}/page`, anywhere)).toMatchObject({ kind: "unreachable", reason: "REFUSED_ADDRESS" });
  });

  it("refuses a host that resolves to a private address", async () => {
    const fetcher = new SafeFetcher("AdPulseBot/1.0", { resolve: async () => [{ address: "10.0.0.5", family: 4 }] });
    expect(await fetcher.fetch("http://intranet.site.ru/", anywhere)).toMatchObject({ kind: "unreachable", reason: "REFUSED_ADDRESS" });
  });

  it("refuses a redirect to a private address", async () => {
    const fetcher = new SafeFetcher("AdPulseBot/1.0", {
      reserved: (() => { const list = new BlockList(); list.addSubnet("169.254.0.0", 16, "ipv4"); return list; })(),
    });
    const target = http.createServer((_req, res) => res.writeHead(302, { Location: "http://169.254.169.254/latest" }).end());
    await new Promise<void>((resolve) => target.listen(0, "::1", resolve));
    const address = `http://[::1]:${(target.address() as AddressInfo).port}/`;

    expect(await fetcher.fetch(address, anywhere)).toMatchObject({ kind: "unreachable", reason: "REFUSED_ADDRESS" });
    target.close();
  });

  it("knows the reserved ranges", () => {
    const fetcher = new SafeFetcher("AdPulseBot/1.0");
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(fetcher.isReserved(address)).toBe(true);
    }
    for (const address of ["93.184.216.34", "2a00:1450:4001:80b::200e", "::ffff:93.184.216.34"]) {
      expect(fetcher.isReserved(address)).toBe(false);
    }
  });

  it("refuses a resolver answer that mixes public and private addresses", async () => {
    const fetcher = new SafeFetcher("AdPulseBot/1.0", { resolve: async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }] });
    expect(await fetcher.fetch("http://mixed.site.ru/", anywhere)).toMatchObject({ kind: "unreachable", reason: "REFUSED_ADDRESS" });
  });
});
