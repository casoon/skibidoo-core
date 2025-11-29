// Upload API Routes with Image Optimization
// src/api/routes/upload.ts

import { Hono } from "hono";
import { storageService, imageService } from "@/storage";

const router = new Hono();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

// Upload product image with optimization
router.post("/products/:productId", async (c) => {
  const productId = c.req.param("productId");
  const optimize = c.req.query("optimize") !== "false"; // default true

  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: "NO_FILE", message: "No file provided" } }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({
      error: { code: "INVALID_TYPE", message: "Only JPEG, PNG, GIF, WebP, AVIF allowed" }
    }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({
      error: { code: "FILE_TOO_LARGE", message: "File exceeds 10MB limit" }
    }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Validate image
  const validation = await imageService.validate(buffer);
  if (!validation.valid) {
    return c.json({ error: { code: "INVALID_IMAGE", message: validation.error } }, 400);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const timestamp = Date.now();
  const baseKey = "products/" + productId + "/" + timestamp + "-" + baseName.replace(/[^a-zA-Z0-9.-]/g, "_");

  if (optimize) {
    // Create optimized versions
    const optimized = await imageService.optimize(buffer, { width: 1920, quality: 85 });

    // Upload all versions in parallel
    const [originalResult, webpResult, avifResult, thumbResult] = await Promise.all([
      storageService.upload(baseKey + ".jpg", optimized.original, { contentType: "image/jpeg" }),
      storageService.upload(baseKey + ".webp", optimized.webp, { contentType: "image/webp" }),
      storageService.upload(baseKey + ".avif", optimized.avif, { contentType: "image/avif" }),
      storageService.upload(baseKey + "-thumb.webp", optimized.thumbnailWebp!, { contentType: "image/webp" }),
    ]);

    return c.json({
      data: {
        original: { key: originalResult.key, url: originalResult.publicUrl, size: originalResult.size },
        webp: { key: webpResult.key, url: webpResult.publicUrl, size: webpResult.size },
        avif: { key: avifResult.key, url: avifResult.publicUrl, size: avifResult.size },
        thumbnail: { key: thumbResult.key, url: thumbResult.publicUrl, size: thumbResult.size },
      },
    });
  } else {
    // Upload without optimization
    const result = await storageService.uploadProductImage(productId, file.name, buffer);
    return c.json({
      data: {
        key: result.key,
        url: result.publicUrl,
        size: result.size,
        contentType: result.contentType,
      },
    });
  }
});

// Upload category image with optimization
router.post("/categories/:categoryId", async (c) => {
  const categoryId = c.req.param("categoryId");
  const optimize = c.req.query("optimize") !== "false";

  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: "NO_FILE", message: "No file provided" } }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({
      error: { code: "INVALID_TYPE", message: "Only JPEG, PNG, GIF, WebP, AVIF allowed" }
    }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({
      error: { code: "FILE_TOO_LARGE", message: "File exceeds 10MB limit" }
    }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const validation = await imageService.validate(buffer);
  if (!validation.valid) {
    return c.json({ error: { code: "INVALID_IMAGE", message: validation.error } }, 400);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const timestamp = Date.now();
  const baseKey = "categories/" + categoryId + "/" + timestamp + "-" + baseName.replace(/[^a-zA-Z0-9.-]/g, "_");

  if (optimize) {
    const optimized = await imageService.optimize(buffer, { width: 1200, quality: 85 });

    const [originalResult, webpResult, avifResult] = await Promise.all([
      storageService.upload(baseKey + ".jpg", optimized.original, { contentType: "image/jpeg" }),
      storageService.upload(baseKey + ".webp", optimized.webp, { contentType: "image/webp" }),
      storageService.upload(baseKey + ".avif", optimized.avif, { contentType: "image/avif" }),
    ]);

    return c.json({
      data: {
        original: { key: originalResult.key, url: originalResult.publicUrl, size: originalResult.size },
        webp: { key: webpResult.key, url: webpResult.publicUrl, size: webpResult.size },
        avif: { key: avifResult.key, url: avifResult.publicUrl, size: avifResult.size },
      },
    });
  } else {
    const result = await storageService.uploadCategoryImage(categoryId, file.name, buffer);
    return c.json({
      data: {
        key: result.key,
        url: result.publicUrl,
        size: result.size,
        contentType: result.contentType,
      },
    });
  }
});

// Get presigned upload URL (for direct browser uploads)
router.post("/presigned", async (c) => {
  const { key, contentType } = await c.req.json<{ key: string; contentType: string }>();

  if (!key || !contentType) {
    return c.json({
      error: { code: "MISSING_PARAMS", message: "key and contentType required" }
    }, 400);
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return c.json({
      error: { code: "INVALID_TYPE", message: "Only JPEG, PNG, GIF, WebP, AVIF allowed" }
    }, 400);
  }

  const result = await storageService.getUploadUrl(key, contentType);

  return c.json({
    data: {
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
    },
  });
});

// List product images
router.get("/products/:productId", async (c) => {
  const productId = c.req.param("productId");

  const files = await storageService.list("products/" + productId + "/");

  return c.json({
    data: files.map((f) => ({
      key: f.key,
      url: storageService.getPublicUrl(f.key),
      size: f.size,
      lastModified: f.lastModified,
    })),
  });
});

// Delete file
router.delete("/:key{.+}", async (c) => {
  const key = c.req.param("key");

  await storageService.delete(key);

  return c.json({ success: true });
});

export { router as uploadRoutes };
