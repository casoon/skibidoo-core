import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

// Redis connection for BullMQ (only if REDIS_URL is configured)
let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is required for job queues. Set REDIS_URL or use MODE=api.",
    );
  }
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

// Queue names
export const QUEUE_NAMES = {
  EMAIL: "email",
  INVOICE: "invoice",
  STOCK: "stock",
  IMPORT: "import",
  CLEANUP: "cleanup",
  PAYMENT: "payment",
  REPORTS: "reports",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Lazy-initialized queues (only created when Redis is available)
type Queues = {
  email: Queue;
  invoice: Queue;
  stock: Queue;
  import: Queue;
  cleanup: Queue;
  payment: Queue;
  reports: Queue;
};

let _queues: Queues | null = null;

export function getQueues(): Queues {
  if (!_queues) {
    const conn = getConnection();
    _queues = {
      email: new Queue(QUEUE_NAMES.EMAIL, { connection: conn }),
      invoice: new Queue(QUEUE_NAMES.INVOICE, { connection: conn }),
      stock: new Queue(QUEUE_NAMES.STOCK, { connection: conn }),
      import: new Queue(QUEUE_NAMES.IMPORT, { connection: conn }),
      cleanup: new Queue(QUEUE_NAMES.CLEANUP, { connection: conn }),
      payment: new Queue(QUEUE_NAMES.PAYMENT, { connection: conn }),
      reports: new Queue(QUEUE_NAMES.REPORTS, { connection: conn }),
    };
  }
  return _queues;
}

// Legacy export for backwards compatibility (lazy proxy)
export const queues = new Proxy({} as Queues, {
  get(_, prop: keyof Queues) {
    return getQueues()[prop];
  },
});

// Job data types
export interface EmailJobData {
  type:
    | "order_confirmation"
    | "shipping_notification"
    | "password_reset"
    | "welcome"
    | "marketing";
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

export interface PaymentSyncJobData {
  type: "sync_pending" | "sync_single" | "reconcile";
  orderId?: string;
  paymentIntentId?: string;
  maxAge?: number;
}

export interface ReportsJobData {
  type: "daily" | "weekly" | "monthly";
  date?: string;
  recipients?: string[];
}

// Add job helper functions
export async function addEmailJob(
  data: EmailJobData,
  opts?: { delay?: number; priority?: number },
) {
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

export async function addPaymentSyncJob(data: PaymentSyncJobData) {
  return queues.payment.add(data.type, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
  });
}

export async function addReportsJob(data: ReportsJobData) {
  return queues.reports.add(data.type, data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 60000 },
  });
}

// Graceful shutdown
export async function closeQueues() {
  if (_queues) {
    await Promise.all(Object.values(_queues).map((q) => q.close()));
  }
  if (connection) {
    await connection.quit();
  }
}
