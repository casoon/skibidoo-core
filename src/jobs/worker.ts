import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { QUEUE_NAMES } from "./queues";
import { processEmailJob } from "./handlers/email";
import { processInvoiceJob } from "./handlers/invoice";
import { processStockJob } from "./handlers/stock";
import { processCleanupJob } from "./handlers/cleanup";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const workers: Worker[] = [];

export async function startWorkers() {
  logger.info("Starting workers");
  
  // Email worker
  const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    processEmailJob,
    { 
      connection,
      concurrency: 5,
    }
  );
  emailWorker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Email job completed");
  });
  emailWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "Email job failed");
  });
  workers.push(emailWorker);
  
  // Invoice worker
  const invoiceWorker = new Worker(
    QUEUE_NAMES.INVOICE,
    processInvoiceJob,
    { 
      connection,
      concurrency: 2,
    }
  );
  invoiceWorker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Invoice job completed");
  });
  invoiceWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "Invoice job failed");
  });
  workers.push(invoiceWorker);
  
  // Stock worker
  const stockWorker = new Worker(
    QUEUE_NAMES.STOCK,
    processStockJob,
    { 
      connection,
      concurrency: 1,
    }
  );
  stockWorker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Stock job completed");
  });
  stockWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "Stock job failed");
  });
  workers.push(stockWorker);
  
  // Cleanup worker
  const cleanupWorker = new Worker(
    QUEUE_NAMES.CLEANUP,
    processCleanupJob,
    { 
      connection,
      concurrency: 1,
    }
  );
  cleanupWorker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Cleanup job completed");
  });
  cleanupWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "Cleanup job failed");
  });
  workers.push(cleanupWorker);
  
  logger.info({ workerCount: workers.length }, "Workers started");
}

export async function stopWorkers() {
  logger.info("Stopping workers");
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  logger.info("Workers stopped");
}
