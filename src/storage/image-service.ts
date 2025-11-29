// Image Optimization Service
// src/storage/image-service.ts

import sharp from "sharp";

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface OptimizedImages {
  original: Buffer;
  webp: Buffer;
  avif: Buffer;
  thumbnail?: Buffer;
  thumbnailWebp?: Buffer;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

const DEFAULT_QUALITY = 80;
const THUMBNAIL_SIZE = 200;

export const imageService = {
  // Get image metadata
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || "unknown",
      size: buffer.length,
    };
  },

  // Optimize image and create multiple formats
  async optimize(
    buffer: Buffer,
    options: ImageOptions = {}
  ): Promise<OptimizedImages> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    let pipeline = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        withoutEnlargement: true,
      });
    }

    // Get optimized original (JPEG)
    const original = await pipeline
      .clone()
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    // WebP version
    const webp = await pipeline
      .clone()
      .webp({ quality, effort: 4 })
      .toBuffer();

    // AVIF version (smaller but slower to encode)
    const avif = await pipeline
      .clone()
      .avif({ quality, effort: 4 })
      .toBuffer();

    // Thumbnail
    const thumbnail = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();

    const thumbnailWebp = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();

    return {
      original,
      webp,
      avif,
      thumbnail,
      thumbnailWebp,
    };
  },

  // Convert to WebP only
  async toWebp(buffer: Buffer, options: ImageOptions = {}): Promise<Buffer> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    let pipeline = sharp(buffer);

    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        withoutEnlargement: true,
      });
    }

    return pipeline.webp({ quality, effort: 4 }).toBuffer();
  },

  // Convert to AVIF only
  async toAvif(buffer: Buffer, options: ImageOptions = {}): Promise<Buffer> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    let pipeline = sharp(buffer);

    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        withoutEnlargement: true,
      });
    }

    return pipeline.avif({ quality, effort: 4 }).toBuffer();
  },

  // Create responsive image set
  async createResponsiveSet(
    buffer: Buffer,
    sizes: number[] = [320, 640, 1024, 1920]
  ): Promise<Map<number, { webp: Buffer; avif: Buffer }>> {
    const result = new Map<number, { webp: Buffer; avif: Buffer }>();

    await Promise.all(
      sizes.map(async (size) => {
        const webp = await this.toWebp(buffer, { width: size });
        const avif = await this.toAvif(buffer, { width: size });
        result.set(size, { webp, avif });
      })
    );

    return result;
  },

  // Create thumbnail
  async createThumbnail(
    buffer: Buffer,
    size: number = THUMBNAIL_SIZE
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(size, size, { fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();
  },

  // Validate image
  async validate(
    buffer: Buffer,
    maxWidth: number = 4096,
    maxHeight: number = 4096,
    maxSize: number = 10 * 1024 * 1024
  ): Promise<{ valid: boolean; error?: string }> {
    if (buffer.length > maxSize) {
      return { valid: false, error: "File too large" };
    }

    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.format || !["jpeg", "png", "gif", "webp", "avif"].includes(metadata.format)) {
        return { valid: false, error: "Unsupported format" };
      }

      if ((metadata.width || 0) > maxWidth || (metadata.height || 0) > maxHeight) {
        return { valid: false, error: "Image dimensions too large" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid image file" };
    }
  },
};
