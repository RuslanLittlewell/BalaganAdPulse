import type { Request, Response } from "express";

export const ACCESS_COOKIE = "adpulse_access";
export const REFRESH_COOKIE = "adpulse_refresh";
export const SESSION_COOKIE = "adpulse_session";

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function serialize(name: string, value: string, maxAge: number): string {
  const secure = baseOptions.secure ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function serializeSession(maxAge: number): string {
  const secure = baseOptions.secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.header("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken?: string }): void {
  const cookies = [serialize(ACCESS_COOKIE, tokens.accessToken, 15 * 60)];
  if (tokens.refreshToken) cookies.push(serialize(REFRESH_COOKIE, tokens.refreshToken, 30 * 24 * 60 * 60));
  if (tokens.refreshToken) cookies.push(serializeSession(30 * 24 * 60 * 60));
  res.append("Set-Cookie", cookies);
}

export function clearAuthCookies(res: Response): void {
  res.append("Set-Cookie", [serialize(ACCESS_COOKIE, "", 0), serialize(REFRESH_COOKIE, "", 0), serializeSession(0)]);
}
