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

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", requestId());
  app.use("*", cors());

  if (env.NODE_ENV === "development") {
    app.use("*", honoLogger());
  }

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", mode: env.MODE }));

  app.get("/health/ready", async (c) => {
    // TODO: Check DB and Redis connections
    return c.json({ status: "ready" });
  });

  // tRPC routes for Admin API
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
  
  // Customer auth routes
  api.route("/auth", authRoutes);
  
  // Admin auth routes
  api.route("/admin/auth", adminAuthRoutes);
  
  // Public storefront routes
  api.route("/products", productRoutes);
  api.route("/categories", categoryRoutes);
  api.route("/cart", cartRoutes);
  api.route("/checkout", checkoutRoutes);
  
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
