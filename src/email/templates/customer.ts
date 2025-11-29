import { baseTemplate } from "./base";
import { compileMjml, interpolate, type TemplateData } from "../template-utils";

export interface PasswordResetData {
  customerName: string;
  resetUrl: string;
  expiresIn: string;
  shopUrl: string;
}

const passwordResetContent = `
    <mj-section background-color="#ffffff" padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#111827" padding-bottom="10px">
          Passwort zuruecksetzen
        </mj-text>
        <mj-text padding-bottom="20px">
          Hallo {{customerName}},<br/><br/>
          Sie haben angefordert, Ihr Passwort zurueckzusetzen. Klicken Sie auf den Button unten, um ein neues Passwort zu erstellen.
        </mj-text>
        <mj-button href="{{resetUrl}}" padding="20px 0">
          Neues Passwort erstellen
        </mj-button>
        <mj-text padding-top="20px" font-size="13px" color="#6b7280">
          Dieser Link ist {{expiresIn}} gueltig. Falls Sie diese Anfrage nicht gestellt haben, koennen Sie diese E-Mail ignorieren.
        </mj-text>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding-top="30px" />
        <mj-text font-size="12px" color="#9ca3af" padding-top="20px">
          Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br/>
          <a href="{{resetUrl}}" style="color: #7c3aed; word-break: break-all;">{{resetUrl}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
`;

export function renderPasswordReset(data: PasswordResetData): { html: string; text: string; subject: string } {
  const subject = "Passwort zuruecksetzen - Skibidoo";

  const templateData: TemplateData = {
    subject,
    customerName: data.customerName,
    resetUrl: data.resetUrl,
    expiresIn: data.expiresIn,
    shopUrl: data.shopUrl,
  };

  const content = interpolate(passwordResetContent, templateData);
  const mjml = interpolate(baseTemplate.replace("{{content}}", content), templateData);
  const html = compileMjml(mjml);

  const text = `
Passwort zuruecksetzen

Hallo ${data.customerName},

Sie haben angefordert, Ihr Passwort zurueckzusetzen.

Klicken Sie auf den folgenden Link, um ein neues Passwort zu erstellen:
${data.resetUrl}

Dieser Link ist ${data.expiresIn} gueltig.

Falls Sie diese Anfrage nicht gestellt haben, koennen Sie diese E-Mail ignorieren.

Mit freundlichen Gruessen,
Ihr Skibidoo Team
  `.trim();

  return { html, text, subject };
}

export interface WelcomeEmailData {
  customerName: string;
  email: string;
  confirmUrl?: string;
  shopUrl: string;
}

const welcomeEmailContent = `
    <mj-section background-color="#ffffff" padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#111827" padding-bottom="10px">
          Willkommen bei Skibidoo!
        </mj-text>
        <mj-text padding-bottom="20px">
          Hallo {{customerName}},<br/><br/>
          vielen Dank fuer Ihre Registrierung bei Skibidoo. Wir freuen uns, Sie als Kunden begruessen zu duerfen!
        </mj-text>
        {{confirmSection}}
        <mj-text padding-top="20px" font-size="16px" font-weight="600" color="#111827">
          Was Sie bei uns erwartet:
        </mj-text>
        <mj-text padding-top="10px">
          - Hochwertige Produkte zu fairen Preisen<br/>
          - Schneller Versand innerhalb von 24 Stunden<br/>
          - 14 Tage kostenlose Rueckgabe<br/>
          - Persoenlicher Kundenservice
        </mj-text>
        <mj-button href="{{shopUrl}}" padding-top="30px">
          Jetzt shoppen
        </mj-button>
      </mj-column>
    </mj-section>
`;

export function renderWelcomeEmail(data: WelcomeEmailData): { html: string; text: string; subject: string } {
  const subject = "Willkommen bei Skibidoo!";

  const confirmSection = data.confirmUrl
    ? `<mj-section background-color="#fef3c7" padding="15px" border-radius="8px">
        <mj-column>
          <mj-text color="#92400e" font-size="14px">
            Bitte bestaetigen Sie Ihre E-Mail-Adresse, um alle Funktionen nutzen zu koennen.
          </mj-text>
          <mj-button href="${data.confirmUrl}" background-color="#d97706" padding-top="10px">
            E-Mail bestaetigen
          </mj-button>
        </mj-column>
      </mj-section>`
    : "";

  const templateData: TemplateData = {
    subject,
    customerName: data.customerName,
    confirmSection,
    shopUrl: data.shopUrl,
  };

  const content = interpolate(welcomeEmailContent, templateData);
  const mjml = interpolate(baseTemplate.replace("{{content}}", content), templateData);
  const html = compileMjml(mjml);

  const text = `
Willkommen bei Skibidoo!

Hallo ${data.customerName},

vielen Dank fuer Ihre Registrierung bei Skibidoo. Wir freuen uns, Sie als Kunden begruessen zu duerfen!

${data.confirmUrl ? `Bitte bestaetigen Sie Ihre E-Mail-Adresse: ${data.confirmUrl}` : ""}

Was Sie bei uns erwartet:
- Hochwertige Produkte zu fairen Preisen
- Schneller Versand innerhalb von 24 Stunden
- 14 Tage kostenlose Rueckgabe
- Persoenlicher Kundenservice

Besuchen Sie unseren Shop: ${data.shopUrl}

Mit freundlichen Gruessen,
Ihr Skibidoo Team
  `.trim();

  return { html, text, subject };
}

export interface NewsletterConfirmData {
  email: string;
  confirmUrl: string;
  shopUrl: string;
}

const newsletterConfirmContent = `
    <mj-section background-color="#ffffff" padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#111827" padding-bottom="10px">
          Newsletter-Anmeldung bestaetigen
        </mj-text>
        <mj-text padding-bottom="20px">
          Hallo,<br/><br/>
          Sie haben sich fuer unseren Newsletter angemeldet. Bitte bestaetigen Sie Ihre Anmeldung mit einem Klick auf den Button.
        </mj-text>
        <mj-button href="{{confirmUrl}}" padding="20px 0">
          Newsletter bestaetigen
        </mj-button>
        <mj-text padding-top="30px" font-size="13px" color="#6b7280">
          Falls Sie sich nicht angemeldet haben, koennen Sie diese E-Mail ignorieren.
        </mj-text>
      </mj-column>
    </mj-section>
`;

export function renderNewsletterConfirm(data: NewsletterConfirmData): { html: string; text: string; subject: string } {
  const subject = "Newsletter-Anmeldung bestaetigen";

  const templateData: TemplateData = {
    subject,
    confirmUrl: data.confirmUrl,
    shopUrl: data.shopUrl,
  };

  const content = interpolate(newsletterConfirmContent, templateData);
  const mjml = interpolate(baseTemplate.replace("{{content}}", content), templateData);
  const html = compileMjml(mjml);

  const text = `
Newsletter-Anmeldung bestaetigen

Hallo,

Sie haben sich fuer unseren Newsletter angemeldet. Bitte bestaetigen Sie Ihre Anmeldung:

${data.confirmUrl}

Falls Sie sich nicht angemeldet haben, koennen Sie diese E-Mail ignorieren.

Mit freundlichen Gruessen,
Ihr Skibidoo Team
  `.trim();

  return { html, text, subject };
}
