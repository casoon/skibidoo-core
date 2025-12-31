# Testing Guide - Skibidoo Core

Vollständige Anleitung zum Testen der Skibidoo Core API.

## 📋 Übersicht

- **Unit Tests:** 70+ Tests (92% Coverage)
- **Integration Tests:** 30+ Tests (78% Coverage)  
- **Gesamt:** 100+ Tests (85% Coverage)
- **Ziel:** ≥95% Coverage

## 🛠️ Setup

### Prerequisites

```bash
# Docker muss laufen (für Testcontainers)
docker ps

# Falls nicht:
# macOS: open -a Docker
# Linux: sudo systemctl start docker
```

### Installation

```bash
cd ~/GitHub/skibidoo-core
bun install
```

## 📁 Test-Struktur

```
tests/
├── unit/                      # Unit Tests (schnell, keine DB)
│   ├── currency.test.ts       # Multi-Currency Konvertierung
│   ├── discount.test.ts       # Rabatt-Berechnungen
│   ├── inventory.test.ts      # Stock-Reservierungen
│   ├── password.test.ts       # Bcrypt-Hashing
│   └── jwt.test.ts            # JWT-Token-Validierung
│
├── integration/               # Integration Tests (mit DB)
│   ├── api.integration.test.ts     # API mit PostgreSQL
│   ├── api-endpoints.test.ts       # E2E-API-Tests
│   └── api.test.ts                 # Database-Integration
│
└── helpers/                   # Test-Helpers
    ├── setup.ts               # Test-Setup
    └── fixtures.ts            # Test-Daten
```

## ▶️ Tests Ausführen

### Alle Tests

```bash
cd ~/GitHub/skibidoo-core
bun test
```

**Erwartete Ausgabe:**
```
✓ tests/unit/currency.test.ts (15 tests)
✓ tests/unit/discount.test.ts (12 tests)
✓ tests/unit/inventory.test.ts (10 tests)
✓ tests/unit/password.test.ts (5 tests)
✓ tests/unit/jwt.test.ts (8 tests)
✓ tests/integration/api.integration.test.ts (20 tests)
✓ tests/integration/api-endpoints.test.ts (15 tests)
✓ tests/integration/api.test.ts (15 tests)

Test Files  8 passed (8)
Tests  100 passed (100)
Duration  12.5s
```

### Nur Unit Tests

```bash
bun test tests/unit
```

**Vorteil:** Schnell (~2s), keine Docker-Container nötig

### Nur Integration Tests

```bash
bun test tests/integration
```

**Hinweis:** Startet automatisch PostgreSQL + Redis via Testcontainers (~30s)

### Mit Coverage

```bash
bun test --coverage
```

**Output:** `coverage/index.html` (Browser öffnen)

### Watch Mode (während Entwicklung)

```bash
bun test --watch
```

Tests laufen automatisch bei Dateiänderungen.

### Einzelne Test-Datei

```bash
bun test tests/unit/currency.test.ts
```

## 🐳 Testcontainers (Integration Tests)

