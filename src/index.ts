// Initialize tracing before other imports
import { initTracing, shutdownTracing } from "@/telemetry";
initTracing();

import { serve } from "@hono/node-server";
import { env, logger } from "@/config";
import { createApp } from "@/api/app";
import { closeDatabase } from "@/db";
import { 
  startWorkers, 
  stopWorkers, 
  startScheduler as initScheduler, 
  stopScheduler,
  closeQueues,
} from "@/jobs";

let isShuttingDown = false;

async function main() {
  const mode = env.MODE;

  logger.info({ mode, nodeEnv: env.NODE_ENV }, "Starting skibidoo-core");

  switch (mode) {
    case "api":
      await startApiServer();
      break;
    case "worker":
      await startWorkerMode();
      break;
    case "scheduler":
      await startSchedulerMode();
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

async function startWorkerMode() {
  logger.info("Starting in worker mode");
  
  await startWorkers();
  
  logger.info("Worker mode running - processing jobs");
  
  // Keep process alive
  await new Promise(() => {});
}

async function startSchedulerMode() {
  logger.info("Starting in scheduler mode");
  
  await initScheduler();
  
  // Also start workers to process scheduled jobs
  await startWorkers();
  
  logger.info("Scheduler mode running - scheduling and processing jobs");
  
  // Keep process alive
  await new Promise(() => {});
}

// Graceful shutdown
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info({ signal }, "Shutting down gracefully");
  
  try {
    const mode = env.MODE;
    
    if (mode === "worker" || mode === "scheduler") {
      await stopWorkers();
      if (mode === "scheduler") {
        await stopScheduler();
      }
      await closeQueues();
    }
    
    await shutdownTracing();
    await closeDatabase();
    
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
