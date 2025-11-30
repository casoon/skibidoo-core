// PayPal Payment Integration
// src/payments/paypal.ts

import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
  type OrderRequest,
} from "@paypal/paypal-server-sdk";
import { env } from "@/config/env";

// Singleton PayPal client
let paypalClient: Client | null = null;

function getClient(): Client {
  if (!paypalClient) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials not configured");
    }

    paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: env.PAYPAL_CLIENT_SECRET,
      },
      environment:
        env.NODE_ENV === "production"
          ? Environment.Production
          : Environment.Sandbox,
    });
  }
  return paypalClient;
}

export interface CreatePayPalOrderParams {
  orderId: string;
  amount: number;
  currency?: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalOrderResult {
  paypalOrderId: string;
  approvalUrl: string;
  status: string;
}

/**
 * Create a PayPal order
 */
export async function createPayPalOrder(
  params: CreatePayPalOrderParams
): Promise<PayPalOrderResult> {
  const client = getClient();
  const ordersController = new OrdersController(client);

  const amountInUnits = (params.amount / 100).toFixed(2);

  const orderRequest: OrderRequest = {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        referenceId: params.orderId,
        description: params.description || "Order " + params.orderId,
        amount: {
          currencyCode: params.currency || "EUR",
          value: amountInUnits,
        },
      },
    ],
    paymentSource: {
      paypal: {
        experienceContext: {
          returnUrl: params.returnUrl,
          cancelUrl: params.cancelUrl,
          brandName: "Skibidoo",
          userAction: PaypalExperienceUserAction.PayNow,
          shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
        },
      },
    },
  };

  const response = await ordersController.createOrder({
    body: orderRequest,
    prefer: "return=representation",
  });

  const order = response.result;
  const approvalLink = order.links?.find((link) => link.rel === "payer-action");

  if (!approvalLink?.href) {
    throw new Error("No approval URL in PayPal response");
  }

  return {
    paypalOrderId: order.id || "",
    approvalUrl: approvalLink.href,
    status: order.status || "CREATED",
  };
}

/**
 * Capture a PayPal order after approval
 */
export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<{
  captureId: string;
  status: string;
  amount: number;
  currency: string;
}> {
  const client = getClient();
  const ordersController = new OrdersController(client);

  const response = await ordersController.captureOrder({
    id: paypalOrderId,
    prefer: "return=representation",
  });

  const order = response.result;
  const capture = order.purchaseUnits?.[0]?.payments?.captures?.[0];

  if (!capture) {
    throw new Error("No capture in PayPal response");
  }

  return {
    captureId: capture.id || "",
    status: order.status || "UNKNOWN",
    amount: Math.round(parseFloat(capture.amount?.value || "0") * 100),
    currency: capture.amount?.currencyCode || "EUR",
  };
}

/**
 * Get PayPal order details
 */
export async function getPayPalOrder(paypalOrderId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  referenceId: string;
}> {
  const client = getClient();
  const ordersController = new OrdersController(client);

  const response = await ordersController.getOrder({
    id: paypalOrderId,
  });

  const order = response.result;
  const purchaseUnit = order.purchaseUnits?.[0];

  return {
    status: order.status || "UNKNOWN",
    amount: Math.round(parseFloat(purchaseUnit?.amount?.value || "0") * 100),
    currency: purchaseUnit?.amount?.currencyCode || "EUR",
    referenceId: purchaseUnit?.referenceId || "",
  };
}

/**
 * Refund a PayPal capture
 */
export async function refundPayPalCapture(
  captureId: string,
  amount?: number,
  currency?: string
): Promise<{
  refundId: string;
  status: string;
}> {
  const client = getClient();
  const paymentsController = new PaymentsController(client);

  const response = await paymentsController.refundCapturedPayment({
    captureId,
    body: amount
      ? {
          amount: {
            value: (amount / 100).toFixed(2),
            currencyCode: currency || "EUR",
          },
        }
      : undefined,
  });

  const refund = response.result;

  return {
    refundId: refund.id || "",
    status: refund.status || "UNKNOWN",
  };
}
