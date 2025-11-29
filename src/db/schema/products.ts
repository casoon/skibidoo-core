import { pgTable, uuid, varchar, text, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, money } from "./common";

// Products table
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull().default("simple"), // simple, variant, bundle
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, active, archived
  
  // Pricing (in cents)
  priceNet: integer("price_net").notNull().default(0),
  priceGross: integer("price_gross").notNull().default(0),
  compareAtPrice: integer("compare_at_price"),
  costPrice: integer("cost_price"),
  taxClassId: uuid("tax_class_id"),
  
  // Base price (Grundpreis) for German law
  basePriceAmount: integer("base_price_amount"),
  basePriceUnit: varchar("base_price_unit", { length: 20 }), // kg, l, m, etc.
  basePriceReference: integer("base_price_reference"), // e.g., 100 for per 100g
  
  // Inventory
  trackInventory: boolean("track_inventory").notNull().default(true),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  allowBackorder: boolean("allow_backorder").notNull().default(false),
  
  // Shipping
  weight: integer("weight"), // in grams
  length: integer("length"), // in mm
  width: integer("width"),
  height: integer("height"),
  shippingClassId: uuid("shipping_class_id"),
  deliveryTimeId: uuid("delivery_time_id"),
  
  // SEO & metadata
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metadata: jsonb("metadata"),
  
  // Parent for variants
  parentId: uuid("parent_id"),
  
  ...timestamps,
}, (table) => ({
  skuIdx: index("products_sku_idx").on(table.sku),
  slugIdx: index("products_slug_idx").on(table.slug),
  statusIdx: index("products_status_idx").on(table.status),
  parentIdx: index("products_parent_idx").on(table.parentId),
}));

// Product translations
export const productTranslations = pgTable("product_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  shortDescription: text("short_description"),
  ...timestamps,
}, (table) => ({
  productLocaleIdx: index("product_translations_product_locale_idx").on(table.productId, table.locale),
}));

// Categories table
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  parentId: uuid("parent_id"),
  position: integer("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => ({
  slugIdx: index("categories_slug_idx").on(table.slug),
  parentIdx: index("categories_parent_idx").on(table.parentId),
}));

// Category translations
export const categoryTranslations = pgTable("category_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ...timestamps,
});

// Product-Category junction
export const productCategories = pgTable("product_categories", {
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (table) => ({
  pk: index("product_categories_pk").on(table.productId, table.categoryId),
}));

// Delivery times (for German law)
export const deliveryTimes = pgTable("delivery_times", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  minDays: integer("min_days").notNull(),
  maxDays: integer("max_days").notNull(),
  ...timestamps,
});

// Delivery time translations
export const deliveryTimeTranslations = pgTable("delivery_time_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryTimeId: uuid("delivery_time_id").notNull().references(() => deliveryTimes.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "1-3 Werktage"
});

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  translations: many(productTranslations),
  categories: many(productCategories),
  parent: one(products, {
    fields: [products.parentId],
    references: [products.id],
  }),
  deliveryTime: one(deliveryTimes, {
    fields: [products.deliveryTimeId],
    references: [deliveryTimes.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  translations: many(categoryTranslations),
  products: many(productCategories),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
}));


// Delivery time relations
export const deliveryTimesRelations = relations(deliveryTimes, ({ many }) => ({
  translations: many(deliveryTimeTranslations),
  products: many(products),
}));

export const deliveryTimeTranslationsRelations = relations(deliveryTimeTranslations, ({ one }) => ({
  deliveryTime: one(deliveryTimes, {
    fields: [deliveryTimeTranslations.deliveryTimeId],
    references: [deliveryTimes.id],
  }),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
}));

export const productTranslationsRelations = relations(productTranslations, ({ one }) => ({
  product: one(products, {
    fields: [productTranslations.productId],
    references: [products.id],
  }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));
