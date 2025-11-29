// Inventory REST Routes
// src/inventory/routes.ts

import { Hono } from "hono";
import { inventoryService } from "./inventory-service.js";

export const inventoryRoutes = new Hono();

// Get inventory for a product
inventoryRoutes.get("/products/:productId", async (c) => {
  const productId = c.req.param("productId");
  const variantId = c.req.query("variantId");

  const inventory = await inventoryService.getInventory(productId, variantId);

  if (!inventory) {
    return c.json({ error: "Inventory not found" }, 404);
  }

  return c.json(inventory);
});

// Get all inventory items
inventoryRoutes.get("/", async (c) => {
  const lowStockOnly = c.req.query("lowStock") === "true";
  const outOfStockOnly = c.req.query("outOfStock") === "true";
  const warehouseId = c.req.query("warehouseId");

  const items = await inventoryService.getAllInventory({
    lowStockOnly,
    outOfStockOnly,
    warehouseId,
  });

  return c.json({ items, total: items.length });
});

// Initialize inventory for a product
inventoryRoutes.post("/products/:productId", async (c) => {
  const productId = c.req.param("productId");
  const body = await c.req.json();

  try {
    const inventory = await inventoryService.initializeInventory({
      productId,
      variantId: body.variantId,
      sku: body.sku,
      quantity: body.quantity ?? 0,
      lowStockThreshold: body.lowStockThreshold,
      trackInventory: body.trackInventory,
      allowBackorder: body.allowBackorder,
      warehouseId: body.warehouseId,
      location: body.location,
    });

    return c.json(inventory, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Adjust stock
inventoryRoutes.post("/products/:productId/adjust", async (c) => {
  const productId = c.req.param("productId");
  const body = await c.req.json();

  try {
    const inventory = await inventoryService.adjustStock({
      productId,
      variantId: body.variantId,
      quantity: body.quantity,
      reason: body.reason,
    });

    return c.json(inventory);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Reserve stock for an order
inventoryRoutes.post("/reserve", async (c) => {
  const body = await c.req.json();

  try {
    const reservation = await inventoryService.reserveStock({
      productId: body.productId,
      variantId: body.variantId,
      quantity: body.quantity,
      orderId: body.orderId,
      expiresInMinutes: body.expiresInMinutes,
    });

    return c.json(reservation, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Complete reservation
inventoryRoutes.post("/reservations/:id/complete", async (c) => {
  const id = c.req.param("id");

  try {
    await inventoryService.completeReservation(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Cancel reservation
inventoryRoutes.post("/reservations/:id/cancel", async (c) => {
  const id = c.req.param("id");

  try {
    await inventoryService.cancelReservation(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Process return
inventoryRoutes.post("/return", async (c) => {
  const body = await c.req.json();

  try {
    const inventory = await inventoryService.processReturn(
      body.productId,
      body.variantId,
      body.quantity,
      body.orderId
    );

    return c.json(inventory);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Check stock availability
inventoryRoutes.get("/check", async (c) => {
  const productId = c.req.query("productId");
  const variantId = c.req.query("variantId");
  const quantity = parseInt(c.req.query("quantity") ?? "1", 10);

  if (!productId) {
    return c.json({ error: "productId required" }, 400);
  }

  const inStock = await inventoryService.isInStock(productId, variantId, quantity);

  return c.json({ inStock, productId, variantId, requestedQuantity: quantity });
});

// Get stock movements
inventoryRoutes.get("/products/:productId/movements", async (c) => {
  const productId = c.req.param("productId");
  const variantId = c.req.query("variantId");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);

  const inventory = await inventoryService.getInventory(productId, variantId);
  if (!inventory) {
    return c.json({ error: "Inventory not found" }, 404);
  }

  const movements = await inventoryService.getStockMovements(inventory.id, limit);

  return c.json({ movements });
});

// Get inventory alerts
inventoryRoutes.get("/alerts", async (c) => {
  const acknowledged = c.req.query("acknowledged") === "true";
  const alerts = await inventoryService.getAlerts(acknowledged);

  return c.json({ alerts, total: alerts.length });
});

// Acknowledge alert
inventoryRoutes.post("/alerts/:id/acknowledge", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  await inventoryService.acknowledgeAlert(id, body.userId ?? "system");

  return c.json({ success: true });
});

// Cleanup expired reservations (should be called by cron job)
inventoryRoutes.post("/maintenance/cleanup-reservations", async (c) => {
  const cleaned = await inventoryService.cleanupExpiredReservations();
  return c.json({ cleaned });
});
