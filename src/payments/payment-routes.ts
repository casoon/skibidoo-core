import { Hono } from "hono";
import { z } from "zod";
import { env } from "@/config/env";
import {
  createCheckoutSession,
  getCheckoutSession,
  createPaymentIntent,
} from "./stripe";

export const paymentRoutes = new Hono();

const createCheckoutSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      amount: z.number().int().positive(),
      quantity: z.number().int().positive(),
      images: z.array(z.string().url()).optional(),
    })
  ),
  customerEmail: z.string().email(),
  shippingAmount: z.number().int().nonnegative().optional(),
});

paymentRoutes.post("/checkout", async (c) => {
  const body = await c.req.json();
  const result = createCheckoutSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid request", details: result.error.flatten() }, 400);
  }

  const data = result.data;
  const baseUrl = env.STOREFRONT_URL || "http://localhost:4001";

  try {
    const session = await createCheckoutSession({
      orderId: data.orderId,
      lineItems: data.items,
      customerEmail: data.customerEmail,
      shippingAmount: data.shippingAmount,
      successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/checkout/cancel?order_id=${data.orderId}`,
    });

    return c.json({
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment error";
    return c.json({ error: message }, 500);
  }
});

const createPaymentIntentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive(),
  customerEmail: z.string().email(),
  customerId: z.string().optional(),
});

paymentRoutes.post("/intent", async (c) => {
  const body = await c.req.json();
  const result = createPaymentIntentSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid request", details: result.error.flatten() }, 400);
  }

  const data = result.data;

  try {
    const intent = await createPaymentIntent({
      orderId: data.orderId,
      amount: data.amount,
      customerEmail: data.customerEmail,
      customerId: data.customerId,
    });

    return c.json({
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment error";
    return c.json({ error: message }, 500);
  }
});

paymentRoutes.get("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  try {
    const session = await getCheckoutSession(sessionId);

    return c.json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      orderId: session.metadata?.orderId,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

paymentRoutes.get("/config", (c) => {
  if (!env.STRIPE_PUBLIC_KEY) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  return c.json({
    publicKey: env.STRIPE_PUBLIC_KEY,
  });
});
