---
title: Deployment
description: Core auf fly.io, Storefront und Admin auf Cloudflare Workers. Auszug aus DEPLOYMENT.md.
order: 3
---

Die vollständige Anleitung steht in
[`DEPLOYMENT.md`](https://github.com/casoon/skibidoo-core/blob/main/DEPLOYMENT.md). Hier die
Eckpunkte.

## Core auf fly.io

`fly.toml` im Repository beschreibt die App `skibidoo-core` in der Region `fra`: `MODE=api`,
Port 3000, erzwungenes HTTPS, Health-Check auf `/health`.

```sh
fly launch
fly secrets set DATABASE_URL="postgresql://…"
fly secrets set JWT_SECRET="$(openssl rand -base64 32)"
fly secrets set JWT_REFRESH_SECRET="$(openssl rand -base64 32)"
fly secrets set CORS_ORIGINS="https://shop.example.com,https://admin.example.com"
fly deploy
```

Stripe und PayPal werden über weitere Secrets zugeschaltet, siehe
[Konfiguration](../configuration/). Eine PostgreSQL-Instanz legt `fly postgres create` an.

## Docker

Das `Dockerfile` baut in zwei Stufen auf `oven/bun:1.3-alpine`. Die Laufzeitstufe installiert nur
Produktionsabhängigkeiten, überspringt Prepare-Skripte und läuft als eigener Benutzer.

## Storefront und Admin

Beide sind Astro-Projekte mit Cloudflare-Adapter und `wrangler.toml`. Die API-Adresse wird als
Secret übergeben (`API_URL` im Storefront, `PUBLIC_API_URL` im Admin). Deployt wird mit
`wrangler deploy`.

## Betrieb

```sh
fly logs -a skibidoo-core
fly status -a skibidoo-core
```

Rollback auf fly.io über `fly releases` und `fly deploy --image …`, bei Cloudflare mit
`wrangler rollback`.
