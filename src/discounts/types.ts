// Discount Types
// src/discounts/types.ts

export interface DiscountCode {
  id: string;
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  appliesTo: AppliesTo;
  productIds?: string[];
  categoryIds?: string[];
  excludeProductIds?: string[];
  excludeCategoryIds?: string[];
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  usageCount: number;
  firstOrderOnly: boolean;
  validFrom?: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DiscountType = "percentage" | "fixed" | "shipping";

export type AppliesTo = "all" | "products" | "categories";

export interface DiscountUsage {
  id: string;
  discountId: string;
  orderId: string;
  customerId?: string;
  discountAmount: number;
  usedAt: Date;
}

export interface ApplyDiscountInput {
  code: string;
  cartTotal: number;
  cartItems: CartItem[];
  customerId?: string;
  isFirstOrder?: boolean;
  shippingCost?: number;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DiscountResult {
  valid: boolean;
  discountCode?: DiscountCode;
  discountAmount: number;
  discountedTotal: number;
  discountedShipping?: number;
  message?: string;
  appliedToItems?: AppliedDiscount[];
}

export interface AppliedDiscount {
  productId: string;
  variantId?: string;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
}

export interface CreateDiscountInput {
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  appliesTo?: AppliesTo;
  productIds?: string[];
  categoryIds?: string[];
  excludeProductIds?: string[];
  excludeCategoryIds?: string[];
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  firstOrderOnly?: boolean;
  validFrom?: Date;
  validUntil?: Date;
  active?: boolean;
}

export interface UpdateDiscountInput extends Partial<CreateDiscountInput> {
  id: string;
}
