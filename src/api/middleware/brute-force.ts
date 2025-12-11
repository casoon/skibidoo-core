// Brute-Force Protection Middleware
// src/api/middleware/brute-force.ts

import type { MiddlewareHandler } from "hono";
import Redis from "ioredis";
import { env, logger } from "@/config";

// Redis connection (lazy initialization, only if REDIS_URL is configured)
let redis: Redis | null = null;
let redisAvailable = false;

function getRedis(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
    redis.on("connect", () => {
      redisAvailable = true;
      logger.info("Brute-force protection: Redis connected");
    });
    redis.on("error", (err) => {
      redisAvailable = false;
      logger.warn(
        { err },
        "Brute-force protection: Redis unavailable, protection disabled",
      );
    });
  }
  return redis;
}

function isRedisAvailable(): boolean {
  return redisAvailable && redis !== null;
}

interface BruteForceConfig {
  maxAttempts: number; // Max failed attempts before block
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // Block duration in milliseconds
  keyPrefix: string; // Redis key prefix
}

const defaultConfig: BruteForceConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 60 * 60 * 1000, // 1 hour block
  keyPrefix: "bf:",
};

/**
 * Get client identifier (IP or user ID)
 */
function getClientKey(
  c: { req: { header: (name: string) => string | undefined } },
  prefix: string,
): string {
  const forwarded = c.req.header("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
  return `${prefix}${ip}`;
}

/**
 * Check if client is blocked
 */
async function isBlocked(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r || !isRedisAvailable()) return false;
  const blocked = await r.get(`${key}:blocked`);
  return blocked === "1";
}

/**
 * Record a failed attempt
 */
async function recordFailedAttempt(
  key: string,
  config: BruteForceConfig,
): Promise<number> {
  const r = getRedis();
  if (!r || !isRedisAvailable()) return 0;

  const attemptsKey = `${key}:attempts`;
  const attempts = await r.incr(attemptsKey);

  if (attempts === 1) {
    await r.pexpire(attemptsKey, config.windowMs);
  }

  if (attempts >= config.maxAttempts) {
    await r.set(`${key}:blocked`, "1", "PX", config.blockDurationMs);
    await r.del(attemptsKey);
  }

  return attempts;
}

/**
 * Clear failed attempts on successful login
 */
async function clearAttempts(key: string): Promise<void> {
  const r = getRedis();
  if (!r || !isRedisAvailable()) return;
  await r.del(`${key}:attempts`);
}

/**
 * Brute-force protection middleware
 */
export const bruteForceProtection = (
  options: Partial<BruteForceConfig> = {},
): MiddlewareHandler => {
  const config = { ...defaultConfig, ...options };

  return async (c, next) => {
    const key = getClientKey(c, config.keyPrefix);

    // Check if blocked (skip if Redis unavailable)
    if (await isBlocked(key)) {
      const r = getRedis();
      const ttl = r ? await r.pttl(`${key}:blocked`) : 0;
      const remainingMinutes = Math.ceil(ttl / 60000);

      return c.json(
        {
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: `Too many failed attempts. Try again in ${remainingMinutes} minutes.`,
          },
        },
        429,
      );
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
  windowMs: 15 * 60 * 1000, // 15 min window
  blockDurationMs: 60 * 60 * 1000, // 1 hour block
  keyPrefix: "bf:login:",
});

/**
 * Password reset brute-force protection
 * Even stricter to prevent enumeration
 */
export const passwordResetBruteForce = bruteForceProtection({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour window
  blockDurationMs: 24 * 60 * 60 * 1000, // 24 hour block
  keyPrefix: "bf:reset:",
});

/**
 * API key brute-force protection
 */
export const apiKeyBruteForce = bruteForceProtection({
  maxAttempts: 10,
  windowMs: 60 * 1000, // 1 min window
  blockDurationMs: 15 * 60 * 1000, // 15 min block
  keyPrefix: "bf:apikey:",
});
