// Webhook REST Routes
// src/webhooks/routes.ts

import { Hono } from "hono";
import { webhookService } from "./webhook-service.js";

export const webhookRoutes = new Hono();

// Get all webhook endpoints
webhookRoutes.get("/endpoints", async (c) => {
  const endpoints = await webhookService.getAllEndpoints();
  // Hide secrets in response
  const safeEndpoints = endpoints.map(e => ({
    ...e,
    secret: e.secret.slice(0, 10) + "...",
  }));
  return c.json({ endpoints: safeEndpoints });
});

// Get webhook endpoint by ID
webhookRoutes.get("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  const endpoint = await webhookService.getEndpoint(id);

  if (!endpoint) {
    return c.json({ error: "Endpoint not found" }, 404);
  }

  return c.json({
    ...endpoint,
    secret: endpoint.secret.slice(0, 10) + "...",
  });
});

// Create webhook endpoint
webhookRoutes.post("/endpoints", async (c) => {
  const body = await c.req.json();

  try {
    const endpoint = await webhookService.createEndpoint({
      url: body.url,
      events: body.events,
      description: body.description,
      headers: body.headers,
      active: body.active,
    });

    return c.json(endpoint, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Update webhook endpoint
webhookRoutes.put("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const endpoint = await webhookService.updateEndpoint({
      id,
      url: body.url,
      events: body.events,
      description: body.description,
      headers: body.headers,
      active: body.active,
    });

    return c.json({
      ...endpoint,
      secret: endpoint.secret.slice(0, 10) + "...",
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Delete webhook endpoint
webhookRoutes.delete("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  await webhookService.deleteEndpoint(id);
  return c.json({ success: true });
});

// Regenerate secret
webhookRoutes.post("/endpoints/:id/regenerate-secret", async (c) => {
  const id = c.req.param("id");

  try {
    const secret = await webhookService.regenerateSecret(id);
    return c.json({ secret });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Test webhook endpoint
webhookRoutes.post("/endpoints/:id/test", async (c) => {
  const id = c.req.param("id");

  try {
    const delivery = await webhookService.testEndpoint(id);
    return c.json(delivery);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Get delivery history
webhookRoutes.get("/deliveries", async (c) => {
  const endpointId = c.req.query("endpointId");
  const eventType = c.req.query("eventType") as any;
  const status = c.req.query("status") as any;
  const limit = parseInt(c.req.query("limit") ?? "100", 10);

  const deliveries = await webhookService.getDeliveries({
    endpointId,
    eventType,
    status,
    limit,
  });

  return c.json({ deliveries, total: deliveries.length });
});

// Retry failed delivery
webhookRoutes.post("/deliveries/:id/retry", async (c) => {
  const id = c.req.param("id");

  try {
    await webhookService.retryDelivery(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// List available event types
webhookRoutes.get("/event-types", async (c) => {
  const eventTypes = [
    { type: "order.created", description: "Neue Bestellung erstellt" },
    { type: "order.updated", description: "Bestellung aktualisiert" },
    { type: "order.paid", description: "Bestellung bezahlt" },
    { type: "order.shipped", description: "Bestellung versendet" },
    { type: "order.delivered", description: "Bestellung geliefert" },
    { type: "order.cancelled", description: "Bestellung storniert" },
    { type: "order.refunded", description: "Bestellung erstattet" },
    { type: "product.created", description: "Produkt erstellt" },
    { type: "product.updated", description: "Produkt aktualisiert" },
    { type: "product.deleted", description: "Produkt geloescht" },
    { type: "product.out_of_stock", description: "Produkt ausverkauft" },
    { type: "product.back_in_stock", description: "Produkt wieder verfuegbar" },
    { type: "customer.created", description: "Kunde registriert" },
    { type: "customer.updated", description: "Kundendaten aktualisiert" },
    { type: "customer.deleted", description: "Kunde geloescht" },
    { type: "inventory.low_stock", description: "Niedriger Lagerbestand" },
    { type: "inventory.out_of_stock", description: "Lager leer" },
    { type: "inventory.adjusted", description: "Lagerbestand angepasst" },
    { type: "payment.succeeded", description: "Zahlung erfolgreich" },
    { type: "payment.failed", description: "Zahlung fehlgeschlagen" },
    { type: "payment.refunded", description: "Zahlung erstattet" },
  ];

  return c.json({ eventTypes });
});
