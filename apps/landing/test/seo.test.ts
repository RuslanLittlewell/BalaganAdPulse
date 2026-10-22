import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = (path: string) => readFileSync(new URL(`../dist/${path}`, import.meta.url), "utf8");

describe("search and sharing metadata", () => {
  it.each([["index.html", "/"], ["privacy/index.html", "/privacy/"]])("publishes coherent metadata for %s", (file, path) => {
    const html = page(file);
    const canonical = `https://bi.balagan.pro${path}`;
    expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
    expect(html).toContain(`<meta property="og:url" content="${canonical}"`);
    expect(html).toContain('name="robots" content="index, follow, max-image-preview:large"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:image" content="https://bi.balagan.pro/social-preview.png"');
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"];
    expect(graph.find((node: any) => node["@type"] === "WebPage").url).toBe(canonical);
    expect(graph.find((node: any) => node["@type"] === "Organization").url).toBe("https://balagan.pro");
    if (path === "/") {
      const software = graph.find((node: any) => node["@type"] === "WebApplication");
      expect(software.url).toBe("https://app.balagan.pro");
      expect(software).not.toHaveProperty("offers");
      expect(software).not.toHaveProperty("aggregateRating");
    }
  });

  it("excludes 404 pages from indexing and structured data", () => {
    const html = page("404.html");
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('type="application/ld+json"');
  });

  it("lists only indexable canonical pages in its discoverable sitemap", () => {
    expect(page("robots.txt")).toContain("Sitemap: https://bi.balagan.pro/sitemap.xml");
    const urls = [...page("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(urls).toEqual(["https://bi.balagan.pro/", "https://bi.balagan.pro/privacy/"]);
  });

  it("ships the advertised 1200 × 630 PNG sharing image", () => {
    const png = readFileSync(new URL("../dist/social-preview.png", import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
