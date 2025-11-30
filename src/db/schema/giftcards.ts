// Gift Cards Schema
// src/db/schema/giftcards.ts

import { pgTable, uuid, timestamp, varchar, integer, text, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, money } from "./common";
import { customers } from "./customers";
import { orders } from "./orders";

// Gift Card status enum
export type GiftCardStatus = "active" | "used" | "expired" | "disabled";

// Gift Cards table
export const giftCards = pgTable("gift_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  initialValue: money("initial_value"), // in cents
  currentBalance: money("current_balance"), // in cents
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default("EUR"),
  status: varchar("status", { length: 20 }).notNull().default("active").$type<GiftCardStatus>(),
  
  // Optional customer association (for purchased gift cards)
  purchasedByCustomerId: uuid("purchased_by_customer_id").references(() => customers.id),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientName: varchar("recipient_name", { length: 255 }),
  personalMessage: text("personal_message"),
  
  // Validity
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  
  // Metadata
  isDigital: boolean("is_digital").notNull().default(true),
  orderItemId: uuid("order_item_id"), // If purchased as product
  
  ...timestamps,
}, (table) => [
  index("gift_cards_code_idx").on(table.code),
  index("gift_cards_status_idx").on(table.status),
  index("gift_cards_purchased_by_idx").on(table.purchasedByCustomerId),
]);

// Gift Card transactions (usage history)
export const giftCardTransactions = pgTable("gift_card_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  giftCardId: uuid("gift_card_id").notNull().references(() => giftCards.id),
  orderId: uuid("order_id").references(() => orders.id),
  
  type: varchar("type", { length: 20 }).notNull().$type<"purchase" | "redeem" | "refund" | "adjust">(),
  amount: integer("amount").notNull(), // positive = credit, negative = debit (in cents)
  balanceAfter: money("balance_after"),
  
  description: text("description"),
  performedBy: uuid("performed_by"), // Admin user ID if manual adjustment
  
  ...timestamps,
}, (table) => [
  index("gift_card_transactions_card_idx").on(table.giftCardId),
  index("gift_card_transactions_order_idx").on(table.orderId),
]);

// Relations
export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
  purchasedBy: one(customers, {
    fields: [giftCards.purchasedByCustomerId],
    references: [customers.id],
  }),
  transactions: many(giftCardTransactions),
}));

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
  giftCard: one(giftCards, {
    fields: [giftCardTransactions.giftCardId],
    references: [giftCards.id],
  }),
  order: one(orders, {
    fields: [giftCardTransactions.orderId],
    references: [orders.id],
  }),
}));
