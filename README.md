# skibidoo-core

Backend of Skibidoo, a self-hosted headless e-commerce system. One Bun process serves a REST API for the shop front end (`/api/v1`) and a tRPC API for the admin dashboard (`/trpc`), stores its data in PostgreSQL through Drizzle and runs background jobs on BullMQ and Redis. The same build starts as API server, worker or scheduler, selected by the `MODE` environment variable.

## Status

Pre-release, version 0.1.0, no tagged release. The first commit is from 2025-11-29; the last change to the application code (`src/`) is from 2026-04-12. Commits since then only concern the documentation site in `site/`. Nothing in the repository shows a shop running on it in production.

Known gaps, as found in the code:

- No migration files are checked in. `drizzle.config.ts` writes to `./drizzle`, which does not exist, so `db:generate` has to run before `db:migrate`.
- `src/currency`, `src/discounts`, `src/inventory` and `src/webhooks` contain services and route files, but `src/api/app.ts` does not mount them. The first three are only used by their unit tests.
- The `import` queue is defined but has no worker.
- Only Stripe has a webhook endpoint (`/webhooks/stripe`). PayPal is reachable through order and capture routes.
- The test files import from `vitest`, while the `test` scripts call `bun test`. `bunfig.toml` preloads `tests/setup.ts`, which is not in the repository. `tests/README.md` describes a layout and coverage numbers that do not match the files.
- The `lint` script calls ESLint, but there is no ESLint configuration file. CI ignores its result.
- The OpenAPI document in `src/api/docs/openapi.ts` still names LGPL-3.0; the `LICENSE` file is MIT.

## What is in it

| Path | Content |
| --- | --- |
| `src/index.ts` | Entry point, starts the mode given by `MODE`, graceful shutdown |
| `src/api` | Hono app, REST routes (products, categories, cart, checkout, search, upload, PayPal), middleware for rate limiting, caching and ETags, security headers, login brute-force protection, HTTP metrics; OpenAPI document and Swagger UI under `/api/docs` |
| `src/trpc` | Admin API: routers for product, category, customer, order, shipping, payment, coupon, tax, delivery time and admin users. Exported as `@skibidoo/core/trpc` |
| `src/auth` | Customer and admin authentication with JWT (jose) and bcrypt, refresh tokens, one-time admin setup endpoint |
| `src/db` | Drizzle schema for products, customers, carts, orders, commerce settings, gift cards and admin users |
| `src/payments` | Stripe (checkout session, payment intent, webhooks) and PayPal (server SDK) |
| `src/giftcards`, `src/invoices` | Gift cards; invoices as PDF (pdfkit) |
| `src/email` | Nodemailer transport and MJML templates (order confirmation, shipping confirmation, customer mails) |
| `src/search`, `src/storage` | PostgreSQL full-text search; upload to S3-compatible storage, image processing with Jimp |
| `src/jobs` | BullMQ queues, workers (email, invoice, stock, cleanup, payment sync, reports) and the cron schedule |
| `src/telemetry` | Prometheus metrics at `/metrics`, OpenTelemetry tracing |
| `src/scripts` | Seed scripts for an admin user, products and demo data |
| `tests`, `src/__tests__` | Unit tests and integration tests (Testcontainers) |
| `site`, `site-docs` | Project site and documentation (German) for GitHub Pages |

Modes: `api` serves HTTP. `worker` processes the queues. `scheduler` registers the repeatable jobs and also processes queues. `worker` and `scheduler` need Redis; in `api` mode Redis is optional and only used for brute-force protection.

## Stack

Bun, TypeScript, Hono, tRPC 11, Drizzle ORM with postgres.js, PostgreSQL, Redis with BullMQ and ioredis, Zod 4, Stripe and PayPal SDKs, Nodemailer, MJML, pdfkit, Jimp, AWS S3 client, pino, prom-client, OpenTelemetry.

## Requirements and setup

- Bun 1.1 or newer (`engines` in `package.json`)
- PostgreSQL and Redis. `docker-compose.yml` provides `postgres:16-alpine` and `redis:7-alpine` together with the three modes of the core.
- Docker for the integration tests

```sh
cp .env.example .env
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

`dev` starts the API in watch mode on port 3000; `GET /health` reports the status. `seed:admin` reads `ADMIN_PASSWORD` (required) and optionally `ADMIN_EMAIL`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start `src/index.ts` in watch mode |
| `bun run build` / `bun run start` | Bundle to `dist/` and run it |
| `bun run typecheck` / `bun run lint` | `tsc --noEmit` / ESLint on `src/` |
| `bun run test`, `test:integration`, `test:all`, `test:coverage` | Tests |
| `bun run db:generate`, `db:migrate`, `db:studio` | drizzle-kit |
| `bun run seed:admin`, `seed:products`, `seed:demo` | Seed data |
| `bun run secretlint` | Scan for secrets (also runs as pre-commit hook) |
| `docker compose up -d` | API, worker, scheduler, PostgreSQL and Redis in containers |

Deployment: `Dockerfile` builds a Bun image, `fly.toml` configures the API on fly.io, and `.github/workflows/ci.yml` builds and pushes an image to the GitHub Container Registry on pushes to `main`. `DEPLOYMENT.md` (German) describes the fly.io setup.

## Configuration

Validated in `src/config/env.ts`. Required: `DATABASE_URL`, `JWT_SECRET` (at least 32 characters).

- Runtime: `MODE`, `NODE_ENV`, `PORT`, `LOG_LEVEL`
- Redis: `REDIS_URL`
- Auth: `JWT_REFRESH_SECRET`, `JWT_EXPIRY`
- Storage: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`
- Mail: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- URLs and CORS: `STOREFRONT_URL`, `ADMIN_URL`, `CORS_ORIGINS`
- Tracing (read directly in `src/telemetry`): `OTEL_DISABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`

## Related repositories

- [skibidoo-storefront](https://github.com/casoon/skibidoo-storefront): shop front end, talks to the REST API under `/api/v1`
- [skibidoo-admin](https://github.com/casoon/skibidoo-admin): admin dashboard, talks to tRPC under `/trpc` and uses the router types exported as `@skibidoo/core/trpc`
- [skibidoo-ui](https://github.com/casoon/skibidoo-ui): component library (`@casoon/skibidoo-ui`) used by the front ends

The core is the only part that talks to the database, the payment providers and the mail server. Longer documentation is in `site-docs/` and published at https://casoon.github.io/skibidoo-core/.

## Licence

MIT, see [LICENSE](LICENSE). Copyright (c) 2025 Jörn Seidel.
