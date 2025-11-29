// Security Headers Middleware
// src/api/middleware/security-headers.ts

import type { MiddlewareHandler } from "hono";

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  // Prevent clickjacking
  c.header("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // XSS Protection (legacy, but still useful)
  c.header("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy (restrict browser features)
  c.header(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=()"
  );

  // Content Security Policy (adjust based on your needs)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  c.header("Content-Security-Policy", csp);

  // Strict Transport Security (HTTPS only)
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Cross-Origin policies
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
};

// Relaxed CSP for API responses (no HTML)
export const apiSecurityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Cross-Origin-Resource-Policy", "same-origin");

  // Cache control for API responses
  if (!c.res.headers.has("Cache-Control")) {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
};
