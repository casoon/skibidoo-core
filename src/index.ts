import { serve } from "@hono/node-server";
import { env, logger } from "./config/index.js";
import { createApp } from "./api/app.js";

async function main() {
  const mode = env.MODE;

  logger.info({ mode, nodeEnv: env.NODE_ENV }, "Starting skibidoo-core");

  switch (mode) {
    case "api":
      await startApiServer();
      break;
    case "worker":
      await startWorker();
      break;
    case "scheduler":
      await startScheduler();
      break;
  }
}

async function startApiServer() {
  const app = createApp();
  const port = env.PORT;

  serve({
    fetch: app.fetch,
    port,
  });

  logger.info({ port }, "API server listening");
}

async function startWorker() {
  logger.info("Worker mode - not yet implemented");
  // TODO: BullMQ worker setup
}

async function startScheduler() {
  logger.info("Scheduler mode - not yet implemented");
  // TODO: Cron scheduler setup
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
