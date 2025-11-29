import { pgTable, uuid, varchar, text, integer, boolean, jsonb, index, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./common";

// Customers table
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  
  // Profile
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, inactive, banned
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  
  // Double Opt-In (German requirement)
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
  marketingOptInIp: varchar("marketing_opt_in_ip", { length: 45 }),
  
  // Tax
  taxExempt: boolean("tax_exempt").notNull().default(false),
  vatId: varchar("vat_id", { length: 50 }),
  vatIdVerified: boolean("vat_id_verified").notNull().default(false),
  
  // Metadata
  locale: varchar("locale", { length: 10 }).default("de-DE"),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  metadata: jsonb("metadata"),
  
  ...timestamps,
}, (table) => ({
  emailIdx: index("customers_email_idx").on(table.email),
}));

// Customer addresses
export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  
  // Type
  type: varchar("type", { length: 20 }).notNull().default("shipping"), // billing, shipping
  isDefault: boolean("is_default").notNull().default(false),
  
  // Address fields
  company: varchar("company", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  street: varchar("street", { length: 255 }).notNull(),
  streetNumber: varchar("street_number", { length: 20 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(), // ISO 3166-1 alpha-2
  phone: varchar("phone", { length: 50 }),
  
  ...timestamps,
}, (table) => ({
  customerIdx: index("customer_addresses_customer_idx").on(table.customerId),
}));

// Customer groups (for B2B pricing etc.)
export const customerGroups = pgTable("customer_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Pricing
  discountPercent: integer("discount_percent").default(0),
  showNetPrices: boolean("show_net_prices").notNull().default(false),
  
  ...timestamps,
});

// Customer-Group junction
export const customerGroupMembers = pgTable("customer_group_members", {
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => customerGroups.id, { onDelete: "cascade" }),
  ...timestamps,
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
  groups: many(customerGroupMembers),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));
