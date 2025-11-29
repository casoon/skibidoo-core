import Stripe from "stripe";
import { getStripe } from "./stripe";

export type StripeWebhookEvent =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "payment_intent.canceled"
  | "charge.refunded"
  | "charge.dispute.created";

export interface WebhookHandlerResult {
  success: boolean;
  orderId?: string;
  action?: string;
  error?: string;
}

export type WebhookHandler = (
  event: Stripe.Event
) => Promise<WebhookHandlerResult>;

const webhookHandlers: Map<string, WebhookHandler> = new Map();

/**
 * Register a webhook handler for a specific event type
 */
export function registerWebhookHandler(
  eventType: StripeWebhookEvent,
  handler: WebhookHandler
): void {
  webhookHandlers.set(eventType, handler);
}

/**
 * Verify and parse a Stripe webhook event
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Process a verified webhook event
 */
export async function processWebhookEvent(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  const handler = webhookHandlers.get(event.type);

  if (!handler) {
    return {
      success: true,
      action: "ignored",
    };
  }

  return handler(event);
}

/**
 * Get the order ID from event metadata
 */
export function getOrderIdFromEvent(event: Stripe.Event): string | null {
  const data = event.data.object as Record<string, unknown>;

  // Check metadata directly
  if (data.metadata && typeof data.metadata === "object") {
    const metadata = data.metadata as Record<string, string>;
    if (metadata.orderId) {
      return metadata.orderId;
    }
  }

  return null;
}

// Default handlers - these will be registered during app initialization

export const defaultHandlers = {
  /**
   * Handle successful checkout session
   */
  async handleCheckoutCompleted(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      return {
        success: false,
        error: "No orderId in session metadata",
      };
    }

    // Payment successful - update order status
    // This will be connected to the order service
    return {
      success: true,
      orderId,
      action: "mark_paid",
    };
  },

  /**
   * Handle expired checkout session
   */
  async handleCheckoutExpired(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      return {
        success: false,
        error: "No orderId in session metadata",
      };
    }

    return {
      success: true,
      orderId,
      action: "cancel_order",
    };
  },

  /**
   * Handle successful payment intent
   */
  async handlePaymentSucceeded(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      return {
        success: false,
        error: "No orderId in payment intent metadata",
      };
    }

    return {
      success: true,
      orderId,
      action: "mark_paid",
    };
  },

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      return {
        success: false,
        error: "No orderId in payment intent metadata",
      };
    }

    return {
      success: true,
      orderId,
      action: "mark_payment_failed",
    };
  },

  /**
   * Handle refund
   */
  async handleChargeRefunded(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const charge = event.data.object as Stripe.Charge;
    const orderId = charge.metadata?.orderId;

    if (!orderId) {
      // Try to get from payment intent
      return {
        success: true,
        action: "refund_processed",
      };
    }

    return {
      success: true,
      orderId,
      action: "mark_refunded",
    };
  },

  /**
   * Handle dispute/chargeback
   */
  async handleDisputeCreated(
    event: Stripe.Event
  ): Promise<WebhookHandlerResult> {
    const dispute = event.data.object as Stripe.Dispute;

    return {
      success: true,
      action: "dispute_created",
    };
  },
};

/**
 * Register all default webhook handlers
 */
export function registerDefaultHandlers(): void {
  registerWebhookHandler(
    "checkout.session.completed",
    defaultHandlers.handleCheckoutCompleted
  );
  registerWebhookHandler(
    "checkout.session.expired",
    defaultHandlers.handleCheckoutExpired
  );
  registerWebhookHandler(
    "payment_intent.succeeded",
    defaultHandlers.handlePaymentSucceeded
  );
  registerWebhookHandler(
    "payment_intent.payment_failed",
    defaultHandlers.handlePaymentFailed
  );
  registerWebhookHandler(
    "charge.refunded",
    defaultHandlers.handleChargeRefunded
  );
  registerWebhookHandler(
    "charge.dispute.created",
    defaultHandlers.handleDisputeCreated
  );
}
