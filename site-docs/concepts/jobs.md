---
title: Hintergrundjobs
description: Queues, Handler und der Zeitplan des Schedulers.
order: 3
---

Jobs laufen über BullMQ auf Redis. Die Queues heißen `email`, `invoice`, `stock`, `import`,
`cleanup`, `payment` und `reports` (`src/jobs/queues.ts`). Handler liegen unter
`src/jobs/handlers/` für E-Mail, Rechnung, Bestand, Aufräumen, Zahlungsabgleich und Berichte.

## Zeitplan des Schedulers

Cron-Muster aus `src/jobs/scheduler.ts`:

| Job | Queue | Muster | Zeitpunkt |
| --- | --- | --- | --- |
| `expired_carts` | cleanup | `0 * * * *` | stündlich |
| `low_stock_alert` | stock | `0 */6 * * *` | alle 6 Stunden |
| `sync` | stock | `0 3 * * *` | täglich 3:00 |
| `old_sessions` | cleanup | `0 4 * * 0` | sonntags 4:00 |
| `temp_files` | cleanup | `0 5 * * *` | täglich 5:00 |
| `sync_pending` | payment | `*/15 * * * *` | alle 15 Minuten |
| `reconcile` | payment | `0 2 * * *` | täglich 2:00 |
| `daily` | reports | `0 6 * * *` | täglich 6:00 |
| `weekly` | reports | `0 7 * * 1` | montags 7:00 |
| `monthly` | reports | `0 8 1 * *` | am 1. des Monats 8:00 |

Beim Start entfernt der Scheduler vorhandene Wiederholungen gleichen Namens und legt sie neu
an. Deshalb darf nur ein Scheduler-Prozess laufen.
