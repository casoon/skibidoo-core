import { Job } from "bullmq";
import { eq, lt, and } from "drizzle-orm";
import { logger } from "@/config/logger";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { StockJobData } from "../queues";
import { addEmailJob } from "../queues";

export async function processStockJob(job: Job<StockJobData>) {
  const log = logger.child({ jobId: job.id, jobName: job.name });
  log.info({ type: job.data.type }, "Processing stock job");
  
  try {
    const { type, productId } = job.data;
    
    switch (type) {
      case "sync":
        await syncStock(log);
        break;
        
      case "low_stock_alert":
        await checkLowStock(log);
        break;
        
      case "restock":
        if (productId) {
          await restockProduct(log, productId);
        }
        break;
        
      default:
        log.warn({ type }, "Unknown stock job type");
    }
    
    return { success: true };
    
  } catch (error) {
    log.error({ error }, "Stock job failed");
    throw error;
  }
}

async function syncStock(log: typeof logger) {
  log.info("Syncing stock levels");
  
  // TODO: Sync with external inventory system
  // - Fetch current stock from ERP/warehouse
  // - Update local database
  // - Handle discrepancies
  
  log.info("Stock sync completed");
}

async function checkLowStock(log: typeof logger) {
  log.info("Checking for low stock products");
  
  // Find products below threshold
  const lowStockProducts = await db.query.products.findMany({
    where: and(
      eq(products.trackInventory, true),
      eq(products.status, "active")
    ),
  });
  
  // Filter in memory for now (would use SQL in production)
  const alerts = lowStockProducts.filter(
    (p) => p.lowStockThreshold && p.stockQuantity <= p.lowStockThreshold
  );
  
  if (alerts.length > 0) {
    log.warn({ count: alerts.length }, "Low stock products found");
    
    // TODO: Send alert email to admin
    // await addEmailJob({
    //   type: "low_stock_alert",
    //   to: "admin@example.com",
    //   subject: "Low Stock Alert",
    //   templateId: "low-stock",
    //   templateData: { products: alerts },
    // });
  }
  
  log.info("Low stock check completed");
}

async function restockProduct(log: typeof logger, productId: string) {
  log.info({ productId }, "Processing restock");
  
  // TODO: Integrate with supplier API for automatic reordering
  
  log.info("Restock processed");
}
