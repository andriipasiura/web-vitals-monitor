# Perf runs: Phase 4 ingestion

## phase3-sync

Finished at 2026-10-31T09:00:18.670Z. 50 connections for 30 s, 10 events per request.

| req/s | p50 ms | p99 ms | max ms | errors | timeouts |
|---|---|---|---|---|---|
| 3301 | 14 | 20 | 43 | 0 | 0 |

Status codes: 202 × 99008. Events stored when the run ended: 990450.
## phase4-queue

Finished at 2026-10-31T09:45:12.397Z. 50 connections for 30 s, 10 events per request.

| req/s | p50 ms | p99 ms | max ms | errors | timeouts |
|---|---|---|---|---|---|
| 8820 | 5 | 11 | 70 | 0 | 0 |

Status codes: 202 × 264593. Events stored when the run ended: 435470.
Queue depth: peak 221085 jobs (sampled every second), 220877 when the run ended, drained 76.8 s later.
Events stored at the end: 2646430 (accepted requests × 10 = 2645930; requests in flight when autocannon stopped are stored but not counted).
## phase4-queue-slow-inserts

Finished at 2026-10-31T09:47:46.633Z. 50 connections for 30 s, 10 events per request, every INSERT into events slowed by 100 ms (statement trigger).

| req/s | p50 ms | p99 ms | max ms | errors | timeouts |
|---|---|---|---|---|---|
| 10513 | 4 | 8 | 24 | 0 | 0 |

Status codes: 202 × 315396. Events stored when the run ended: 28370.
Queue depth: peak 312600 jobs (sampled every second), 312600 when the run ended, drained 107.9 s later (after the slowdown was removed).
Events stored at the end: 3154460 (accepted requests × 10 = 3153960; requests in flight when autocannon stopped are stored but not counted).
