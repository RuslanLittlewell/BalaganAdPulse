export interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export interface TelegramBotConfig {
  botToken: string;
  groqApiKey: string;
  groqBaseUrl: string;
  transcriptionModel: string;
  taskModel: string;
}

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
}

export interface Config {
  jwtSecret: string;
  documentation: boolean;
  production: boolean;
  appUrl: string | null;
  mail: MailConfig | null;
  taskTimeZone: string;
  telegramBot: TelegramBotConfig | null;
  googleAds: GoogleAdsConfig | null;
  storage: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
}

const PLACEHOLDER_JWT_SECRET = "dev-secret-change-me";

const MIN_JWT_SECRET_LENGTH = 32;

const DEVELOPMENT_APP_URL = "http://localhost:5173";

const DEFAULT_TASK_TIME_ZONE = "Europe/Minsk";

function taskTimeZone(env: NodeJS.ProcessEnv): string {
  const zone = env.TASK_TIME_ZONE?.trim() || DEFAULT_TASK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    throw new Error(`TASK_TIME_ZONE must be an IANA time zone, such as ${DEFAULT_TASK_TIME_ZONE}`);
  }
  return zone;
}

const DEFAULT_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";

const DEFAULT_TASK_MODEL = "openai/gpt-oss-20b";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function groqBaseUrl(env: NodeJS.ProcessEnv): string {
  const given = env.GROQ_BASE_URL?.trim().replace(/\/+$/, "");
  if (!given) return DEFAULT_GROQ_BASE_URL;
  let url: URL;
  try {
    url = new URL(given);
  } catch {
    throw new Error("GROQ_BASE_URL must be a URL, such as https://relay.example.com/openai/v1");
  }
  if (url.protocol !== "https:") {
    throw new Error("GROQ_BASE_URL must use https, since the Groq API key travels with every request");
  }
  return given;
}

function telegramBotConfig(env: NodeJS.ProcessEnv): TelegramBotConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const groqApiKey = env.GROQ_API_KEY?.trim();
  if (!botToken || !groqApiKey) return null;
  return {
    botToken,
    groqApiKey,
    groqBaseUrl: groqBaseUrl(env),
    transcriptionModel: env.GROQ_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL,
    taskModel: env.GROQ_TASK_MODEL?.trim() || DEFAULT_TASK_MODEL,
  };
}

const DEFAULT_GOOGLE_ADS_API_VERSION = "v24";

function googleAdsConfig(env: NodeJS.ProcessEnv, appUrl: string | null): GoogleAdsConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || (appUrl ? `${appUrl}/api/integrations/google/callback` : "");
  if (!clientId || !clientSecret || !redirectUri) return null;
  const apiVersion = env.GOOGLE_ADS_API_VERSION?.trim() || DEFAULT_GOOGLE_ADS_API_VERSION;
  if (!/^v\d{1,3}$/.test(apiVersion)) throw new Error("GOOGLE_ADS_API_VERSION must look like v24");
  return { clientId, clientSecret, redirectUri, apiVersion };
}

function mailConfig(env: NodeJS.ProcessEnv): MailConfig | null {
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD?.trim();
  if (!user || !password) return null;
  const port = Number(env.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port <= 0) throw new Error("SMTP_PORT must be a port number");
  return {
    host: env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    user,
    password,
    from: env.MAIL_FROM?.trim() || `Balagan BI <${user}>`,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is required but not set");

  const production = env.NODE_ENV === "production";
  if (production) {
    if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
      throw new Error(
        "JWT_SECRET still holds the placeholder from .env.example; set a real secret before deploying",
      );
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
    }
  }

  const appUrl = env.APP_URL?.trim().replace(/\/+$/, "") || (production ? null : DEVELOPMENT_APP_URL);

  return {
    jwtSecret,
    documentation: env.API_DOCS !== "off",
    production,
    appUrl,
    mail: mailConfig(env),
    taskTimeZone: taskTimeZone(env),
    telegramBot: telegramBotConfig(env),
    googleAds: googleAdsConfig(env, appUrl),
    storage: {
      endpoint: env.S3_ENDPOINT ?? "http://localhost:9000",
      region: env.S3_REGION ?? "us-east-1",
      accessKey: env.S3_ACCESS_KEY ?? "adpulse",
      secretKey: env.S3_SECRET_KEY ?? "adpulse-local-secret",
      bucket: env.S3_BUCKET ?? "adpulse-avatars",
    },
  };
}

export const config = loadConfig();
