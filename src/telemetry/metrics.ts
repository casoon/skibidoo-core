// Custom Metrics Service
// src/telemetry/metrics.ts

import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";
import { env } from "@/config";

// Create a custom registry
export const metricsRegistry = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register: metricsRegistry });

// Business Metrics

// Orders
export const ordersTotal = new Counter({
  name: "skibidoo_orders_total",
  help: "Total number of orders",
  labelNames: ["status", "payment_method"],
  registers: [metricsRegistry],
});

export const orderValue = new Histogram({
  name: "skibidoo_order_value_cents",
  help: "Order value in cents",
  labelNames: ["currency"],
  buckets: [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
  registers: [metricsRegistry],
});

// Products
export const productsViewed = new Counter({
  name: "skibidoo_products_viewed_total",
  help: "Total product page views",
  labelNames: ["product_id", "category"],
  registers: [metricsRegistry],
});

export const cartAdditions = new Counter({
  name: "skibidoo_cart_additions_total",
  help: "Total items added to cart",
  labelNames: ["product_id"],
  registers: [metricsRegistry],
});

// Payments
export const paymentAttempts = new Counter({
  name: "skibidoo_payment_attempts_total",
  help: "Total payment attempts",
  labelNames: ["provider", "status"],
  registers: [metricsRegistry],
});

// API Metrics
export const httpRequestDuration = new Histogram({
  name: "skibidoo_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestsTotal = new Counter({
  name: "skibidoo_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: "skibidoo_db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [metricsRegistry],
});

// Cache Metrics
export const cacheHits = new Counter({
  name: "skibidoo_cache_hits_total",
  help: "Cache hit count",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

export const cacheMisses = new Counter({
  name: "skibidoo_cache_misses_total",
  help: "Cache miss count",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

// Queue Metrics
export const jobsProcessed = new Counter({
  name: "skibidoo_jobs_processed_total",
  help: "Total jobs processed",
  labelNames: ["queue", "status"],
  registers: [metricsRegistry],
});

export const jobDuration = new Histogram({
  name: "skibidoo_job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["queue", "job_type"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

// Active Users
export const activeUsers = new Gauge({
  name: "skibidoo_active_users",
  help: "Number of active users (sessions)",
  registers: [metricsRegistry],
});

// Inventory
export const lowStockProducts = new Gauge({
  name: "skibidoo_low_stock_products",
  help: "Number of products with low stock",
  registers: [metricsRegistry],
});

// Helper function to get all metrics
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

// Helper function to get metrics as JSON
export async function getMetricsJSON(): Promise<object> {
  return metricsRegistry.getMetricsAsJSON();
}
