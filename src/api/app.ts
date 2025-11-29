import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { trpcServer } from "@hono/trpc-server";
import { env, logger } from "../config/index.js";
import { db } from "../db/index.js";
import { appRouter, createContext } from "../trpc/index.js";

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
  app.route("/api/v1", createRestRouter());

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

function createRestRouter() {
  const router = new Hono();

  // Products (public storefront)
  router.get("/products", async (c) => {
    // TODO: Implement with db query
    return c.json({ data: [], pagination: { page: 1, size: 20, total: 0, totalPages: 0 } });
  });

  router.get("/products/:slug", async (c) => {
    const slug = c.req.param("slug");
    // TODO: Implement with db query
    return c.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
  });

  // Categories
  router.get("/categories", async (c) => {
    // TODO: Implement with db query
    return c.json({ data: [] });
  });

  router.get("/categories/:slug", async (c) => {
    const slug = c.req.param("slug");
    // TODO: Implement with db query
    return c.json({ error: { code: "NOT_FOUND", message: "Category not found" } }, 404);
  });

  // Cart
  router.post("/cart", async (c) => {
    // Create new cart
    return c.json({ data: { id: crypto.randomUUID(), items: [], total: 0 } }, 201);
  });

  router.get("/cart/:id", async (c) => {
    const id = c.req.param("id");
    // TODO: Implement
    return c.json({ data: { id, items: [], total: 0 } });
  });

  router.post("/cart/:id/items", async (c) => {
    const id = c.req.param("id");
    // TODO: Implement add to cart
    return c.json({ data: { id, items: [], total: 0 } });
  });

  // Checkout
  router.post("/checkout", async (c) => {
    // TODO: Implement checkout creation
    return c.json({ data: { checkoutUrl: "/checkout" } }, 201);
  });

  return router;
}
