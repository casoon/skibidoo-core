import PDFDocument from "pdfkit";
import { type InvoiceData, type InvoiceConfig, formatCurrency, formatDate, formatPercent } from "./types";

const DEFAULT_CONFIG: InvoiceConfig = {
  primaryColor: "#7c3aed",
  currency: "EUR",
  locale: "de-DE",
};

export async function generateInvoicePdf(
  data: InvoiceData,
  config: InvoiceConfig = {}
): Promise<Buffer> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Rechnung ${data.invoiceNumber}`,
        Author: data.seller.name,
        Subject: `Rechnung fuer Bestellung ${data.orderNumber}`,
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Colors
    const primaryColor = cfg.primaryColor!;
    const textColor = "#1f2937";
    const mutedColor = "#6b7280";
    const lineColor = "#e5e7eb";

    // Page dimensions
    const pageWidth = doc.page.width - 100;
    const leftCol = 50;
    const rightCol = 350;

    let y = 50;

    // Header - Company Name (as logo replacement)
    doc.fontSize(24).fillColor(primaryColor).text(data.seller.name, leftCol, y);
    y += 40;

    // Invoice Title
    doc.fontSize(20).fillColor(textColor).text("RECHNUNG", leftCol, y);
    y += 35;

    // Invoice details box
    doc.fontSize(10).fillColor(mutedColor);
    doc.text("Rechnungsnummer:", leftCol, y);
    doc.fillColor(textColor).text(data.invoiceNumber, leftCol + 110, y);
    y += 15;

    doc.fillColor(mutedColor).text("Rechnungsdatum:", leftCol, y);
    doc.fillColor(textColor).text(formatDate(data.invoiceDate, cfg.locale), leftCol + 110, y);
    y += 15;

    doc.fillColor(mutedColor).text("Bestellnummer:", leftCol, y);
    doc.fillColor(textColor).text(data.orderNumber, leftCol + 110, y);
    y += 15;

    doc.fillColor(mutedColor).text("Bestelldatum:", leftCol, y);
    doc.fillColor(textColor).text(formatDate(data.orderDate, cfg.locale), leftCol + 110, y);
    y += 15;

    if (data.dueDate) {
      doc.fillColor(mutedColor).text("Faellig am:", leftCol, y);
      doc.fillColor(textColor).text(formatDate(data.dueDate, cfg.locale), leftCol + 110, y);
      y += 15;
    }

    // Seller address (right side)
    let sellerY = 95;
    doc.fontSize(9).fillColor(mutedColor);
    doc.text(data.seller.name, rightCol, sellerY, { width: 200, align: "right" });
    sellerY += 12;
    doc.text(data.seller.address, rightCol, sellerY, { width: 200, align: "right" });
    sellerY += 12;
    doc.text(`${data.seller.zip} ${data.seller.city}`, rightCol, sellerY, { width: 200, align: "right" });
    sellerY += 12;
    doc.text(data.seller.country, rightCol, sellerY, { width: 200, align: "right" });
    sellerY += 12;
    if (data.seller.taxId) {
      doc.text(`USt-IdNr.: ${data.seller.taxId}`, rightCol, sellerY, { width: 200, align: "right" });
    }

    y += 30;

    // Divider
    doc.moveTo(leftCol, y).lineTo(leftCol + pageWidth, y).strokeColor(lineColor).lineWidth(1).stroke();
    y += 20;

    // Buyer address
    doc.fontSize(10).fillColor(mutedColor).text("Rechnungsempfaenger:", leftCol, y);
    y += 18;

    doc.fontSize(11).fillColor(textColor);
    if (data.buyer.company) {
      doc.font("Helvetica-Bold").text(data.buyer.company, leftCol, y);
      y += 14;
      doc.font("Helvetica");
    }
    doc.text(data.buyer.name, leftCol, y);
    y += 14;
    doc.text(data.buyer.address, leftCol, y);
    y += 14;
    doc.text(`${data.buyer.zip} ${data.buyer.city}`, leftCol, y);
    y += 14;
    doc.text(data.buyer.country, leftCol, y);
    y += 14;
    if (data.buyer.taxId) {
      doc.fontSize(9).fillColor(mutedColor).text(`USt-IdNr.: ${data.buyer.taxId}`, leftCol, y);
      y += 14;
    }

    y += 30;

    // Items table header
    const colPos = { desc: leftCol, qty: 320, unit: 380, total: 480 };

    doc.fontSize(9).fillColor(mutedColor);
    doc.text("Beschreibung", colPos.desc, y);
    doc.text("Menge", colPos.qty, y);
    doc.text("Einzelpreis", colPos.unit, y);
    doc.text("Gesamt", colPos.total, y);
    y += 5;

    // Header line
    doc.moveTo(leftCol, y + 10).lineTo(leftCol + pageWidth, y + 10).strokeColor(lineColor).stroke();
    y += 20;

    // Items
    doc.fontSize(10).fillColor(textColor);
    for (const item of data.items) {
      // Check for page break
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.font("Helvetica").text(item.description, colPos.desc, y, { width: 250 });
      if (item.sku) {
        doc.fontSize(8).fillColor(mutedColor).text(`Art.Nr.: ${item.sku}`, colPos.desc, y + 12);
        doc.fontSize(10).fillColor(textColor);
      }
      doc.text(String(item.quantity), colPos.qty, y);
      doc.text(formatCurrency(item.unitPrice, cfg.currency, cfg.locale), colPos.unit, y);
      doc.text(formatCurrency(item.totalNet, cfg.currency, cfg.locale), colPos.total, y);

      // Tax rate
      doc.fontSize(8).fillColor(mutedColor);
      doc.text(`(${formatPercent(item.taxRate)} MwSt.)`, colPos.total, y + 12);
      doc.fontSize(10).fillColor(textColor);

      y += item.sku ? 35 : 25;
    }

    // Items bottom line
    doc.moveTo(leftCol, y).lineTo(leftCol + pageWidth, y).strokeColor(lineColor).stroke();
    y += 20;

    // Totals section (right aligned)
    const totalsX = 380;
    const totalsValueX = 480;

    doc.fontSize(10).fillColor(textColor);
    doc.text("Zwischensumme (netto):", totalsX, y);
    doc.text(formatCurrency(data.subtotalNet, cfg.currency, cfg.locale), totalsValueX, y);
    y += 16;

    if (data.shippingNet > 0) {
      doc.text("Versandkosten (netto):", totalsX, y);
      doc.text(formatCurrency(data.shippingNet, cfg.currency, cfg.locale), totalsValueX, y);
      y += 16;
    }

    if (data.discount && data.discount > 0) {
      doc.fillColor("#059669");
      doc.text(data.discountDescription || "Rabatt:", totalsX, y);
      doc.text(`-${formatCurrency(data.discount, cfg.currency, cfg.locale)}`, totalsValueX, y);
      doc.fillColor(textColor);
      y += 16;
    }

    // Tax breakdown
    y += 5;
    for (const tax of data.taxBreakdown) {
      doc.fillColor(mutedColor).fontSize(9);
      doc.text(`MwSt. ${formatPercent(tax.rate)} auf ${formatCurrency(tax.netAmount, cfg.currency, cfg.locale)}:`, totalsX, y);
      doc.text(formatCurrency(tax.taxAmount, cfg.currency, cfg.locale), totalsValueX, y);
      y += 14;
    }

    // Total line
    y += 5;
    doc.moveTo(totalsX, y).lineTo(leftCol + pageWidth, y).strokeColor(primaryColor).lineWidth(2).stroke();
    y += 10;

    // Grand total
    doc.fontSize(12).font("Helvetica-Bold").fillColor(textColor);
    doc.text("Gesamtbetrag:", totalsX, y);
    doc.text(formatCurrency(data.totalGross, cfg.currency, cfg.locale), totalsValueX, y);
    y += 20;

    doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
    doc.text("(inkl. MwSt.)", totalsValueX, y);
    y += 30;

    // Payment info
    doc.fontSize(10).fillColor(textColor);
    doc.text(`Zahlungsart: ${data.paymentMethod}`, leftCol, y);
    y += 14;

    if (data.paymentStatus === "paid" && data.paidAt) {
      doc.fillColor("#059669").text(`Bezahlt am ${formatDate(data.paidAt, cfg.locale)}`, leftCol, y);
      y += 14;
    } else if (data.paymentStatus === "pending") {
      doc.fillColor("#d97706").text("Zahlung ausstehend", leftCol, y);
      y += 14;
    }

    // Bank details
    if (data.seller.iban && data.paymentStatus !== "paid") {
      y += 10;
      doc.fillColor(textColor).fontSize(9);
      doc.text("Bankverbindung:", leftCol, y);
      y += 12;
      doc.fillColor(mutedColor);
      if (data.seller.bankName) {
        doc.text(data.seller.bankName, leftCol, y);
        y += 12;
      }
      doc.text(`IBAN: ${data.seller.iban}`, leftCol, y);
      y += 12;
      if (data.seller.bic) {
        doc.text(`BIC: ${data.seller.bic}`, leftCol, y);
        y += 12;
      }
    }

    // Notes
    if (data.notes) {
      y += 20;
      doc.fontSize(9).fillColor(mutedColor).text("Hinweise:", leftCol, y);
      y += 12;
      doc.fillColor(textColor).text(data.notes, leftCol, y, { width: pageWidth });
    }

    // Footer
    const footerY = doc.page.height - 80;
    doc.fontSize(8).fillColor(mutedColor);

    const footerText = data.footerText || [
      data.seller.name,
      data.seller.registrationNumber ? `Handelsregister: ${data.seller.registrationNumber}` : null,
      data.seller.taxId ? `USt-IdNr.: ${data.seller.taxId}` : null,
      data.seller.email,
      data.seller.website,
    ].filter(Boolean).join(" | ");

    doc.text(footerText, leftCol, footerY, { width: pageWidth, align: "center" });

    // Page number
    doc.text(`Seite 1 von 1`, leftCol, footerY + 15, { width: pageWidth, align: "center" });

    doc.end();
  });
}
