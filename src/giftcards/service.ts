// Gift Card Service
// src/giftcards/service.ts

import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { giftCards, giftCardTransactions, type GiftCardStatus } from "@/db/schema";
import { generateCode } from "./utils";

export interface CreateGiftCardInput {
  initialValue: number; // in cents
  currencyCode?: string;
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
  expiresAt?: Date;
  purchasedByCustomerId?: string;
  isDigital?: boolean;
}

export interface RedeemGiftCardInput {
  code: string;
  amount: number; // in cents
  orderId: string;
}

export interface GiftCardValidation {
  valid: boolean;
  giftCard?: typeof giftCards.$inferSelect;
  error?: string;
}

export const giftCardService = {
  /**
   * Create a new gift card
   */
  async create(input: CreateGiftCardInput): Promise<typeof giftCards.$inferSelect> {
    const code = generateCode();
    
    const [giftCard] = await db.insert(giftCards).values({
      code,
      initialValue: input.initialValue,
      currentBalance: input.initialValue,
      currencyCode: input.currencyCode ?? "EUR",
      status: "active",
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      personalMessage: input.personalMessage,
      expiresAt: input.expiresAt,
      purchasedByCustomerId: input.purchasedByCustomerId,
      isDigital: input.isDigital ?? true,
      activatedAt: new Date(),
    }).returning();

    // Record initial transaction
    await db.insert(giftCardTransactions).values({
      giftCardId: giftCard.id,
      type: "purchase",
      amount: input.initialValue,
      balanceAfter: input.initialValue,
      description: "Gift card created",
    });

    return giftCard;
  },

  /**
   * Validate a gift card code
   */
  async validate(code: string): Promise<GiftCardValidation> {
    const giftCard = await db.query.giftCards.findFirst({
      where: eq(giftCards.code, code.toUpperCase()),
    });

    if (!giftCard) {
      return { valid: false, error: "Gift card not found" };
    }

    if (giftCard.status !== "active") {
      return { valid: false, error: `Gift card is ${giftCard.status}` };
    }

    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      // Update status to expired
      await db.update(giftCards)
        .set({ status: "expired" })
        .where(eq(giftCards.id, giftCard.id));
      return { valid: false, error: "Gift card has expired" };
    }

    if (giftCard.currentBalance <= 0) {
      return { valid: false, error: "Gift card has no remaining balance" };
    }

    return { valid: true, giftCard };
  },

  /**
   * Get gift card by code
   */
  async getByCode(code: string): Promise<typeof giftCards.$inferSelect | null> {
    const giftCard = await db.query.giftCards.findFirst({
      where: eq(giftCards.code, code.toUpperCase()),
    });
    return giftCard ?? null;
  },

  /**
   * Get gift card by ID
   */
  async getById(id: string): Promise<typeof giftCards.$inferSelect | null> {
    const giftCard = await db.query.giftCards.findFirst({
      where: eq(giftCards.id, id),
    });
    return giftCard ?? null;
  },

  /**
   * Redeem gift card (use balance for order)
   */
  async redeem(input: RedeemGiftCardInput): Promise<{ success: boolean; amountUsed: number; remainingBalance: number; error?: string }> {
    const validation = await this.validate(input.code);
    
    if (!validation.valid || !validation.giftCard) {
      return { success: false, amountUsed: 0, remainingBalance: 0, error: validation.error };
    }

    const giftCard = validation.giftCard;
    const amountToUse = Math.min(input.amount, giftCard.currentBalance);
    const newBalance = giftCard.currentBalance - amountToUse;

    // Update balance
    await db.update(giftCards)
      .set({
        currentBalance: newBalance,
        status: newBalance === 0 ? "used" : "active",
        updatedAt: new Date(),
      })
      .where(eq(giftCards.id, giftCard.id));

    // Record transaction
    await db.insert(giftCardTransactions).values({
      giftCardId: giftCard.id,
      orderId: input.orderId,
      type: "redeem",
      amount: -amountToUse,
      balanceAfter: newBalance,
      description: `Redeemed for order`,
    });

    return {
      success: true,
      amountUsed: amountToUse,
      remainingBalance: newBalance,
    };
  },

  /**
   * Refund amount back to gift card
   */
  async refund(giftCardId: string, amount: number, orderId: string): Promise<{ success: boolean; newBalance: number }> {
    const giftCard = await this.getById(giftCardId);
    
    if (!giftCard) {
      return { success: false, newBalance: 0 };
    }

    const newBalance = giftCard.currentBalance + amount;
    const cappedBalance = Math.min(newBalance, giftCard.initialValue);

    await db.update(giftCards)
      .set({
        currentBalance: cappedBalance,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(giftCards.id, giftCardId));

    await db.insert(giftCardTransactions).values({
      giftCardId,
      orderId,
      type: "refund",
      amount: amount,
      balanceAfter: cappedBalance,
      description: "Order refund",
    });

    return { success: true, newBalance: cappedBalance };
  },

  /**
   * Disable a gift card
   */
  async disable(id: string, reason?: string): Promise<boolean> {
    const [updated] = await db.update(giftCards)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(giftCards.id, id))
      .returning();

    if (updated) {
      await db.insert(giftCardTransactions).values({
        giftCardId: id,
        type: "adjust",
        amount: 0,
        balanceAfter: updated.currentBalance,
        description: reason ?? "Gift card disabled",
      });
    }

    return !!updated;
  },

  /**
   * Get transaction history for a gift card
   */
  async getTransactions(giftCardId: string) {
    return db.query.giftCardTransactions.findMany({
      where: eq(giftCardTransactions.giftCardId, giftCardId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  },

  /**
   * Get gift cards purchased by a customer
   */
  async getByCustomer(customerId: string) {
    return db.query.giftCards.findMany({
      where: eq(giftCards.purchasedByCustomerId, customerId),
      orderBy: (gc, { desc }) => [desc(gc.createdAt)],
    });
  },

  /**
   * Check balance
   */
  async checkBalance(code: string): Promise<{ balance: number; currencyCode: string } | null> {
    const validation = await this.validate(code);
    
    if (!validation.valid || !validation.giftCard) {
      return null;
    }

    return {
      balance: validation.giftCard.currentBalance,
      currencyCode: validation.giftCard.currencyCode,
    };
  },
};
