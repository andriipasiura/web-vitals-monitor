# Perf run: rewrite

Run at 2026-10-29T20:35:45.938Z. Events: 9999990, rollup rows: 4123839.
Timings are client-side wall time through node-postgres: first run, then 10 warm runs.

## Settings

- effective_cache_size: 5242888kB
- jit: on
- max_parallel_workers_per_gather: 2
- random_page_cost: 4
- server_version: 17.11
- shared_buffers: 163848kB
- work_mem: 4096kB

## Timings

| query | rows | first ms | median ms | min ms | max ms |
|---|---|---|---|---|---|
| series-30d-hour-rollup | 720 | 465.3 | 454.0 | 438.8 | 497.5 |
| series-30d-hour-raw | 720 | 2426.1 | 2339.7 | 2313.2 | 2354.5 |
| series-30d-day-route-rollup | 31 | 15.9 | 12.6 | 12.2 | 14.8 |
| series-30d-day-route-raw | 31 | 550.4 | 560.0 | 535.4 | 577.3 |
| routes-7d-rollup | 200 | 199.1 | 162.0 | 158.6 | 168.2 |
| routes-7d-raw | 200 | 291.8 | 296.8 | 284.3 | 304.9 |
| routes-30d-rollup | 200 | 474.8 | 462.0 | 441.3 | 503.8 |
| paths-page-1 | 21 | 122.2 | 122.7 | 118.6 | 130.0 |
| paths-page-2 | 21 | 123.7 | 125.6 | 119.6 | 135.2 |
| attribution-lcp | 8 | 139.4 | 131.4 | 127.1 | 149.8 |
| attribution-inp | 10 | 126.4 | 126.1 | 122.0 | 140.9 |
| rollup-job-3h | 11398 | 815.1 | 839.7 | 817.9 | 949.3 |

## Inserts

5000 batches of 10 events, one multi-row INSERT each: median 2.2 ms, p99 3.1 ms, 4453 events/s.

## Sizes

| relation | kind | size |
|---|---|---|
| event_rollups_hourly | table | 1722 MB |
| events | table | 1740 MB |
| event_rollups_hourly: event_rollups_hourly_key | index | 511 MB |
| events: events_pYYYYMMDD_pkey | index | 304 MB |

## Plans

### series-30d-hour-rollup

p75 LCP series, 30 days, hourly, whole project (GET /metrics)

```
Finalize GroupAggregate  (cost=287756.01..288183.81 rows=721 width=72) (actual time=426.274..435.678 rows=720 loops=1)
  Group Key: hour
  Buffers: shared hit=1956 read=211219
  ->  Gather Merge  (cost=287756.01..287924.25 rows=1442 width=560) (actual time=426.239..433.483 rows=2154 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=1956 read=211219
        ->  Sort  (cost=286755.98..286757.78 rows=721 width=560) (actual time=411.535..411.593 rows=718 loops=3)
              Sort Key: hour
              Sort Method: quicksort  Memory: 430kB
              Buffers: shared hit=1956 read=211219
              Worker 0:  Sort Method: quicksort  Memory: 428kB
              Worker 1:  Sort Method: quicksort  Memory: 428kB
              ->  Partial HashAggregate  (cost=286714.55..286721.76 rows=721 width=560) (actual time=410.400..410.920 rows=718 loops=3)
                    Group Key: hour
                    Batches: 1  Memory Usage: 1577kB
                    Buffers: shared hit=1940 read=211219
                    Worker 0:  Batches: 1  Memory Usage: 1577kB
                    Worker 1:  Batches: 1  Memory Usage: 1577kB
                    ->  Parallel Seq Scan on event_rollups_hourly r  (cost=0.00..253173.87 rows=191661 width=305) (actual time=33.636..186.904 rows=147350 loops=3)
                          Filter: ((hour < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)))
                          Rows Removed by Filter: 1227263
                          Buffers: shared hit=1940 read=211219
Planning Time: 0.792 ms
JIT:
  Functions: 27
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 9.628 ms (Deform 1.002 ms), Inlining 0.000 ms, Optimization 2.150 ms, Emission 90.065 ms, Total 101.844 ms
Execution Time: 440.910 ms
```

### series-30d-hour-raw

Same series computed from raw events with percentile_cont

