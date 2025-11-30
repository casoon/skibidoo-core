import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { trpcServer } from "@hono/trpc-server";
import { env, logger } from "@/config";
import { db } from "@/db";
import { appRouter, createContext } from "@/trpc";
import { authRoutes, adminAuthRoutes } from "@/auth";
import { productRoutes } from "./routes/products";
import { categoryRoutes } from "./routes/categories";
import { cartRoutes } from "./routes/cart";
import { checkoutRoutes } from "./routes/checkout";
import { searchRoutes } from "./routes/search";
import { uploadRoutes } from "./routes/upload";
import { paymentRoutes, stripeWebhookRoutes, registerDefaultHandlers } from "@/payments";
import { invoiceRoutes } from "@/invoices";
import { setupSwaggerUI } from "./docs/openapi";
import {
  productCache,
  categoryCache,
  searchCache,
  etagMiddleware,
  generalRateLimiter,
  authRateLimiter,
  checkoutRateLimiter,
  webhookRateLimiter,
  apiSecurityHeaders,
} from "./middleware";

export function createApp() {
  const app = new Hono();

  // Register Stripe webhook handlers
  if (env.STRIPE_SECRET_KEY) {
    registerDefaultHandlers();
  }

  // Global Middleware
  app.use("*", requestId());
  app.use("*", cors({
    origin: env.CORS_ORIGINS?.split(",") || ["http://localhost:4321", "http://localhost:4322"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    credentials: true,
  }));

  // Security headers for all responses
  app.use("*", apiSecurityHeaders);

  // Development logging
  if (env.NODE_ENV === "development") {
    app.use("*", honoLogger());
  }

  // Health check (no rate limiting)
  app.get("/health", (c) => c.json({ status: "ok", mode: env.MODE }));
  app.get("/health/ready", async (c) => c.json({ status: "ready" }));

  // API Documentation (Swagger UI) - no rate limiting in dev
  setupSwaggerUI(app);

  // Stripe webhooks - special rate limiting
  app.use("/webhooks/*", webhookRateLimiter);
  app.route("/webhooks", stripeWebhookRoutes);

  // tRPC routes for Admin API - general rate limiting
  app.use("/trpc/*", generalRateLimiter);
  app.use("/trpc/*", trpcServer({
    router: appRouter,
    createContext: async ({ req }) => {
      const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
      const ctx = await createContext({
        db,
        logger,
        authHeader: req.headers.get("authorization") || undefined,
        requestId: reqId,
      });
      return ctx as unknown as Record<string, unknown>;
    },
  }));

  // REST API routes
  const api = new Hono();

  // Auth routes - strict rate limiting
  api.use("/auth/*", authRateLimiter);
  api.route("/auth", authRoutes);

  // Admin auth routes - strict rate limiting
  api.use("/admin/auth/*", authRateLimiter);
  api.route("/admin/auth", adminAuthRoutes);

  // Public storefront routes - general rate limiting
  api.use("/products/*", generalRateLimiter);
  api.use("/products/*", productCache);
  api.use("/products/*", etagMiddleware);
  api.route("/products", productRoutes);

  api.use("/categories/*", generalRateLimiter);
  api.use("/categories/*", categoryCache);
  api.use("/categories/*", etagMiddleware);
  api.route("/categories", categoryRoutes);

  // Search routes - general rate limiting
  api.use("/search/*", generalRateLimiter);
  api.use("/search/*", searchCache);
  api.route("/search", searchRoutes);

  api.use("/cart/*", generalRateLimiter);
  api.route("/cart", cartRoutes);

  // Checkout - moderate rate limiting
  api.use("/checkout/*", checkoutRateLimiter);
  api.route("/checkout", checkoutRoutes);

  // Payment routes - checkout rate limiting
  api.use("/payments/*", checkoutRateLimiter);
  api.route("/payments", paymentRoutes);

  // Invoice routes - general rate limiting
  api.use("/invoices/*", generalRateLimiter);
  api.route("/invoices", invoiceRoutes);

  // Upload routes - general rate limiting (admin only)
  api.use("/upload/*", generalRateLimiter);
  api.route("/upload", uploadRoutes);

  app.route("/api/v1", api);

  // 404 handler
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404));

  // Error handler
  app.onError((err, c) => {
    logger.error({ err }, "Unhandled error");
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      500
    );
  });

  return app;
}
