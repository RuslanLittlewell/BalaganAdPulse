import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "./config.js";

const storage = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.storage.accessKey,
    secretAccessKey: config.storage.secretKey,
  },
});

export interface StoredObject {
  readonly body: Uint8Array;
  readonly contentType: string | undefined;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await storage.send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "private, max-age=3600",
  }));
}

export async function getObject(key: string): Promise<StoredObject> {
  const object = await storage.send(new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  }));
  if (!object.Body) throw new Error(`Stored object ${key} has no body`);
  return { body: await object.Body.transformToByteArray(), contentType: object.ContentType };
}

export async function headObject(
  key: string,
): Promise<{ contentType: string | undefined; bytes: number } | null> {
  try {
    const object = await storage.send(new HeadObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    }));
    return { contentType: object.ContentType, bytes: object.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function removeObjects(keys: readonly string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) =>
    storage.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }))));
}

export function putPng(key: string, body: Buffer): Promise<void> {
  return putObject(key, body, "image/png");
}

export async function getPng(key: string) {
  return (await getObject(key)).body;
}
