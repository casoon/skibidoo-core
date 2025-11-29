import { Hono } from "hono";
import { generateInvoicePdf } from "./pdf-generator";
import { orderToInvoiceData, generateInvoiceNumber } from "./order-mapper";
import { logger } from "@/config/logger";

export const invoiceRoutes = new Hono();

// Demo endpoint to test PDF generation
invoiceRoutes.get("/demo", async (c) => {
  const demoOrder = {
    id: "demo-123",
    orderNumber: "SK-2024-00001",
    createdAt: new Date(),
    email: "kunde@example.de",
    paymentMethod: "Kreditkarte",
    paymentStatus: "paid" as const,
    paidAt: new Date(),
    items: [
      {
        productName: "Premium Wireless Kopfhoerer",
        sku: "WH-1000XM5",
        quantity: 1,
        unitPriceNet: 25126,
        unitPriceGross: 29900,
        totalNet: 25126,
        totalGross: 29900,
        taxRate: 19,
      },
      {
        productName: "USB-C Ladekabel 2m",
        sku: "USBC-2M-BLK",
        quantity: 2,
        unitPriceNet: 839,
        unitPriceGross: 999,
        totalNet: 1678,
        totalGross: 1998,
        taxRate: 19,
      },
    ],
    shippingNet: 420,
    shippingGross: 499,
    shippingTaxRate: 19,
    discountTotal: 1000,
    discountCode: "WELCOME10",
    subtotalNet: 26804,
    subtotalGross: 31898,
    totalNet: 26224,
    totalTax: 4973,
    totalGross: 31397,
    billingAddress: {
      firstName: "Max",
      lastName: "Mustermann",
      company: "Musterfirma GmbH",
      street: "Beispielweg 42",
      zip: "10115",
      city: "Berlin",
      country: "Deutschland",
    },
    customerTaxId: "DE987654321",
  };

  try {
    const invoiceData = orderToInvoiceData({
      order: demoOrder,
      invoiceNumber: generateInvoiceNumber(),
      notes: "Vielen Dank fuer Ihren Einkauf bei Skibidoo!",
    });

    const pdfBuffer = await generateInvoicePdf(invoiceData);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rechnung-${invoiceData.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to generate demo invoice");
    return c.json({ error: "Failed to generate invoice" }, 500);
  }
});

// Generate invoice for order ID
invoiceRoutes.get("/order/:orderId", async (c) => {
  const orderId = c.req.param("orderId");

  // TODO: Fetch order from database
  // For now, return error
  return c.json({ error: "Not implemented - requires order service integration" }, 501);
});

// Download invoice by invoice number
invoiceRoutes.get("/download/:invoiceNumber", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");

  // TODO: Fetch invoice from database
  return c.json({ error: "Not implemented - requires invoice storage" }, 501);
});
