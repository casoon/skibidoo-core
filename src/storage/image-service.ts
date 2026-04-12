// Image Optimization Service
// src/storage/image-service.ts

import { Jimp, JimpMime } from "jimp";

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

function getMimeFormat(mime: string): string {
  const formatMap: Record<string, string> = {
    [JimpMime.jpeg]: "jpeg",
    [JimpMime.png]: "png",
    [JimpMime.gif]: "gif",
    [JimpMime.bmp]: "bmp",
  };
  return formatMap[mime] || "unknown";
}

async function resizeImage(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  width: number | undefined,
  height: number | undefined,
  fit: ImageOptions["fit"] = "inside"
) {
  if (!width && !height) return;

  if (width && height) {
    if (fit === "cover") {
      image.cover({ w: width, h: height });
    } else {
      image.contain({ w: width, h: height });
    }
  } else if (width) {
    image.resize({ w: width });
  } else if (height) {
    image.resize({ h: height });
  }
}

export const imageService = {
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const image = await Jimp.read(buffer);
    return {
      width: image.width,
      height: image.height,
      format: getMimeFormat(image.mime ?? ""),
      size: buffer.length,
    };
  },

  async optimize(
    buffer: Buffer,
    options: ImageOptions = {}
  ): Promise<OptimizedImages> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;

    const image = await Jimp.read(buffer);
    await resizeImage(image, width, height, fit);

    // In Jimp v1, quality is passed as option to getBuffer()
    const original = Buffer.from(await image.getBuffer(JimpMime.jpeg, { quality }));
    // PNG as WebP fallback (Jimp doesn't natively support WebP)
    const webp = Buffer.from(await image.getBuffer(JimpMime.png));

    const thumb = await Jimp.read(buffer);
    thumb.cover({ w: THUMBNAIL_SIZE, h: THUMBNAIL_SIZE });
    const thumbnail = Buffer.from(await thumb.getBuffer(JimpMime.jpeg, { quality: 70 }));
    const thumbnailWebp = Buffer.from(await thumb.getBuffer(JimpMime.png));

    return { original, webp, thumbnail, thumbnailWebp };
  },

  async toWebp(buffer: Buffer, options: ImageOptions = {}): Promise<Buffer> {
    const { width, height, quality = DEFAULT_QUALITY, fit = "inside" } = options;
    const image = await Jimp.read(buffer);
    await resizeImage(image, width, height, fit);
    // quality not applicable to PNG, but kept for API consistency
    void quality;
    return Buffer.from(await image.getBuffer(JimpMime.png));
  },

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

  async createThumbnail(buffer: Buffer, size: number = THUMBNAIL_SIZE): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    image.cover({ w: size, h: size });
    return Buffer.from(await image.getBuffer(JimpMime.png));
  },

  async validate(
    buffer: Buffer,
    maxWidth = 4096,
    maxHeight = 4096,
    maxSize = 10 * 1024 * 1024
  ): Promise<{ valid: boolean; error?: string }> {
    if (buffer.length > maxSize) {
      return { valid: false, error: "File too large" };
    }
    try {
      const image = await Jimp.read(buffer);
      const mime = image.mime ?? "";
      const allowed = [JimpMime.jpeg, JimpMime.png, JimpMime.gif, JimpMime.bmp];
      if (!allowed.includes(mime as typeof allowed[number])) {
        return { valid: false, error: "Unsupported format" };
      }
      if (image.width > maxWidth || image.height > maxHeight) {
        return { valid: false, error: "Image dimensions too large" };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid image file" };
    }
  },
};
