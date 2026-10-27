---
title: Lokal starten
description: Den Core mit PostgreSQL und Redis lokal betreiben, Migrationen ausführen und Demo-Daten laden.
order: 1
---

## Voraussetzungen

- [Bun](https://bun.sh) ab Version 1.1 (`engines` in der `package.json`)
- PostgreSQL und Redis. Der Core braucht beides laufend; Redis ist für die Modi `worker` und
  `scheduler` Pflicht, siehe [Betriebsmodi](../../concepts/modes/).
- Optional: Mailpit für E-Mails, MinIO für Uploads

Die `docker-compose.yml` im Repository startet PostgreSQL und Redis sowie den Core in den Modi
`api`, `worker` und `scheduler` (`docker compose up`).

## Konfiguration

```sh
cp .env.example .env
```

`DATABASE_URL` und `JWT_SECRET` (mindestens 32 Zeichen) sind Pflicht. Alle Variablen stehen
unter [Konfiguration](../../reference/configuration/).

## Abhängigkeiten, Migrationen, Start

```sh
bun install
bun run db:migrate
bun run dev
```

`dev` startet die API im Watch-Modus auf Port 3000. Ob der Prozess läuft, zeigt
`GET /health`.

## Demo-Daten

```sh
bun run seed:admin
bun run seed:demo
```

`seed:admin` legt den Admin-Benutzer an. `seed:demo` lädt Produkte und weitere Demo-Daten.

## Tests und Prüfungen

```sh
bun run typecheck
bun run lint
bun test
```

Integrationstests laufen mit `bun run test:integration` und nutzen Testcontainers für PostgreSQL;
dafür muss Docker laufen.
