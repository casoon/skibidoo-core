import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminUsers, adminSessions } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from "./jwt";

const router = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

// Initial setup - only works if no admin exists
router.post("/setup", async (c) => {
  const body = await c.req.json();

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, 400);
  }

  const { email, password, firstName, lastName } = parsed.data;

  // Check if any admin exists
  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(adminUsers);

  if (Number(existingCount[0]?.count ?? 0) > 0) {
    return c.json({
      error: { code: "SETUP_COMPLETED", message: "Setup already completed. Admin users exist." },
    }, 403);
  }

  // Create initial admin
  const passwordHash = await hashPassword(password);

  const [admin] = await db.insert(adminUsers).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstName || "Admin",
    lastName: lastName || "User",
    role: "super_admin",
    isActive: true,
  }).returning();

  return c.json({
    data: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      message: "Initial admin user created successfully",
    },
  });
});

// Admin login
router.post("/login", async (c) => {
  const body = await c.req.json();

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    }, 400);
  }

  const { email, password } = parsed.data;

  // Find admin user
  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email.toLowerCase()),
  });

  if (!admin) {
    return c.json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return c.json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    }, 401);
  }

  // Check if active
  if (!admin.isActive) {
    return c.json({
      error: { code: "ACCOUNT_INACTIVE", message: "Account is not active" },
    }, 403);
  }

  // Update last login
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, admin.id));

  // Generate tokens
  const accessToken = await signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: "admin",
  });

  const refreshToken = await signRefreshToken({
    sub: admin.id,
    email: admin.email,
    role: "admin",
  });

  // Store session
  const tokenHash = await hashTokenForStorage(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(adminSessions).values({
    adminUserId: admin.id,
    tokenHash,
    expiresAt,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  });

  return c.json({
    data: {
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
      },
      accessToken,
      refreshToken,
    },
  });
});

// Admin refresh token
router.post("/refresh", async (c) => {
  const body = await c.req.json();

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: { code: "VALIDATION_ERROR", message: "refreshToken required" },
    }, 400);
  }

  const { refreshToken } = parsed.data;

  // Verify refresh token
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return c.json({
      error: { code: "INVALID_TOKEN", message: "Invalid or expired refresh token" },
    }, 401);
  }

  // Verify session exists
  const tokenHash = await hashTokenForStorage(refreshToken);
  const session = await db.query.adminSessions.findFirst({
    where: eq(adminSessions.tokenHash, tokenHash),
  });

  if (!session || session.expiresAt < new Date()) {
    return c.json({
      error: { code: "SESSION_EXPIRED", message: "Session expired" },
    }, 401);
  }

  // Get admin user
  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, payload.sub),
  });

  if (!admin || !admin.isActive) {
    return c.json({
      error: { code: "ACCOUNT_INACTIVE", message: "Account not found or inactive" },
    }, 401);
  }

  // Delete old session
  await db.delete(adminSessions).where(eq(adminSessions.id, session.id));

  // Generate new tokens
  const newAccessToken = await signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: "admin",
  });

  const newRefreshToken = await signRefreshToken({
    sub: admin.id,
    email: admin.email,
    role: "admin",
  });

  // Store new session
  const newTokenHash = await hashTokenForStorage(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(adminSessions).values({
    adminUserId: admin.id,
    tokenHash: newTokenHash,
    expiresAt,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  });

  return c.json({
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// Admin logout
router.post("/logout", async (c) => {
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ data: { success: true } });
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);

  if (payload) {
    // Delete all sessions for this user (optional: only current session)
    await db.delete(adminSessions).where(eq(adminSessions.adminUserId, payload.sub));
  }

  return c.json({ data: { success: true } });
});

// Get current admin user
router.get("/me", async (c) => {
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({
      error: { code: "UNAUTHORIZED", message: "Authorization required" },
    }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);

  if (!payload || payload.role !== "admin") {
    return c.json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    }, 401);
  }

  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, payload.sub),
  });

  if (!admin) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Admin not found" },
    }, 404);
  }

  return c.json({
    data: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      twoFactorEnabled: admin.twoFactorEnabled,
    },
  });
});

// Hash token for storage (using native crypto)
async function hashTokenForStorage(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { router as adminAuthRoutes };
