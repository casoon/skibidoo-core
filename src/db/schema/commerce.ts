import { pgTable, uuid, varchar, text, integer, boolean, jsonb, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./common";

// Tax classes
export const taxClasses = pgTable("tax_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps,
});

// Tax rates per country/region
export const taxRates = pgTable("tax_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxClassId: uuid("tax_class_id").notNull().references(() => taxClasses.id, { onDelete: "cascade" }),
  
  // Location
  country: varchar("country", { length: 2 }).notNull(), // ISO 3166-1 alpha-2
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  city: varchar("city", { length: 100 }),
  
  // Rate in basis points (1900 = 19%)
  rate: integer("rate").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "MwSt."
  
  // Priority for overlapping rules
  priority: integer("priority").notNull().default(0),
  
  // Compound tax (tax on tax)
  compound: boolean("compound").notNull().default(false),
  
  ...timestamps,
}, (table) => ({
  taxClassIdx: index("tax_rates_tax_class_idx").on(table.taxClassId),
  countryIdx: index("tax_rates_country_idx").on(table.country),
}));

// Shipping zones
export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Countries/regions in this zone
  countries: jsonb("countries").notNull().default([]), // Array of country codes
  
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  ...timestamps,
});

// Shipping methods
export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id").notNull().references(() => shippingZones.id, { onDelete: "cascade" }),
  
  slug: varchar("slug", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Pricing
  type: varchar("type", { length: 50 }).notNull().default("flat"), // flat, weight, price, free
  price: integer("price").notNull().default(0), // in cents
  freeAbove: integer("free_above"), // Free shipping above this cart total
  
  // Weight-based pricing
  pricePerKg: integer("price_per_kg"),
  
  // Delivery time
  deliveryTimeId: uuid("delivery_time_id"),
  
  // Carrier integration
  carrierCode: varchar("carrier_code", { length: 50 }), // dhl, dpd, etc.
  carrierConfig: jsonb("carrier_config"),
  
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  
  ...timestamps,
}, (table) => ({
  zoneIdx: index("shipping_methods_zone_idx").on(table.zoneId),
}));

// Shipping classes (for products)
export const shippingClasses = pgTable("shipping_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ...timestamps,
});

// Payment methods
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Provider
  provider: varchar("provider", { length: 50 }).notNull(), // stripe, paypal, klarna, etc.
  providerConfig: jsonb("provider_config"),
  
  // Settings
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  
  // Restrictions
  minAmount: integer("min_amount"),
  maxAmount: integer("max_amount"),
  countries: jsonb("countries"), // Allowed countries
  
  ...timestamps,
});

// Coupons/Discounts
export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  
  // Type
  type: varchar("type", { length: 50 }).notNull(), // percentage, fixed, free_shipping
  value: integer("value").notNull(), // percentage in basis points or fixed in cents
  
  // Restrictions
  minPurchase: integer("min_purchase"),
  maxDiscount: integer("max_discount"),
  usageLimit: integer("usage_limit"),
  usageLimitPerCustomer: integer("usage_limit_per_customer").default(1),
  usageCount: integer("usage_count").notNull().default(0),
  
  // Validity
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  // Product/Category restrictions
  productIds: jsonb("product_ids"),
  categoryIds: jsonb("category_ids"),
  excludeProductIds: jsonb("exclude_product_ids"),
  excludeCategoryIds: jsonb("exclude_category_ids"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  ...timestamps,
}, (table) => ({
  codeIdx: index("coupons_code_idx").on(table.code),
}));

// Relations
export const taxClassesRelations = relations(taxClasses, ({ many }) => ({
  rates: many(taxRates),
}));

export const shippingZonesRelations = relations(shippingZones, ({ many }) => ({
  methods: many(shippingMethods),
}));