```
GroupAggregate  (cost=374838.38..577351.11 rows=1315304 width=48) (actual time=2054.672..2487.716 rows=720 loops=1)
  Group Key: (date_trunc('hour'::text, e.received_at, 'UTC'::text))
  Buffers: shared hit=12913 read=209939, temp read=6206 written=6227
  ->  Gather Merge  (cost=374838.38..528027.21 rows=1315304 width=24) (actual time=2053.537..2218.800 rows=1320208 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=12913 read=209939, temp read=6206 written=6227
        ->  Sort  (cost=373838.36..375208.47 rows=548043 width=24) (actual time=2025.835..2058.169 rows=440069 loops=3)
              Sort Key: (date_trunc('hour'::text, e.received_at, 'UTC'::text))
              Sort Method: external merge  Disk: 16544kB
              Buffers: shared hit=12913 read=209939, temp read=6206 written=6227
              Worker 0:  Sort Method: external merge  Disk: 16112kB
              Worker 1:  Sort Method: external merge  Disk: 16992kB
              ->  Parallel Append  (cost=0.00..310357.09 rows=548043 width=24) (actual time=1463.411..1926.355 rows=440069 loops=3)
                    Buffers: shared hit=12799 read=209939
                    ->  Parallel Seq Scan on events_p20261025 e_27  (cost=0.00..10272.09 rows=18125 width=24) (actual time=1436.321..1479.157 rows=44147 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289186
                          Buffers: shared hit=352 read=7097
                    ->  Parallel Seq Scan on events_p20261019 e_21  (cost=0.00..10271.55 rows=18308 width=24) (actual time=1447.214..1494.556 rows=44202 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289131
                          Buffers: shared hit=352 read=7096
                    ->  Parallel Seq Scan on events_p20261027 e_29  (cost=0.00..10271.02 rows=18097 width=24) (actual time=0.059..46.313 rows=44060 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289273
                          Buffers: shared hit=352 read=7096
                    ->  Parallel Seq Scan on events_p20261020 e_22  (cost=0.00..10270.60 rows=18329 width=24) (actual time=0.075..46.464 rows=44044 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289289
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261026 e_28  (cost=0.00..10270.40 rows=18251 width=24) (actual time=0.074..44.549 rows=44158 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289175
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261021 e_23  (cost=0.00..10270.40 rows=18248 width=24) (actual time=0.068..42.908 rows=43851 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289482
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261018 e_20  (cost=0.00..10270.10 rows=18129 width=24) (actual time=0.064..40.696 rows=44049 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289284
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261023 e_25  (cost=0.00..10269.95 rows=18469 width=24) (actual time=0.065..44.110 rows=44043 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289290
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261028 e_30  (cost=0.00..10269.93 rows=18464 width=24) (actual time=0.064..45.486 rows=44109 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289224
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261022 e_24  (cost=0.00..10269.46 rows=18273 width=24) (actual time=0.066..45.554 rows=44140 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289193
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261024 e_26  (cost=0.00..10264.66 rows=18354 width=24) (actual time=0.069..40.966 rows=43657 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289676
                          Buffers: shared hit=352 read=7089
                    ->  Parallel Seq Scan on events_p20261013 e_15  (cost=0.00..10263.19 rows=18165 width=24) (actual time=0.080..53.492 rows=44134 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289199
                          Buffers: shared hit=352 read=7088
                    ->  Parallel Seq Scan on events_p20261017 e_19  (cost=0.00..10262.14 rows=18146 width=24) (actual time=0.067..51.568 rows=43938 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289395
                          Buffers: shared hit=352 read=7087
                    ->  Parallel Seq Scan on events_p20261014 e_16  (cost=0.00..10261.66 rows=18354 width=24) (actual time=0.067..39.900 rows=44026 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289307
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261016 e_18  (cost=0.00..10261.40 rows=18252 width=24) (actual time=0.064..37.908 rows=44339 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 288994
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261015 e_17  (cost=0.00..10260.57 rows=17919 width=24) (actual time=0.058..38.994 rows=44264 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289069
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261012 e_14  (cost=0.00..10260.06 rows=18115 width=24) (actual time=0.113..44.087 rows=44262 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289071
                          Buffers: shared hit=352 read=7085
                    ->  Parallel Seq Scan on events_p20261011 e_13  (cost=0.00..10223.10 rows=18132 width=24) (actual time=0.060..44.065 rows=44070 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289263
                          Buffers: shared hit=352 read=7048
                    ->  Parallel Seq Scan on events_p20261009 e_11  (cost=0.00..10220.85 rows=18429 width=24) (actual time=0.078..48.944 rows=44110 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289223
                          Buffers: shared hit=544 read=6853
                    ->  Parallel Seq Scan on events_p20261002 e_4  (cost=0.00..10220.72 rows=18779 width=24) (actual time=0.056..14.567 rows=14657 loops=3)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 96454
                          Buffers: shared hit=768 read=6628
                    ->  Parallel Seq Scan on events_p20261004 e_6  (cost=0.00..10220.67 rows=18360 width=24) (actual time=0.057..21.751 rows=21942 loops=2)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 144724
                          Buffers: shared hit=544 read=6853
                    ->  Parallel Seq Scan on events_p20261008 e_10  (cost=0.00..10220.56 rows=18312 width=24) (actual time=0.053..39.303 rows=43768 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289565
                          Buffers: shared hit=416 read=6981
                    ->  Parallel Seq Scan on events_p20261007 e_9  (cost=0.00..10220.47 rows=18276 width=24) (actual time=0.054..38.093 rows=43742 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289591
                          Buffers: shared hit=352 read=7045
                    ->  Parallel Seq Scan on events_p20261003 e_5  (cost=0.00..10220.33 rows=18222 width=24) (actual time=0.053..38.296 rows=44133 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289200
                          Buffers: shared hit=352 read=7045
                    ->  Parallel Seq Scan on events_p20261010 e_12  (cost=0.00..10220.06 rows=18512 width=24) (actual time=0.059..41.679 rows=44187 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289146
                          Buffers: shared hit=352 read=7044
                    ->  Parallel Seq Scan on events_p20261001 e_3  (cost=0.00..10219.57 rows=18320 width=24) (actual time=0.060..43.329 rows=44139 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289194
                          Buffers: shared hit=352 read=7044
                    ->  Parallel Seq Scan on events_p20260930 e_2  (cost=0.00..10218.40 rows=18252 width=24) (actual time=0.058..42.269 rows=43638 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289695
                          Buffers: shared hit=352 read=7043
                    ->  Parallel Seq Scan on events_p20261006 e_8  (cost=0.00..10218.04 rows=18105 width=24) (actual time=0.043..44.556 rows=44038 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289295
                          Buffers: shared hit=352 read=7043
                    ->  Parallel Seq Scan on events_p20261005 e_7  (cost=0.00..10216.92 rows=18458 width=24) (actual time=0.046..40.883 rows=43924 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289409
                          Buffers: shared hit=352 read=7041
                    ->  Parallel Seq Scan on events_p20261029 e_31  (cost=0.00..8717.23 rows=15475 width=24) (actual time=0.033..45.093 rows=37356 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 245549
                          Buffers: shared hit=608 read=5713
                    ->  Parallel Seq Scan on events_p20260929 e_1  (cost=0.00..1720.79 rows=3407 width=24) (actual time=1506.693..1512.687 rows=5824 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 44604
                          Buffers: shared hit=1119
Planning Time: 0.975 ms
JIT:
  Functions: 376
  Options: Inlining true, Optimization true, Expressions true, Deforming true
  Timing: Generation 46.789 ms (Deform 29.599 ms), Inlining 120.306 ms, Optimization 2405.564 ms, Emission 1864.762 ms, Total 4437.421 ms
Execution Time: 2503.545 ms
```

