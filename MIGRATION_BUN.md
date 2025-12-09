# Migrationsplan: Node.js zu Bun

## Projektübersicht

- **Projekt**: @skibidoo/core
- **Aktuelle Runtime**: Node.js 24
- **Ziel-Runtime**: Bun 1.1+
- **Geschätzter Aufwand**: 5-7 Arbeitstage
- **Risikostufe**: Mittel

---

## Phase 1: Vorbereitung (0.5 Tage)

### 1.1 Bun installieren und testen

```bash
# Bun installieren
curl -fsSL https://bun.sh/install | bash

# Version prüfen
bun --version

# Projekt initial testen
cd /Users/jseidel/GitHub/skibidoo-core
bun install
```

### 1.2 Feature Branch erstellen

```bash
git checkout -b feat/migrate-to-bun
```

### 1.3 Backup der aktuellen Lock-Datei

```bash
cp pnpm-lock.yaml pnpm-lock.yaml.backup
```

---

## Phase 2: Dependencies migrieren (1-2 Tage)

### 2.1 bcrypt zu bcryptjs migrieren

**Datei**: `src/lib/auth/password.ts` (oder ähnlich)

```bash
# Alte Dependency entfernen, neue installieren
bun remove bcrypt
bun add bcryptjs
bun add -d @types/bcryptjs
```

**Code-Änderung**:

```typescript
// VORHER
import bcrypt from "bcrypt";

// NACHHER
import bcrypt from "bcryptjs";
```

Die API ist identisch - keine weiteren Änderungen nötig.

**Tests ausführen**:
```bash
bun test --grep "password|auth|bcrypt"
```

---

### 2.2 sharp-Strategie umsetzen

**Option A: Cloud-basierte Bildverarbeitung (Empfohlen für Production)**

Wenn S3 bereits genutzt wird, kann CloudFlare oder AWS Lambda für Bildtransformation verwendet werden.

```typescript
// src/lib/image/cloudflare-transform.ts
export function getTransformedImageUrl(
  originalUrl: string,
  options: { width?: number; height?: number; quality?: number }
): string {
  const params = new URLSearchParams();
  if (options.width) params.set("width", String(options.width));
  if (options.height) params.set("height", String(options.height));
  if (options.quality) params.set("quality", String(options.quality));
  
  // CloudFlare Image Resizing Format
  return `${originalUrl}?${params.toString()}`;
}
```

**Option B: Migration zu @jimp/core (Einfacher, aber langsamer)**

```bash
bun remove sharp @img/sharp-darwin-arm64 @img/sharp-linux-x64
bun add jimp
```

```typescript
// VORHER
import sharp from "sharp";

async function resizeImage(buffer: Buffer, width: number, height: number) {
  return sharp(buffer).resize(width, height).jpeg({ quality: 80 }).toBuffer();
}

// NACHHER
import Jimp from "jimp";

async function resizeImage(buffer: Buffer, width: number, height: number) {
  const image = await Jimp.read(buffer);
  image.resize(width, height);
  image.quality(80);
  return image.getBufferAsync(Jimp.MIME_JPEG);
}
```

**Option C: Hybrid-Ansatz (Sharp in separatem Container)**

Sharp in einem Node.js-Microservice belassen und über HTTP aufrufen.

---

### 2.3 Hono Server-Adapter ersetzen

```bash
bun remove @hono/node-server
```

**Datei**: `src/index.ts` oder `src/api/server.ts`

```typescript
// VORHER
import { serve } from "@hono/node-server";
import { app } from "./api/app";

serve({
  fetch: app.fetch,
  port: env.PORT,
});

// NACHHER - Option 1: Bun.serve direkt
import { app } from "./api/app";

Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
});

// NACHHER - Option 2: Mit graceful shutdown
import { app } from "./api/app";

const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

console.log(`Server running on port ${env.PORT}`);
```

---

