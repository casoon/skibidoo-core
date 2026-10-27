---
title: Betriebsmodi
description: Ein Image, drei Prozessrollen. API, Worker und Scheduler werden über MODE gewählt.
order: 2
---

Derselbe Build startet je nach Umgebungsvariable `MODE` in einer von drei Rollen
(`src/index.ts`):

| `MODE` | Aufgabe | Redis nötig |
| --- | --- | --- |
| `api` (Standard) | HTTP-Server mit REST, tRPC, Webhooks, Health und Metriken | nein, aber für Brute-Force-Schutz empfohlen |
| `worker` | Verarbeitet die BullMQ-Queues | ja |
| `scheduler` | Legt die wiederkehrenden Jobs an | ja |

Ohne `REDIS_URL` brechen `worker` und `scheduler` mit einer Fehlermeldung ab. Die API läuft auch
ohne, dann fehlen allerdings die Funktionen, die Redis voraussetzen (Job-Queues,
Brute-Force-Schutz beim Login).

Die Rollen lassen sich damit getrennt skalieren: ein oder mehrere API-Prozesse, ein Worker, genau
ein Scheduler.

## Health und Metriken

| Pfad | Inhalt |
| --- | --- |
| `GET /health` | `{ "status": "ok", "mode": "…" }` |
| `GET /health/ready` | `{ "status": "ready" }` |
| `GET /metrics` | Prometheus-Format |
