import Stripe from "stripe";
import { env } from "@/config/env";

// Singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  orderId: string;
  customerEmail: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  status: Stripe.PaymentIntent.Status;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const stripe = getStripe();

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: params.amount,
    currency: params.currency || "eur",
    metadata: {
      orderId: params.orderId,
      ...params.metadata,
    },
    receipt_email: params.customerEmail,
    automatic_payment_methods: {
      enabled: true,
    },
  };

  if (params.customerId) {
    paymentIntentParams.customer = params.customerId;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  };
}

export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return stripe.paymentIntents.cancel(paymentIntentId);
}

export async function createRefund(
  paymentIntentId: string,
  amount?: number
): Promise<Stripe.Refund> {
  const stripe = getStripe();

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
  };

  if (amount) {
    refundParams.amount = amount;
  }

  return stripe.refunds.create(refundParams);
}

export interface CreateCheckoutSessionParams {
  orderId: string;
  lineItems: Array<{
    name: string;
    description?: string;
    amount: number;
    quantity: number;
    images?: string[];
  }>;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  shippingAmount?: number;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.lineItems.map(
    (item) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.name,
          description: item.description,
          images: item.images,
        },
        unit_amount: item.amount,
      },
      quantity: item.quantity,
    })
  );

  if (params.shippingAmount && params.shippingAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "Versand",
        },
        unit_amount: params.shippingAmount,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "klarna", "paypal", "sepa_debit"],
    line_items: lineItems,
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      orderId: params.orderId,
      ...params.metadata,
    },
    locale: "de",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["DE", "AT", "CH"],
    },
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "payment_intent"],
  });
}
