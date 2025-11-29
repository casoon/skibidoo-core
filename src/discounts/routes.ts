// Discount REST Routes
// src/discounts/routes.ts

import { Hono } from "hono";
import { discountService } from "./discount-service.js";

export const discountRoutes = new Hono();

// Get all discount codes (admin)
discountRoutes.get("/", async (c) => {
  const active = c.req.query("active");
  const type = c.req.query("type");

  const discounts = await discountService.getAll({
    active: active ? active === "true" : undefined,
    type,
  });

  return c.json({ discounts, total: discounts.length });
});

// Get discount by ID
discountRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const discount = await discountService.getById(id);

  if (!discount) {
    return c.json({ error: "Discount not found" }, 404);
  }

  return c.json(discount);
});

// Create discount code
discountRoutes.post("/", async (c) => {
  const body = await c.req.json();

  try {
    const discount = await discountService.create({
      code: body.code,
      description: body.description,
      type: body.type,
      value: body.value,
      minOrderValue: body.minOrderValue,
      maxDiscount: body.maxDiscount,
      appliesTo: body.appliesTo,
      productIds: body.productIds,
      categoryIds: body.categoryIds,
      excludeProductIds: body.excludeProductIds,
      excludeCategoryIds: body.excludeCategoryIds,
      usageLimit: body.usageLimit,
      usageLimitPerCustomer: body.usageLimitPerCustomer,
      firstOrderOnly: body.firstOrderOnly,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      active: body.active,
    });

    return c.json(discount, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Update discount code
discountRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const discount = await discountService.update({
      id,
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    });

    return c.json(discount);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Delete discount code
discountRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await discountService.delete(id);
  return c.json({ success: true });
});

// Validate/apply discount code (public endpoint for checkout)
discountRoutes.post("/validate", async (c) => {
  const body = await c.req.json();

  const result = await discountService.applyDiscount({
    code: body.code,
    cartTotal: body.cartTotal,
    cartItems: body.cartItems,
    customerId: body.customerId,
    isFirstOrder: body.isFirstOrder,
    shippingCost: body.shippingCost,
  });

  return c.json(result);
});

// Record usage (called after successful order)
discountRoutes.post("/:id/usage", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  await discountService.recordUsage(
    id,
    body.orderId,
    body.customerId,
    body.discountAmount
  );

  return c.json({ success: true });
});

// Get usage statistics
discountRoutes.get("/:id/stats", async (c) => {
  const id = c.req.param("id");
  const stats = await discountService.getUsageStats(id);
  return c.json(stats);
});

// Generate random code
discountRoutes.get("/generate-code", async (c) => {
  const length = parseInt(c.req.query("length") ?? "8", 10);
  const code = discountService.generateCode(length);
  return c.json({ code });
});
