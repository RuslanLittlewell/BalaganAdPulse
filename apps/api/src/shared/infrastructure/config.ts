export interface Config {
  jwtSecret: string;
  documentation: boolean;
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is required but not set");

  if (env.NODE_ENV === "production") {
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
