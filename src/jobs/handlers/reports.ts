import { Job } from "bullmq";
import { logger } from "@/config/logger";
import { db } from "@/db";
import { orders, customers, products } from "@/db/schema";
import { eq, and, gte, lte, sql, count, sum } from "drizzle-orm";
import type { ReportsJobData } from "../queues";

export async function processReportsJob(job: Job<ReportsJobData>) {
  const log = logger.child({ jobId: job.id, jobName: job.name });
  log.info({ type: job.data.type }, "Processing reports job");

  try {
    switch (job.data.type) {
      case "daily":
        return await generateDailyReport(log, job.data.date);

      case "weekly":
        return await generateWeeklyReport(log, job.data.date);

      case "monthly":
        return await generateMonthlyReport(log, job.data.date);

      default:
        log.warn({ type: job.data.type }, "Unknown report type");
        return { success: false, error: "Unknown type" };
    }
  } catch (error) {
    log.error({ error }, "Reports job failed");
    throw error;
  }
}

interface ReportData {
  period: { start: Date; end: Date };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  revenue: {
    gross: number;
    net: number;
    shipping: number;
    discounts: number;
  };
  customers: {
    new: number;
    returning: number;
  };
  products: {
    topSelling: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    lowStock: Array<{ productId: string; name: string; stock: number }>;
  };
  averageOrderValue: number;
}

async function generateDailyReport(log: ReturnType<typeof logger.child>, dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  log.info({ date: startOfDay.toISOString() }, "Generating daily report");

  const report = await generateReport(startOfDay, endOfDay);

  log.info({
    orders: report.orders.total,
    revenue: report.revenue.gross,
    newCustomers: report.customers.new,
  }, "Daily report generated");

  // TODO: Send report via email or store in database
  // await sendReportEmail(report, job.data.recipients);

  return { success: true, report };
}

async function generateWeeklyReport(log: ReturnType<typeof logger.child>, dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  
  // Get start of week (Monday)
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Get end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  log.info({ start: startOfWeek.toISOString(), end: endOfWeek.toISOString() }, "Generating weekly report");

  const report = await generateReport(startOfWeek, endOfWeek);

  log.info({
    orders: report.orders.total,
    revenue: report.revenue.gross,
    newCustomers: report.customers.new,
  }, "Weekly report generated");

  return { success: true, report };
}

async function generateMonthlyReport(log: ReturnType<typeof logger.child>, dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  
  // Get start of month
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  
  // Get end of month
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  log.info({ start: startOfMonth.toISOString(), end: endOfMonth.toISOString() }, "Generating monthly report");

  const report = await generateReport(startOfMonth, endOfMonth);

  log.info({
    orders: report.orders.total,
    revenue: report.revenue.gross,
    newCustomers: report.customers.new,
  }, "Monthly report generated");

  return { success: true, report };
}

async function generateReport(startDate: Date, endDate: Date): Promise<ReportData> {
  // Order statistics
  const orderStats = await db
    .select({
      total: count(),
      completed: sql<number>`COUNT(CASE WHEN ${orders.status} = 'completed' THEN 1 END)`,
      cancelled: sql<number>`COUNT(CASE WHEN ${orders.status} = 'cancelled' THEN 1 END)`,
      pending: sql<number>`COUNT(CASE WHEN ${orders.status} = 'pending' THEN 1 END)`,
      grossRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      shipping: sql<number>`COALESCE(SUM(${orders.shippingCost}), 0)`,
      discounts: sql<number>`COALESCE(SUM(${orders.discountAmount}), 0)`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      )
    );

  const stats = orderStats[0] || {
    total: 0,
    completed: 0,
    cancelled: 0,
    pending: 0,
    grossRevenue: 0,
    shipping: 0,
    discounts: 0,
  };

  // New customers
  const newCustomerCount = await db
    .select({ count: count() })
    .from(customers)
    .where(
      and(
        gte(customers.createdAt, startDate),
        lte(customers.createdAt, endDate)
      )
    );

  // Low stock products
  const lowStockProducts = await db
    .select({
      productId: products.id,
      name: products.name,
      stock: products.stock,
    })
    .from(products)
    .where(lte(products.stock, 10))
    .orderBy(products.stock)
    .limit(10);

  const grossRevenue = Number(stats.grossRevenue) || 0;
  const shippingTotal = Number(stats.shipping) || 0;
  const discountsTotal = Number(stats.discounts) || 0;
  const orderCount = Number(stats.total) || 0;

  return {
    period: { start: startDate, end: endDate },
    orders: {
      total: orderCount,
      completed: Number(stats.completed) || 0,
      cancelled: Number(stats.cancelled) || 0,
      pending: Number(stats.pending) || 0,
    },
    revenue: {
      gross: grossRevenue,
      net: grossRevenue - shippingTotal - discountsTotal,
      shipping: shippingTotal,
      discounts: discountsTotal,
    },
    customers: {
      new: newCustomerCount[0]?.count || 0,
      returning: 0, // TODO: Calculate returning customers
    },
    products: {
      topSelling: [], // TODO: Calculate from order_items
      lowStock: lowStockProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        stock: p.stock,
      })),
    },
    averageOrderValue: orderCount > 0 ? grossRevenue / orderCount : 0,
  };
}