### 2.4 OpenTelemetry anpassen (falls Probleme auftreten)

```typescript
// VORHER
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

// NACHHER - Manuelle Instrumentation
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";

const instrumentations = [
  new HttpInstrumentation(),
  new IORedisInstrumentation(),
];
```

---

### 2.5 Unnötige Dependencies entfernen

```bash
# tsx wird nicht mehr benötigt - Bun führt TypeScript direkt aus
bun remove tsx
```

---

## Phase 3: package.json anpassen (0.5 Tage)

### 3.1 Scripts aktualisieren

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "db:generate": "bunx drizzle-kit generate",
    "db:migrate": "bunx drizzle-kit migrate",
    "db:studio": "bunx drizzle-kit studio",
    "lint": "bunx eslint src",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

### 3.2 Engine-Anforderungen anpassen

```json
{
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

### 3.3 Volta-Konfiguration entfernen (optional)

```json
{
  "volta": null
}
```

Oder auf Bun umstellen (Volta unterstützt Bun noch nicht nativ).

---

## Phase 4: Build-Konfiguration (0.5 Tage)

### 4.1 tsup durch Bun-Bundler ersetzen (Optional)

**Option A: tsup beibehalten** (einfacher)

tsup funktioniert mit Bun - keine Änderung nötig.

**Option B: Bun-nativer Bundler**

```typescript
// build.ts
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  sourcemap: "external",
  minify: process.env.NODE_ENV === "production",
});
```

```json
{
  "scripts": {
    "build": "bun run build.ts"
  }
}
```

### 4.2 bunfig.toml erstellen (Optional)

```toml
# bunfig.toml
[install]
# Nutze frozen lockfile in CI
frozen = false

[install.lockfile]
# Lockfile-Format
save = true

[test]
# Test-Konfiguration
coverage = true
coverageDir = "coverage"
```

---

## Phase 5: Docker-Konfiguration (0.5 Tage)

### 5.1 Dockerfile aktualisieren

```dockerfile
# ===== Builder Stage =====
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Dependencies installieren
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Source kopieren und bauen
COPY . .
RUN bun run build

# ===== Production Stage =====
FROM oven/bun:1.1-alpine AS production

WORKDIR /app

# Nur Production-Dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Build-Artefakte kopieren
COPY --from=builder /app/dist ./dist

# Non-root User
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
```

### 5.2 docker-compose.yml anpassen (falls vorhanden)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - BUN_ENV=production
    # ...
```

### 5.3 .dockerignore aktualisieren

```
node_modules
pnpm-lock.yaml
.git
.env*
!.env.example
dist
coverage
```

---

## Phase 6: CI/CD anpassen (0.5 Tage)

### 6.1 GitHub Actions aktualisieren

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      - name: Type check
        run: bun run typecheck
      
      - name: Lint
        run: bun run lint
      
      - name: Test
        run: bun test --coverage
      
      - name: Build
        run: bun run build

  docker:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t skibidoo-core .
```

### 6.2 Staging Workflow anpassen

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
      
      - name: Install & Build
        run: |
          bun install --frozen-lockfile
          bun run build
      
      # ... weiterer Deploy-Schritt
```

---

## Phase 7: Testing & Validierung (1-2 Tage)

### 7.1 Unit Tests ausführen

```bash
bun test
```

### 7.2 Integration Tests ausführen

```bash
bun test:integration
```

### 7.3 Manuelle Tests

Checkliste:

- [ ] API-Endpunkte funktionieren
- [ ] Authentifizierung (bcryptjs) funktioniert
- [ ] Datenbankverbindung (Drizzle) funktioniert
- [ ] Redis/BullMQ Jobs werden verarbeitet
- [ ] E-Mail-Versand funktioniert
- [ ] PDF-Generierung funktioniert
- [ ] Bildverarbeitung funktioniert
- [ ] Stripe-Webhooks funktionieren
- [ ] PayPal-Integration funktioniert
- [ ] Prometheus-Metrics werden exportiert

