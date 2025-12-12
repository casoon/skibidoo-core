# Skibidoo Deployment Guide

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare DNS                            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Cloudflare     │ │  Cloudflare     │ │    fly.io       │
│   Workers       │ │   Workers       │ │                 │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│  Storefront     │ │  Admin Panel    │ │  API Backend    │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Astro SSR       │ │ Astro SSR       │ │ Bun + Hono API  │
│ HTMX            │ │ Alpine.js       │ │ + tRPC          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┴───────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    └─────────────────┘
```

## 1. Backend (skibidoo-core) auf fly.io

### Voraussetzungen
- fly CLI: `brew install flyctl`
- Eingeloggt: `fly auth login`

### Deployment

```bash
cd skibidoo-core

# Erstes Deployment
fly launch

# Secrets setzen (Werte entsprechend anpassen)
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="$(openssl rand -base64 32)"
fly secrets set JWT_REFRESH_SECRET="$(openssl rand -base64 32)"
fly secrets set CORS_ORIGINS="https://your-store.example.com,https://your-admin.example.com"
fly secrets set STOREFRONT_URL="https://your-store.example.com"
fly secrets set ADMIN_URL="https://your-admin.example.com"

# Optional: Stripe (Werte aus Stripe Dashboard)
fly secrets set STRIPE_SECRET_KEY="sk_..."
fly secrets set STRIPE_PUBLIC_KEY="pk_..."
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."

# Deploy
fly deploy
```

### PostgreSQL erstellen

```bash
fly postgres create --name skibidoo-db --region fra
fly postgres attach skibidoo-db --app skibidoo-core
```

## 2. Storefront auf Cloudflare Workers

### Voraussetzungen
- wrangler CLI: `npm install -g wrangler`
- Eingeloggt: `wrangler login`

### Deployment

```bash
cd skibidoo-storefront
npm install
npm run build

# Deploy
wrangler deploy

# Environment Variables setzen (Production API URL)
wrangler secret put API_URL
# Eingabe: https://your-api.fly.dev
```

### Custom Domain

```bash
wrangler route add "your-store.example.com/*" --zone-name example.com
```

## 3. Admin Panel auf Cloudflare Workers

### Deployment

```bash
cd skibidoo-admin
npm install
npm run build

# Deploy
wrangler deploy

# Environment Variables setzen
wrangler secret put PUBLIC_API_URL
# Eingabe: https://your-api.fly.dev
```

### Custom Domain

```bash
wrangler route add "your-admin.example.com/*" --zone-name example.com
```

## 4. DNS Konfiguration

Cloudflare DNS Records für Custom Domains:

| Type  | Name         | Target                    | Proxy |
|-------|--------------|---------------------------|-------|
| AAAA  | your-store   | 100::                     | Yes   |
| AAAA  | your-admin   | 100::                     | Yes   |

## 5. Sichere Kommunikation

### HTTPS
- fly.io: Automatisches TLS-Zertifikat
- Cloudflare Workers: Automatisches TLS-Zertifikat
- Alle API-Aufrufe über HTTPS

### Authentication
- JWT-basierte Authentifizierung
- Access Token: 1 Stunde Gültigkeit
- Refresh Token: 7 Tage Gültigkeit

### Rate Limiting
- Auth-Endpoints: 10 req/min
- API-Endpoints: 100 req/min
- Webhooks: 1000 req/min

## 6. Monitoring

### fly.io
```bash
fly logs -a skibidoo-core
fly status -a skibidoo-core
```

### Health Checks
- `/health` - Basis Health Check
- `/health/ready` - Ready Probe
- `/metrics` - Prometheus Metrics

## 7. Rollback

### fly.io
```bash
fly releases -a skibidoo-core
fly deploy --image registry.fly.io/skibidoo-core:deployment-XXXXX
```

### Cloudflare Workers
```bash
wrangler rollback
```
