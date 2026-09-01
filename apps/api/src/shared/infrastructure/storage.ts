import {
  DeleteObjectCommand,
  GetObjectCommand,
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

/** Stores bytes under their own content type. Task images may be JPEG, WebP or
 * GIF as well as PNG, so the type travels with the object rather than being
 * assumed by the reader. */
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

/** Best effort, and deliberately so: an object the service will not delete is
 * rubbish that costs storage, not a failure the caller can act on. */
export async function removeObjects(keys: readonly string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) =>
    storage.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }))));
}

/** Avatars keep their own pair: one PNG per user or client, overwritten in
 * place, with the type fixed at the call site rather than carried. */
export function putPng(key: string, body: Buffer): Promise<void> {
  return putObject(key, body, "image/png");
}

export async function getPng(key: string) {
  return (await getObject(key)).body;
}
