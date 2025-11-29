import { pgTable, uuid, varchar, text, integer, boolean, jsonb, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./common";
import { customers } from "./customers";
import { products } from "./products";

// Orders table
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  customerId: uuid("customer_id").references(() => customers.id),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"),
  fulfillmentStatus: varchar("fulfillment_status", { length: 50 }).notNull().default("unfulfilled"),
  
  // Totals (in cents)
  subtotal: integer("subtotal").notNull().default(0),
  shippingTotal: integer("shipping_total").notNull().default(0),
  taxTotal: integer("tax_total").notNull().default(0),
  discountTotal: integer("discount_total").notNull().default(0),
  total: integer("total").notNull().default(0),
  
  // Currency
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  
  // Addresses (snapshot at order time)
  billingAddress: jsonb("billing_address").notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  
  // Customer info (for guest checkout)
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  
  // Payment
  paymentMethodId: varchar("payment_method_id", { length: 100 }),
  paymentReference: varchar("payment_reference", { length: 255 }),
  
  // Shipping
  shippingMethodId: uuid("shipping_method_id"),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  trackingUrl: text("tracking_url"),
  
  // Legal (German requirements)
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  acceptedCancellationPolicy: boolean("accepted_cancellation_policy").notNull().default(false),
  
  // Notes
  customerNote: text("customer_note"),
  internalNote: text("internal_note"),
  
  // Metadata
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Timestamps
  paidAt: timestamp("paid_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber),
  customerIdx: index("orders_customer_idx").on(table.customerId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
}));

// Order line items
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  
  // Product snapshot
  sku: varchar("sku", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Quantity & pricing
  quantity: integer("quantity").notNull(),
  unitPriceNet: integer("unit_price_net").notNull(),
  unitPriceGross: integer("unit_price_gross").notNull(),
  totalNet: integer("total_net").notNull(),
  totalGross: integer("total_gross").notNull(),
  taxRate: integer("tax_rate").notNull(), // in basis points (1900 = 19%)
  taxAmount: integer("tax_amount").notNull(),
  
  // Discount
  discountAmount: integer("discount_amount").notNull().default(0),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  ...timestamps,
}, (table) => ({
  orderIdx: index("order_items_order_idx").on(table.orderId),
}));

// Tax breakdown per order
export const orderTaxLines = pgTable("order_tax_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "MwSt. 19%"
  rate: integer("rate").notNull(), // in basis points
  amount: integer("amount").notNull(),
});

// Invoices (for German sequential numbering requirement)
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  
  // Snapshot of order data
  data: jsonb("data").notNull(),
  
  // PDF
  pdfUrl: text("pdf_url"),
  pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, final, cancelled
  
  ...timestamps,
}, (table) => ({
  invoiceNumberIdx: index("invoices_invoice_number_idx").on(table.invoiceNumber),
  orderIdx: index("invoices_order_idx").on(table.orderId),
}));

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  taxLines: many(orderTaxLines),
  invoices: many(invoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
