import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { env, logger } from "../config/index.js";

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

  app.get("/health/ready", (c) => {
    // TODO: Check DB and Redis connections
    return c.json({ status: "ready" });
  });

  // REST API routes
  app.route("/api/v1", createRestRouter());

  // tRPC routes (placeholder)
  // app.route("/trpc", createTrpcRouter());

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

  // Products
  router.get("/products", (c) => {
    return c.json({ data: [], pagination: { page: 1, size: 20, total: 0, totalPages: 0 } });
  });

  router.get("/products/:slug", (c) => {
    const slug = c.req.param("slug");
    return c.json({ data: null, message: "Product not found" }, 404);
  });

  // Categories
  router.get("/categories", (c) => {
    return c.json({ data: [] });
  });

  return router;
}
