# Performance

Summary of measured runs. Full outputs, settings and `EXPLAIN (ANALYZE, BUFFERS)` plans are in [`raw/`](raw/).

## Phase 3 queries

10M events, 4.1M rollup rows, Postgres 17 in Docker. Median of 10 warm runs, client-side wall time. Raw runs: [before](raw/before.md), [rewrite](raw/rewrite.md).

| query                       | before ms | rewrite ms |
| --------------------------- | --------- | ---------- |
| series-30d-hour-rollup      | 5372.5    | 454.0      |
| series-30d-hour-raw         | 2382.0    | 2339.7     |
| series-30d-day-route-rollup | 62.9      | 12.6       |
| series-30d-day-route-raw    | 600.5     | 560.0      |
| routes-7d-rollup            | 1357.5    | 162.0      |
| routes-7d-raw               | 302.7     | 296.8      |
| routes-30d-rollup           | 5974.9    | 462.0      |
| paths-page-1                | 126.2     | 122.7      |
| paths-page-2                | 123.5     | 125.6      |
| attribution-lcp             | 130.9     | 131.4      |
| attribution-inp             | 127.5     | 126.1      |
| rollup-job-3h               | 661.8     | 839.7      |

The rollup queries were slower than the raw queries they replaced. The before plan unnested every histogram: 442k rollup rows × 65 buckets became 28.7M rows in a nested loop, then went through a hash aggregate (8.5 s execution for the 30-day hourly series). The rewrite sums bucket positions directly (`sum(r.buckets[1]), …, sum(r.buckets[n])`), so each rollup row is read once inside a parallel partial aggregate (0.44 s). Rollup reads are now 5–13× faster than before and faster than raw. The raw-event queries (`*-raw`, paths, attribution) and inserts didn't change. The rollup job (`rollup-job-3h`, 662 → 840 ms) got slower between the runs, and that hasn't been investigated.

## Phase 4 ingestion

`POST /v1/events`, autocannon, 50 connections for 30 s, 10 events per request, rate limits off. Api, worker, Postgres and Redis on one machine. Raw runs: [phase4](raw/phase4.md).

| run                                             | req/s | p50 ms | p99 ms | peak queue (jobs) |
| ----------------------------------------------- | ----- | ------ | ------ | ----------------- |
| Baseline: Phase 3 synchronous insert            | 3301  | 14     | 20     | n/a               |
| A: queue + worker                               | 8820  | 5      | 11     | 221k              |
| B: queue + worker, each INSERT slowed by 100 ms | 10513 | 4      | 8      | 313k              |

A request now costs validation, the key lookup and one Redis write, so the api accepts 2.7× the requests at about a third of the latency. Storage throughput didn't grow with it. The worker (concurrency 10, one INSERT per job) drains about 2.9k jobs/s once the load stops, so in run A the queue backs up and needs 77 s to drain. In run B the worker fell to about 95 jobs/s and ingestion latency stayed flat. The queue took the backlog and drained in 108 s once inserts were fast again. Every accepted event was stored exactly once in both runs.
