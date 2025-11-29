// Inventory Service Tests
import { describe, it, expect } from "vitest";
import { inventoryService } from "../inventory/inventory-service.js";

describe("inventoryService", () => {
  const testProductId = "test-product-" + Date.now();
  const testVariantId = "test-variant-" + Date.now();

  describe("initializeInventory", () => {
    it("should create a new inventory item", async () => {
      const item = await inventoryService.initializeInventory({
        productId: testProductId + "-init",
        sku: "TEST-SKU-001",
        quantity: 100,
        lowStockThreshold: 10,
      });

      expect(item).toBeDefined();
      expect(item.id).toBeDefined();
      expect(item.productId).toBe(testProductId + "-init");
      expect(item.sku).toBe("TEST-SKU-001");
      expect(item.quantity).toBe(100);
      expect(item.availableQuantity).toBe(100);
      expect(item.reservedQuantity).toBe(0);
      expect(item.lowStockThreshold).toBe(10);
      expect(item.trackInventory).toBe(true);
    });

    it("should create inventory with variant", async () => {
      const item = await inventoryService.initializeInventory({
        productId: testProductId + "-variant",
        variantId: testVariantId,
        sku: "TEST-SKU-002",
        quantity: 50,
      });

      expect(item.variantId).toBe(testVariantId);
    });

    it("should set default values correctly", async () => {
      const item = await inventoryService.initializeInventory({
        productId: testProductId + "-defaults",
        sku: "TEST-SKU-003",
        quantity: 20,
      });

      expect(item.lowStockThreshold).toBe(5);
      expect(item.trackInventory).toBe(true);
      expect(item.allowBackorder).toBe(false);
    });
  });

  describe("getInventory", () => {
    it("should retrieve an existing inventory item", async () => {
      const productId = testProductId + "-get";
      await inventoryService.initializeInventory({
        productId,
        sku: "GET-SKU",
        quantity: 30,
      });

      const item = await inventoryService.getInventory(productId);
      expect(item).toBeDefined();
      expect(item?.productId).toBe(productId);
    });

    it("should return null for non-existent inventory", async () => {
      const item = await inventoryService.getInventory("non-existent-product");
      expect(item).toBeNull();
    });
  });

  describe("adjustStock", () => {
    it("should increase stock quantity", async () => {
      const productId = testProductId + "-adjust-inc";
      await inventoryService.initializeInventory({
        productId,
        sku: "ADJ-SKU-1",
        quantity: 50,
      });

      const updated = await inventoryService.adjustStock({
        productId,
        quantity: 25,
        reason: "Restocking",
      });

      expect(updated.quantity).toBe(75);
      expect(updated.availableQuantity).toBe(75);
    });

    it("should decrease stock quantity", async () => {
      const productId = testProductId + "-adjust-dec";
      await inventoryService.initializeInventory({
        productId,
        sku: "ADJ-SKU-2",
        quantity: 50,
      });

      const updated = await inventoryService.adjustStock({
        productId,
        quantity: -20,
        reason: "Damaged goods",
      });

      expect(updated.quantity).toBe(30);
      expect(updated.availableQuantity).toBe(30);
    });

    it("should throw error for insufficient stock without backorder", async () => {
      const productId = testProductId + "-adjust-err";
      await inventoryService.initializeInventory({
        productId,
        sku: "ADJ-SKU-3",
        quantity: 10,
        allowBackorder: false,
      });

      await expect(
        inventoryService.adjustStock({
          productId,
          quantity: -20,
          reason: "Test",
        })
      ).rejects.toThrow("Insufficient stock");
    });

    it("should allow negative stock with backorder enabled", async () => {
      const productId = testProductId + "-adjust-back";
      await inventoryService.initializeInventory({
        productId,
        sku: "ADJ-SKU-4",
        quantity: 10,
        allowBackorder: true,
      });

      const updated = await inventoryService.adjustStock({
        productId,
        quantity: -20,
        reason: "Backorder test",
      });

      expect(updated.quantity).toBe(-10);
    });
  });

  describe("reserveStock", () => {
    it("should create a stock reservation", async () => {
      const productId = testProductId + "-reserve";
      await inventoryService.initializeInventory({
        productId,
        sku: "RES-SKU-1",
        quantity: 100,
      });

      const reservation = await inventoryService.reserveStock({
        productId,
        quantity: 5,
        orderId: "ORDER-001",
      });

      expect(reservation).toBeDefined();
      expect(reservation.id).toBeDefined();
      expect(reservation.quantity).toBe(5);
      expect(reservation.orderId).toBe("ORDER-001");
      expect(reservation.status).toBe("active");

      const item = await inventoryService.getInventory(productId);
      expect(item?.reservedQuantity).toBe(5);
      expect(item?.availableQuantity).toBe(95);
    });

    it("should throw error when reserving more than available", async () => {
      const productId = testProductId + "-reserve-err";
      await inventoryService.initializeInventory({
        productId,
        sku: "RES-SKU-2",
        quantity: 5,
        allowBackorder: false,
      });

      await expect(
        inventoryService.reserveStock({
          productId,
          quantity: 10,
          orderId: "ORDER-002",
        })
      ).rejects.toThrow("Insufficient stock");
    });
  });

  describe("completeReservation", () => {
    it("should complete a reservation and deduct stock", async () => {
      const productId = testProductId + "-complete";
      await inventoryService.initializeInventory({
        productId,
        sku: "COMP-SKU",
        quantity: 20,
      });

      const reservation = await inventoryService.reserveStock({
        productId,
        quantity: 5,
        orderId: "ORDER-COMPLETE",
      });

      await inventoryService.completeReservation(reservation.id);

      const item = await inventoryService.getInventory(productId);
      expect(item?.quantity).toBe(15);
      expect(item?.reservedQuantity).toBe(0);
      expect(item?.availableQuantity).toBe(15);
    });
  });

  describe("cancelReservation", () => {
    it("should cancel a reservation and restore availability", async () => {
      const productId = testProductId + "-cancel";
      await inventoryService.initializeInventory({
        productId,
        sku: "CANCEL-SKU",
        quantity: 30,
      });

      const reservation = await inventoryService.reserveStock({
        productId,
        quantity: 10,
        orderId: "ORDER-CANCEL",
      });

      const itemBefore = await inventoryService.getInventory(productId);
      expect(itemBefore?.availableQuantity).toBe(20);

      await inventoryService.cancelReservation(reservation.id);

      const itemAfter = await inventoryService.getInventory(productId);
      expect(itemAfter?.reservedQuantity).toBe(0);
      expect(itemAfter?.availableQuantity).toBe(30);
    });
  });

  describe("processReturn", () => {
    it("should add returned quantity back to stock", async () => {
      const productId = testProductId + "-return";
      await inventoryService.initializeInventory({
        productId,
        sku: "RETURN-SKU",
        quantity: 50,
      });

      const returned = await inventoryService.processReturn(
        productId,
        undefined,
        5,
        "ORDER-RETURN"
      );

      expect(returned.quantity).toBe(55);
      expect(returned.availableQuantity).toBe(55);
    });
  });

  describe("isInStock", () => {
    it("should return true when stock is available", async () => {
      const productId = testProductId + "-instock";
      await inventoryService.initializeInventory({
        productId,
        sku: "STOCK-SKU-1",
        quantity: 10,
      });

      const inStock = await inventoryService.isInStock(productId, undefined, 5);
      expect(inStock).toBe(true);
    });

    it("should return false when stock is insufficient", async () => {
      const productId = testProductId + "-outstock";
      await inventoryService.initializeInventory({
        productId,
        sku: "STOCK-SKU-2",
        quantity: 3,
        allowBackorder: false,
      });

      const inStock = await inventoryService.isInStock(productId, undefined, 10);
      expect(inStock).toBe(false);
    });

    it("should return true for non-tracked inventory", async () => {
      const productId = testProductId + "-notrack";
      await inventoryService.initializeInventory({
        productId,
        sku: "STOCK-SKU-3",
        quantity: 0,
        trackInventory: false,
      });

      const inStock = await inventoryService.isInStock(productId, undefined, 100);
      expect(inStock).toBe(true);
    });

    it("should return true for backorder items", async () => {
      const productId = testProductId + "-backorder";
      await inventoryService.initializeInventory({
        productId,
        sku: "STOCK-SKU-4",
        quantity: 0,
        allowBackorder: true,
      });

      const inStock = await inventoryService.isInStock(productId, undefined, 10);
      expect(inStock).toBe(true);
    });
  });

  describe("getAllInventory", () => {
    it("should filter low stock items", async () => {
      const productId = testProductId + "-lowstock";
      await inventoryService.initializeInventory({
        productId,
        sku: "LOW-SKU",
        quantity: 3,
        lowStockThreshold: 10,
      });

      const lowStock = await inventoryService.getAllInventory({ lowStockOnly: true });
      const found = lowStock.find(i => i.productId === productId);
      expect(found).toBeDefined();
    });

    it("should filter out of stock items", async () => {
      const productId = testProductId + "-oos";
      await inventoryService.initializeInventory({
        productId,
        sku: "OOS-SKU",
        quantity: 0,
      });

      const outOfStock = await inventoryService.getAllInventory({ outOfStockOnly: true });
      const found = outOfStock.find(i => i.productId === productId);
      expect(found).toBeDefined();
    });
  });
});
