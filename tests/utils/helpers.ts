/**
 * Test utilities and helpers
 */

// Set up test environment variables
export function setupTestEnv() {
  process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-characters-long";
  process.env.JWT_EXPIRY = "3600";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.MODE = "api";
  process.env.NODE_ENV = "test";
}

// Generate test user data
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: crypto.randomUUID(),
    email: `test-${Date.now()}@example.com`,
    firstName: "Test",
    lastName: "User",
    role: "customer",
    ...overrides,
  };
}

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "customer";
}

// Generate test product data
export function createTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
  const id = crypto.randomUUID();
  return {
    id,
    sku: `TEST-${Date.now()}`,
    slug: `test-product-${Date.now()}`,
    priceNet: 1000, // 10.00 EUR
    priceGross: 1190, // 11.90 EUR (19% tax)
    stockQuantity: 100,
    status: "active",
    ...overrides,
  };
}

export interface TestProduct {
  id: string;
  sku: string;
  slug: string;
  priceNet: number;
  priceGross: number;
  stockQuantity: number;
  status: string;
}

// Generate test order data
export function createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    id: crypto.randomUUID(),
    orderNumber: `SK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    email: "customer@example.com",
    subtotal: 2380,
    shippingTotal: 499,
    taxTotal: 380,
    discountTotal: 0,
    total: 2879,
    currency: "EUR",
    status: "pending",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    ...overrides,
  };
}

export interface TestOrder {
  id: string;
  orderNumber: string;
  email: string;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
}

// Money formatting helper
export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// Wait helper using Node 24 native timers/promises
export async function wait(ms: number): Promise<void> {
  const { setTimeout } = await import("node:timers/promises");
  await setTimeout(ms);
}
