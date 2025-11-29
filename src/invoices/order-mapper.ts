import { type InvoiceData } from "./types";

// Default seller info - should be configured via env or settings
const DEFAULT_SELLER = {
  name: "Skibidoo GmbH",
  address: "Musterstrasse 123",
  zip: "12345",
  city: "Berlin",
  country: "Deutschland",
  email: "info@skibidoo.de",
  website: "www.skibidoo.de",
  taxId: "DE123456789",
  registrationNumber: "HRB 12345 B",
  bankName: "Deutsche Bank",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
};

export interface OrderToInvoiceParams {
  order: {
    id: string;
    orderNumber: string;
    createdAt: Date | string;
    email: string;
    paymentMethod: string;
    paymentStatus: "pending" | "paid" | "refunded";
    paidAt?: Date | string;
    items: Array<{
      productName: string;
      sku?: string;
      quantity: number;
      unitPriceNet: number;
      unitPriceGross: number;
      totalNet: number;
      totalGross: number;
      taxRate: number;
    }>;
    shippingNet: number;
    shippingGross: number;
    shippingTaxRate: number;
    discountTotal?: number;
    discountCode?: string;
    subtotalNet: number;
    subtotalGross: number;
    totalNet: number;
    totalTax: number;
    totalGross: number;
    billingAddress: {
      firstName: string;
      lastName: string;
      company?: string;
      street: string;
      zip: string;
      city: string;
      country: string;
    };
    customerTaxId?: string;
  };
  invoiceNumber: string;
  invoiceDate?: Date;
  dueDate?: Date;
  seller?: typeof DEFAULT_SELLER;
  notes?: string;
}

export function orderToInvoiceData(params: OrderToInvoiceParams): InvoiceData {
  const { order, invoiceNumber, invoiceDate, dueDate, seller, notes } = params;

  // Build tax breakdown
  const taxMap = new Map<number, { netAmount: number; taxAmount: number }>();

  for (const item of order.items) {
    const existing = taxMap.get(item.taxRate) || { netAmount: 0, taxAmount: 0 };
    existing.netAmount += item.totalNet;
    existing.taxAmount += item.totalGross - item.totalNet;
    taxMap.set(item.taxRate, existing);
  }

  // Add shipping tax
  if (order.shippingNet > 0) {
    const existing = taxMap.get(order.shippingTaxRate) || { netAmount: 0, taxAmount: 0 };
    existing.netAmount += order.shippingNet;
    existing.taxAmount += order.shippingGross - order.shippingNet;
    taxMap.set(order.shippingTaxRate, existing);
  }

  const taxBreakdown = Array.from(taxMap.entries()).map(([rate, amounts]) => ({
    rate,
    netAmount: amounts.netAmount,
    taxAmount: amounts.taxAmount,
  }));

  // Build buyer info
  const buyerName = order.billingAddress.company
    ? order.billingAddress.company
    : `${order.billingAddress.firstName} ${order.billingAddress.lastName}`;

  return {
    invoiceNumber,
    invoiceDate: invoiceDate || new Date(),
    dueDate,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    seller: seller || DEFAULT_SELLER,
    buyer: {
      name: `${order.billingAddress.firstName} ${order.billingAddress.lastName}`,
      company: order.billingAddress.company,
      address: order.billingAddress.street,
      zip: order.billingAddress.zip,
      city: order.billingAddress.city,
      country: order.billingAddress.country,
      email: order.email,
      taxId: order.customerTaxId,
    },
    items: order.items.map((item) => ({
      description: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPriceNet,
      taxRate: item.taxRate,
      totalNet: item.totalNet,
      totalGross: item.totalGross,
    })),
    subtotalNet: order.subtotalNet,
    subtotalGross: order.subtotalGross,
    shippingNet: order.shippingNet,
    shippingGross: order.shippingGross,
    shippingTaxRate: order.shippingTaxRate,
    discount: order.discountTotal,
    discountDescription: order.discountCode ? `Gutschein: ${order.discountCode}` : undefined,
    taxBreakdown,
    totalNet: order.totalNet,
    totalTax: order.totalTax,
    totalGross: order.totalGross,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
    notes,
  };
}

let invoiceCounter = 0;

export function generateInvoiceNumber(prefix = "RE"): string {
  const year = new Date().getFullYear();
  const counter = String(++invoiceCounter).padStart(6, "0");
  return `${prefix}-${year}-${counter}`;
}