### series-30d-day-route-rollup

p75 LCP series, 30 days, daily, route /products/:id (GET /metrics)

```
Sort  (cost=23954.21..23956.01 rows=721 width=72) (actual time=10.300..10.302 rows=31 loops=1)
  Sort Key: (date_trunc('day'::text, hour, 'UTC'::text))
  Sort Method: quicksort  Memory: 43kB
  Buffers: shared hit=383
  ->  HashAggregate  (cost=23910.97..23919.98 rows=721 width=72) (actual time=10.255..10.285 rows=31 loops=1)
        Group Key: date_trunc('day'::text, hour, 'UTC'::text)
        Batches: 1  Memory Usage: 169kB
        Buffers: shared hit=383
        ->  Bitmap Heap Scan on event_rollups_hourly r  (cost=510.98..22783.97 rows=6440 width=305) (actual time=0.483..3.077 rows=5158 loops=1)
              Recheck Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
              Heap Blocks: exact=291
              Buffers: shared hit=383
              ->  Bitmap Index Scan on event_rollups_hourly_key  (cost=0.00..509.37 rows=6440 width=0) (actual time=0.454..0.454 rows=5177 loops=1)
                    Index Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                    Buffers: shared hit=92
Planning Time: 0.299 ms
Execution Time: 10.498 ms
```

### series-30d-day-route-raw

Same series computed from raw events

