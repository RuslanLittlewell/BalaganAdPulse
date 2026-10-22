import path from "node:path";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import express, { type RequestHandler, type Response } from "express";

export function landingFor(host: string, root: string): RequestHandler {
  // Only trusted, built HTML enters this cache. Request paths never become
  // filesystem paths, and user input is never inserted into these documents.
  const pages = new Map<string, string>();
  const directories = new Set<string>();
  const collect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith(".html")) {
        const url = `/${path.relative(root, file).split(path.sep).join("/")}`;
        const html = readFileSync(file, "utf8");
        pages.set(url, html);
        if (entry.name === "index.html") {
          const directoryUrl = url.slice(0, -"index.html".length);
          pages.set(directoryUrl, html);
          if (directoryUrl !== "/") directories.add(directoryUrl.slice(0, -1));
        } else {
          pages.set(url.slice(0, -".html".length), html);
        }
      }
    }
  };
  collect(root);

  const documentPolicy = "frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'";
  const sendPage = (res: Response, html: string, status: number) => {
    const nonce = randomBytes(18).toString("base64");
    res.set({
      "Content-Security-Policy": [
        "default-src 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'nonce-${nonce}'`,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
        documentPolicy,
      ].join("; "),
      // Nonces must not be reused through a browser or shared response cache.
      "Cache-Control": "private, no-store",
    });
    if (status === 404) res.setHeader("X-Robots-Tag", "noindex");
    res.status(status).type("html").send(html.replace(/<(script|style)\b/g, `<$1 nonce="${nonce}"`));
  };
  const files = express.static(root, { index: false, extensions: false });
  const missing = pages.get("/404.html")!;
  const name = host.toLowerCase();
  return (req, res, next) => {
    if (req.hostname.toLowerCase() !== name) return next();
    res.removeHeader("X-Powered-By");
    res.set({
      "Content-Security-Policy": `default-src 'none'; base-uri 'none'; ${documentPolicy}`,
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (req.method === "GET" || req.method === "HEAD") {
      if (directories.has(req.path)) {
        res.redirect(301, `${req.path}/${req.url.slice(req.path.length)}`);
        return;
      }
      const html = pages.get(req.path);
      if (html) {
        sendPage(res, html, 200);
        return;
      }
    }
    files(req, res, () => sendPage(res, missing, 404));
  };
}
