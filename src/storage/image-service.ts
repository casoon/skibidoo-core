// Image Optimization Service
// src/storage/image-service.ts

import Jimp from "jimp";

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface OptimizedImages {
  original: Buffer;
  webp: Buffer;
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

// Map MIME types to format strings
function getMimeFormat(mime: string): string {
  const formatMap: Record<string, string> = {
    [Jimp.MIME_JPEG]: "jpeg",
    [Jimp.MIME_PNG]: "png",
    [Jimp.MIME_GIF]: "gif",
    [Jimp.MIME_BMP]: "bmp",
  };
  return formatMap[mime] || "unknown";
}

export const imageService = {
  // Get image metadata
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const image = await Jimp.read(buffer);
    return {
      width: image.getWidth(),
      height: image.getHeight(),
      format: getMimeFormat(image.getMIME()),
      size: buffer.length,
    };
  },

  // Optimize image and create multiple formats
  // Note: Jimp doesn't support WebP/AVIF natively, using PNG as fallback
  async optimize(
    buffer: Buffer,
    options: ImageOptions = {}
  ): Promise<OptimizedImages> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    const image = await Jimp.read(buffer);

    // Resize if dimensions provided
    if (width || height) {
      const resizeMode = fit === "cover" ? Jimp.RESIZE_BEZIER : Jimp.RESIZE_BILINEAR;
      if (width && height) {
        if (fit === "cover") {
          image.cover(width, height);
        } else if (fit === "contain" || fit === "inside") {
          image.contain(width, height);
        } else {
          image.resize(width, height, resizeMode);
        }
      } else if (width) {
        image.resize(width, Jimp.AUTO, resizeMode);
      } else if (height) {
        image.resize(Jimp.AUTO, height, resizeMode);
      }
    }

    // Get optimized original (JPEG)
    image.quality(quality);
    const original = await image.clone().getBufferAsync(Jimp.MIME_JPEG);

    // PNG version as WebP fallback (Jimp doesn't support WebP natively)
    // Consider using @aspect-build/bun-webp or cloud-based transformation for WebP
    const webp = await image.clone().getBufferAsync(Jimp.MIME_PNG);

    // Thumbnail
    const thumbImage = await Jimp.read(buffer);
    thumbImage.cover(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    thumbImage.quality(70);
    const thumbnail = await thumbImage.getBufferAsync(Jimp.MIME_JPEG);

    const thumbWebpImage = await Jimp.read(buffer);
    thumbWebpImage.cover(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const thumbnailWebp = await thumbWebpImage.getBufferAsync(Jimp.MIME_PNG);

    return {
      original,
      webp,
      thumbnail,
      thumbnailWebp,
    };
  },

  // Convert to PNG (WebP fallback)
  async toWebp(buffer: Buffer, options: ImageOptions = {}): Promise<Buffer> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    const image = await Jimp.read(buffer);

    if (width || height) {
      if (width && height) {
        if (fit === "cover") {
          image.cover(width, height);
        } else if (fit === "contain" || fit === "inside") {
          image.contain(width, height);
        } else {
          image.resize(width, height);
        }
      } else if (width) {
        image.resize(width, Jimp.AUTO);
      } else if (height) {
        image.resize(Jimp.AUTO, height);
      }
    }

    image.quality(quality);
    return image.getBufferAsync(Jimp.MIME_PNG);
  },

  // Create responsive image set
  async createResponsiveSet(
    buffer: Buffer,
    sizes: number[] = [320, 640, 1024, 1920]
  ): Promise<Map<number, { webp: Buffer }>> {
    const result = new Map<number, { webp: Buffer }>();

    await Promise.all(
      sizes.map(async (size) => {
        const webp = await this.toWebp(buffer, { width: size });
        result.set(size, { webp });
      })
    );

    return result;
  },

  // Create thumbnail
  async createThumbnail(
    buffer: Buffer,
    size: number = THUMBNAIL_SIZE
  ): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    image.cover(size, size);
    image.quality(70);
    return image.getBufferAsync(Jimp.MIME_PNG);
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
      const image = await Jimp.read(buffer);
      const mime = image.getMIME();

      const allowedMimes: string[] = [Jimp.MIME_JPEG, Jimp.MIME_PNG, Jimp.MIME_GIF, Jimp.MIME_BMP];
      if (!mime || !allowedMimes.includes(mime)) {
        return { valid: false, error: "Unsupported format" };
      }

      if (image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
        return { valid: false, error: "Image dimensions too large" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid image file" };
    }
  },
};