```
GroupAggregate  (cost=319632.68..328602.46 rows=58258 width=48) (actual time=501.633..527.801 rows=31 loops=1)
  Group Key: (date_trunc('day'::text, e.received_at, 'UTC'::text))
  Buffers: shared hit=15327 read=207525
  ->  Gather Merge  (cost=319632.68..326417.78 rows=58258 width=24) (actual time=501.477..515.391 rows=58428 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=15327 read=207525
        ->  Sort  (cost=318632.66..318693.34 rows=24273 width=24) (actual time=478.119..478.765 rows=19476 loops=3)
              Sort Key: (date_trunc('day'::text, e.received_at, 'UTC'::text))
              Sort Method: quicksort  Memory: 1668kB
              Buffers: shared hit=15327 read=207525
              Worker 0:  Sort Method: quicksort  Memory: 1599kB
              Worker 1:  Sort Method: quicksort  Memory: 1573kB
              ->  Parallel Append  (cost=0.00..316864.73 rows=24273 width=24) (actual time=91.307..473.643 rows=19476 loops=3)
                    Buffers: shared hit=15213 read=207525
                    ->  Parallel Seq Scan on events_p20261025 e_27  (cost=0.00..10575.98 rows=795 width=24) (actual time=92.124..139.061 rows=1935 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331398
                          Buffers: shared hit=386 read=7063
                    ->  Parallel Seq Scan on events_p20261019 e_21  (cost=0.00..10575.11 rows=847 width=24) (actual time=92.010..138.423 rows=1937 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331396
                          Buffers: shared hit=381 read=7067
                    ->  Parallel Seq Scan on events_p20261027 e_29  (cost=0.00..10575.02 rows=808 width=24) (actual time=0.198..37.283 rows=1978 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331355
                          Buffers: shared hit=442 read=7006
                    ->  Parallel Seq Scan on events_p20261020 e_22  (cost=0.00..10574.11 rows=845 width=24) (actual time=0.099..42.326 rows=1943 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331390
                          Buffers: shared hit=426 read=7021
                    ->  Parallel Seq Scan on events_p20261021 e_23  (cost=0.00..10573.98 rows=792 width=24) (actual time=0.066..36.042 rows=1962 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331371
                          Buffers: shared hit=433 read=7014
                    ->  Parallel Seq Scan on events_p20261018 e_20  (cost=0.00..10573.97 rows=790 width=24) (actual time=0.058..34.858 rows=1968 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331365
                          Buffers: shared hit=422 read=7025
                    ->  Parallel Seq Scan on events_p20261026 e_28  (cost=0.00..10573.96 rows=785 width=24) (actual time=0.152..34.963 rows=2002 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331331
                          Buffers: shared hit=384 read=7063
                    ->  Parallel Seq Scan on events_p20261023 e_25  (cost=0.00..10573.03 rows=812 width=24) (actual time=0.052..34.697 rows=1971 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331362
                          Buffers: shared hit=384 read=7062
                    ->  Parallel Seq Scan on events_p20261028 e_30  (cost=0.00..10572.99 rows=798 width=24) (actual time=0.112..35.913 rows=1956 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331377
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261022 e_24  (cost=0.00..10572.97 rows=788 width=24) (actual time=0.061..35.281 rows=1890 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331443
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261024 e_26  (cost=0.00..10568.02 rows=810 width=24) (actual time=0.069..37.807 rows=1915 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331418
                          Buffers: shared hit=352 read=7089
                    ->  Parallel Seq Scan on events_p20261013 e_15  (cost=0.00..10567.02 rows=811 width=24) (actual time=0.098..35.913 rows=1983 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331350
                          Buffers: shared hit=352 read=7088
                    ->  Parallel Seq Scan on events_p20261017 e_19  (cost=0.00..10566.08 rows=835 width=24) (actual time=0.273..34.814 rows=1988 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331345
                          Buffers: shared hit=320 read=7119
                    ->  Parallel Seq Scan on events_p20261016 e_18  (cost=0.00..10565.08 rows=834 width=24) (actual time=0.087..35.133 rows=1982 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331351
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261014 e_16  (cost=0.00..10565.04 rows=818 width=24) (actual time=0.076..41.333 rows=1877 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331456
                          Buffers: shared hit=527 read=6911
                    ->  Parallel Seq Scan on events_p20261015 e_17  (cost=0.00..10565.03 rows=812 width=24) (actual time=0.167..35.678 rows=1933 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331400
                          Buffers: shared hit=499 read=6939
                    ->  Parallel Seq Scan on events_p20261012 e_14  (cost=0.00..10564.06 rows=824 width=24) (actual time=0.104..41.439 rows=1994 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331339
                          Buffers: shared hit=553 read=6884
                    ->  Parallel Seq Scan on events_p20261011 e_13  (cost=0.00..10527.04 rows=818 width=24) (actual time=0.065..35.353 rows=1951 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331382
                          Buffers: shared hit=551 read=6849
                    ->  Parallel Seq Scan on events_p20261004 e_6  (cost=0.00..10524.01 rows=807 width=24) (actual time=0.103..13.445 rows=655 loops=3)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 110456
                          Buffers: shared hit=1076 read=6321
                    ->  Parallel Seq Scan on events_p20261007 e_9  (cost=0.00..10524.00 rows=801 width=24) (actual time=0.098..27.851 rows=1001 loops=2)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 165666
                          Buffers: shared hit=802 read=6595
                    ->  Parallel Seq Scan on events_p20261009 e_11  (cost=0.00..10523.99 rows=799 width=24) (actual time=0.050..36.726 rows=1925 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331408
                          Buffers: shared hit=661 read=6736
                    ->  Parallel Seq Scan on events_p20261008 e_10  (cost=0.00..10523.99 rows=798 width=24) (actual time=0.122..40.520 rows=1961 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331372
                          Buffers: shared hit=512 read=6885
                    ->  Parallel Seq Scan on events_p20261003 e_5  (cost=0.00..10523.97 rows=788 width=24) (actual time=0.157..34.675 rows=1913 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331420
                          Buffers: shared hit=320 read=7077
                    ->  Parallel Seq Scan on events_p20261001 e_3  (cost=0.00..10523.05 rows=822 width=24) (actual time=0.071..34.312 rows=1865 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331468
                          Buffers: shared hit=352 read=7044
                    ->  Parallel Seq Scan on events_p20261010 e_12  (cost=0.00..10523.02 rows=810 width=24) (actual time=0.070..35.370 rows=1945 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331388
                          Buffers: shared hit=392 read=7004
                    ->  Parallel Seq Scan on events_p20261002 e_4  (cost=0.00..10522.96 rows=785 width=24) (actual time=0.072..35.000 rows=1923 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331410
                          Buffers: shared hit=704 read=6692
                    ->  Parallel Seq Scan on events_p20260930 e_2  (cost=0.00..10522.08 rows=833 width=24) (actual time=0.084..37.699 rows=1873 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331460
                          Buffers: shared hit=451 read=6944
                    ->  Parallel Seq Scan on events_p20261006 e_8  (cost=0.00..10521.91 rows=767 width=24) (actual time=0.050..38.026 rows=1905 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331428
                          Buffers: shared hit=480 read=6915
                    ->  Parallel Seq Scan on events_p20261005 e_7  (cost=0.00..10520.10 rows=841 width=24) (actual time=0.108..36.208 rows=2008 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331325
                          Buffers: shared hit=416 read=6977
                    ->  Parallel Seq Scan on events_p20261029 e_31  (cost=0.00..8974.98 rows=699 width=24) (actual time=0.065..30.408 rows=1725 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 281180
                          Buffers: shared hit=460 read=5861
                    ->  Parallel Seq Scan on events_p20260929 e_1  (cost=0.00..1786.79 rows=143 width=24) (actual time=89.785..95.260 rows=254 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 50174
                          Buffers: shared hit=1119
Planning Time: 1.123 ms
JIT:
  Functions: 376
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 41.006 ms (Deform 24.974 ms), Inlining 0.000 ms, Optimization 20.222 ms, Emission 254.093 ms, Total 315.321 ms
Execution Time: 541.960 ms
```

### routes-7d-rollup

Per-route LCP summary, 7 days (GET /routes)

