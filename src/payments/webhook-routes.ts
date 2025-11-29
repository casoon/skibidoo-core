import { Hono } from "hono";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import {
  verifyWebhookSignature,
  processWebhookEvent,
} from "./webhooks";

export const stripeWebhookRoutes = new Hono();

stripeWebhookRoutes.post("/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    return c.json({ error: "Webhook not configured" }, 500);
  }

  try {
    const rawBody = await c.req.raw.text();

    const event = verifyWebhookSignature(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

    const result = await processWebhookEvent(event);

    if (!result.success) {
      logger.error(
        { eventType: event.type, error: result.error },
        "Webhook processing failed"
      );
      return c.json({ error: result.error }, 400);
    }

    logger.info(
      { eventType: event.type, orderId: result.orderId, action: result.action },
      "Webhook processed successfully"
    );

    return c.json({ received: true, action: result.action });
  } catch (err) {
    if (err instanceof Error && err.message.includes("signature")) {
      logger.warn("Invalid webhook signature");
      return c.json({ error: "Invalid signature" }, 400);
    }

    logger.error({ err }, "Webhook processing error");
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});
