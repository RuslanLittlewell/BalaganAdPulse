import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "../../src/modules/seo/domain/robots.js";
import { choosePages, findProblems, type CheckedPage, type PageFacts } from "../../src/modules/seo/domain/page-audit.js";
import { isOnSite, siteLabel } from "../../src/modules/seo/domain/seo-site.js";
import { HtmlPageParser, readHtml, XmlSitemapParser } from "../../src/modules/seo/infrastructure/page-reader.js";
import { gzipSync } from "node:zlib";

describe("robots.txt", () => {
  const rules = parseRobots([
    "User-agent: *",
    "Disallow: /private/",
    "Allow: /private/open",
    "Disallow: /*.pdf$",
    "",
    "User-agent: Googlebot",
    "Disallow: /",
    "Sitemap: https://site.ru/sitemap.xml",
  ].join("\n"));

  it("follows the rules for all agents when none name the checker", () => {
    expect(isAllowed(rules, "https://site.ru/private/report")).toBe(false);
    expect(isAllowed(rules, "https://site.ru/catalog")).toBe(true);
  });

  it("lets the longest rule win, and allow win a tie", () => {
    expect(isAllowed(rules, "https://site.ru/private/open/page")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a"), "https://site.ru/a")).toBe(true);
  });

  it("understands wildcards and the end anchor", () => {
    expect(isAllowed(rules, "https://site.ru/files/price.pdf")).toBe(false);
    expect(isAllowed(rules, "https://site.ru/files/price.pdf?v=2")).toBe(true);
  });

  it("uses the checker's own group when there is one", () => {
    const own = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: AdPulseBot\nAllow: /");
    expect(isAllowed(own, "https://site.ru/page")).toBe(true);
  });

  it("collects the sitemaps it names", () => {
    expect(rules.sitemaps).toEqual(["https://site.ru/sitemap.xml"]);
  });

  it("treats an empty disallow as allowing everything", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "https://site.ru/any")).toBe(true);
  });
});

describe("a site's addresses", () => {
  it("belong to a domain property on the domain and its subdomains only", () => {
    expect(isOnSite("sc-domain:site.ru", "https://www.site.ru/a")).toBe(true);
    expect(isOnSite("sc-domain:site.ru", "http://site.ru/")).toBe(true);
    expect(isOnSite("sc-domain:site.ru", "https://notsite.ru/")).toBe(false);
    expect(isOnSite("sc-domain:site.ru", "ftp://site.ru/")).toBe(false);
  });

  it("belong to a prefix property under its scheme, host and path", () => {
    expect(isOnSite("https://shop.ru/blog/", "https://shop.ru/blog/post")).toBe(true);
    expect(isOnSite("https://shop.ru/blog/", "https://shop.ru/cart")).toBe(false);
    expect(isOnSite("https://shop.ru/", "http://shop.ru/")).toBe(false);
  });

  it("are labelled without the property's decoration", () => {
    expect(siteLabel("sc-domain:site.ru")).toBe("site.ru");
    expect(siteLabel("https://shop.ru/")).toBe("shop.ru");
    expect(siteLabel("https://shop.ru/blog/")).toBe("shop.ru/blog");
  });
});

describe("choosing pages to check", () => {
  const onSite = (address: string) => isOnSite("https://site.ru/", address);

  it("takes the home page, the pages with impressions and the sitemap pages once each", () => {
    const choice = choosePages({
      home: "https://site.ru/",
      byImpressions: ["https://site.ru/c"],
      sitemap: ["https://site.ru/a", "https://site.ru/b#top", "https://site.ru/c", "https://other.ru/x"],
      isOnSite: onSite,
    });

    expect(choice.pages.map((page) => page.url)).toEqual(["https://site.ru/", "https://site.ru/c", "https://site.ru/a", "https://site.ru/b"]);
    expect(choice.pages.find((page) => page.url === "https://site.ru/c")).toMatchObject({ inSitemap: true, hasImpressions: true });
    expect(choice.notChecked).toBe(0);
  });

  it("checks at most 500 pages, the pages with impressions first, and counts the rest", () => {
    const sitemap = Array.from({ length: 2000 }, (_, index) => `https://site.ru/p${index}`);
    const choice = choosePages({ home: "https://site.ru/", byImpressions: ["https://site.ru/p1999"], sitemap, isOnSite: onSite });

    expect(choice.pages).toHaveLength(500);
    expect(choice.pages[1]!.url).toBe("https://site.ru/p1999");
    expect(choice.notChecked).toBe(1501);
  });
});

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  lang: "ru", title: "Окна на заказ", description: "Пластиковые окна с установкой", keywords: null, robots: [],
  canonical: null, h1: ["Окна"], openGraph: {}, jsonLd: [], ...over,
});

