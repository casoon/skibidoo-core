// PayPal Payment Routes
// src/api/routes/paypal.ts

import { Hono } from "hono";
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
} from "@/payments/paypal";
import { env } from "@/config/env";

const router = new Hono();

// Create PayPal order
router.post("/orders", async (c) => {
  const body = await c.req.json<{
    orderId: string;
    amount: number;
    currency?: string;
    description?: string;
  }>();

  if (!body.orderId || !body.amount) {
    return c.json(
      { error: { code: "INVALID_REQUEST", message: "orderId and amount required" } },
      400
    );
  }

  const baseUrl = env.STOREFRONT_URL || "http://localhost:4321";

  const result = await createPayPalOrder({
    orderId: body.orderId,
    amount: body.amount,
    currency: body.currency,
    description: body.description,
    returnUrl: baseUrl + "/checkout/paypal/return",
    cancelUrl: baseUrl + "/checkout/paypal/cancel",
  });

  return c.json({
    data: {
      paypalOrderId: result.paypalOrderId,
      approvalUrl: result.approvalUrl,
      status: result.status,
    },
  });
});

// Capture PayPal order after approval
router.post("/orders/:paypalOrderId/capture", async (c) => {
  const paypalOrderId = c.req.param("paypalOrderId");

  const result = await capturePayPalOrder(paypalOrderId);

  return c.json({
    data: {
      captureId: result.captureId,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
    },
  });
});

// Get PayPal order status
router.get("/orders/:paypalOrderId", async (c) => {
  const paypalOrderId = c.req.param("paypalOrderId");

  const result = await getPayPalOrder(paypalOrderId);

  return c.json({
    data: {
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      orderId: result.referenceId,
    },
  });
});

export { router as paypalRoutes };
