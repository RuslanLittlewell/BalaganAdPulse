import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "../config.js";

const storage = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.storage.accessKey,
    secretAccessKey: config.storage.secretKey,
  },
});

export async function putPng(key: string, body: Buffer): Promise<void> {
  await storage.send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: body,
    ContentType: "image/png",
    CacheControl: "private, max-age=3600",
  }));
}

export async function getPng(key: string) {
  const object = await storage.send(new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  }));
  if (!object.Body) throw new Error("Avatar object has no body");
  return object.Body.transformToByteArray();
}