```
Finalize GroupAggregate  (cost=251987.07..252105.74 rows=200 width=78) (actual time=145.611..154.439 rows=200 loops=1)
  Group Key: route
  Buffers: shared hit=13134
  ->  Gather Merge  (cost=251987.07..252033.74 rows=400 width=566) (actual time=145.574..153.670 rows=600 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=13134
        ->  Sort  (cost=250987.05..250987.55 rows=200 width=566) (actual time=130.753..130.765 rows=200 loops=3)
              Sort Key: route
              Sort Method: quicksort  Memory: 139kB
              Buffers: shared hit=13134
              Worker 0:  Sort Method: quicksort  Memory: 139kB
              Worker 1:  Sort Method: quicksort  Memory: 139kB
              ->  Partial HashAggregate  (cost=250977.41..250979.41 rows=200 width=566) (actual time=130.371..130.465 rows=200 loops=3)
                    Group Key: route
                    Batches: 1  Memory Usage: 544kB
                    Buffers: shared hit=13118
                    Worker 0:  Batches: 1  Memory Usage: 544kB
                    Worker 1:  Batches: 1  Memory Usage: 544kB
                    ->  Parallel Bitmap Heap Scan on event_rollups_hourly r  (cost=35139.00..242901.86 rows=46146 width=311) (actual time=50.924..57.182 rows=35812 loops=3)
                          Recheck Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-10-22 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                          Heap Blocks: exact=2992
                          Buffers: shared hit=13118
                          ->  Bitmap Index Scan on event_rollups_hourly_key  (cost=0.00..35111.31 rows=110750 width=0) (actual time=64.296..64.296 rows=108712 loops=1)
                                Index Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-10-22 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                                Buffers: shared hit=6949
Planning Time: 0.703 ms
JIT:
  Functions: 30
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 10.044 ms (Deform 0.866 ms), Inlining 0.000 ms, Optimization 2.137 ms, Emission 88.568 ms, Total 100.750 ms
Execution Time: 159.751 ms
```

### routes-7d-raw

Same summary computed from raw events

```
Sort  (cost=137913.61..137914.11 rows=200 width=53) (actual time=309.917..316.070 rows=200 loops=1)
  Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC
  Sort Method: quicksort  Memory: 39kB
  Buffers: shared hit=3147 read=55411, temp read=1623 written=1627
  ->  GroupAggregate  (cost=95651.13..137905.97 rows=200 width=53) (actual time=191.185..315.924 rows=200 loops=1)
        Group Key: e.route
        Buffers: shared hit=3147 read=55411, temp read=1623 written=1627
        ->  Gather Merge  (cost=95651.13..131062.41 rows=304047 width=29) (actual time=189.729..247.838 rows=304992 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=3147 read=55411, temp read=1623 written=1627
              ->  Sort  (cost=94651.10..94967.82 rows=126686 width=29) (actual time=170.452..181.735 rows=101664 loops=3)
                    Sort Key: e.route
                    Sort Method: external merge  Disk: 4840kB
                    Buffers: shared hit=3147 read=55411, temp read=1623 written=1627
                    Worker 0:  Sort Method: external merge  Disk: 3384kB
                    Worker 1:  Sort Method: external merge  Disk: 4760kB
                    ->  Parallel Append  (cost=0.00..80879.40 rows=126686 width=29) (actual time=23.591..129.621 rows=101664 loops=3)
                          Buffers: shared hit=3033 read=55411
                          ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=18125 width=29) (actual time=25.133..61.098 rows=44147 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289186
                                Buffers: shared hit=288 read=7161
                          ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=18097 width=29) (actual time=24.338..69.902 rows=44060 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289273
                                Buffers: shared hit=307 read=7141
                          ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=18251 width=29) (actual time=0.065..36.430 rows=44158 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289175
                                Buffers: shared hit=232 read=7215
                          ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=1451 width=29) (actual time=0.094..28.007 rows=3462 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 329871
                                Buffers: shared hit=295 read=7151
                          ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=18469 width=29) (actual time=0.066..12.981 rows=14681 loops=3)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 96430
                                Buffers: shared hit=775 read=6671
                          ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=18464 width=29) (actual time=0.052..19.091 rows=22054 loops=2)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 144612
                                Buffers: shared hit=560 read=6886
                          ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=18354 width=29) (actual time=0.051..42.009 rows=43657 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289676
                                Buffers: shared hit=256 read=7185
                          ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=15475 width=29) (actual time=21.298..57.715 rows=37356 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 245549
                                Buffers: shared hit=320 read=6001
Planning Time: 0.296 ms
JIT:
  Functions: 100
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 8.456 ms (Deform 4.750 ms), Inlining 0.000 ms, Optimization 3.006 ms, Emission 67.583 ms, Total 79.044 ms
Execution Time: 319.963 ms
```

### routes-30d-rollup

Per-route LCP summary, 30 days (GET /routes)

