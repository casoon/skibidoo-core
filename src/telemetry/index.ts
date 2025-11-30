// Telemetry Module Index
// src/telemetry/index.ts

export { initTracing, shutdownTracing } from "./tracing.js";

// Metrics
export {
  metricsRegistry,
  getMetrics,
  getMetricsJSON,
  // Business metrics
  ordersTotal,
  orderValue,
  productsViewed,
  cartAdditions,
  paymentAttempts,
  // API metrics
  httpRequestDuration,
  httpRequestsTotal,
  // Database metrics
  dbQueryDuration,
  // Cache metrics
  cacheHits,
  cacheMisses,
  // Queue metrics
  jobsProcessed,
  jobDuration,
  // Gauges
  activeUsers,
  lowStockProducts,
} from "./metrics.js";
