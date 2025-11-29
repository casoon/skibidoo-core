// Discount Service
// src/discounts/discount-service.ts

import type {
  DiscountCode,
  DiscountUsage,
  ApplyDiscountInput,
  DiscountResult,
  CreateDiscountInput,
  UpdateDiscountInput,
  AppliedDiscount,
} from "./types.js";

// In-memory store (replace with database in production)
const discountCodes = new Map<string, DiscountCode>();
const discountUsages: DiscountUsage[] = [];

function generateId(): string {
  return crypto.randomUUID();
}

export const discountService = {
  // Create a new discount code
  async create(input: CreateDiscountInput): Promise<DiscountCode> {
    const existing = await this.getByCode(input.code);
    if (existing) {
      throw new Error(`Discount code "${input.code}" already exists`);
    }

    const discount: DiscountCode = {
      id: generateId(),
      code: input.code.toUpperCase().trim(),
      description: input.description,
      type: input.type,
      value: input.value,
      minOrderValue: input.minOrderValue,
      maxDiscount: input.maxDiscount,
      appliesTo: input.appliesTo ?? "all",
      productIds: input.productIds,
      categoryIds: input.categoryIds,
      excludeProductIds: input.excludeProductIds,
      excludeCategoryIds: input.excludeCategoryIds,
      usageLimit: input.usageLimit,
      usageLimitPerCustomer: input.usageLimitPerCustomer,
      usageCount: 0,
      firstOrderOnly: input.firstOrderOnly ?? false,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      active: input.active ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    discountCodes.set(discount.id, discount);
    return discount;
  },

  // Update discount code
  async update(input: UpdateDiscountInput): Promise<DiscountCode> {
    const discount = discountCodes.get(input.id);
    if (!discount) {
      throw new Error("Discount not found");
    }

    if (input.code && input.code !== discount.code) {
      const existing = await this.getByCode(input.code);
      if (existing) {
        throw new Error(`Discount code "${input.code}" already exists`);
      }
    }

    Object.assign(discount, {
      ...input,
      code: input.code?.toUpperCase().trim() ?? discount.code,
      updatedAt: new Date(),
    });

    return discount;
  },

  // Delete discount code
  async delete(id: string): Promise<void> {
    discountCodes.delete(id);
  },

  // Get discount by ID
  async getById(id: string): Promise<DiscountCode | null> {
    return discountCodes.get(id) || null;
  },

  // Get discount by code
  async getByCode(code: string): Promise<DiscountCode | null> {
    const normalizedCode = code.toUpperCase().trim();
    for (const discount of discountCodes.values()) {
      if (discount.code === normalizedCode) {
        return discount;
      }
    }
    return null;
  },

  // Get all discount codes
  async getAll(options?: {
    active?: boolean;
    type?: string;
  }): Promise<DiscountCode[]> {
    let discounts = Array.from(discountCodes.values());

    if (options?.active !== undefined) {
      discounts = discounts.filter(d => d.active === options.active);
    }
    if (options?.type) {
      discounts = discounts.filter(d => d.type === options.type);
    }

    return discounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  // Validate and apply discount
  async applyDiscount(input: ApplyDiscountInput): Promise<DiscountResult> {
    const discount = await this.getByCode(input.code);

    if (!discount) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode nicht gefunden",
      };
    }

    // Check if active
    if (!discount.active) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode ist nicht aktiv",
      };
    }

    // Check validity period
    const now = new Date();
    if (discount.validFrom && now < discount.validFrom) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode ist noch nicht gueltig",
      };
    }
    if (discount.validUntil && now > discount.validUntil) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode ist abgelaufen",
      };
    }

    // Check usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode wurde bereits zu oft verwendet",
      };
    }

    // Check per-customer usage limit
    if (discount.usageLimitPerCustomer && input.customerId) {
      const customerUsages = discountUsages.filter(
        u => u.discountId === discount.id && u.customerId === input.customerId
      );
      if (customerUsages.length >= discount.usageLimitPerCustomer) {
        return {
          valid: false,
          discountAmount: 0,
          discountedTotal: input.cartTotal,
          message: "Sie haben diesen Rabattcode bereits verwendet",
        };
      }
    }

    // Check first order only
    if (discount.firstOrderOnly && !input.isFirstOrder) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: "Rabattcode nur fuer Erstbestellungen gueltig",
      };
    }

    // Check minimum order value
    if (discount.minOrderValue && input.cartTotal < discount.minOrderValue) {
      return {
        valid: false,
        discountAmount: 0,
        discountedTotal: input.cartTotal,
        message: `Mindestbestellwert: ${discount.minOrderValue.toFixed(2)} EUR`,
      };
    }

    // Calculate discount
    let discountAmount = 0;
    let discountedShipping = input.shippingCost;
    const appliedToItems: AppliedDiscount[] = [];

    if (discount.type === "shipping") {
      // Free shipping
      discountAmount = input.shippingCost ?? 0;
      discountedShipping = 0;
    } else {
      // Get applicable items
      const applicableItems = this.getApplicableItems(input.cartItems, discount);
      const applicableTotal = applicableItems.reduce((sum, item) => sum + item.totalPrice, 0);

      if (applicableTotal === 0) {
        return {
          valid: false,
          discountAmount: 0,
          discountedTotal: input.cartTotal,
          message: "Keine Produkte im Warenkorb sind rabattfaehig",
        };
      }

      if (discount.type === "percentage") {
        discountAmount = (applicableTotal * discount.value) / 100;
      } else if (discount.type === "fixed") {
        discountAmount = Math.min(discount.value, applicableTotal);
      }

      // Apply max discount cap
      if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
        discountAmount = discount.maxDiscount;
      }

      // Calculate per-item discounts
      for (const item of applicableItems) {
        const itemDiscount = (item.totalPrice / applicableTotal) * discountAmount;
        appliedToItems.push({
          productId: item.productId,
          variantId: item.variantId,
          originalPrice: item.totalPrice,
          discountedPrice: item.totalPrice - itemDiscount,
          discountAmount: itemDiscount,
        });
      }
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    const discountedTotal = Math.round((input.cartTotal - discountAmount) * 100) / 100;

    return {
      valid: true,
      discountCode: discount,
      discountAmount,
      discountedTotal: Math.max(0, discountedTotal),
      discountedShipping,
      appliedToItems,
    };
  },

  // Get items that the discount applies to
  getApplicableItems(items: ApplyDiscountInput["cartItems"], discount: DiscountCode) {
    return items.filter(item => {
      // Check exclusions first
      if (discount.excludeProductIds?.includes(item.productId)) {
        return false;
      }
      if (item.categoryId && discount.excludeCategoryIds?.includes(item.categoryId)) {
        return false;
      }

      // Check inclusions
      if (discount.appliesTo === "all") {
        return true;
      }
      if (discount.appliesTo === "products" && discount.productIds) {
        return discount.productIds.includes(item.productId);
      }
      if (discount.appliesTo === "categories" && discount.categoryIds && item.categoryId) {
        return discount.categoryIds.includes(item.categoryId);
      }

      return false;
    });
  },

  // Record discount usage
  async recordUsage(discountId: string, orderId: string, customerId: string | undefined, discountAmount: number): Promise<void> {
    const discount = discountCodes.get(discountId);
    if (!discount) return;

    discount.usageCount++;
    discount.updatedAt = new Date();

    discountUsages.push({
      id: generateId(),
      discountId,
      orderId,
      customerId,
      discountAmount,
      usedAt: new Date(),
    });
  },

  // Get usage statistics
  async getUsageStats(discountId: string): Promise<{
    totalUsages: number;
    totalDiscountAmount: number;
    usages: DiscountUsage[];
  }> {
    const usages = discountUsages.filter(u => u.discountId === discountId);
    const totalDiscountAmount = usages.reduce((sum, u) => sum + u.discountAmount, 0);

    return {
      totalUsages: usages.length,
      totalDiscountAmount,
      usages: usages.sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime()),
    };
  },

  // Generate random discount code
  generateCode(length: number = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },
};
