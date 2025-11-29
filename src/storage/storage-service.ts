// S3/MinIO Storage Service
// src/storage/storage-service.ts

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config";

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: "private" | "public-read";
  cacheControl?: string;
}

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
  publicUrl?: string;
  size: number;
  contentType: string;
}

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

// S3 Client Configuration - using env vars from config/env.ts
const REGION = "eu-central-1";
const s3Config = {
  region: REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: !!env.STORAGE_ENDPOINT,
  credentials: env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY
    ? {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      }
    : undefined,
};

const s3Client = new S3Client(s3Config);

const BUCKET = env.STORAGE_BUCKET || "skibidoo-assets";
const PUBLIC_URL_BASE = env.STORAGE_ENDPOINT || "https://" + BUCKET + ".s3." + REGION + ".amazonaws.com";

export const storageService = {
  async upload(
    key: string,
    body: Buffer | Uint8Array | ReadableStream,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      contentType = "application/octet-stream",
      metadata,
      acl = "public-read",
      cacheControl = "public, max-age=31536000, immutable",
    } = options;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
      ACL: acl,
      CacheControl: cacheControl,
    });

    await s3Client.send(command);

    const size = body instanceof Buffer ? body.length : 0;

    return {
      key,
      bucket: BUCKET,
      url: "s3://" + BUCKET + "/" + key,
      publicUrl: acl === "public-read" ? PUBLIC_URL_BASE + "/" + key : undefined,
      size,
      contentType,
    };
  },

  async uploadProductImage(
    productId: string,
    filename: string,
    body: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const key = "products/" + productId + "/" + timestamp + "-" + filename.replace(/[^a-zA-Z0-9.-]/g, "_");

    return this.upload(key, body, {
      ...options,
      contentType: options.contentType || getMimeType(ext),
      metadata: {
        ...options.metadata,
        productId,
        originalFilename: filename,
      },
    });
  },

  async uploadCategoryImage(
    categoryId: string,
    filename: string,
    body: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const key = "categories/" + categoryId + "/" + timestamp + "-" + filename.replace(/[^a-zA-Z0-9.-]/g, "_");

    return this.upload(key, body, {
      ...options,
      contentType: options.contentType || getMimeType(ext),
    });
  },

  async uploadUserAvatar(
    userId: string,
    filename: string,
    body: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const key = "avatars/" + userId + "." + ext;

    return this.upload(key, body, {
      ...options,
      contentType: options.contentType || getMimeType(ext),
    });
  },

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);
  },

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  },

  async getInfo(key: string): Promise<StorageFile | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
      };
    } catch {
      return null;
    }
  },

  async getContent(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);
      const stream = response.Body;

      if (!stream) return null;

      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  },

  async list(prefix: string, maxKeys: number = 100): Promise<StorageFile[]> {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await s3Client.send(command);

    return (response.Contents || []).map((item) => ({
      key: item.Key || "",
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));
  },

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: BUCKET + "/" + sourceKey,
      Key: destinationKey,
    });

    await s3Client.send(command);
  },

  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      uploadUrl,
      publicUrl: PUBLIC_URL_BASE + "/" + key,
    };
  },

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  },

  getPublicUrl(key: string): string {
    return PUBLIC_URL_BASE + "/" + key;
  },
};

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    mp4: "video/mp4",
    webm: "video/webm",
  };

  return mimeTypes[ext] || "application/octet-stream";
}