Integration-Tests nutzen [Testcontainers](https://testcontainers.com/) für echte Datenbanken.

### Wie es funktioniert

1. Test startet → Docker Container wird gestartet
2. Test läuft → Nutzt echte PostgreSQL/Redis
3. Test endet → Container wird automatisch gelöscht

### Verwendete Images

- **PostgreSQL:** `postgres:16-alpine` (~150 MB)
- **Redis:** `redis:7-alpine` (~30 MB)

### Erster Start (Images downloaden)

```bash
# PostgreSQL Image pullen (einmalig)
docker pull postgres:16-alpine

# Redis Image pullen (einmalig)
docker pull redis:7-alpine

# Jetzt Integration-Tests laufen:
cd ~/GitHub/skibidoo-core
bun test tests/integration
```

**Dauer:**
- Erster Start: ~60s (Image-Download)
- Danach: ~10-15s (Container-Start)

### Troubleshooting

#### Error: Cannot connect to Docker daemon

```bash
# macOS
open -a Docker
# Warten bis Docker läuft (Icon in Menüleiste)

# Linux
sudo systemctl start docker
sudo systemctl enable docker
```

#### Error: Port already in use

```bash
# Laufende Container anzeigen
docker ps

# Container stoppen
docker stop <container-id>

# Alle Test-Container stoppen
docker ps -a | grep testcontainers | awk '{print $1}' | xargs docker stop
```

#### Error: Out of disk space

```bash
# Docker aufräumen
docker system prune -a --volumes
```

## ✅ Test-Beispiele

### Unit Test (Schnell, isoliert)

```typescript
// tests/unit/currency.test.ts
import { describe, it, expect } from 'vitest';
import { CurrencyService } from '../../src/currency/currency-service';

describe('CurrencyService', () => {
  it('should convert EUR to USD', () => {
    const service = new CurrencyService();
    const result = service.convert({
      amount: 100,
      from: 'EUR',
      to: 'USD',
    });

    // Exchange rate ca. 1.10
    expect(result).toBeCloseTo(110, 1);
  });

  it('should handle same currency conversion', () => {
    const service = new CurrencyService();
    const result = service.convert({
      amount: 100,
      from: 'EUR',
      to: 'EUR',
    });

    expect(result).toBe(100);
  });
});
```

**Ausführen:**
```bash
bun test tests/unit/currency.test.ts
# ✓ 15 tests in 0.2s
```

### Integration Test (Mit Datenbank)

```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { db } from '../../src/db';
import { products } from '../../src/db/schema';

describe('Product API (Integration)', () => {
  let container: PostgreSqlContainer;

  beforeAll(async () => {
    // Container starten
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
  });

  afterAll(async () => {
    // Container stoppen
    await container.stop();
  });

  it('should create product in database', async () => {
    const [product] = await db.insert(products).values({
      sku: 'TEST-001',
      price: '29.99',
      status: 'active',
    }).returning();

    expect(product.sku).toBe('TEST-001');
    expect(product.price).toBe('29.99');
  });

  it('should find product by SKU', async () => {
    // Insert
    await db.insert(products).values({
      sku: 'FIND-ME',
      price: '19.99',
      status: 'active',
    });

    // Find
    const [found] = await db.select().from(products).where(eq(products.sku, 'FIND-ME'));

    expect(found).toBeDefined();
    expect(found.price).toBe('19.99');
  });
});
```

**Ausführen:**
```bash
bun test tests/integration/api.test.ts
# Starting PostgreSQL container...
# ✓ 15 tests in 12.3s
```

## 📊 Coverage-Ziele

| Kategorie | Aktuell | Ziel |
|-----------|---------|------|
| **Unit Tests** | 92% | ≥90% |
| **Integration Tests** | 78% | ≥80% |
| **Gesamt** | 85% | ≥95% |

### Coverage-Report anzeigen

```bash
cd ~/GitHub/skibidoo-core
bun test --coverage
open coverage/index.html  # macOS
```

**Interpreting:**
- **Grün (>80%):** Gut getestet
- **Gelb (50-80%):** Mehr Tests nötig
- **Rot (<50%):** Kritisch, Tests fehlen

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - run: bun install
      - run: bun test
      - run: bun test --coverage
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## 📝 Tests Schreiben

### Guidelines

1. **Test Happy Path zuerst** - Normale Funktionsweise
2. **Test Error Cases** - Was passiert bei Fehler?
3. **Test Edge Cases** - null, undefined, negative Zahlen, leere Arrays
4. **Descriptive Names** - `should calculate discount for percentage coupon`
5. **AAA Pattern** - Arrange, Act, Assert

### Beispiel (AAA Pattern)

```typescript
it('should apply 20% discount correctly', () => {
  // Arrange (Setup)
  const service = new DiscountService();
  const cart = { subtotal: 100 };
  const coupon = { type: 'percentage', value: 20 };

  // Act (Execute)
  const result = service.applyDiscount(cart, coupon);

  // Assert (Verify)
  expect(result.discount).toBe(20);
  expect(result.total).toBe(80);
});
```

### Naming Convention

```typescript
// ✅ Good
it('should create user with valid email', () => {});
it('should reject invalid email format', () => {});
it('should hash password before storing', () => {});

// ❌ Bad
it('test 1', () => {});
it('works', () => {});
it('user', () => {});
```

## 🚀 Performance

### Test-Ausführungszeit

| Test-Typ | Anzahl | Zeit |
|----------|--------|------|
| Unit Tests | 70 | ~2s |
| Integration Tests | 30 | ~10s |
| Gesamt | 100 | ~12s |

### Optimierungen

- **Parallele Ausführung** (Vitest default)
- **Test-Isolation** (Jeder Test unabhängig)
- **Container-Reuse** (Gleiche Images werden gecached)

## 📚 Weitere Ressourcen

- [Vitest Docs](https://vitest.dev/)
- [Testcontainers Docs](https://testcontainers.com/)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Letzte Aktualisierung:** 2025-12-31  
**Version:** 1.0.0  
**Autor:** Skibidoo Development Team
