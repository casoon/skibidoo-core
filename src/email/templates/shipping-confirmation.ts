import { baseTemplate } from "./base";
import { compileMjml, interpolate, formatPrice, formatDate, type TemplateData } from "../template-utils";

export interface ShippingConfirmationData {
  orderNumber: string;
  customerName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier: string;
  estimatedDelivery?: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  shopUrl: string;
}

const shippingConfirmationContent = `
    <mj-section background-color="#ffffff" padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#111827" padding-bottom="10px">
          Ihre Bestellung ist unterwegs!
        </mj-text>
        <mj-text padding-bottom="20px">
          Hallo {{customerName}},<br/><br/>
          gute Nachrichten! Ihre Bestellung #{{orderNumber}} wurde versendet.
        </mj-text>
        <mj-divider border-color="#e5e7eb" border-width="1px" />
      </mj-column>
    </mj-section>

    <!-- Tracking Info -->
    <mj-section background-color="#f0fdf4" padding="20px" border-radius="8px">
      <mj-column>
        <mj-text font-size="14px" font-weight="600" color="#166534" padding-bottom="10px">
          Sendungsverfolgung
        </mj-text>
        <mj-text color="#166534">
          Versanddienstleister: {{carrier}}<br/>
          {{trackingInfo}}
        </mj-text>
        {{trackingButton}}
      </mj-column>
    </mj-section>

    <!-- Estimated Delivery -->
    {{estimatedDeliverySection}}

    <!-- Items -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="16px" font-weight="600" color="#111827" padding-bottom="15px">
          Versendete Artikel
        </mj-text>
        {{itemsList}}
      </mj-column>
    </mj-section>

    <!-- Shipping Address -->
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

export function renderShippingConfirmation(data: ShippingConfirmationData): { html: string; text: string; subject: string } {
  const subject = `Ihre Bestellung #${data.orderNumber} wurde versendet`;

  const trackingInfo = data.trackingNumber
    ? `Sendungsnummer: ${data.trackingNumber}`
    : "Sendungsnummer wird in Kuerze bereitgestellt";

  const trackingButton = data.trackingUrl
    ? `<mj-button href="${data.trackingUrl}" background-color="#166534" padding-top="15px">Sendung verfolgen</mj-button>`
    : "";

  const estimatedDeliverySection = data.estimatedDelivery
    ? `<mj-section background-color="#ffffff" padding="20px">
        <mj-column>
          <mj-text font-size="14px" color="#6b7280">Voraussichtliche Zustellung</mj-text>
          <mj-text font-size="18px" font-weight="600" color="#111827" padding-top="5px">${data.estimatedDelivery}</mj-text>
        </mj-column>
      </mj-section>`
    : "";

  const itemsList = data.items.map(item =>
    `<mj-text padding="5px 0">- ${item.name} (${item.quantity}x)</mj-text>`
  ).join("");

  const templateData: TemplateData = {
    subject,
    customerName: data.customerName,
    orderNumber: data.orderNumber,
    carrier: data.carrier,
    trackingInfo,
    trackingButton,
    estimatedDeliverySection,
    itemsList,
    shippingAddress: data.shippingAddress,
    shopUrl: data.shopUrl,
  };

  const content = interpolate(shippingConfirmationContent, templateData);
  const mjml = interpolate(baseTemplate.replace("{{content}}", content), templateData);
  const html = compileMjml(mjml);

  const text = `
Ihre Bestellung #${data.orderNumber} wurde versendet

Hallo ${data.customerName},

gute Nachrichten! Ihre Bestellung wurde versendet.

Versanddienstleister: ${data.carrier}
${data.trackingNumber ? `Sendungsnummer: ${data.trackingNumber}` : ""}
${data.trackingUrl ? `Sendung verfolgen: ${data.trackingUrl}` : ""}
${data.estimatedDelivery ? `Voraussichtliche Zustellung: ${data.estimatedDelivery}` : ""}

Versendete Artikel:
${data.items.map(item => `- ${item.name} (${item.quantity}x)`).join("\n")}

Lieferadresse:
${data.shippingAddress.firstName} ${data.shippingAddress.lastName}
${data.shippingAddress.street}
${data.shippingAddress.zip} ${data.shippingAddress.city}

Mit freundlichen Gruessen,
Ihr Skibidoo Team
  `.trim();

  return { html, text, subject };
}
