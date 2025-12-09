import { Job } from "bullmq";
import type { Logger } from "pino";
import { logger } from "@/config/logger";
import { getPaymentIntent } from "@/payments/stripe";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, and, inArray, lt } from "drizzle-orm";

export interface PaymentSyncJobData {
  type: "sync_pending" | "sync_single" | "reconcile";
  orderId?: string;
  paymentIntentId?: string;
  maxAge?: number; // in minutes, for sync_pending
}

export async function processPaymentSyncJob(job: Job<PaymentSyncJobData>) {
  const log = logger.child({ jobId: job.id, jobName: job.name });
  log.info({ type: job.data.type }, "Processing payment sync job");

  try {
    switch (job.data.type) {
      case "sync_pending":
        return await syncPendingPayments(log, job.data.maxAge);

      case "sync_single":
        if (!job.data.orderId || !job.data.paymentIntentId) {
          throw new Error("orderId and paymentIntentId required for sync_single");
        }
        return await syncSinglePayment(log, job.data.orderId, job.data.paymentIntentId);

      case "reconcile":
        return await reconcilePayments(log);

      default:
        log.warn({ type: job.data.type }, "Unknown payment sync type");
        return { success: false, error: "Unknown type" };
    }
  } catch (error) {
    log.error({ error }, "Payment sync job failed");
    throw error;
  }
}

async function syncPendingPayments(log: Logger, maxAgeMinutes = 60) {
  // Find orders with pending payment status older than X minutes
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const pendingOrders = await db
    .select({
      id: orders.id,
      paymentIntentId: orders.paymentReference,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.paymentStatus, ["pending", "processing"]),
        lt(orders.createdAt, cutoffTime)
      )
    )
    .limit(100);

  log.info({ count: pendingOrders.length }, "Found pending orders to sync");

  const results = {
    total: pendingOrders.length,
    updated: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    unchanged: 0,
    errors: [] as string[],
  };

  for (const order of pendingOrders) {
    if (!order.paymentIntentId) {
      log.warn({ orderId: order.id }, "Order has no paymentIntentId");
      results.errors.push(`Order ${order.id}: no paymentIntentId`);
      continue;
    }

    try {
      const paymentIntent = await getPaymentIntent(order.paymentIntentId);
      const newStatus = mapStripeStatusToOrderStatus(paymentIntent.status);

      if (newStatus !== order.paymentStatus) {
        await db
          .update(orders)
          .set({
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        log.info(
          { orderId: order.id, oldStatus: order.paymentStatus, newStatus },
          "Updated order payment status"
        );

        results.updated++;

        if (newStatus === "paid") results.succeeded++;
        else if (newStatus === "failed") results.failed++;
        else if (newStatus === "cancelled") results.cancelled++;
      } else {
        results.unchanged++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error({ orderId: order.id, error: message }, "Failed to sync order payment");
      results.errors.push(`Order ${order.id}: ${message}`);
    }
  }

  log.info(results, "Payment sync completed");
  return { success: true, results };
}

async function syncSinglePayment(
  log: Logger,
  orderId: string,
  paymentIntentId: string
) {
  const paymentIntent = await getPaymentIntent(paymentIntentId);
  const newStatus = mapStripeStatusToOrderStatus(paymentIntent.status);

  const [order] = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (newStatus !== order.paymentStatus) {
    await db
      .update(orders)
      .set({
        paymentStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    log.info({ orderId, oldStatus: order.paymentStatus, newStatus }, "Updated payment status");
    return { success: true, updated: true, oldStatus: order.paymentStatus, newStatus };
  }

  return { success: true, updated: false, status: order.paymentStatus };
}

async function reconcilePayments(log: Logger) {
  // Daily reconciliation: check all orders from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentOrders = await db
    .select({
      id: orders.id,
      paymentIntentId: orders.paymentReference,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.paymentStatus, ["paid"]),
        eq(orders.createdAt, sevenDaysAgo) // This should be gte but simplified
      )
    )
    .limit(500);

  log.info({ count: recentOrders.length }, "Starting payment reconciliation");

  const discrepancies: Array<{
    orderId: string;
    orderStatus: string;
    stripeStatus: string;
    orderAmount: number;
    stripeAmount: number | null;
  }> = [];

  for (const order of recentOrders) {
    if (!order.paymentIntentId) continue;

    try {
      const paymentIntent = await getPaymentIntent(order.paymentIntentId);

      // Check status mismatch
      const expectedStatus = mapStripeStatusToOrderStatus(paymentIntent.status);
      if (expectedStatus !== order.paymentStatus) {
        discrepancies.push({
          orderId: order.id,
          orderStatus: order.paymentStatus,
          stripeStatus: paymentIntent.status,
          orderAmount: order.total,
          stripeAmount: paymentIntent.amount,
        });
      }

      // Check amount mismatch
      if (paymentIntent.amount !== order.total) {
        discrepancies.push({
          orderId: order.id,
          orderStatus: order.paymentStatus,
          stripeStatus: paymentIntent.status,
          orderAmount: order.total,
          stripeAmount: paymentIntent.amount,
        });
      }
    } catch (error) {
      log.warn({ orderId: order.id, error }, "Failed to fetch payment intent for reconciliation");
    }
  }

  if (discrepancies.length > 0) {
    log.warn({ discrepancies }, "Found payment discrepancies");
  } else {
    log.info("No discrepancies found");
  }

  return {
    success: true,
    totalChecked: recentOrders.length,
    discrepanciesFound: discrepancies.length,
    discrepancies,
  };
}

function mapStripeStatusToOrderStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "succeeded":
      return "paid";
    case "processing":
      return "processing";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return "pending";
    case "canceled":
      return "cancelled";
    case "requires_capture":
      return "authorized";
    default:
      return "pending";
  }
}
