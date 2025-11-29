export const baseTemplate = `
<mjml>
  <mj-head>
    <mj-title>{{subject}}</mj-title>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, Helvetica, Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#374151" />
      <mj-button background-color="#7c3aed" border-radius="8px" font-size="14px" font-weight="600" />
    </mj-attributes>
    <mj-style>
      .footer-link { color: #6b7280 !important; text-decoration: none; }
      .footer-link:hover { text-decoration: underline; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f3f4f6">
    <!-- Header -->
    <mj-section background-color="#7c3aed" padding="20px 0">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="700">
          Skibidoo
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Content -->
    {{content}}

    <!-- Footer -->
    <mj-section background-color="#f9fafb" padding="30px 20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#6b7280">
          Skibidoo GmbH | Musterstrasse 123 | 12345 Berlin
        </mj-text>
        <mj-text align="center" font-size="12px" color="#6b7280" padding-top="10px">
          <a href="{{shopUrl}}/impressum" class="footer-link">Impressum</a> |
          <a href="{{shopUrl}}/datenschutz" class="footer-link">Datenschutz</a> |
          <a href="{{shopUrl}}/agb" class="footer-link">AGB</a>
        </mj-text>
        <mj-text align="center" font-size="11px" color="#9ca3af" padding-top="15px">
          Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht direkt auf diese Nachricht.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
