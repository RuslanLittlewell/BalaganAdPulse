function encode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A token shaped like the real thing. The signature is a placeholder: the
 * browser never verifies it, and no test here talks to the real API. */
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

/** An access token that is already past its expiry. */
export function makeExpiredAccessToken(): string {
  return makeAccessToken({ exp: Math.floor(Date.now() / 1000) - 60 });
}
