import { Parser } from "htmlparser2";
import type { FetchOutcome, PageParser, SitemapParser } from "../application/ports.js";
import type { JsonLdBlock, PageFacts } from "../domain/page-audit.js";
import { gunzipSync } from "node:zlib";

const TEXT_LIMIT = 2000;
const H1_LIMIT = 20;
const JSON_LD_LIMIT = 10;
const JSON_LD_SOURCE_LIMIT = 20_000;
const SITEMAP_ENTRIES = 50_000;

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, limit = TEXT_LIMIT) => text.slice(0, limit);

function charsetOf(contentType: string | null, head: string): string {
  const declared = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "")?.[1]
    ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  return declared?.toLowerCase() ?? "utf-8";
}

function decode(body: Buffer, contentType: string | null): string {
  const charset = charsetOf(contentType, body.subarray(0, 4096).toString("latin1"));
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

function isHtml(contentType: string | null, body: Buffer): boolean {
  if (contentType) return /text\/html|application\/xhtml\+xml/i.test(contentType);
  return /^\s*</.test(body.subarray(0, 256).toString("latin1"));
}

function directives(value: string): string[] {
  return value.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function headerDirectives(header: string | string[] | undefined): string[] {
  const values = Array.isArray(header) ? header : header ? [header] : [];
  return values.flatMap((value) => {
    const named = /^\s*([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(value);
    if (named && !["noindex", "nofollow", "none", "unavailable_after"].includes(named[1]!.toLowerCase())) {
      return named[1]!.toLowerCase() === "googlebot" ? directives(named[2]!) : [];
    }
    return directives(value);
  });
}

function typesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(typesOf);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own = record["@type"];
  const declared = typeof own === "string" ? [own] : Array.isArray(own) ? own.filter((item): item is string => typeof item === "string") : [];
  return [...declared, ...typesOf(record["@graph"])];
}

export function jsonLdBlock(source: string): JsonLdBlock {
  const trimmed = source.trim();
  try {
    return { source: clip(trimmed, JSON_LD_SOURCE_LIMIT), types: [...new Set(typesOf(JSON.parse(trimmed)))], error: null };
  } catch (error) {
    return { source: clip(trimmed, JSON_LD_SOURCE_LIMIT), types: [], error: error instanceof Error ? clip(error.message, 300) : "parse error" };
  }
}

export function readHtml(html: string, robotsHeader?: string | string[]): PageFacts {
  let lang: string | null = null;
  let title: string | null = null;
  let description: string | null = null;
  let keywords: string | null = null;
  let canonical: string | null = null;
  const robots: string[] = [...headerDirectives(robotsHeader)];
  const h1: string[] = [];
  const openGraph: Record<string, string> = {};
  const jsonLd: JsonLdBlock[] = [];
  let svgDepth = 0;
  let titleText: string | null = null;
  let h1Depth = 0;
  let h1Text = "";
  let scriptText: string | null = null;

  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "svg") svgDepth++;
      if (name === "html" && attributes.lang) lang = clip(attributes.lang.trim(), 35) || null;
      if (name === "title" && svgDepth === 0 && title === null) titleText = "";
      if (name === "h1") {
        if (h1Depth === 0) h1Text = "";
        h1Depth++;
      }
      if (name === "script" && (attributes.type ?? "").trim().toLowerCase() === "application/ld+json") scriptText = "";
      if (name === "meta") {
        const key = (attributes.name ?? attributes.property ?? "").trim().toLowerCase();
        const content = collapse(attributes.content ?? "");
        if (key === "description" && description === null) description = clip(content) || null;
        if (key === "keywords" && keywords === null) keywords = clip(content) || null;
        if (key === "robots" || key === "googlebot") robots.push(...directives(content));
        const property = (attributes.property ?? attributes.name ?? "").trim().toLowerCase();
        if (property.startsWith("og:") && !(property in openGraph) && content) openGraph[property] = clip(content, 1000);
      }
      if (name === "link" && canonical === null) {
        const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
        if (rel.includes("canonical") && attributes.href) canonical = clip(attributes.href.trim(), TEXT_LIMIT);
      }
    },
    ontext(text) {
      if (titleText !== null) titleText += text;
      if (h1Depth > 0) h1Text += text;
      if (scriptText !== null) scriptText += text;
    },
    onclosetag(name) {
      if (name === "svg" && svgDepth > 0) svgDepth--;
      if (name === "title" && titleText !== null) {
        title = clip(collapse(titleText)) || null;
        titleText = null;
      }
      if (name === "h1" && h1Depth > 0) {
        h1Depth--;
        if (h1Depth === 0 && h1.length < H1_LIMIT) h1.push(clip(collapse(h1Text), 500));
      }
      if (name === "script" && scriptText !== null) {
        if (jsonLd.length < JSON_LD_LIMIT) jsonLd.push(jsonLdBlock(scriptText));
        scriptText = null;
      }
    },
  }, { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true });
  parser.write(html);
  parser.end();
  return { lang, title, description, keywords, robots: [...new Set(robots)], canonical, h1, openGraph, jsonLd };
}

export class HtmlPageParser implements PageParser {
  facts(outcome: Extract<FetchOutcome, { kind: "response" }>): PageFacts | null {
    if (!isHtml(outcome.contentType, outcome.body)) return null;
    return readHtml(decode(outcome.body, outcome.contentType), outcome.headers["x-robots-tag"]);
  }
}

export class XmlSitemapParser implements SitemapParser {
  parse(body: Buffer): { sitemaps: string[]; pages: string[] } {
    const xml = (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body, { maxOutputLength: 50_000_000 }) : body).toString("utf8");
    const sitemaps: string[] = [];
    const pages: string[] = [];
    let parent: "url" | "sitemap" | null = null;
    let loc: string | null = null;
    const parser = new Parser({
      onopentag(name) {
        const local = name.toLowerCase().replace(/^.*:/, "");
        if (local === "url" || local === "sitemap") parent = local;
        if (local === "loc" && parent) loc = "";
      },
      ontext(text) {
        if (loc !== null) loc += text;
      },
      onclosetag(name) {
        const local = name.toLowerCase().replace(/^.*:/, "");
        if (local === "loc" && loc !== null && parent) {
          const address = loc.trim();
          if (address && sitemaps.length + pages.length < SITEMAP_ENTRIES) (parent === "sitemap" ? sitemaps : pages).push(address);
          loc = null;
        }
        if (local === "url" || local === "sitemap") parent = null;
      },
    }, { xmlMode: true, decodeEntities: true });
    parser.write(xml);
    parser.end();
    return { sitemaps, pages };
  }
}