const page = (url: string, over: Partial<CheckedPage> = {}): CheckedPage => ({
  url, inSitemap: true, hasImpressions: false, outcome: "FETCHED", status: 200, finalUrl: url,
  contentType: "text/html", responseMs: 120, facts: facts(), ...over,
});

describe("marking problems", () => {
  const problemsOf = (pages: CheckedPage[], url: string) => findProblems(pages).get(url);

  it("finds nothing wrong with a tidy page", () => {
    expect(problemsOf([page("https://site.ru/a")], "https://site.ru/a")).toEqual([]);
  });

  it.each([
    ["an error status", page("https://site.ru/a", { status: 404, facts: null }), ["HTTP_ERROR"]],
    ["an unreachable page", page("https://site.ru/a", { outcome: "UNREACHABLE", status: null, facts: null }), ["UNREACHABLE"]],
    ["a sitemap page closed by robots.txt", page("https://site.ru/a", { outcome: "BLOCKED", status: null, facts: null }), ["ROBOTS_BLOCKED"]],
    ["a sitemap page with noindex", page("https://site.ru/a", { facts: facts({ robots: ["noindex", "follow"] }) }), ["NOINDEX"]],
    ["no title", page("https://site.ru/a", { facts: facts({ title: null }) }), ["TITLE_MISSING"]],
    ["a long title", page("https://site.ru/a", { facts: facts({ title: "о".repeat(61) }) }), ["TITLE_LONG"]],
    ["no description", page("https://site.ru/a", { facts: facts({ description: null }) }), ["DESCRIPTION_MISSING"]],
    ["a long description", page("https://site.ru/a", { facts: facts({ description: "о".repeat(161) }) }), ["DESCRIPTION_LONG"]],
    ["no H1", page("https://site.ru/a", { facts: facts({ h1: [] }) }), ["H1_MISSING"]],
    ["two H1", page("https://site.ru/a", { facts: facts({ h1: ["Окна", "Двери"] }) }), ["H1_MULTIPLE"]],
    ["a canonical elsewhere", page("https://site.ru/a", { facts: facts({ canonical: "/b" }) }), ["CANONICAL_ELSEWHERE"]],
    ["a redirecting sitemap page", page("https://site.ru/a", { finalUrl: "https://site.ru/b" }), ["SITEMAP_REDIRECT"]],
    ["a sitemap page redirecting off the site", page("https://site.ru/a", { outcome: "OFF_SITE_REDIRECT", status: 301, finalUrl: "https://other.ru/", facts: null }), ["SITEMAP_REDIRECT"]],
    ["broken JSON-LD", page("https://site.ru/a", { facts: facts({ jsonLd: [{ source: "{", types: [], error: "Unexpected end" }] }) }), ["JSON_LD_INVALID"]],
    ["untyped JSON-LD", page("https://site.ru/a", { facts: facts({ jsonLd: [{ source: "{}", types: [], error: null }] }) }), ["JSON_LD_UNTYPED"]],
  ])("marks %s", (_name, checked, expected) => {
    expect(problemsOf([checked], checked.url)).toEqual(expected);
  });

  it("does not mark a blocked page that is not in a sitemap, nor a canonical to itself", () => {
    expect(problemsOf([page("https://site.ru/a", { inSitemap: false, outcome: "BLOCKED", status: null, facts: null })], "https://site.ru/a")).toEqual([]);
    expect(problemsOf([page("https://site.ru/a", { facts: facts({ canonical: "https://site.ru/a#top" }) })], "https://site.ru/a")).toEqual([]);
  });

  it("marks titles and descriptions repeated on two pages", () => {
    const pages = [page("https://site.ru/a"), page("https://site.ru/b")];
    expect(problemsOf(pages, "https://site.ru/a")).toEqual(["TITLE_DUPLICATE", "DESCRIPTION_DUPLICATE"]);
    expect(problemsOf(pages, "https://site.ru/b")).toEqual(["TITLE_DUPLICATE", "DESCRIPTION_DUPLICATE"]);
  });

  it("does not count a redirecting or noindex page as a repeat", () => {
    const pages = [
      page("https://site.ru/old", { inSitemap: false, finalUrl: "https://site.ru/new" }),
      page("https://site.ru/new"),
      page("https://site.ru/hidden", { inSitemap: false, facts: facts({ robots: ["noindex"] }) }),
    ];
    expect(problemsOf(pages, "https://site.ru/new")).toEqual([]);
  });
});

