// Cache Headers Middleware
// src/api/middleware/cache.ts

import type { MiddlewareHandler } from "hono";
import { createHash } from "crypto";

/**
 * Generate ETag from content
 */
function generateETag(content: string): string {
  return '"' + createHash("md5").update(content).digest("hex") + '"';
}

/**
 * Cache control middleware for static/semi-static content
 */
export const cacheControl = (maxAge: number = 60): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    // Only cache successful GET requests
    if (c.req.method !== "GET" || c.res.status !== 200) {
      return;
    }

    // Don't cache if already has cache headers
    if (c.res.headers.get("Cache-Control")) {
      return;
    }

    c.res.headers.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  };
};

/**
 * ETag middleware for conditional requests
 */
export const etagMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Only process successful GET requests with JSON body
  if (c.req.method !== "GET" || c.res.status !== 200) {
    return;
  }

  const contentType = c.res.headers.get("Content-Type");
  if (!contentType?.includes("application/json")) {
    return;
  }

  // Clone response to read body
  const clonedRes = c.res.clone();
  const body = await clonedRes.text();

  if (!body) {
    return;
  }

  const etag = generateETag(body);
  c.res.headers.set("ETag", etag);

  // Check If-None-Match header
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    c.res = new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
      },
    });
  }
};

/**
 * No-cache middleware for dynamic content
 */
export const noCache: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  c.res.headers.set("Pragma", "no-cache");
  c.res.headers.set("Expires", "0");
};

/**
 * Product cache - moderate TTL with stale-while-revalidate
 */
export const productCache = cacheControl(300); // 5 minutes

/**
 * Category cache - longer TTL as categories change less often
 */
export const categoryCache = cacheControl(3600); // 1 hour

/**
 * Search cache - short TTL
 */
export const searchCache = cacheControl(60); // 1 minute
