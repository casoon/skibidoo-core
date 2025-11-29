// Discount Service Tests
import { describe, it, expect, beforeEach } from "vitest";
import { discountService } from "../discounts/discount-service.js";

describe("discountService", () => {
  const testCode = "TEST" + Date.now();

  describe("create", () => {
    it("should create a percentage discount", async () => {
      const discount = await discountService.create({
        code: testCode + "-PCT",
        description: "Test 10% discount",
        type: "percentage",
        value: 10,
      });

      expect(discount).toBeDefined();
      expect(discount.id).toBeDefined();
      expect(discount.code).toBe((testCode + "-PCT").toUpperCase());
      expect(discount.type).toBe("percentage");
      expect(discount.value).toBe(10);
      expect(discount.active).toBe(true);
      expect(discount.usageCount).toBe(0);
    });

    it("should create a fixed amount discount", async () => {
      const discount = await discountService.create({
        code: testCode + "-FIXED",
        type: "fixed",
        value: 20,
        minOrderValue: 50,
      });

      expect(discount.type).toBe("fixed");
      expect(discount.value).toBe(20);
      expect(discount.minOrderValue).toBe(50);
    });

    it("should create a shipping discount", async () => {
      const discount = await discountService.create({
        code: testCode + "-SHIP",
        type: "shipping",
        value: 0,
      });

      expect(discount.type).toBe("shipping");
    });

    it("should normalize code to uppercase", async () => {
      const discount = await discountService.create({
        code: "lowercase" + Date.now(),
        type: "percentage",
        value: 5,
      });

      expect(discount.code).toBe(discount.code.toUpperCase());
    });

    it("should throw error for duplicate code", async () => {
      const code = "UNIQUE" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      await expect(
        discountService.create({
          code,
          type: "percentage",
          value: 15,
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("getByCode", () => {
    it("should find discount by code", async () => {
      const code = "FIND" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      const found = await discountService.getByCode(code);
      expect(found).toBeDefined();
      expect(found?.code).toBe(code.toUpperCase());
    });

    it("should return null for non-existent code", async () => {
      const found = await discountService.getByCode("NONEXISTENT");
      expect(found).toBeNull();
    });

    it("should be case-insensitive", async () => {
      const code = "CASETEST" + Date.now();
      await discountService.create({
        code: code.toUpperCase(),
        type: "percentage",
        value: 10,
      });

      const found = await discountService.getByCode(code.toLowerCase());
      expect(found).toBeDefined();
    });
  });

  describe("applyDiscount", () => {
    it("should apply percentage discount correctly", async () => {
      const code = "APPLY10" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [
          { productId: "p1", quantity: 2, unitPrice: 50, totalPrice: 100 },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.discountedTotal).toBe(90);
    });

    it("should apply fixed discount correctly", async () => {
      const code = "FIXED20" + Date.now();
      await discountService.create({
        code,
        type: "fixed",
        value: 20,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [
          { productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20);
      expect(result.discountedTotal).toBe(80);
    });

    it("should apply shipping discount correctly", async () => {
      const code = "FREESHIP" + Date.now();
      await discountService.create({
        code,
        type: "shipping",
        value: 0,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [
          { productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 },
        ],
        shippingCost: 5.99,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(5.99);
      expect(result.discountedShipping).toBe(0);
    });

    it("should reject non-existent code", async () => {
      const result = await discountService.applyDiscount({
        code: "INVALID",
        cartTotal: 100,
        cartItems: [],
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("nicht gefunden");
    });

    it("should reject inactive discount", async () => {
      const code = "INACTIVE" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
        active: false,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [],
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("nicht aktiv");
    });

    it("should reject expired discount", async () => {
      const code = "EXPIRED" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
        validUntil: new Date(Date.now() - 86400000), // Yesterday
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 }],
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("abgelaufen");
    });

    it("should reject if minimum order value not met", async () => {
      const code = "MINORDER" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
        minOrderValue: 100,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 50,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 50, totalPrice: 50 }],
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Mindestbestellwert");
    });

    it("should apply max discount cap", async () => {
      const code = "MAXCAP" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 50,
        maxDiscount: 25,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 200,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 200, totalPrice: 200 }],
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(25); // Capped at 25, not 100
      expect(result.discountedTotal).toBe(175);
    });

    it("should enforce usage limit", async () => {
      const code = "LIMITED" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
        usageLimit: 1,
      });

      // Simulate usage
      await discountService.recordUsage(discount.id, "order1", "cust1", 10);

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 }],
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("zu oft verwendet");
    });

    it("should enforce per-customer usage limit", async () => {
      const code = "PERCUST" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
        usageLimitPerCustomer: 1,
      });

      // Record usage for customer
      await discountService.recordUsage(discount.id, "order1", "cust1", 10);

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 }],
        customerId: "cust1",
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("bereits verwendet");
    });

    it("should enforce first order only", async () => {
      const code = "FIRSTONLY" + Date.now();
      await discountService.create({
        code,
        type: "percentage",
        value: 10,
        firstOrderOnly: true,
      });

      const result = await discountService.applyDiscount({
        code,
        cartTotal: 100,
        cartItems: [{ productId: "p1", quantity: 1, unitPrice: 100, totalPrice: 100 }],
        isFirstOrder: false,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Erstbestellungen");
    });
  });

  describe("update", () => {
    it("should update discount properties", async () => {
      const code = "UPDATE" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      const updated = await discountService.update({
        id: discount.id,
        value: 20,
        description: "Updated description",
      });

      expect(updated.value).toBe(20);
      expect(updated.description).toBe("Updated description");
    });
  });

  describe("delete", () => {
    it("should delete a discount", async () => {
      const code = "DELETE" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      await discountService.delete(discount.id);

      const found = await discountService.getById(discount.id);
      expect(found).toBeNull();
    });
  });

  describe("recordUsage", () => {
    it("should increment usage count", async () => {
      const code = "USAGE" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      await discountService.recordUsage(discount.id, "order1", "cust1", 10);
      await discountService.recordUsage(discount.id, "order2", "cust2", 15);

      const updated = await discountService.getById(discount.id);
      expect(updated?.usageCount).toBe(2);
    });
  });

  describe("getUsageStats", () => {
    it("should return usage statistics", async () => {
      const code = "STATS" + Date.now();
      const discount = await discountService.create({
        code,
        type: "percentage",
        value: 10,
      });

      await discountService.recordUsage(discount.id, "order1", "cust1", 10);
      await discountService.recordUsage(discount.id, "order2", "cust2", 20);

      const stats = await discountService.getUsageStats(discount.id);
      expect(stats.totalUsages).toBe(2);
      expect(stats.totalDiscountAmount).toBe(30);
      expect(stats.usages.length).toBe(2);
    });
  });

  describe("generateCode", () => {
    it("should generate a code of specified length", () => {
      const code = discountService.generateCode(10);
      expect(code.length).toBe(10);
    });

    it("should generate uppercase alphanumeric code", () => {
      const code = discountService.generateCode(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });
  });

  describe("getAll", () => {
    it("should filter by active status", async () => {
      const activeCode = "ACTIVE" + Date.now();
      const inactiveCode = "INACT" + Date.now();

      await discountService.create({
        code: activeCode,
        type: "percentage",
        value: 10,
        active: true,
      });
      await discountService.create({
        code: inactiveCode,
        type: "percentage",
        value: 10,
        active: false,
      });

      const activeOnly = await discountService.getAll({ active: true });
      const hasActive = activeOnly.some(d => d.code === activeCode.toUpperCase());
      const hasInactive = activeOnly.some(d => d.code === inactiveCode.toUpperCase());

      expect(hasActive).toBe(true);
      expect(hasInactive).toBe(false);
    });
  });
});