describe("reading a page", () => {
  it("collects its title, description, keywords, robots, canonical, H1, Open Graph and JSON-LD", () => {
    const read = readHtml(`<!doctype html><html lang="ru"><head>
      <title>  Окна
        на заказ </title>
      <meta name="description" content="Пластиковые окна &amp; двери">
      <meta name="keywords" content="окна, двери">
      <meta name="robots" content="index, follow">
      <link rel="alternate canonical" href="https://site.ru/okna">
      <meta property="og:title" content="Окна">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"BreadcrumbList"}]}</script>
      <script type="application/ld+json">{"@type": "Product",}</script>
      </head><body><svg><title>icon</title></svg><h1>Окна <b>ПВХ</b></h1><h1>Ещё</h1></body></html>`, "noarchive");

    expect(read).toMatchObject({
      lang: "ru",
      title: "Окна на заказ",
      description: "Пластиковые окна & двери",
      keywords: "окна, двери",
      robots: ["noarchive", "index", "follow"],
      canonical: "https://site.ru/okna",
      h1: ["Окна ПВХ", "Ещё"],
      openGraph: { "og:title": "Окна" },
    });
    expect(read.jsonLd[0]).toMatchObject({ types: ["Organization", "BreadcrumbList"], error: null });
    expect(read.jsonLd[1]!.types).toEqual([]);
    expect(read.jsonLd[1]!.error).toBeTruthy();
  });

  it("reads noindex sent in the X-Robots-Tag header for Google", () => {
    expect(readHtml("<html></html>", ["googlebot: noindex", "otherbot: nofollow"]).robots).toEqual(["noindex"]);
  });

  it("decodes a page in windows-1251", () => {
    const body = Buffer.from(new TextEncoder().encode("<title>"));
    const title = Buffer.from([0xce, 0xea, 0xed, 0xe0]);
    const outcome = {
      kind: "response" as const, status: 200, finalUrl: "https://site.ru/", contentType: "text/html; charset=windows-1251",
      headers: {}, body: Buffer.concat([body, title, Buffer.from("</title>")]), ms: 10,
    };
    expect(new HtmlPageParser().facts(outcome)?.title).toBe("Окна");
  });

  it("does not read a file that is not HTML", () => {
    const outcome = { kind: "response" as const, status: 200, finalUrl: "https://site.ru/a.pdf", contentType: "application/pdf", headers: {}, body: Buffer.from("%PDF"), ms: 10 };
    expect(new HtmlPageParser().facts(outcome)).toBeNull();
  });
});

describe("reading a sitemap", () => {
  it("lists the pages of a URL set and the sitemaps of an index, gzipped or not", () => {
    const set = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc> https://site.ru/a </loc></url><url><loc>https://site.ru/b?x=1&amp;y=2</loc></url></urlset>`;
    const index = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://site.ru/s1.xml.gz</loc></sitemap></sitemapindex>`;
    const parser = new XmlSitemapParser();

    expect(parser.parse(Buffer.from(set))).toEqual({ sitemaps: [], pages: ["https://site.ru/a", "https://site.ru/b?x=1&y=2"] });
    expect(parser.parse(gzipSync(Buffer.from(index)))).toEqual({ sitemaps: ["https://site.ru/s1.xml.gz"], pages: [] });
  });
});
