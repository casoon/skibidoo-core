import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

// Redis connection for BullMQ
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
  EMAIL: "email",
  INVOICE: "invoice",
  STOCK: "stock",
  IMPORT: "import",
  CLEANUP: "cleanup",
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Create queues
export const queues = {
  email: new Queue(QUEUE_NAMES.EMAIL, { connection }),
  invoice: new Queue(QUEUE_NAMES.INVOICE, { connection }),
  stock: new Queue(QUEUE_NAMES.STOCK, { connection }),
  import: new Queue(QUEUE_NAMES.IMPORT, { connection }),
  cleanup: new Queue(QUEUE_NAMES.CLEANUP, { connection }),
};

// Job data types
export interface EmailJobData {
  type: "order_confirmation" | "shipping_notification" | "password_reset" | "welcome" | "marketing";
  to: string;
  subject: string;
  templateId: string;
  templateData: Record<string, unknown>;
}

export interface InvoiceJobData {
  orderId: string;
  invoiceId: string;
}

export interface StockJobData {
  type: "sync" | "low_stock_alert" | "restock";
  productId?: string;
}

export interface ImportJobData {
  type: "products" | "customers" | "orders";
  source: "csv" | "woocommerce" | "shopify" | "amazon" | "ebay";
  fileUrl?: string;
  config: Record<string, unknown>;
}

export interface CleanupJobData {
  type: "expired_carts" | "old_sessions" | "temp_files";
}

// Add job helper functions
export async function addEmailJob(data: EmailJobData, opts?: { delay?: number; priority?: number }) {
  return queues.email.add("send", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    ...opts,
  });
}

export async function addInvoiceJob(data: InvoiceJobData) {
  return queues.invoice.add("generate", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
  });
}

export async function addStockJob(data: StockJobData) {
  return queues.stock.add(data.type, data, {
    attempts: 2,
  });
}

export async function addImportJob(data: ImportJobData) {
  return queues.import.add(data.type, data, {
    attempts: 1,
  });
}

export async function addCleanupJob(data: CleanupJobData) {
  return queues.cleanup.add(data.type, data, {
    attempts: 1,
  });
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await connection.quit();
}
