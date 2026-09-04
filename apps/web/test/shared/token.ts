function encode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeAccessToken(
  overrides: Partial<{ sub: string; name: string; email: string; exp: number }> = {},
): string {
  const payload = {
    sub: "user-1",
    name: "Buyer",
    email: "buyer@acme.com",
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    ...overrides,
  };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

export function makeExpiredAccessToken(): string {
  return makeAccessToken({ exp: Math.floor(Date.now() / 1000) - 60 });
}
