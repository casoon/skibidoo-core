---
title: Grenzen und häufige Fragen
description: Was man vor dem Einsatz von Skibidoo wissen sollte, und Antworten zu Reifegrad, Lizenz, Zahlungsanbietern und Betrieb.
order: 5
---

## Was man wissen sollte

- **Frühe Version.** Der Core steht bei Version 0.1.0, ohne Stabilitätszusage für API und
  Datenbankschema. Die Konzeptdokumentation führt Produktionshärtung als offen.
- **Kein gehosteter Dienst, keine Demo.** Skibidoo ist Code zum Selbstbetreiben. Es gibt kein
  SaaS-Angebot und keine öffentliche Demo-Instanz.
- **Infrastruktur nötig.** PostgreSQL ist Pflicht, Redis für Worker und Scheduler, ein
  S3-kompatibler Speicher für den Bild-Upload, siehe [Konfiguration](../../reference/configuration/).
- **Nicht alles im Code ist angeschlossen.** Die Module für ausgehende Webhooks
  (`src/webhooks`) und Währungsumrechnung (`src/currency`) liegen im Repository, ihre Routen
  hängen aber nicht in `src/api/app.ts`. Sie sind deshalb hier nicht als Funktion aufgeführt.
  Maßgeblich für die HTTP-Oberfläche ist die [API-Referenz](../../reference/api/).
- **Ausbaustufen.** Ein erweitertes Analytics-Dashboard steht im Konzept als offene Aufgabe.

## Häufige Fragen

### Ist Skibidoo produktionsreif?

Noch nicht. Die Commerce-Funktionen sind im Core umgesetzt, das Projekt ist aber Pre-Release
(0.1.0). Es gibt kein aktives Live-System, und APIs sowie Datenbankschema können sich ändern.

### Was bedeutet AHA-Stack?

Astro, HTMX und Alpine.js, dazu Tailwind CSS fürs Styling. Astro rendert die Seiten auf dem
Server, HTMX tauscht HTML-Fragmente aus, Alpine.js übernimmt kleine Interaktionen im Browser.
Mehr dazu unter [Architektur](../architecture/).

### Unter welcher Lizenz steht der Code?

Core, Storefront, Admin, UI-Bibliothek, Shared-Paket und Dokumentation stehen jeweils unter der
MIT-Lizenz (`LICENSE` im jeweiligen Repository).

### Wie viel JavaScript läuft im Browser?

Es gibt kein Frontend-Framework wie React. Die Seiten kommen als HTML vom Server. Das Storefront
lädt HTMX und Alpine.js, der Admin nutzt Alpine.js über die Astro-Integration. Wie viel
JavaScript das in Kilobyte ist, wurde nicht gemessen.

### Welche Zahlungsanbieter werden unterstützt?

Stripe und PayPal, einschließlich der Webhooks von Stripe. Details unter
[Zahlungen](../payments/).

### Wo läuft Skibidoo?

Der Core läuft auf Bun und wird als Docker-Image gebaut. `fly.toml` konfiguriert fly.io.
Storefront und Admin sind für Cloudflare Workers konfiguriert. Siehe
[Deployment](../../reference/deployment/).
