// API Integration Tests
// src/__tests__/integration/api.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import postgres from "postgres";
import { setupTestDatabase, teardownTestDatabase, runMigrations } from "./setup";

describe("API Integration Tests", () => {
  let connectionString: string;
  let sql: postgres.Sql;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    connectionString = setup.connectionString;
    await runMigrations(connectionString);
    sql = postgres(connectionString);
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    if (sql) await sql.end();
    await teardownTestDatabase();
  });

  describe("Database Connection", () => {
    it("should connect to the test database", async () => {
      const result = await sql`SELECT 1 as value`;
      expect(result[0].value).toBe(1);
    });

    it("should have created the products table", async () => {
      const result = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'products'
      `;
      expect(result.length).toBe(1);
    });

    it("should have created the categories table", async () => {
      const result = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'categories'
      `;
      expect(result.length).toBe(1);
    });

    it("should have created the customers table", async () => {
      const result = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'customers'
      `;
      expect(result.length).toBe(1);
    });

    it("should have created the orders table", async () => {
      const result = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'orders'
      `;
      expect(result.length).toBe(1);
    });
  });

  describe("Product CRUD Operations", () => {
    let productId: string;

    it("should create a product", async () => {
      const result = await sql`
        INSERT INTO products (name, slug, description, price, sku)
        VALUES ('Test Product', 'test-product', 'A test product', 29.99, 'TEST-001')
        RETURNING id, name, slug, price
      `;
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test Product");
      expect(result[0].slug).toBe("test-product");
      expect(Number(result[0].price)).toBe(29.99);
      productId = result[0].id;
    });

    it("should read a product by id", async () => {
      const result = await sql`
        SELECT * FROM products WHERE id = ${productId}
      `;
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test Product");
    });

    it("should update a product", async () => {
      await sql`
        UPDATE products
        SET name = 'Updated Product', price = 39.99
        WHERE id = ${productId}
      `;
      const result = await sql`
        SELECT name, price FROM products WHERE id = ${productId}
      `;
      expect(result[0].name).toBe("Updated Product");
      expect(Number(result[0].price)).toBe(39.99);
    });

    it("should delete a product", async () => {
      await sql`DELETE FROM products WHERE id = ${productId}`;
      const result = await sql`
        SELECT * FROM products WHERE id = ${productId}
      `;
      expect(result.length).toBe(0);
    });
  });

  describe("Category Operations", () => {
    let categoryId: string;
    let childCategoryId: string;

    it("should create a parent category", async () => {
      const result = await sql`
        INSERT INTO categories (name, slug, description)
        VALUES ('Electronics', 'electronics', 'Electronic devices')
        RETURNING id, name, slug
      `;
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Electronics");
      categoryId = result[0].id;
    });

    it("should create a child category", async () => {
      const result = await sql`
        INSERT INTO categories (name, slug, description, parent_id)
        VALUES ('Smartphones', 'smartphones', 'Mobile phones', ${categoryId})
        RETURNING id, name, parent_id
      `;
      expect(result.length).toBe(1);
      expect(result[0].parent_id).toBe(categoryId);
      childCategoryId = result[0].id;
    });

    it("should query category hierarchy", async () => {
      const result = await sql`
        SELECT c.name as category, p.name as parent
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.id = ${childCategoryId}
      `;
      expect(result[0].category).toBe("Smartphones");
      expect(result[0].parent).toBe("Electronics");
    });
  });

  describe("Customer Operations", () => {
    let customerId: string;

    it("should create a customer", async () => {
      const result = await sql`
        INSERT INTO customers (email, password_hash, first_name, last_name)
        VALUES ('test@example.com', 'hashedpassword123', 'John', 'Doe')
        RETURNING id, email, first_name, last_name
      `;
      expect(result.length).toBe(1);
      expect(result[0].email).toBe("test@example.com");
      expect(result[0].first_name).toBe("John");
      customerId = result[0].id;
    });

    it("should enforce unique email constraint", async () => {
      await expect(sql`
        INSERT INTO customers (email, password_hash, first_name, last_name)
        VALUES ('test@example.com', 'anotherpassword', 'Jane', 'Doe')
      `).rejects.toThrow();
    });

    it("should find customer by email", async () => {
      const result = await sql`
        SELECT * FROM customers WHERE email = 'test@example.com'
      `;
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(customerId);
    });
  });

  describe("Order Operations", () => {
    let customerId: string;
    let orderId: string;

    beforeAll(async () => {
      const customer = await sql`
        INSERT INTO customers (email, password_hash, first_name, last_name)
        VALUES ('order-test@example.com', 'hash', 'Order', 'Tester')
        RETURNING id
      `;
      customerId = customer[0].id;
    });

    it("should create an order", async () => {
      const result = await sql`
        INSERT INTO orders (order_number, customer_id, status, subtotal, shipping, tax, total)
        VALUES ('ORD-001', ${customerId}, 'pending', 100.00, 5.99, 10.00, 115.99)
        RETURNING id, order_number, status, total
      `;
      expect(result.length).toBe(1);
      expect(result[0].order_number).toBe("ORD-001");
      expect(result[0].status).toBe("pending");
      expect(Number(result[0].total)).toBe(115.99);
      orderId = result[0].id;
    });

    it("should update order status", async () => {
      await sql`
        UPDATE orders SET status = 'paid' WHERE id = ${orderId}
      `;
      const result = await sql`
        SELECT status FROM orders WHERE id = ${orderId}
      `;
      expect(result[0].status).toBe("paid");
    });

    it("should list orders for customer", async () => {
      const result = await sql`
        SELECT * FROM orders WHERE customer_id = ${customerId}
      `;
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
