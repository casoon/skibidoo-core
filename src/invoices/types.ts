export interface InvoiceData {
  // Invoice details
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate?: Date | string;

  // Order reference
  orderNumber: string;
  orderDate: Date | string;

  // Seller (Shop)
  seller: {
    name: string;
    address: string;
    zip: string;
    city: string;
    country: string;
    email?: string;
    phone?: string;
    website?: string;
    taxId?: string; // USt-IdNr.
    registrationNumber?: string; // Handelsregister
    bankName?: string;
    iban?: string;
    bic?: string;
  };

  // Buyer (Customer)
  buyer: {
    name: string;
    company?: string;
    address: string;
    zip: string;
    city: string;
    country: string;
    email?: string;
    taxId?: string;
  };

  // Line items
  items: Array<{
    description: string;
    sku?: string;
    quantity: number;
    unitPrice: number; // net price in cents
    taxRate: number; // e.g., 19 for 19%
    totalNet: number; // in cents
    totalGross: number; // in cents
  }>;

  // Totals
  subtotalNet: number;
  subtotalGross: number;
  shippingNet: number;
  shippingGross: number;
  shippingTaxRate: number;
  discount?: number;
  discountDescription?: string;

  // Tax breakdown
  taxBreakdown: Array<{
    rate: number;
    netAmount: number;
    taxAmount: number;
  }>;

  totalNet: number;
  totalTax: number;
  totalGross: number;

  // Payment
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "refunded";
  paidAt?: Date | string;

  // Notes
  notes?: string;
  footerText?: string;
}

export interface InvoiceConfig {
  primaryColor?: string;
  logoUrl?: string;
  currency?: string;
  locale?: string;
}

export function formatCurrency(cents: number, currency = "EUR", locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string, locale = "de-DE"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} %`;
}
