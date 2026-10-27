---
title: Überblick
description: Was skibidoo-core ist, welche Teile zum Skibidoo-Shopsystem gehören und wie diese Dokumentation aufgebaut ist.
order: 0
---

skibidoo-core ist das Backend von Skibidoo, einem selbst gehosteten, headless betriebenen
Shopsystem. Der Core stellt eine REST-API für den Shop und eine tRPC-API für das Admin-Dashboard
bereit, hält die Daten in PostgreSQL und führt Hintergrundjobs über BullMQ aus.

## Was der Core enthält

- Produkte, Kategorien, Übersetzungen, Warenkörbe, Checkout und Bestellungen
- Zahlungen über Stripe und PayPal, inklusive Webhooks
- Bestand, Rabatte und Gutscheinkarten
- Rechnungen als PDF, E-Mails aus MJML-Vorlagen
- Volltextsuche, Bild-Upload in S3-kompatiblen Speicher
- Metriken (Prometheus) und Tracing (OpenTelemetry)

## Was er nicht enthält

Storefront, Admin-Oberfläche und UI-Komponenten liegen in eigenen Repositories, siehe
[Architektur](concepts/architecture/). Der Projektstand ist Pre-Release (Version 0.1.0); die
Konzeptseite nennt Produktionshärtung und einen Docker-Starter ausdrücklich als offen.

## Aufbau der Dokumentation

- **Erste Schritte**: Core lokal starten, Demo-Daten laden.
- **Konzepte**: Zusammenspiel der Repositories, Betriebsmodi und Hintergrundjobs.
- **Referenz**: API-Oberfläche, Konfiguration, Deployment.
