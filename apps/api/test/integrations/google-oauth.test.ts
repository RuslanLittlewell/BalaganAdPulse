import { expect, it, vi } from "vitest";
import { GoogleOAuth } from "../../src/modules/integrations/infrastructure/google-oauth.js";

const settings = { clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://app.test/api/integrations/google/callback" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

it("sends the member to Google asking for offline access to Google Ads with the state it was given", () => {
  const url = new URL(new GoogleOAuth(settings).authorizeUrl("state-1"));
  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    client_id: "client-id",
    redirect_uri: settings.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    state: "state-1",
  });
});

it("redeems a code for a refresh token with the client credentials in the form body", async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ access_token: "access", refresh_token: "refresh" }));
  const refresh = await new GoogleOAuth(settings, fetcher).redeem("the-code");

  expect(refresh).toBe("refresh");
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://oauth2.googleapis.com/token");
  expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
    grant_type: "authorization_code",
    code: "the-code",
    redirect_uri: settings.redirectUri,
    client_id: "client-id",
    client_secret: "client-secret",
  });
});

it("refuses a grant that carries no refresh token", async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ access_token: "access" }));
  await expect(new GoogleOAuth(settings, fetcher).redeem("code")).rejects.toMatchObject({ code: "INVALID_DATA" });
});

it("exchanges a refresh token for an access token", async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ access_token: "fresh" }));
  expect(await new GoogleOAuth(settings, fetcher).accessToken("refresh")).toBe("fresh");
  expect(Object.fromEntries(new URLSearchParams(fetcher.mock.calls[0][1].body))).toMatchObject({
    grant_type: "refresh_token",
    refresh_token: "refresh",
  });
});

it.each([
  [400, { error: "invalid_grant" }, "TOKEN"],
  [401, { error: "invalid_client" }, "CONFIGURATION"],
  [503, { error: "backend_error" }, "PROVIDER"],
  [400, { error: "invalid_request" }, "INVALID_DATA"],
])("classifies a %s answer of %j as %s", async (status, body, code) => {
  const fetcher = vi.fn().mockResolvedValue(json(body, status));
  await expect(new GoogleOAuth(settings, fetcher).accessToken("refresh")).rejects.toMatchObject({ code });
});

it("keeps the credentials out of the error it raises", async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ error: "invalid_grant", error_description: "refresh-secret" }, 400));
  const failure = await new GoogleOAuth(settings, fetcher).accessToken("refresh-secret").catch((error: Error) => error);
  expect(JSON.stringify({ message: (failure as Error).message, detail: (failure as { detail: string }).detail })).not.toContain("refresh-secret");
});
