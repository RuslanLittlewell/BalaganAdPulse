import path from "node:path";
import express, { type RequestHandler } from "express";

export function landingFor(host: string, root: string): RequestHandler {
  const files = express.static(root, { extensions: ["html"] });
  const missing = path.join(root, "404.html");
  const name = host.toLowerCase();
  return (req, res, next) => {
    if (req.hostname.toLowerCase() !== name) return next();
    files(req, res, () => res.status(404).sendFile(missing));
  };
}
