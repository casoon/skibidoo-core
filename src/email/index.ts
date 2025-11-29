export { sendEmail, getTransporter, verifyConnection, type SendEmailOptions } from "./mailer";
export { compileMjml, interpolate, formatPrice, formatDate, formatDateTime } from "./template-utils";
export * from "./templates";

import { sendEmail } from "./mailer";
import {
  renderOrderConfirmation,
  renderShippingConfirmation,
  renderPasswordReset,
  renderWelcomeEmail,
  renderNewsletterConfirm,
  type OrderConfirmationData,
  type ShippingConfirmationData,
  type PasswordResetData,
  type WelcomeEmailData,
  type NewsletterConfirmData,
} from "./templates";

// Convenience functions for sending specific email types

export async function sendOrderConfirmation(to: string, data: OrderConfirmationData) {
  const { html, text, subject } = renderOrderConfirmation(data);
  return sendEmail({ to, subject, html, text });
}

export async function sendShippingConfirmation(to: string, data: ShippingConfirmationData) {
  const { html, text, subject } = renderShippingConfirmation(data);
  return sendEmail({ to, subject, html, text });
}

export async function sendPasswordReset(to: string, data: PasswordResetData) {
  const { html, text, subject } = renderPasswordReset(data);
  return sendEmail({ to, subject, html, text });
}

export async function sendWelcomeEmail(to: string, data: WelcomeEmailData) {
  const { html, text, subject } = renderWelcomeEmail(data);
  return sendEmail({ to, subject, html, text });
}

export async function sendNewsletterConfirm(to: string, data: NewsletterConfirmData) {
  const { html, text, subject } = renderNewsletterConfirm(data);
  return sendEmail({ to, subject, html, text });
}
