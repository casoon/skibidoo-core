// Upload API Routes
// src/api/routes/upload.ts

import { Hono } from "hono";
import { storageService } from "@/storage";

const router = new Hono();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

// Upload product image
router.post("/products/:productId", async (c) => {
  const productId = c.req.param("productId");
  
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
  const result = await storageService.uploadProductImage(productId, file.name, buffer);

  return c.json({
    data: {
      key: result.key,
      url: result.publicUrl,
      size: result.size,
      contentType: result.contentType,
    },
  });
});

// Upload category image
router.post("/categories/:categoryId", async (c) => {
  const categoryId = c.req.param("categoryId");
  
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
  const result = await storageService.uploadCategoryImage(categoryId, file.name, buffer);

  return c.json({
    data: {
      key: result.key,
      url: result.publicUrl,
      size: result.size,
      contentType: result.contentType,
    },
  });
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
