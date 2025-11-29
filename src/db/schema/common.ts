import { pgTable, uuid, timestamp, varchar, integer } from "drizzle-orm/pg-core";

// Reusable timestamp columns
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// Money type as integer (cents)
export const money = (name: string) => integer(name).notNull().default(0);

// UUID primary key
export const id = uuid("id").primaryKey().defaultRandom();

// Currencies table
export const currencies = pgTable("currencies", {
  code: varchar("code", { length: 3 }).primaryKey(), // EUR, USD, etc.
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  decimalPlaces: integer("decimal_places").notNull().default(2),
  isDefault: integer("is_default").notNull().default(0), // Boolean as int
  ...timestamps,
});

// Locales table
export const locales = pgTable("locales", {
  code: varchar("code", { length: 10 }).primaryKey(), // de-DE, en-US, etc.
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: integer("is_default").notNull().default(0),
  ...timestamps,
});
