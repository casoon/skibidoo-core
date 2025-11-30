// Middleware Index
// src/api/middleware/index.ts

export {
  generalRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  checkoutRateLimiter,
  webhookRateLimiter,
} from "./rate-limit.js";

export {
  securityHeaders,
  apiSecurityHeaders,
} from "./security-headers.js";

export {
  cacheControl,
  etagMiddleware,
  noCache,
  productCache,
  categoryCache,
  searchCache,
} from "./cache.js";