```
Finalize GroupAggregate  (cost=287724.21..287842.88 rows=200 width=78) (actual time=452.922..460.603 rows=200 loops=1)
  Group Key: route
  Buffers: shared hit=7294 read=205881
  ->  Gather Merge  (cost=287724.21..287770.88 rows=400 width=566) (actual time=452.885..459.935 rows=600 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=7294 read=205881
        ->  Sort  (cost=286724.19..286724.69 rows=200 width=566) (actual time=437.941..437.955 rows=200 loops=3)
              Sort Key: route
              Sort Method: quicksort  Memory: 139kB
              Buffers: shared hit=7294 read=205881
              Worker 0:  Sort Method: quicksort  Memory: 139kB
              Worker 1:  Sort Method: quicksort  Memory: 139kB
              ->  Partial HashAggregate  (cost=286714.55..286716.55 rows=200 width=566) (actual time=437.525..437.645 rows=200 loops=3)
                    Group Key: route
                    Batches: 1  Memory Usage: 544kB
                    Buffers: shared hit=7278 read=205881
                    Worker 0:  Batches: 1  Memory Usage: 544kB
                    Worker 1:  Batches: 1  Memory Usage: 544kB
                    ->  Parallel Seq Scan on event_rollups_hourly r  (cost=0.00..253173.87 rows=191661 width=311) (actual time=33.139..196.391 rows=147350 loops=3)
                          Filter: ((hour < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)))
                          Rows Removed by Filter: 1227263
                          Buffers: shared hit=7278 read=205881
Planning Time: 0.684 ms
JIT:
  Functions: 27
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 10.382 ms (Deform 1.035 ms), Inlining 0.000 ms, Optimization 1.969 ms, Emission 91.481 ms, Total 103.832 ms
Execution Time: 465.856 ms
```

### paths-page-1

Slowest paths of /products/:id, p75, 7 days, first page of 20 (GET /routes/paths)

```
Limit  (cost=83979.12..83979.17 rows=21 width=53) (actual time=120.600..125.469 rows=21 loops=1)
  Buffers: shared hit=7371 read=51187
  ->  Sort  (cost=83979.12..84010.63 rows=12604 width=53) (actual time=120.598..125.465 rows=21 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, e.path
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=7371 read=51187
        ->  GroupAggregate  (cost=81620.99..83639.29 rows=12604 width=53) (actual time=114.715..125.311 rows=1000 loops=1)
              Group Key: e.path
              Buffers: shared hit=7371 read=51187
              ->  Gather Merge  (cost=81620.99..83180.47 rows=13390 width=29) (actual time=114.692..121.982 rows=13635 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=7371 read=51187
                    ->  Sort  (cost=80620.96..80634.91 rows=5578 width=29) (actual time=102.860..103.060 rows=4545 loops=3)
                          Sort Key: e.path
                          Sort Method: quicksort  Memory: 465kB
                          Buffers: shared hit=7371 read=51187
                          Worker 0:  Sort Method: quicksort  Memory: 253kB
                          Worker 1:  Sort Method: quicksort  Memory: 432kB
                          ->  Parallel Append  (cost=0.00..80273.86 rows=5578 width=29) (actual time=0.081..99.077 rows=4545 loops=3)
                                Buffers: shared hit=7257 read=51187
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=795 width=29) (actual time=0.042..42.867 rows=1935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331398
                                      Buffers: shared hit=672 read=6777
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=808 width=29) (actual time=0.131..37.378 rows=1978 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331355
                                      Buffers: shared hit=691 read=6757
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=785 width=29) (actual time=0.125..37.436 rows=2002 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331331
                                      Buffers: shared hit=616 read=6831
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=71 width=29) (actual time=0.137..30.655 rows=153 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 333180
                                      Buffers: shared hit=679 read=6767
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=812 width=29) (actual time=0.036..12.268 rows=657 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110454
                                      Buffers: shared hit=1927 read=5519
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=798 width=29) (actual time=0.044..18.154 rows=978 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 165688
                                      Buffers: shared hit=1328 read=6118
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=810 width=29) (actual time=0.014..43.796 rows=1915 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331418
                                      Buffers: shared hit=640 read=6801
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=699 width=29) (actual time=0.069..31.027 rows=1725 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281180
                                      Buffers: shared hit=704 read=5617
Planning Time: 0.380 ms
Execution Time: 125.702 ms
```

### paths-page-2

Second page via keyset cursor

```
Limit  (cost=83847.39..83847.44 rows=21 width=53) (actual time=126.516..132.144 rows=21 loops=1)
  Buffers: shared hit=11851 read=46707
  ->  Sort  (cost=83847.39..83857.92 rows=4212 width=53) (actual time=126.514..132.140 rows=21 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, e.path
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=11851 read=46707
        ->  GroupAggregate  (cost=81620.99..83733.82 rows=4212 width=53) (actual time=118.948..131.909 rows=980 loops=1)
              Group Key: e.path
              Filter: ((percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value) < '5556'::double precision) OR ((percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value) = '5556'::double precision) AND (e.path > '/products/25'::text)))
              Rows Removed by Filter: 20
              Buffers: shared hit=11851 read=46707
              ->  Gather Merge  (cost=81620.99..83180.47 rows=13390 width=29) (actual time=118.921..127.492 rows=13635 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=11851 read=46707
                    ->  Sort  (cost=80620.96..80634.91 rows=5578 width=29) (actual time=107.502..107.744 rows=4545 loops=3)
                          Sort Key: e.path
                          Sort Method: quicksort  Memory: 463kB
                          Buffers: shared hit=11851 read=46707
                          Worker 0:  Sort Method: quicksort  Memory: 256kB
                          Worker 1:  Sort Method: quicksort  Memory: 431kB
                          ->  Parallel Append  (cost=0.00..80273.86 rows=5578 width=29) (actual time=0.071..104.044 rows=4545 loops=3)
                                Buffers: shared hit=11737 read=46707
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=795 width=29) (actual time=0.039..44.011 rows=1935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331398
                                      Buffers: shared hit=1088 read=6361
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=808 width=29) (actual time=0.127..38.756 rows=1978 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331355
                                      Buffers: shared hit=1107 read=6341
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=785 width=29) (actual time=0.132..39.965 rows=2002 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331331
                                      Buffers: shared hit=1032 read=6415
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=71 width=29) (actual time=0.225..31.857 rows=153 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 333180
                                      Buffers: shared hit=1095 read=6351
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=812 width=29) (actual time=0.037..14.193 rows=657 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110454
                                      Buffers: shared hit=3111 read=4335
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=798 width=29) (actual time=0.050..18.714 rows=978 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 165688
                                      Buffers: shared hit=2128 read=5318
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=810 width=29) (actual time=0.017..44.168 rows=1915 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331418
                                      Buffers: shared hit=1056 read=6385
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=699 width=29) (actual time=0.046..32.309 rows=1725 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281180
                                      Buffers: shared hit=1120 read=5201
Planning Time: 0.304 ms
Execution Time: 132.374 ms
```

