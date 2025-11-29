import { pgTable, uuid, varchar, text, integer, boolean, jsonb, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./common";
import { customers } from "./customers";
import { products } from "./products";

// Carts table
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Currency
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  
  // Totals (calculated)
  subtotal: integer("subtotal").notNull().default(0),
  taxTotal: integer("tax_total").notNull().default(0),
  total: integer("total").notNull().default(0),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Expiry
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  ...timestamps,
}, (table) => ({
  customerIdx: index("carts_customer_idx").on(table.customerId),
  sessionIdx: index("carts_session_idx").on(table.sessionId),
}));

// Cart items
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  
  // Quantity
  quantity: integer("quantity").notNull().default(1),
  
  // Price snapshot at add time
  unitPriceNet: integer("unit_price_net").notNull(),
  unitPriceGross: integer("unit_price_gross").notNull(),
  
  // Metadata (for variants, custom options)
  metadata: jsonb("metadata"),
  
  ...timestamps,
}, (table) => ({
  cartIdx: index("cart_items_cart_idx").on(table.cartId),
  productIdx: index("cart_items_product_idx").on(table.productId),
}));

// Relations
export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [carts.customerId],
    references: [customers.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));
