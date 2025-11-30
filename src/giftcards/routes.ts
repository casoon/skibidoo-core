// Gift Card API Routes
// src/giftcards/routes.ts

import { Hono } from "hono";
import { giftCardService } from "./service";
import { isValidCodeFormat, normalizeCode, formatGiftCardAmount } from "./utils";

export const giftCardRoutes = new Hono();

// Check gift card balance (public)
giftCardRoutes.post("/check-balance", async (c) => {
  const body = await c.req.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return c.json({ error: { code: "INVALID_INPUT", message: "Code is required" } }, 400);
  }

  if (!isValidCodeFormat(code)) {
    return c.json({ error: { code: "INVALID_FORMAT", message: "Invalid gift card code format" } }, 400);
  }

  const result = await giftCardService.checkBalance(normalizeCode(code));

  if (!result) {
    return c.json({ error: { code: "NOT_FOUND", message: "Gift card not found or invalid" } }, 404);
  }

  return c.json({
    data: {
      balance: result.balance,
      balanceFormatted: formatGiftCardAmount(result.balance, result.currencyCode),
      currencyCode: result.currencyCode,
    },
  });
});

// Validate gift card (used during checkout)
giftCardRoutes.post("/validate", async (c) => {
  const body = await c.req.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return c.json({ 
      data: { valid: false, error: "Code is required" } 
    });
  }

  if (!isValidCodeFormat(code)) {
    return c.json({ 
      data: { valid: false, error: "Invalid gift card code format" } 
    });
  }

  const validation = await giftCardService.validate(normalizeCode(code));

  if (!validation.valid) {
    return c.json({ 
      data: { valid: false, error: validation.error } 
    });
  }

  return c.json({
    data: {
      valid: true,
      balance: validation.giftCard!.currentBalance,
      balanceFormatted: formatGiftCardAmount(
        validation.giftCard!.currentBalance, 
        validation.giftCard!.currencyCode
      ),
      currencyCode: validation.giftCard!.currencyCode,
    },
  });
});

// Apply gift card to order (internal use during checkout)
giftCardRoutes.post("/redeem", async (c) => {
  const body = await c.req.json();
  const { code, amount, orderId } = body;

  if (!code || typeof code !== "string") {
    return c.json({ error: { code: "INVALID_INPUT", message: "Code is required" } }, 400);
  }

  if (typeof amount !== "number" || amount <= 0) {
    return c.json({ error: { code: "INVALID_INPUT", message: "Valid amount is required" } }, 400);
  }

  if (!orderId || typeof orderId !== "string") {
    return c.json({ error: { code: "INVALID_INPUT", message: "Order ID is required" } }, 400);
  }

  if (!isValidCodeFormat(code)) {
    return c.json({ error: { code: "INVALID_FORMAT", message: "Invalid gift card code format" } }, 400);
  }

  const result = await giftCardService.redeem({
    code: normalizeCode(code),
    amount,
    orderId,
  });

  if (!result.success) {
    return c.json({ error: { code: "REDEEM_FAILED", message: result.error } }, 400);
  }

  return c.json({
    data: {
      amountUsed: result.amountUsed,
      remainingBalance: result.remainingBalance,
      remainingBalanceFormatted: formatGiftCardAmount(result.remainingBalance, "EUR"),
    },
  });
});

// Get gift card details by code (for logged-in users)
giftCardRoutes.get("/:code", async (c) => {
  const code = c.req.param("code");

  if (!isValidCodeFormat(code)) {
    return c.json({ error: { code: "INVALID_FORMAT", message: "Invalid gift card code format" } }, 400);
  }

  const giftCard = await giftCardService.getByCode(normalizeCode(code));

  if (!giftCard) {
    return c.json({ error: { code: "NOT_FOUND", message: "Gift card not found" } }, 404);
  }

  // Return limited info for security
  return c.json({
    data: {
      code: giftCard.code,
      currentBalance: giftCard.currentBalance,
      currentBalanceFormatted: formatGiftCardAmount(giftCard.currentBalance, giftCard.currencyCode),
      currencyCode: giftCard.currencyCode,
      status: giftCard.status,
      expiresAt: giftCard.expiresAt,
    },
  });
});
