// HTTP Metrics Middleware
// src/api/middleware/metrics.ts

import type { Context, Next } from "hono";
import { httpRequestDuration, httpRequestsTotal } from "@/telemetry";

/**
 * Middleware to collect HTTP request metrics
 */
export async function httpMetricsMiddleware(c: Context, next: Next): Promise<void> {
  const start = performance.now();
  const method = c.req.method;
  
  // Normalize route for metrics (avoid high cardinality)
  const route = normalizeRoute(c.req.path);

  await next();

  const duration = (performance.now() - start) / 1000; // Convert to seconds
  const statusCode = c.res.status.toString();

  // Record metrics
  httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
}

/**
 * Normalize route paths to prevent high cardinality
 * Replaces dynamic segments like UUIDs and IDs with placeholders
 */
function normalizeRoute(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    // Replace numeric IDs
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    // Replace slugs that look like product-name-123
    .replace(/\/[a-z0-9-]+-\d+(?=\/|$)/gi, "/:slug")
    // Limit path depth to prevent explosion
    .split("/")
    .slice(0, 5)
    .join("/");
}
