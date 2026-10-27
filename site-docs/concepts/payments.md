---
title: Zahlungen
description: Stripe und PayPal, Webhooks und der Abgleich offener Zahlungen.
order: 4
---

Der Core bindet Stripe (`stripe`) und PayPal (`@paypal/paypal-server-sdk`) ein. Beide sind
optional und werden über Umgebungsvariablen aktiviert, siehe
[Konfiguration](../../reference/configuration/).

- **Stripe**: Webhooks kommen unter `/webhooks` an. Die Handler werden nur registriert, wenn
  `STRIPE_SECRET_KEY` gesetzt ist.
- **PayPal**: eigene Routen unter `/api/v1/paypal`; Zugangsdaten und Webhook-ID kommen aus
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` und `PAYPAL_WEBHOOK_ID`.
- **Abgleich**: der Job `sync_pending` prüft alle 15 Minuten offene Zahlungen, `reconcile` läuft
  täglich, siehe [Hintergrundjobs](../jobs/).

Webhooks haben ein eigenes Rate Limit, getrennt von den übrigen API-Routen.
