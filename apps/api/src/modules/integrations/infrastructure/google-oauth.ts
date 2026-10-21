import { z } from "zod";
import { ProviderError } from "../domain/integration.js";
import { exchange } from "./google-http.js";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/adwords";

export interface GoogleOAuthSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const tokens = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional() });
const failure = z.object({ error: z.string().optional() });

export class GoogleOAuth {
  constructor(
    private readonly settings: GoogleOAuthSettings,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  authorizeUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.settings.clientId,
      redirect_uri: this.settings.redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state,
    }).toString();
    return url.toString();
  }

  async redeem(code: string, signal?: AbortSignal): Promise<string> {
    const granted = await this.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.settings.redirectUri,
    }, signal);
    if (!granted.refresh_token) throw new ProviderError("INVALID_DATA", 0, "no refresh token granted", "Google");
    return granted.refresh_token;
  }

  async accessToken(refreshToken: string, signal?: AbortSignal): Promise<string> {
    const granted = await this.token({ grant_type: "refresh_token", refresh_token: refreshToken }, signal);
    return granted.access_token;
  }

  private async token(form: Record<string, string>, signal?: AbortSignal) {
    const response = await exchange(this.fetcher, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...form, client_id: this.settings.clientId, client_secret: this.settings.clientSecret }).toString(),
    }, this.timeoutMs, signal);
    if (response.ok) {
      const parsed = tokens.safeParse(response.body);
      if (!parsed.success) throw new ProviderError("INVALID_DATA", 0, "", "Google");
      return parsed.data;
    }
    const reason = failure.safeParse(response.body).data?.error ?? "none";
    const detail = `http ${response.status}, error ${reason}`;
    if (reason === "invalid_grant") throw new ProviderError("TOKEN", 0, detail, "Google");
    if (reason === "invalid_client" || reason === "unauthorized_client") throw new ProviderError("CONFIGURATION", 0, detail, "Google");
    if (response.status === 429 || response.status >= 500) throw new ProviderError("PROVIDER", response.retryAfterMs, detail, "Google");
    throw new ProviderError("INVALID_DATA", 0, detail, "Google");
  }
}
