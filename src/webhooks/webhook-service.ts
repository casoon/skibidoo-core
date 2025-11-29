// Webhook Service
// src/webhooks/webhook-service.ts

import { createHmac } from "crypto";
import type {
  WebhookEndpoint,
  WebhookEvent,
  WebhookDelivery,
  WebhookEventType,
  WebhookPayload,
  CreateEndpointInput,
  UpdateEndpointInput,
} from "./types.js";

// In-memory store (replace with database in production)
const endpoints = new Map<string, WebhookEndpoint>();
const deliveries: WebhookDelivery[] = [];
const eventQueue: WebhookEvent[] = [];

function generateId(): string {
  return crypto.randomUUID();
}

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "whsec_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export const webhookService = {
  // Create webhook endpoint
  async createEndpoint(input: CreateEndpointInput): Promise<WebhookEndpoint> {
    const endpoint: WebhookEndpoint = {
      id: generateId(),
      url: input.url,
      secret: generateSecret(),
      events: input.events,
      active: input.active ?? true,
      description: input.description,
      headers: input.headers,
      retryCount: 3,
      retryDelayMs: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    endpoints.set(endpoint.id, endpoint);
    return endpoint;
  },

  // Update webhook endpoint
  async updateEndpoint(input: UpdateEndpointInput): Promise<WebhookEndpoint> {
    const endpoint = endpoints.get(input.id);
    if (!endpoint) {
      throw new Error("Webhook endpoint not found");
    }

    Object.assign(endpoint, {
      url: input.url ?? endpoint.url,
      events: input.events ?? endpoint.events,
      description: input.description ?? endpoint.description,
      headers: input.headers ?? endpoint.headers,
      active: input.active ?? endpoint.active,
      updatedAt: new Date(),
    });

    return endpoint;
  },

  // Delete webhook endpoint
  async deleteEndpoint(id: string): Promise<void> {
    endpoints.delete(id);
  },

  // Get endpoint by ID
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return endpoints.get(id) || null;
  },

  // Get all endpoints
  async getAllEndpoints(): Promise<WebhookEndpoint[]> {
    return Array.from(endpoints.values());
  },

  // Regenerate secret
  async regenerateSecret(id: string): Promise<string> {
    const endpoint = endpoints.get(id);
    if (!endpoint) {
      throw new Error("Webhook endpoint not found");
    }

    endpoint.secret = generateSecret();
    endpoint.updatedAt = new Date();
    return endpoint.secret;
  },

  // Emit webhook event
  async emit(type: WebhookEventType, data: Record<string, unknown>): Promise<void> {
    const event: WebhookEvent = {
      id: generateId(),
      type,
      data,
      timestamp: new Date(),
    };

    eventQueue.push(event);

    // Find all endpoints subscribed to this event
    const subscribedEndpoints = Array.from(endpoints.values()).filter(
      e => e.active && e.events.includes(type)
    );

    // Queue deliveries
    for (const endpoint of subscribedEndpoints) {
      await this.queueDelivery(endpoint, event);
    }

    // Process queue (in production, use job queue)
    await this.processDeliveryQueue();
  },

  // Queue delivery for an endpoint
  async queueDelivery(endpoint: WebhookEndpoint, event: WebhookEvent): Promise<WebhookDelivery> {
    const payload: WebhookPayload = {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      data: event.data,
    };

    const delivery: WebhookDelivery = {
      id: generateId(),
      endpointId: endpoint.id,
      eventId: event.id,
      eventType: event.type,
      url: endpoint.url,
      requestBody: JSON.stringify(payload),
      attempts: 0,
      maxAttempts: endpoint.retryCount + 1,
      status: "pending",
      createdAt: new Date(),
    };

    deliveries.push(delivery);
    return delivery;
  },

  // Process delivery queue
  async processDeliveryQueue(): Promise<void> {
    const pendingDeliveries = deliveries.filter(
      d => d.status === "pending" || (d.status === "retrying" && d.nextRetryAt && d.nextRetryAt <= new Date())
    );

    for (const delivery of pendingDeliveries) {
      await this.sendDelivery(delivery);
    }
  },

  // Send a single delivery
  async sendDelivery(delivery: WebhookDelivery): Promise<void> {
    const endpoint = endpoints.get(delivery.endpointId);
    if (!endpoint) {
      delivery.status = "failed";
      delivery.error = "Endpoint not found";
      return;
    }

    delivery.attempts++;
    const startTime = Date.now();

    try {
      // Generate signature
      const signature = this.generateSignature(delivery.requestBody, endpoint.secret);

      const response = await fetch(delivery.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Id": delivery.id,
          "X-Webhook-Timestamp": new Date().toISOString(),
          ...endpoint.headers,
        },
        body: delivery.requestBody,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      delivery.duration = Date.now() - startTime;
      delivery.responseStatus = response.status;

      try {
        delivery.responseBody = await response.text();
      } catch {
        delivery.responseBody = "";
      }

      if (response.ok) {
        delivery.status = "success";
        delivery.completedAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      delivery.duration = Date.now() - startTime;
      delivery.error = (error as Error).message;

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = "failed";
        delivery.completedAt = new Date();
      } else {
        delivery.status = "retrying";
        // Exponential backoff
        const delay = endpoint.retryDelayMs * Math.pow(2, delivery.attempts - 1);
        delivery.nextRetryAt = new Date(Date.now() + delay);
      }
    }
  },

  // Generate HMAC signature
  generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    return `t=${timestamp},v1=${signature}`;
  },

  // Verify webhook signature (for incoming webhooks)
  verifySignature(payload: string, signature: string, secret: string, tolerance: number = 300): boolean {
    const parts = signature.split(",");
    const timestampPart = parts.find(p => p.startsWith("t="));
    const signaturePart = parts.find(p => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const expectedSig = signaturePart.slice(3);

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Verify signature
    const signedPayload = `${timestamp}.${payload}`;
    const computedSig = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return computedSig === expectedSig;
  },

  // Get delivery history
  async getDeliveries(options?: {
    endpointId?: string;
    eventType?: WebhookEventType;
    status?: WebhookDelivery["status"];
    limit?: number;
  }): Promise<WebhookDelivery[]> {
    let result = [...deliveries];

    if (options?.endpointId) {
      result = result.filter(d => d.endpointId === options.endpointId);
    }
    if (options?.eventType) {
      result = result.filter(d => d.eventType === options.eventType);
    }
    if (options?.status) {
      result = result.filter(d => d.status === options.status);
    }

    return result
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, options?.limit ?? 100);
  },

  // Retry failed delivery
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) {
      throw new Error("Delivery not found");
    }

    delivery.status = "pending";
    delivery.attempts = 0;
    delivery.error = undefined;
    delivery.nextRetryAt = undefined;

    await this.sendDelivery(delivery);
  },

  // Test endpoint
  async testEndpoint(id: string): Promise<WebhookDelivery> {
    const endpoint = endpoints.get(id);
    if (!endpoint) {
      throw new Error("Endpoint not found");
    }

    const testEvent: WebhookEvent = {
      id: generateId(),
      type: "order.created",
      data: {
        test: true,
        message: "This is a test webhook",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    const delivery = await this.queueDelivery(endpoint, testEvent);
    await this.sendDelivery(delivery);

    return delivery;
  },
};

// Event emitter helpers
export const webhookEvents = {
  orderCreated: (order: Record<string, unknown>) => webhookService.emit("order.created", order),
  orderUpdated: (order: Record<string, unknown>) => webhookService.emit("order.updated", order),
  orderPaid: (order: Record<string, unknown>) => webhookService.emit("order.paid", order),
  orderShipped: (order: Record<string, unknown>) => webhookService.emit("order.shipped", order),
  orderDelivered: (order: Record<string, unknown>) => webhookService.emit("order.delivered", order),
  orderCancelled: (order: Record<string, unknown>) => webhookService.emit("order.cancelled", order),
  orderRefunded: (order: Record<string, unknown>) => webhookService.emit("order.refunded", order),
  
  productCreated: (product: Record<string, unknown>) => webhookService.emit("product.created", product),
  productUpdated: (product: Record<string, unknown>) => webhookService.emit("product.updated", product),
  productDeleted: (product: Record<string, unknown>) => webhookService.emit("product.deleted", product),
  productOutOfStock: (product: Record<string, unknown>) => webhookService.emit("product.out_of_stock", product),
  productBackInStock: (product: Record<string, unknown>) => webhookService.emit("product.back_in_stock", product),
  
  customerCreated: (customer: Record<string, unknown>) => webhookService.emit("customer.created", customer),
  customerUpdated: (customer: Record<string, unknown>) => webhookService.emit("customer.updated", customer),
  customerDeleted: (customer: Record<string, unknown>) => webhookService.emit("customer.deleted", customer),
  
  inventoryLowStock: (item: Record<string, unknown>) => webhookService.emit("inventory.low_stock", item),
  inventoryOutOfStock: (item: Record<string, unknown>) => webhookService.emit("inventory.out_of_stock", item),
  inventoryAdjusted: (item: Record<string, unknown>) => webhookService.emit("inventory.adjusted", item),
  
  paymentSucceeded: (payment: Record<string, unknown>) => webhookService.emit("payment.succeeded", payment),
  paymentFailed: (payment: Record<string, unknown>) => webhookService.emit("payment.failed", payment),
  paymentRefunded: (payment: Record<string, unknown>) => webhookService.emit("payment.refunded", payment),
};
