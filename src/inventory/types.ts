// Inventory Types
// src/inventory/types.ts

export interface InventoryItem {
  id: string;
  productId: string;
  variantId?: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  warehouseId?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  type: StockMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceType?: "order" | "return" | "adjustment" | "transfer";
  referenceId?: string;
  createdBy?: string;
  createdAt: Date;
}

export type StockMovementType =
  | "received"      // Wareneingang
  | "sold"          // Verkauf
  | "returned"      // Retoure
  | "adjusted"      // Manuelle Korrektur
  | "reserved"      // Reservierung (Bestellung)
  | "unreserved"    // Reservierung aufgehoben
  | "transferred"   // Lagerumbuchung
  | "damaged"       // Beschaedigt
  | "lost";         // Verlust/Schwund

export interface StockReservation {
  id: string;
  inventoryItemId: string;
  orderId: string;
  quantity: number;
  expiresAt: Date;
  status: "active" | "completed" | "cancelled" | "expired";
  createdAt: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAlert {
  id: string;
  inventoryItemId: string;
  type: "low_stock" | "out_of_stock" | "overstock";
  threshold: number;
  currentQuantity: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface StockAdjustment {
  productId: string;
  variantId?: string;
  quantity: number;
  reason: string;
}

export interface ReserveStockInput {
  productId: string;
  variantId?: string;
  quantity: number;
  orderId: string;
  expiresInMinutes?: number;
}

export interface TransferStockInput {
  productId: string;
  variantId?: string;
  quantity: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  reason?: string;
}
