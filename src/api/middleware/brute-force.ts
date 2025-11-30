// Brute-Force Protection Middleware
// src/api/middleware/brute-force.ts

import type { MiddlewareHandler } from "hono";
import Redis from "ioredis";
import { env } from "@/config";

const redis = new Redis(env.REDIS_URL);

interface BruteForceConfig {
  maxAttempts: number;      // Max failed attempts before block
  windowMs: number;         // Time window in milliseconds
  blockDurationMs: number;  // Block duration in milliseconds
  keyPrefix: string;        // Redis key prefix
}

const defaultConfig: BruteForceConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,      // 15 minutes
  blockDurationMs: 60 * 60 * 1000, // 1 hour block
  keyPrefix: "bf:",
};

/**
 * Get client identifier (IP or user ID)
 */
function getClientKey(c: { req: { header: (name: string) => string | undefined } }, prefix: string): string {
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
  return `${prefix}${ip}`;
}

/**
 * Check if client is blocked
 */
async function isBlocked(key: string): Promise<boolean> {
  const blocked = await redis.get(`${key}:blocked`);
  return blocked === "1";
}

/**
 * Record a failed attempt
 */
async function recordFailedAttempt(key: string, config: BruteForceConfig): Promise<number> {
  const attemptsKey = `${key}:attempts`;
  const attempts = await redis.incr(attemptsKey);
  
  if (attempts === 1) {
    await redis.pexpire(attemptsKey, config.windowMs);
  }
  
  if (attempts >= config.maxAttempts) {
    await redis.set(`${key}:blocked`, "1", "PX", config.blockDurationMs);
    await redis.del(attemptsKey);
  }
  
  return attempts;
}

/**
 * Clear failed attempts on successful login
 */
async function clearAttempts(key: string): Promise<void> {
  await redis.del(`${key}:attempts`);
}

/**
 * Brute-force protection middleware
 */
export const bruteForceProtection = (
  options: Partial<BruteForceConfig> = {}
): MiddlewareHandler => {
  const config = { ...defaultConfig, ...options };

  return async (c, next) => {
    const key = getClientKey(c, config.keyPrefix);

    // Check if blocked
    if (await isBlocked(key)) {
      const ttl = await redis.pttl(`${key}:blocked`);
      const remainingMinutes = Math.ceil(ttl / 60000);
      
      return c.json({
        error: {
          code: "TOO_MANY_ATTEMPTS",
          message: `Too many failed attempts. Try again in ${remainingMinutes} minutes.`,
        },
      }, 429);
    }

    await next();

    // Check response status
    if (c.res.status === 401 || c.res.status === 403) {
      const attempts = await recordFailedAttempt(key, config);
      const remaining = config.maxAttempts - attempts;
      
      if (remaining > 0) {
        c.res.headers.set("X-RateLimit-Remaining", String(remaining));
      }
    } else if (c.res.status === 200) {
      // Successful login - clear attempts
      await clearAttempts(key);
    }
  };
};

/**
 * Login-specific brute-force protection
 * Stricter limits for login endpoints
 */
export const loginBruteForce = bruteForceProtection({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,      // 15 min window
  blockDurationMs: 60 * 60 * 1000, // 1 hour block
  keyPrefix: "bf:login:",
});

/**
 * Password reset brute-force protection
 * Even stricter to prevent enumeration
 */
export const passwordResetBruteForce = bruteForceProtection({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,        // 1 hour window
  blockDurationMs: 24 * 60 * 60 * 1000, // 24 hour block
  keyPrefix: "bf:reset:",
});

/**
 * API key brute-force protection
 */
export const apiKeyBruteForce = bruteForceProtection({
  maxAttempts: 10,
  windowMs: 60 * 1000,             // 1 min window
  blockDurationMs: 15 * 60 * 1000, // 15 min block
  keyPrefix: "bf:apikey:",
});