### attribution-lcp

Top LCP elements of /products/:id, 7 days (GET /routes/attribution)

```
Limit  (cost=86010.32..86010.37 rows=20 width=48) (actual time=121.167..127.440 rows=8 loops=1)
  Buffers: shared hit=15691 read=42867
  ->  Sort  (cost=86010.32..86010.38 rows=22 width=48) (actual time=121.166..127.438 rows=8 loops=1)
        Sort Key: (count(*)) DESC, ((e.attribution ->> 'target'::text))
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=15691 read=42867
        ->  GroupAggregate  (cost=84358.02..86009.83 rows=22 width=48) (actual time=117.747..127.429 rows=8 loops=1)
              Group Key: ((e.attribution ->> 'target'::text))
              Buffers: shared hit=15691 read=42867
              ->  Gather Merge  (cost=84358.02..85909.59 rows=13322 width=40) (actual time=117.270..125.219 rows=12305 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=15691 read=42867
                    ->  Sort  (cost=83358.00..83371.87 rows=5550 width=40) (actual time=106.494..106.637 rows=4102 loops=3)
                          Sort Key: ((e.attribution ->> 'target'::text))
                          Sort Method: quicksort  Memory: 263kB
                          Buffers: shared hit=15691 read=42867
                          Worker 0:  Sort Method: quicksort  Memory: 267kB
                          Worker 1:  Sort Method: quicksort  Memory: 370kB
                          ->  Parallel Append  (cost=0.00..83012.84 rows=5550 width=40) (actual time=0.078..105.123 rows=4102 loops=3)
                                Buffers: shared hit=15577 read=42867
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10575.97 rows=790 width=40) (actual time=0.045..40.712 rows=1746 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331587
                                      Buffers: shared hit=1472 read=5977
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10575.01 rows=804 width=40) (actual time=0.136..40.741 rows=1782 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331551
                                      Buffers: shared hit=1491 read=5957
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10573.95 rows=781 width=40) (actual time=0.134..42.392 rows=1821 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331512
                                      Buffers: shared hit=1416 read=6031
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10573.02 rows=809 width=40) (actual time=0.034..43.652 rows=1769 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331564
                                      Buffers: shared hit=3559 read=3887
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10572.98 rows=794 width=40) (actual time=0.081..14.648 rows=588 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110523
                                      Buffers: shared hit=3184 read=4262
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10571.17 rows=71 width=40) (actual time=0.745..14.889 rows=71 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 166596
                                      Buffers: shared hit=1511 read=5935
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10568.01 rows=806 width=40) (actual time=0.016..39.115 rows=1719 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331614
                                      Buffers: shared hit=1440 read=6001
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8974.97 rows=695 width=40) (actual time=0.052..34.162 rows=1561 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281344
                                      Buffers: shared hit=1504 read=4817
Planning Time: 0.278 ms
Execution Time: 127.629 ms
```

### attribution-inp

Slowest INP targets of /products/:id, 7 days (GET /routes/attribution)

```
Limit  (cost=85072.31..85072.33 rows=7 width=48) (actual time=124.419..130.395 rows=10 loops=1)
  Buffers: shared hit=16074 read=42484
  ->  Sort  (cost=85072.31..85072.33 rows=7 width=48) (actual time=124.417..130.393 rows=10 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, ((e.attribution ->> 'interactionTarget'::text))
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=16074 read=42484
        ->  GroupAggregate  (cost=84169.39..85072.21 rows=7 width=48) (actual time=122.064..130.383 rows=10 loops=1)
              Group Key: ((e.attribution ->> 'interactionTarget'::text))
              Filter: (count(*) >= '5'::bigint)
              Buffers: shared hit=16074 read=42484
              ->  Gather Merge  (cost=84169.39..85017.27 rows=7280 width=40) (actual time=121.824..129.053 rows=6556 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=16074 read=42484
                    ->  Sort  (cost=83169.37..83176.95 rows=3033 width=40) (actual time=110.685..110.773 rows=2185 loops=3)
                          Sort Key: ((e.attribution ->> 'interactionTarget'::text))
                          Sort Method: quicksort  Memory: 185kB
                          Buffers: shared hit=16074 read=42484
                          Worker 0:  Sort Method: quicksort  Memory: 199kB
                          Worker 1:  Sort Method: quicksort  Memory: 186kB
                          ->  Parallel Append  (cost=0.00..82993.96 rows=3033 width=40) (actual time=0.137..109.701 rows=2185 loops=3)
                                Buffers: shared hit=15960 read=42484
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10575.09 rows=436 width=40) (actual time=0.075..41.069 rows=944 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332389
                                      Buffers: shared hit=1567 read=5882
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10574.11 rows=447 width=40) (actual time=0.067..41.003 rows=916 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332417
                                      Buffers: shared hit=1586 read=5862
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10573.08 rows=432 width=40) (actual time=0.101..39.911 rows=1014 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332319
                                      Buffers: shared hit=1480 read=5967
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10572.10 rows=442 width=40) (actual time=0.110..49.456 rows=936 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332397
                                      Buffers: shared hit=3078 read=4368
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10572.08 rows=434 width=40) (actual time=0.112..15.184 rows=305 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110806
                                      Buffers: shared hit=3518 read=3928
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10571.09 rows=39 width=40) (actual time=0.633..18.803 rows=42 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 166625
                                      Buffers: shared hit=1643 read=5803
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10567.05 rows=420 width=40) (actual time=0.014..40.385 rows=935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332398
                                      Buffers: shared hit=1530 read=5911
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8974.19 rows=383 width=40) (actual time=0.268..33.559 rows=813 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:35:45.938+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 282092
                                      Buffers: shared hit=1558 read=4763
Planning Time: 0.345 ms
Execution Time: 130.597 ms
```

