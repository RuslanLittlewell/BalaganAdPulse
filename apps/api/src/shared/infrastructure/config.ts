export interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export interface Config {
  jwtSecret: string;
  documentation: boolean;
  production: boolean;
  appUrl: string | null;
  mail: MailConfig | null;
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

  return {
    jwtSecret,
    documentation: env.API_DOCS !== "off",
    production,
    appUrl: env.APP_URL?.trim().replace(/\/+$/, "") || (production ? null : DEVELOPMENT_APP_URL),
    mail: mailConfig(env),
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
