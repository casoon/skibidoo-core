import { baseTemplate } from "./base";
import { compileMjml, interpolate, formatPrice, formatDate, type TemplateData } from "../template-utils";

export interface OrderConfirmationData {
  orderNumber: string;
  customerName: string;
  email: string;
  orderDate: Date | string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  shipping: number;
  discount?: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  paymentMethod: string;
  deliveryTime?: string;
  shopUrl: string;
}

const orderConfirmationContent = `
    <mj-section background-color="#ffffff" padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#111827" padding-bottom="10px">
          Vielen Dank fuer Ihre Bestellung!
        </mj-text>
        <mj-text padding-bottom="20px">
          Hallo {{customerName}},<br/><br/>
          wir haben Ihre Bestellung erhalten und bearbeiten diese schnellstmoeglich.
        </mj-text>
        <mj-divider border-color="#e5e7eb" border-width="1px" />
      </mj-column>
    </mj-section>

    <!-- Order Info -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="12px" color="#6b7280">BESTELLNUMMER</mj-text>
        <mj-text font-size="18px" font-weight="600" color="#111827" padding-top="5px">
          #{{orderNumber}}
        </mj-text>
      </mj-column>
      <mj-column>
        <mj-text font-size="12px" color="#6b7280">BESTELLDATUM</mj-text>
        <mj-text font-size="18px" font-weight="600" color="#111827" padding-top="5px">
          {{orderDateFormatted}}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Order Items -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="16px" font-weight="600" color="#111827" padding-bottom="15px">
          Ihre Bestellung
        </mj-text>
        <mj-table>
          {{itemsHtml}}
        </mj-table>
      </mj-column>
    </mj-section>

    <!-- Totals -->
    <mj-section background-color="#f9fafb" padding="20px">
      <mj-column>
        <mj-table>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Zwischensumme</td>
            <td style="padding: 8px 0; text-align: right;">{{subtotalFormatted}}</td>
          </tr>
          {{discountRow}}
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Versand</td>
            <td style="padding: 8px 0; text-align: right;">{{shippingFormatted}}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 15px 0 8px; font-weight: 700; font-size: 18px;">Gesamt</td>
            <td style="padding: 15px 0 8px; text-align: right; font-weight: 700; font-size: 18px;">{{totalFormatted}}</td>
          </tr>
          <tr>
            <td colspan="2" style="color: #6b7280; font-size: 12px;">inkl. MwSt.</td>
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>

    <!-- Addresses -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="14px" font-weight="600" color="#111827" padding-bottom="10px">
          Lieferadresse
        </mj-text>
        <mj-text font-size="14px" line-height="1.8">
          {{shippingAddress.firstName}} {{shippingAddress.lastName}}<br/>
          {{shippingAddress.street}}<br/>
          {{shippingAddress.zip}} {{shippingAddress.city}}<br/>
          {{shippingAddress.country}}
        </mj-text>
      </mj-column>
      <mj-column>
        <mj-text font-size="14px" font-weight="600" color="#111827" padding-bottom="10px">
          Rechnungsadresse
        </mj-text>
        <mj-text font-size="14px" line-height="1.8">
          {{billingAddressHtml}}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Payment & Delivery -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="14px" font-weight="600" color="#111827" padding-bottom="5px">
          Zahlungsart
        </mj-text>
        <mj-text>{{paymentMethod}}</mj-text>
      </mj-column>
      <mj-column>
        <mj-text font-size="14px" font-weight="600" color="#111827" padding-bottom="5px">
          Voraussichtliche Lieferzeit
        </mj-text>
        <mj-text>{{deliveryTime}}</mj-text>
      </mj-column>
    </mj-section>

    <!-- CTA -->
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-button href="{{shopUrl}}/account/orders/{{orderNumber}}">
          Bestellung ansehen
        </mj-button>
      </mj-column>
    </mj-section>
`;

export function renderOrderConfirmation(data: OrderConfirmationData): { html: string; text: string; subject: string } {
  const subject = `Bestellbestaetigung #${data.orderNumber}`;

  // Build items HTML
  const itemsHtml = data.items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 0;">
        <strong>${item.name}</strong><br/>
        <span style="color: #6b7280; font-size: 12px;">Menge: ${item.quantity}</span>
      </td>
      <td style="padding: 12px 0; text-align: right; white-space: nowrap;">
        ${formatPrice(item.totalPrice)}
      </td>
    </tr>
  `).join("");

  // Build discount row if applicable
  const discountRow = data.discount && data.discount > 0
    ? `<tr><td style="padding: 8px 0; color: #059669;">Rabatt</td><td style="padding: 8px 0; text-align: right; color: #059669;">-${formatPrice(data.discount)}</td></tr>`
    : "";

  // Build billing address
  const billingAddr = data.billingAddress || data.shippingAddress;
  const billingAddressHtml = `${billingAddr.firstName} ${billingAddr.lastName}<br/>${billingAddr.street}<br/>${billingAddr.zip} ${billingAddr.city}<br/>${billingAddr.country}`;

  const templateData: TemplateData = {
    subject,
    customerName: data.customerName,
    orderNumber: data.orderNumber,
    orderDateFormatted: formatDate(data.orderDate),
    itemsHtml,
    subtotalFormatted: formatPrice(data.subtotal),
    shippingFormatted: data.shipping > 0 ? formatPrice(data.shipping) : "Kostenlos",
    discountRow,
    totalFormatted: formatPrice(data.total),
    shippingAddress: data.shippingAddress,
    billingAddressHtml,
    paymentMethod: data.paymentMethod,
    deliveryTime: data.deliveryTime || "3-5 Werktage",
    shopUrl: data.shopUrl,
  };

  const content = interpolate(orderConfirmationContent, templateData);
  const mjml = interpolate(baseTemplate.replace("{{content}}", content), templateData);
  const html = compileMjml(mjml);

  // Plain text version
  const text = `
Bestellbestaetigung #${data.orderNumber}

Hallo ${data.customerName},

vielen Dank fuer Ihre Bestellung bei Skibidoo!

Bestellnummer: #${data.orderNumber}
Bestelldatum: ${formatDate(data.orderDate)}

Ihre Bestellung:
${data.items.map(item => `- ${item.name} (${item.quantity}x) - ${formatPrice(item.totalPrice)}`).join("\n")}

Zwischensumme: ${formatPrice(data.subtotal)}
Versand: ${data.shipping > 0 ? formatPrice(data.shipping) : "Kostenlos"}
${data.discount ? `Rabatt: -${formatPrice(data.discount)}` : ""}
Gesamt: ${formatPrice(data.total)} (inkl. MwSt.)

Lieferadresse:
${data.shippingAddress.firstName} ${data.shippingAddress.lastName}
${data.shippingAddress.street}
${data.shippingAddress.zip} ${data.shippingAddress.city}

Voraussichtliche Lieferzeit: ${data.deliveryTime || "3-5 Werktage"}

Bei Fragen zu Ihrer Bestellung kontaktieren Sie uns gerne.

Mit freundlichen Gruessen,
Ihr Skibidoo Team
  `.trim();

  return { html, text, subject };
}
