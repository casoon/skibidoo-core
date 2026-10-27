---
title: Architektur
description: Aus welchen Repositories Skibidoo besteht und welche Rolle der Core darin spielt.
order: 1
---

Skibidoo ist auf mehrere Repositories verteilt. Der Core ist die einzige Komponente, die mit
Datenbank, Zahlungsanbietern und Mail-Versand spricht.

| Repository | Rolle | Technik |
| --- | --- | --- |
| [skibidoo-core](https://github.com/casoon/skibidoo-core) | Backend: REST, tRPC, Jobs | Bun, Hono, Drizzle, PostgreSQL, Redis, BullMQ |
| [skibidoo-storefront](https://github.com/casoon/skibidoo-storefront) | Shop für Kundinnen und Kunden | Astro 6, HTMX, Tailwind CSS 4 |
| [skibidoo-admin](https://github.com/casoon/skibidoo-admin) | Admin-Dashboard | Astro 6, Alpine.js, Tailwind CSS 4 |
| [skibidoo-ui](https://github.com/casoon/skibidoo-ui) | UI-Komponenten, serverseitig gerendert | Astro, Alpine.js, HTMX |
| [skibidoo-shared](https://github.com/casoon/skibidoo-shared) | Gemeinsame Typen, Zod-Schemas, Hilfsfunktionen | TypeScript |
| [skibidoo-docs](https://github.com/casoon/skibidoo-docs) | Entwicklerdokumentation | Markdown |

## Schnittstellen

- **Storefront → Core**: REST unter `/api/v1` mit OpenAPI-Beschreibung.
- **Admin → Core**: tRPC unter `/trpc`, Ende-zu-Ende typisiert über den Export `@skibidoo/core/trpc`.
- **Zahlungsanbieter → Core**: Webhooks, siehe [Zahlungen](../payments/).

## Stack-Idee

Storefront und Admin setzen auf serverseitig gerendertes HTML. Interaktivität kommt aus HTMX
(Storefront) und Alpine.js (Admin) statt aus einem React-Frontend. Die Konzeptdokumentation
nennt das AHA-Stack: Astro, HTMX, Alpine.js.

## Deployment-Ziele

Laut [Deployment-Anleitung](../../reference/deployment/) läuft der Core auf fly.io,
Storefront und Admin laufen als Cloudflare Workers. Beides ist Konfiguration, keine Pflicht: der
Core wird als Docker-Image gebaut und ist nicht an fly.io gebunden.
