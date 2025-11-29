import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { trpcServer } from "@hono/trpc-server";
import { env, logger } from "../config/index.js";
import { db } from "../db/index.js";
import { appRouter, createContext } from "../trpc/index.js";
import { productRoutes } from "./routes/products.js";
import { categoryRoutes } from "./routes/categories.js";
import { cartRoutes } from "./routes/cart.js";
import { checkoutRoutes } from "./routes/checkout.js";

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

  // REST API routes for Storefront
  const api = new Hono();
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
