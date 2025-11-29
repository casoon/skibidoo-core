// Webhook Types
// src/webhooks/types.ts

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  description?: string;
  headers?: Record<string, string>;
  retryCount: number;
  retryDelayMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEventType =
  // Order events
  | "order.created"
  | "order.updated"
  | "order.paid"
  | "order.shipped"
  | "order.delivered"
  | "order.cancelled"
  | "order.refunded"
  // Product events
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.out_of_stock"
  | "product.back_in_stock"
  // Customer events
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  // Inventory events
  | "inventory.low_stock"
  | "inventory.out_of_stock"
  | "inventory.adjusted"
  // Payment events
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  // Subscription events
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: WebhookEventType;
  url: string;
  requestBody: string;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  status: "pending" | "success" | "failed" | "retrying";
  duration?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CreateEndpointInput {
  url: string;
  events: WebhookEventType[];
  description?: string;
  headers?: Record<string, string>;
  active?: boolean;
}

export interface UpdateEndpointInput {
  id: string;
  url?: string;
  events?: WebhookEventType[];
  description?: string;
  headers?: Record<string, string>;
  active?: boolean;
}
