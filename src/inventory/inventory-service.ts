// Inventory Service
// src/inventory/inventory-service.ts

import type {
  InventoryItem,
  StockMovement,
  StockMovementType,
  StockReservation,
  StockAdjustment,
  ReserveStockInput,
  TransferStockInput,
  InventoryAlert,
} from "./types.js";

// In-memory store (replace with database in production)
const inventoryItems = new Map<string, InventoryItem>();
const stockMovements: StockMovement[] = [];
const stockReservations = new Map<string, StockReservation>();
const inventoryAlerts: InventoryAlert[] = [];

function generateId(): string {
  return crypto.randomUUID();
}

function getInventoryKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

export const inventoryService = {
  // Get inventory for a product/variant
  async getInventory(productId: string, variantId?: string): Promise<InventoryItem | null> {
    const key = getInventoryKey(productId, variantId);
    return inventoryItems.get(key) || null;
  },

  // Get all inventory items
  async getAllInventory(options?: {
    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
    warehouseId?: string;
  }): Promise<InventoryItem[]> {
    let items = Array.from(inventoryItems.values());

    if (options?.lowStockOnly) {
      items = items.filter(i => i.availableQuantity <= i.lowStockThreshold && i.availableQuantity > 0);
    }
    if (options?.outOfStockOnly) {
      items = items.filter(i => i.availableQuantity <= 0);
    }
    if (options?.warehouseId) {
      items = items.filter(i => i.warehouseId === options.warehouseId);
    }

    return items;
  },

  // Initialize inventory for a product
  async initializeInventory(input: {
    productId: string;
    variantId?: string;
    sku: string;
    quantity: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
    allowBackorder?: boolean;
    warehouseId?: string;
    location?: string;
  }): Promise<InventoryItem> {
    const key = getInventoryKey(input.productId, input.variantId);
    
    const item: InventoryItem = {
      id: generateId(),
      productId: input.productId,
      variantId: input.variantId,
      sku: input.sku,
      quantity: input.quantity,
      reservedQuantity: 0,
      availableQuantity: input.quantity,
      lowStockThreshold: input.lowStockThreshold ?? 5,
      trackInventory: input.trackInventory ?? true,
      allowBackorder: input.allowBackorder ?? false,
      warehouseId: input.warehouseId,
      location: input.location,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inventoryItems.set(key, item);
    
    await this.recordMovement(item.id, "received", input.quantity, 0, input.quantity, "Initial stock");
    await this.checkAlerts(item);

    return item;
  },

  // Adjust stock (increase or decrease)
  async adjustStock(adjustment: StockAdjustment): Promise<InventoryItem> {
    const key = getInventoryKey(adjustment.productId, adjustment.variantId);
    const item = inventoryItems.get(key);

    if (!item) {
      throw new Error(`Inventory not found for product ${adjustment.productId}`);
    }

    const previousQuantity = item.quantity;
    const newQuantity = item.quantity + adjustment.quantity;

    if (newQuantity < 0 && !item.allowBackorder) {
      throw new Error(`Insufficient stock. Available: ${item.availableQuantity}, Requested: ${Math.abs(adjustment.quantity)}`);
    }

    item.quantity = newQuantity;
    item.availableQuantity = newQuantity - item.reservedQuantity;
    item.updatedAt = new Date();

    const movementType: StockMovementType = adjustment.quantity > 0 ? "received" : "adjusted";
    await this.recordMovement(item.id, movementType, adjustment.quantity, previousQuantity, newQuantity, adjustment.reason);
    await this.checkAlerts(item);

    return item;
  },

  // Reserve stock for an order
  async reserveStock(input: ReserveStockInput): Promise<StockReservation> {
    const key = getInventoryKey(input.productId, input.variantId);
    const item = inventoryItems.get(key);

    if (!item) {
      throw new Error(`Inventory not found for product ${input.productId}`);
    }

    if (!item.trackInventory) {
      // Return dummy reservation if not tracking
      return {
        id: generateId(),
        inventoryItemId: item.id,
        orderId: input.orderId,
        quantity: input.quantity,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        status: "active",
        createdAt: new Date(),
      };
    }

    if (item.availableQuantity < input.quantity && !item.allowBackorder) {
      throw new Error(`Insufficient stock. Available: ${item.availableQuantity}, Requested: ${input.quantity}`);
    }

    const reservation: StockReservation = {
      id: generateId(),
      inventoryItemId: item.id,
      orderId: input.orderId,
      quantity: input.quantity,
      expiresAt: new Date(Date.now() + (input.expiresInMinutes ?? 30) * 60 * 1000),
      status: "active",
      createdAt: new Date(),
    };

    stockReservations.set(reservation.id, reservation);

    item.reservedQuantity += input.quantity;
    item.availableQuantity = item.quantity - item.reservedQuantity;
    item.updatedAt = new Date();

    await this.recordMovement(item.id, "reserved", input.quantity, item.quantity, item.quantity, `Order ${input.orderId}`);

    return reservation;
  },

  // Complete reservation (order confirmed/paid)
  async completeReservation(reservationId: string): Promise<void> {
    const reservation = stockReservations.get(reservationId);
    if (!reservation || reservation.status !== "active") {
      throw new Error("Reservation not found or already processed");
    }

    const item = Array.from(inventoryItems.values()).find(i => i.id === reservation.inventoryItemId);
    if (!item) {
      throw new Error("Inventory item not found");
    }

    // Deduct from actual stock
    item.quantity -= reservation.quantity;
    item.reservedQuantity -= reservation.quantity;
    item.availableQuantity = item.quantity - item.reservedQuantity;
    item.updatedAt = new Date();

    reservation.status = "completed";

    await this.recordMovement(item.id, "sold", -reservation.quantity, item.quantity + reservation.quantity, item.quantity, `Order ${reservation.orderId}`);
    await this.checkAlerts(item);
  },

  // Cancel reservation
  async cancelReservation(reservationId: string): Promise<void> {
    const reservation = stockReservations.get(reservationId);
    if (!reservation || reservation.status !== "active") {
      return; // Already cancelled or completed
    }

    const item = Array.from(inventoryItems.values()).find(i => i.id === reservation.inventoryItemId);
    if (item) {
      item.reservedQuantity -= reservation.quantity;
      item.availableQuantity = item.quantity - item.reservedQuantity;
      item.updatedAt = new Date();

      await this.recordMovement(item.id, "unreserved", reservation.quantity, item.availableQuantity - reservation.quantity, item.availableQuantity, `Order ${reservation.orderId} cancelled`);
    }

    reservation.status = "cancelled";
  },

  // Process return
  async processReturn(productId: string, variantId: string | undefined, quantity: number, orderId: string): Promise<InventoryItem> {
    const key = getInventoryKey(productId, variantId);
    const item = inventoryItems.get(key);

    if (!item) {
      throw new Error(`Inventory not found for product ${productId}`);
    }

    const previousQuantity = item.quantity;
    item.quantity += quantity;
    item.availableQuantity = item.quantity - item.reservedQuantity;
    item.updatedAt = new Date();

    await this.recordMovement(item.id, "returned", quantity, previousQuantity, item.quantity, `Return from order ${orderId}`);

    return item;
  },

  // Transfer stock between warehouses
  async transferStock(input: TransferStockInput): Promise<void> {
    // Implementation for multi-warehouse scenario
    const key = getInventoryKey(input.productId, input.variantId);
    const item = inventoryItems.get(key);

    if (!item) {
      throw new Error(`Inventory not found for product ${input.productId}`);
    }

    // For single warehouse, just record the movement
    await this.recordMovement(
      item.id,
      "transferred",
      input.quantity,
      item.quantity,
      item.quantity,
      `Transfer from ${input.fromWarehouseId} to ${input.toWarehouseId}: ${input.reason || ""}`
    );
  },

  // Check if product is in stock
  async isInStock(productId: string, variantId?: string, quantity: number = 1): Promise<boolean> {
    const item = await this.getInventory(productId, variantId);
    
    if (!item || !item.trackInventory) {
      return true; // Not tracked = always in stock
    }

    return item.availableQuantity >= quantity || item.allowBackorder;
  },

  // Get stock movements for an item
  async getStockMovements(inventoryItemId: string, limit: number = 50): Promise<StockMovement[]> {
    return stockMovements
      .filter(m => m.inventoryItemId === inventoryItemId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  },

  // Record stock movement
  async recordMovement(
    inventoryItemId: string,
    type: StockMovementType,
    quantity: number,
    previousQuantity: number,
    newQuantity: number,
    reason?: string,
    referenceType?: StockMovement["referenceType"],
    referenceId?: string
  ): Promise<StockMovement> {
    const movement: StockMovement = {
      id: generateId(),
      inventoryItemId,
      type,
      quantity,
      previousQuantity,
      newQuantity,
      reason,
      referenceType,
      referenceId,
      createdAt: new Date(),
    };

    stockMovements.push(movement);
    return movement;
  },

  // Check and create alerts
  async checkAlerts(item: InventoryItem): Promise<void> {
    // Remove old unacknowledged alerts for this item
    const existingIndex = inventoryAlerts.findIndex(
      a => a.inventoryItemId === item.id && !a.acknowledged
    );
    if (existingIndex !== -1) {
      inventoryAlerts.splice(existingIndex, 1);
    }

    if (item.availableQuantity <= 0) {
      inventoryAlerts.push({
        id: generateId(),
        inventoryItemId: item.id,
        type: "out_of_stock",
        threshold: 0,
        currentQuantity: item.availableQuantity,
        acknowledged: false,
        createdAt: new Date(),
      });
    } else if (item.availableQuantity <= item.lowStockThreshold) {
      inventoryAlerts.push({
        id: generateId(),
        inventoryItemId: item.id,
        type: "low_stock",
        threshold: item.lowStockThreshold,
        currentQuantity: item.availableQuantity,
        acknowledged: false,
        createdAt: new Date(),
      });
    }
  },

  // Get active alerts
  async getAlerts(acknowledged: boolean = false): Promise<InventoryAlert[]> {
    return inventoryAlerts.filter(a => a.acknowledged === acknowledged);
  },

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = inventoryAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
    }
  },

  // Cleanup expired reservations
  async cleanupExpiredReservations(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [id, reservation] of stockReservations) {
      if (reservation.status === "active" && reservation.expiresAt < now) {
        await this.cancelReservation(id);
        reservation.status = "expired";
        cleaned++;
      }
    }

    return cleaned;
  },
};