### 7.4 Load Tests

```bash
# Mit k6 oder ähnlichem Tool
k6 run load-test.js
```

### 7.5 Performance-Vergleich dokumentieren

| Metrik | Node.js | Bun | Differenz |
|--------|---------|-----|-----------|
| Startup-Zeit | | | |
| Request/s | | | |
| Memory Usage | | | |
| Install-Zeit | | | |

---

## Phase 8: Rollout (0.5 Tage)

### 8.1 Staging-Deployment

```bash
# Staging deployen und 24-48h beobachten
git push origin feat/migrate-to-bun
# PR erstellen und Staging-Pipeline triggern
```

### 8.2 Production-Deployment

Nach erfolgreichem Staging-Test:

```bash
git checkout main
git merge feat/migrate-to-bun
git push origin main
```

### 8.3 Monitoring

- Logs auf Fehler prüfen
- Prometheus-Metriken beobachten
- Response-Zeiten vergleichen

---

## Rollback-Plan

Falls kritische Probleme auftreten:

### Sofortiger Rollback

```bash
# 1. Auf vorherigen Commit zurück
git revert HEAD

# 2. Oder: Docker-Image auf vorherige Version
docker pull ghcr.io/skibidoo/core:previous-tag
```

### Langfristiger Rollback

```bash
# Branch wieder auf Node.js umstellen
git checkout main
git revert --no-commit HEAD~5..HEAD
git commit -m "revert: Rollback Bun migration"
```

---

## Checkliste

### Vor der Migration

- [ ] Alle Tests sind grün
- [ ] Feature Branch erstellt
- [ ] Team informiert
- [ ] Rollback-Plan dokumentiert

### Während der Migration

- [ ] bcrypt → bcryptjs migriert
- [ ] sharp-Strategie umgesetzt
- [ ] @hono/node-server ersetzt
- [ ] package.json Scripts aktualisiert
- [ ] Dockerfile aktualisiert
- [ ] CI/CD Workflows aktualisiert

### Nach der Migration

- [ ] Alle Unit Tests grün
- [ ] Alle Integration Tests grün
- [ ] Staging 24-48h stabil
- [ ] Performance-Metriken dokumentiert
- [ ] Production erfolgreich deployed
- [ ] Monitoring zeigt keine Anomalien
- [ ] Team-Dokumentation aktualisiert

---

## Bekannte Einschränkungen

1. **Bun-Debugger**: Weniger ausgereifte Debugging-Tools als Node.js
2. **Native Addons**: Eingeschränkte Unterstützung (bcrypt, sharp betroffen)
3. **Ecosystem**: Manche npm-Pakete sind noch nicht getestet
4. **Windows**: Bun auf Windows ist noch experimentell

---

## Ressourcen

- [Bun Dokumentation](https://bun.sh/docs)
- [Bun Node.js Kompatibilität](https://bun.sh/docs/runtime/nodejs-apis)
- [Hono mit Bun](https://hono.dev/getting-started/bun)
- [Drizzle mit Bun](https://orm.drizzle.team/docs/get-started-postgresql#bun)

---

## Zeitplan (Vorschlag)

| Tag | Phase | Aufgaben |
|-----|-------|----------|
| 1 | Vorbereitung + Dependencies | Bun Setup, bcrypt, sharp |
| 2 | Dependencies + package.json | Hono, Scripts, Cleanup |
| 3 | Build + Docker | Bundler, Dockerfile, Compose |
| 4 | CI/CD + Testing | Workflows, Unit Tests |
| 5 | Testing | Integration Tests, Load Tests |
| 6 | Staging | Deploy, Monitoring, Fixes |
| 7 | Production | Deploy, Monitoring |

---

*Erstellt am: 2025-12-09*
*Letzte Aktualisierung: 2025-12-09*
