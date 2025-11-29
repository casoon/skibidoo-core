import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { QUEUE_NAMES, queues } from "./queues";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Schedule definitions
const SCHEDULES = {
  // Cleanup expired carts every hour
  cleanupCarts: {
    queue: QUEUE_NAMES.CLEANUP,
    name: "expired_carts",
    pattern: "0 * * * *", // Every hour
    data: { type: "expired_carts" },
  },
  
  // Check low stock every 6 hours
  lowStockCheck: {
    queue: QUEUE_NAMES.STOCK,
    name: "low_stock_alert",
    pattern: "0 */6 * * *", // Every 6 hours
    data: { type: "low_stock_alert" },
  },
  
  // Sync stock daily at 3am
  stockSync: {
    queue: QUEUE_NAMES.STOCK,
    name: "sync",
    pattern: "0 3 * * *", // Daily at 3am
    data: { type: "sync" },
  },
  
  // Cleanup old sessions weekly
  cleanupSessions: {
    queue: QUEUE_NAMES.CLEANUP,
    name: "old_sessions",
    pattern: "0 4 * * 0", // Sunday at 4am
    data: { type: "old_sessions" },
  },
  
  // Cleanup temp files daily
  cleanupTempFiles: {
    queue: QUEUE_NAMES.CLEANUP,
    name: "temp_files",
    pattern: "0 5 * * *", // Daily at 5am
    data: { type: "temp_files" },
  },
} as const;

export async function startScheduler() {
  logger.info("Starting scheduler");
  
  // Set up repeatable jobs
  for (const [key, schedule] of Object.entries(SCHEDULES)) {
    const queue = queues[schedule.queue as keyof typeof queues];
    
    // Remove existing repeatable job if exists
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.name === schedule.name) {
        await queue.removeRepeatableByKey(job.key);
        logger.info({ name: schedule.name }, "Removed existing scheduled job");
      }
    }
    
    // Add new repeatable job
    await queue.add(
      schedule.name,
      schedule.data,
      {
        repeat: { pattern: schedule.pattern },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    
    logger.info({ 
      name: schedule.name, 
      pattern: schedule.pattern,
      queue: schedule.queue,
    }, "Scheduled job added");
  }
  
  logger.info({ jobCount: Object.keys(SCHEDULES).length }, "Scheduler started");
}

export async function stopScheduler() {
  logger.info("Stopping scheduler");
  await connection.quit();
  logger.info("Scheduler stopped");
}

// List all scheduled jobs
export async function listScheduledJobs() {
  const allJobs: Array<{ queue: string; name: string; pattern: string; next: Date | null }> = [];
  
  for (const [queueName, queue] of Object.entries(queues)) {
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      allJobs.push({
        queue: queueName,
        name: job.name || "unknown",
        pattern: job.pattern || "unknown",
        next: job.next ? new Date(job.next) : null,
      });
    }
  }
  
  return allJobs;
}