### rollup-job-3h

Rollup job: recompute last 3 hours from raw events and upsert

```
Insert on event_rollups_hourly  (cost=12662.22..18744.97 rows=0 width=0) (actual time=1054.428..1054.432 rows=0 loops=1)
  Conflict Resolution: UPDATE
  Conflict Arbiter Indexes: event_rollups_hourly_key
  Tuples Inserted: 0
  Conflicting Tuples: 11398
  Buffers: shared hit=173103 read=8176 dirtied=558 written=561
  ->  Hash Join  (cost=12662.22..18744.97 rows=53 width=114) (actual time=68.792..653.225 rows=11398 loops=1)
        Hash Cond: (e.metric = "*VALUES*".column1)
        Buffers: shared read=6321 written=3
        ->  GroupAggregate  (cost=12662.10..14980.32 rows=2137 width=146) (actual time=68.595..115.012 rows=11398 loops=1)
              Group Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text))
              Buffers: shared read=6321 written=3
              ->  GroupAggregate  (cost=12662.10..13997.47 rows=21366 width=102) (actual time=68.566..90.876 rows=18691 loops=1)
                    Group Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text)), ((("*VALUES*_1".column3 - width_bucket((- e.value), "*VALUES*_1".column2)) + 1))
                    Buffers: shared read=6321 written=3
                    ->  Sort  (cost=12662.10..12715.51 rows=21366 width=78) (actual time=68.553..74.143 rows=20983 loops=1)
                          Sort Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text)), ((("*VALUES*_1".column3 - width_bucket((- e.value), "*VALUES*_1".column2)) + 1))
                          Sort Method: quicksort  Memory: 2902kB
                          Buffers: shared read=6321 written=3
                          ->  Hash Join  (cost=0.12..11125.56 rows=21366 width=78) (actual time=0.035..37.152 rows=20983 loops=1)
                                Hash Cond: (e.metric = "*VALUES*_1".column1)
                                Buffers: shared read=6321 written=3
                                ->  Seq Scan on events_p20261029 e  (cost=0.00..10564.58 rows=21366 width=74) (actual time=0.015..26.620 rows=20983 loops=1)
                                      Filter: ((received_at >= '2026-10-29 18:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone))
                                      Rows Removed by Filter: 261922
                                      Buffers: shared read=6321 written=3
                                ->  Hash  (cost=0.06..0.06 rows=5 width=68) (actual time=0.011..0.012 rows=5 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 11kB
                                      ->  Values Scan on "*VALUES*_1"  (cost=0.00..0.06 rows=5 width=68) (actual time=0.001..0.002 rows=5 loops=1)
        ->  Hash  (cost=0.06..0.06 rows=5 width=36) (actual time=0.012..0.012 rows=5 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 9kB
              ->  Values Scan on "*VALUES*"  (cost=0.00..0.06 rows=5 width=36) (actual time=0.001..0.003 rows=5 loops=1)
        SubPlan 1
          ->  Aggregate  (cost=70.86..70.87 rows=1 width=32) (actual time=0.046..0.046 rows=1 loops=11398)
                ->  Merge Left Join  (cost=60.11..65.86 rows=1000 width=12) (actual time=0.035..0.042 rows=64 loops=11398)
                      Merge Cond: (s.i = u.i)
                      ->  Sort  (cost=59.83..62.33 rows=1000 width=4) (actual time=0.008..0.010 rows=64 loops=11398)
                            Sort Key: s.i
                            Sort Method: quicksort  Memory: 25kB
                            ->  Function Scan on generate_series s  (cost=0.01..10.01 rows=1000 width=4) (actual time=0.003..0.005 rows=64 loops=11398)
                      ->  Sort  (cost=0.27..0.30 rows=10 width=12) (actual time=0.019..0.019 rows=2 loops=11398)
                            Sort Key: u.i
                            Sort Method: quicksort  Memory: 25kB
                            ->  Function Scan on u  (cost=0.01..0.11 rows=10 width=12) (actual time=0.007..0.007 rows=2 loops=11398)
Planning:
  Buffers: shared hit=2
Planning Time: 0.522 ms
Execution Time: 1054.923 ms
```
