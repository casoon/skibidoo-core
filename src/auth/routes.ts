import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from "./jwt";

const router = new Hono();

// Input validation
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Register new customer
router.post("/register", async (c) => {
  const body = await c.req.json();
  
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, 400);
  }
  
  const { email, password, firstName, lastName } = parsed.data;
  
  // Check if email exists
  const existing = await db.query.customers.findFirst({
    where: eq(customers.email, email.toLowerCase()),
  });
  
  if (existing) {
    return c.json({
      error: { code: "EMAIL_EXISTS", message: "Email already registered" },
    }, 409);
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create customer
  const [customer] = await db.insert(customers).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    status: "active",
  }).returning();
  
  // Generate tokens
  const accessToken = await signAccessToken({
    sub: customer.id,
    email: customer.email,
    role: "customer",
  });
  
  const refreshToken = await signRefreshToken({
    sub: customer.id,
    email: customer.email,
    role: "customer",
  });
  
  return c.json({
    data: {
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
      accessToken,
      refreshToken,
    },
  }, 201);
});

// Login
router.post("/login", async (c) => {
  const body = await c.req.json();
  
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    }, 400);
  }
  
  const { email, password } = parsed.data;
  
  // Find customer
  const customer = await db.query.customers.findFirst({
    where: eq(customers.email, email.toLowerCase()),
  });
  
  if (!customer || !customer.passwordHash) {
    return c.json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    }, 401);
  }
  
  // Verify password
  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    return c.json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    }, 401);
  }
  
  // Check status
  if (customer.status !== "active") {
    return c.json({
      error: { code: "ACCOUNT_INACTIVE", message: "Account is not active" },
    }, 403);
  }
  
  // Generate tokens
  const accessToken = await signAccessToken({
    sub: customer.id,
    email: customer.email,
    role: "customer",
  });
  
  const refreshToken = await signRefreshToken({
    sub: customer.id,
    email: customer.email,
    role: "customer",
  });
  
  return c.json({
    data: {
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
      accessToken,
      refreshToken,
    },
  });
});

// Refresh token
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
  
  // Get user to ensure still valid
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, payload.sub),
  });
  
  if (!customer || customer.status !== "active") {
    return c.json({
      error: { code: "ACCOUNT_INACTIVE", message: "Account not found or inactive" },
    }, 401);
  }
  
  // Generate new tokens
  const newAccessToken = await signAccessToken({
    sub: customer.id,
    email: customer.email,
    role: payload.role,
  });
  
  const newRefreshToken = await signRefreshToken({
    sub: customer.id,
    email: customer.email,
    role: payload.role,
  });
  
  return c.json({
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// Get current user (requires auth)
router.get("/me", async (c) => {
  const authHeader = c.req.header("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({
      error: { code: "UNAUTHORIZED", message: "Authorization required" },
    }, 401);
  }
  
  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);
  
  if (!payload) {
    return c.json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    }, 401);
  }
  
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, payload.sub),
    with: {
      addresses: true,
    },
  });
  
  if (!customer) {
    return c.json({
      error: { code: "NOT_FOUND", message: "User not found" },
    }, 404);
  }
  
  return c.json({
    data: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      isVerified: customer.isVerified,
      addresses: customer.addresses,
      locale: customer.locale,
      currency: customer.currency,
    },
  });
});

export { router as authRoutes };
