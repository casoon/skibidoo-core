// Rate Limiting Middleware
// src/api/middleware/rate-limit.ts

import { rateLimiter } from "hono-rate-limiter";
import type { Context } from "hono";

// Get client identifier (IP or user ID)
function getClientId(c: Context): string {
  // Try to get user ID from auth context
  const userId = c.get("userId");
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

// General API rate limiter (100 requests per minute)
export const generalRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: "draft-6",
  keyGenerator: getClientId,
  message: { error: { code: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut." } },
});

// Strict rate limiter for auth endpoints (10 requests per minute)
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: "draft-6",
  keyGenerator: getClientId,
  message: { error: { code: "RATE_LIMITED", message: "Zu viele Login-Versuche. Bitte warten Sie eine Minute." } },
});

// Very strict for password reset (3 requests per hour)
export const passwordResetRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: "draft-6",
  keyGenerator: getClientId,
  message: { error: { code: "RATE_LIMITED", message: "Zu viele Passwort-Reset-Anfragen. Bitte warten Sie eine Stunde." } },
});

// Checkout rate limiter (20 requests per minute)
export const checkoutRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-6",
  keyGenerator: getClientId,
  message: { error: { code: "RATE_LIMITED", message: "Zu viele Checkout-Anfragen. Bitte versuchen Sie es spaeter erneut." } },
});

// Webhook rate limiter (1000 requests per minute - for external services)
export const webhookRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-webhook-source") || getClientId(c),
  message: { error: { code: "RATE_LIMITED", message: "Webhook rate limit exceeded." } },
});
