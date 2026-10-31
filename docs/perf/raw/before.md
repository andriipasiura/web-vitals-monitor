# Perf run: before

Run at 2026-10-29T20:30:08.515Z. Events: 9999990, rollup rows: 4123839.
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
| series-30d-hour-rollup | 720 | 5844.5 | 5372.5 | 5264.8 | 5570.1 |
| series-30d-hour-raw | 720 | 2722.1 | 2382.0 | 2326.4 | 2511.8 |
| series-30d-day-route-rollup | 31 | 70.4 | 62.9 | 61.9 | 66.3 |
| series-30d-day-route-raw | 31 | 524.3 | 600.5 | 550.1 | 664.4 |
| routes-7d-rollup | 200 | 1602.1 | 1357.5 | 1344.6 | 1399.8 |
| routes-7d-raw | 200 | 308.7 | 302.7 | 286.6 | 336.1 |
| routes-30d-rollup | 200 | 6047.9 | 5974.9 | 5932.1 | 6124.1 |
| paths-page-1 | 21 | 131.2 | 126.2 | 116.1 | 136.2 |
| paths-page-2 | 21 | 120.2 | 123.5 | 120.0 | 139.1 |
| attribution-lcp | 8 | 135.7 | 130.9 | 125.4 | 147.2 |
| attribution-inp | 10 | 131.6 | 127.5 | 122.2 | 145.0 |
| rollup-job-3h | 11398 | 663.6 | 661.8 | 643.1 | 671.3 |

## Inserts

5000 batches of 10 events, one multi-row INSERT each: median 2.2 ms, p99 3.3 ms, 4450 events/s.

## Sizes

| relation | kind | size |
|---|---|---|
| event_rollups_hourly | table | 1665 MB |
| events | table | 1740 MB |
| event_rollups_hourly: event_rollups_hourly_key | index | 511 MB |
| events: events_pYYYYMMDD_pkey | index | 303 MB |

## Plans

### series-30d-hour-rollup

p75 LCP series, 30 days, hourly, whole project (GET /metrics)

```
Merge Join  (cost=336931.34..336957.97 rows=721 width=72) (actual time=8515.470..8520.997 rows=720 loops=1)
  Merge Cond: (filtered."time" = bucket_sums."time")
  Buffers: shared hit=1152 read=204703, temp read=17160 written=17160
  CTE filtered
    ->  Gather  (cost=1000.00..289921.24 rows=444225 width=305) (actual time=14.932..161.698 rows=442051 loops=1)
          Workers Planned: 2
          Workers Launched: 2
          Buffers: shared hit=1152 read=204703
          ->  Parallel Seq Scan on event_rollups_hourly r  (cost=0.00..244498.74 rows=185094 width=305) (actual time=9.075..166.923 rows=147350 loops=3)
                Filter: ((hour < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)))
                Rows Removed by Filter: 1227263
                Buffers: shared hit=1152 read=204703
  ->  Sort  (cost=14478.75..14480.55 rows=721 width=40) (actual time=383.464..383.534 rows=720 loops=1)
        Sort Key: filtered."time"
        Sort Method: quicksort  Memory: 64kB
        Buffers: shared hit=1152 read=204703, temp written=17159
        ->  HashAggregate  (cost=14437.31..14444.52 rows=721 width=40) (actual time=383.244..383.340 rows=720 loops=1)
              Group Key: filtered."time"
              Batches: 1  Memory Usage: 169kB
              Buffers: shared hit=1152 read=204703, temp written=17159
              ->  CTE Scan on filtered  (cost=0.00..8884.50 rows=444225 width=24) (actual time=14.940..328.137 rows=442051 loops=1)
                    Buffers: shared hit=1152 read=204703, temp written=17159
  ->  GroupAggregate  (cost=32531.35..32544.67 rows=200 width=40) (actual time=8131.993..8137.158 rows=720 loops=1)
        Group Key: bucket_sums."time"
        Buffers: temp read=17160 written=1
        ->  Sort  (cost=32531.35..32534.96 rows=1442 width=24) (actual time=8131.944..8133.827 rows=46800 loops=1)
              Sort Key: bucket_sums."time", bucket_sums.i
              Sort Method: quicksort  Memory: 3365kB
              Buffers: temp read=17160 written=1
              ->  Subquery Scan on bucket_sums  (cost=32426.85..32455.69 rows=1442 width=24) (actual time=8110.204..8120.299 rows=46800 loops=1)
                    Buffers: temp read=17160 written=1
                    ->  HashAggregate  (cost=32426.85..32441.27 rows=1442 width=24) (actual time=8110.199..8117.627 rows=46800 loops=1)
                          Group Key: f."time", u.i
                          Batches: 1  Memory Usage: 4625kB
                          Buffers: temp read=17160 written=1
                          ->  Nested Loop  (cost=0.01..25763.47 rows=888450 width=20) (actual time=0.214..4874.555 rows=28733315 loops=1)
                                Buffers: temp read=17160 written=1
                                ->  CTE Scan on filtered f  (cost=0.00..8884.50 rows=444225 width=40) (actual time=0.015..83.017 rows=442051 loops=1)
                                      Buffers: temp read=17160 written=1
                                ->  Memoize  (cost=0.01..0.03 rows=2 width=12) (actual time=0.001..0.006 rows=65 loops=442051)
                                      Cache Key: f.buckets
                                      Cache Mode: binary
                                      Hits: 286823  Misses: 155228  Evictions: 152614  Overflows: 0  Memory Usage: 8193kB
                                      ->  Function Scan on unnest u  (cost=0.00..0.02 rows=2 width=12) (actual time=0.002..0.005 rows=65 loops=155228)
Planning Time: 0.226 ms
JIT:
  Functions: 42
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 3.501 ms (Deform 1.196 ms), Inlining 0.000 ms, Optimization 1.140 ms, Emission 21.935 ms, Total 26.576 ms
Execution Time: 8540.602 ms
```

### series-30d-hour-raw

Same series computed from raw events with percentile_cont

```
GroupAggregate  (cost=375070.71..578246.26 rows=1319609 width=48) (actual time=2057.590..2486.166 rows=720 loops=1)
  Group Key: (date_trunc('hour'::text, e.received_at, 'UTC'::text))
  Buffers: shared hit=12817 read=210035, temp read=6207 written=6228
  ->  Gather Merge  (cost=375070.71..528760.92 rows=1319609 width=24) (actual time=2056.946..2218.797 rows=1320208 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=12817 read=210035, temp read=6207 written=6228
        ->  Sort  (cost=374070.69..375445.28 rows=549836 width=24) (actual time=2033.531..2066.150 rows=440069 loops=3)
              Sort Key: (date_trunc('hour'::text, e.received_at, 'UTC'::text))
              Sort Method: external merge  Disk: 16464kB
              Buffers: shared hit=12817 read=210035, temp read=6207 written=6228
              Worker 0:  Sort Method: external merge  Disk: 16248kB
              Worker 1:  Sort Method: external merge  Disk: 16944kB
              ->  Parallel Append  (cost=0.00..310370.56 rows=549836 width=24) (actual time=1522.441..1940.582 rows=440069 loops=3)
                    Buffers: shared hit=12703 read=210035
                    ->  Parallel Seq Scan on events_p20261025 e_27  (cost=0.00..10272.92 rows=18460 width=24) (actual time=1519.833..1558.824 rows=44147 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289186
                          Buffers: shared hit=352 read=7097
                    ->  Parallel Seq Scan on events_p20261019 e_21  (cost=0.00..10272.71 rows=18774 width=24) (actual time=1510.046..1548.076 rows=44202 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289131
                          Buffers: shared hit=352 read=7096
                    ->  Parallel Seq Scan on events_p20261021 e_23  (cost=0.00..10271.27 rows=18598 width=24) (actual time=0.059..38.156 rows=43851 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289482
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261026 e_28  (cost=0.00..10271.19 rows=18565 width=24) (actual time=0.091..38.914 rows=44158 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289175
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261027 e_29  (cost=0.00..10271.06 rows=18112 width=24) (actual time=0.057..38.183 rows=44060 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289273
                          Buffers: shared hit=352 read=7096
                    ->  Parallel Seq Scan on events_p20261018 e_20  (cost=0.00..10270.60 rows=18330 width=24) (actual time=0.055..38.203 rows=44049 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289284
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261020 e_22  (cost=0.00..10270.41 rows=18254 width=24) (actual time=0.057..37.822 rows=44044 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289289
                          Buffers: shared hit=352 read=7095
                    ->  Parallel Seq Scan on events_p20261023 e_25  (cost=0.00..10269.68 rows=18364 width=24) (actual time=0.725..39.230 rows=44043 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289290
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261022 e_24  (cost=0.00..10269.33 rows=18224 width=24) (actual time=0.058..37.822 rows=44140 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289193
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261028 e_30  (cost=0.00..10269.10 rows=18131 width=24) (actual time=0.173..43.966 rows=44109 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289224
                          Buffers: shared hit=352 read=7094
                    ->  Parallel Seq Scan on events_p20261024 e_26  (cost=0.00..10264.37 rows=18239 width=24) (actual time=0.067..43.954 rows=43657 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289676
                          Buffers: shared hit=352 read=7089
                    ->  Parallel Seq Scan on events_p20261013 e_15  (cost=0.00..10263.88 rows=18443 width=24) (actual time=0.073..43.051 rows=44134 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289199
                          Buffers: shared hit=352 read=7088
                    ->  Parallel Seq Scan on events_p20261016 e_18  (cost=0.00..10262.80 rows=18811 width=24) (actual time=0.065..38.104 rows=44339 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 288994
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261017 e_19  (cost=0.00..10261.92 rows=18060 width=24) (actual time=0.062..38.007 rows=43938 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289395
                          Buffers: shared hit=352 read=7087
                    ->  Parallel Seq Scan on events_p20261014 e_16  (cost=0.00..10261.76 rows=18395 width=24) (actual time=0.068..38.320 rows=44026 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289307
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261012 e_14  (cost=0.00..10260.84 rows=18426 width=24) (actual time=0.051..39.155 rows=44262 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289071
                          Buffers: shared hit=352 read=7085
                    ->  Parallel Seq Scan on events_p20261015 e_17  (cost=0.00..10260.79 rows=18006 width=24) (actual time=0.065..38.064 rows=44264 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289069
                          Buffers: shared hit=352 read=7086
                    ->  Parallel Seq Scan on events_p20261011 e_13  (cost=0.00..10224.17 rows=18557 width=24) (actual time=0.069..39.730 rows=44070 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289263
                          Buffers: shared hit=416 read=6984
                    ->  Parallel Seq Scan on events_p20261007 e_9  (cost=0.00..10221.86 rows=18833 width=24) (actual time=0.063..38.877 rows=43742 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289591
                          Buffers: shared hit=768 read=6629
                    ->  Parallel Seq Scan on events_p20261003 e_5  (cost=0.00..10221.27 rows=18599 width=24) (actual time=0.048..13.012 rows=14711 loops=3)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 96400
                          Buffers: shared hit=736 read=6661
                    ->  Parallel Seq Scan on events_p20261009 e_11  (cost=0.00..10220.48 rows=18280 width=24) (actual time=0.069..19.036 rows=22055 loops=2)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 144612
                          Buffers: shared hit=480 read=6917
                    ->  Parallel Seq Scan on events_p20261010 e_12  (cost=0.00..10220.45 rows=18669 width=24) (actual time=0.093..37.492 rows=44187 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289146
                          Buffers: shared hit=384 read=7012
                    ->  Parallel Seq Scan on events_p20261004 e_6  (cost=0.00..10220.40 rows=18252 width=24) (actual time=0.053..39.660 rows=43884 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289449
                          Buffers: shared hit=352 read=7045
                    ->  Parallel Seq Scan on events_p20261008 e_10  (cost=0.00..10220.09 rows=18127 width=24) (actual time=0.040..38.042 rows=43768 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289565
                          Buffers: shared hit=352 read=7045
                    ->  Parallel Seq Scan on events_p20261001 e_3  (cost=0.00..10219.72 rows=18379 width=24) (actual time=0.043..51.420 rows=44139 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289194
                          Buffers: shared hit=352 read=7044
                    ->  Parallel Seq Scan on events_p20261002 e_4  (cost=0.00..10218.86 rows=18036 width=24) (actual time=0.059..38.393 rows=43972 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289361
                          Buffers: shared hit=352 read=7044
                    ->  Parallel Seq Scan on events_p20261006 e_8  (cost=0.00..10217.98 rows=18082 width=24) (actual time=0.051..37.637 rows=44038 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289295
                          Buffers: shared hit=352 read=7043
                    ->  Parallel Seq Scan on events_p20260930 e_2  (cost=0.00..10217.89 rows=18045 width=24) (actual time=0.052..38.957 rows=43638 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289695
                          Buffers: shared hit=352 read=7043
                    ->  Parallel Seq Scan on events_p20261005 e_7  (cost=0.00..10215.89 rows=18047 width=24) (actual time=0.096..38.897 rows=43924 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 289409
                          Buffers: shared hit=352 read=7041
                    ->  Parallel Seq Scan on events_p20261029 e_31  (cost=0.00..8716.81 rows=15307 width=24) (actual time=0.054..33.200 rows=37356 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 245549
                          Buffers: shared hit=352 read=5969
                    ->  Parallel Seq Scan on events_p20260929 e_1  (cost=0.00..1720.85 rows=3432 width=24) (actual time=1537.441..1544.123 rows=5824 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                          Rows Removed by Filter: 44604
                          Buffers: shared hit=1119
Planning Time: 0.897 ms
JIT:
  Functions: 376
  Options: Inlining true, Optimization true, Expressions true, Deforming true
  Timing: Generation 37.465 ms (Deform 23.703 ms), Inlining 109.220 ms, Optimization 2587.776 ms, Emission 1870.837 ms, Total 4605.299 ms
Execution Time: 2500.846 ms
```

### series-30d-day-route-rollup

p75 LCP series, 30 days, daily, route /products/:id (GET /metrics)

```
Merge Join  (cost=22718.43..22729.43 rows=200 width=72) (actual time=91.096..91.303 rows=31 loops=1)
  Merge Cond: (filtered."time" = bucket_sums."time")
  Buffers: shared hit=379
  CTE filtered
    ->  Bitmap Heap Scan on event_rollups_hourly r  (cost=507.05..22014.95 rows=6219 width=305) (actual time=0.507..3.496 rows=5158 loops=1)
          Recheck Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
          Heap Blocks: exact=287
          Buffers: shared hit=379
          ->  Bitmap Index Scan on event_rollups_hourly_key  (cost=0.00..505.50 rows=6219 width=0) (actual time=0.471..0.472 rows=5158 loops=1)
                Index Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                Buffers: shared hit=92
  ->  Sort  (cost=211.76..212.26 rows=200 width=40) (actual time=7.102..7.106 rows=31 loops=1)
        Sort Key: filtered."time"
        Sort Method: quicksort  Memory: 26kB
        Buffers: shared hit=379
        ->  HashAggregate  (cost=202.12..204.12 rows=200 width=40) (actual time=7.091..7.096 rows=31 loops=1)
              Group Key: filtered."time"
              Batches: 1  Memory Usage: 40kB
              Buffers: shared hit=379
              ->  CTE Scan on filtered  (cost=0.00..124.38 rows=6219 width=24) (actual time=0.508..6.389 rows=5158 loops=1)
                    Buffers: shared hit=379
  ->  GroupAggregate  (cost=491.72..497.22 rows=200 width=40) (actual time=83.989..84.183 rows=31 loops=1)
        Group Key: bucket_sums."time"
        ->  Sort  (cost=491.72..492.72 rows=400 width=24) (actual time=83.976..84.034 rows=2015 loops=1)
              Sort Key: bucket_sums."time", bucket_sums.i
              Sort Method: quicksort  Memory: 127kB
              ->  Subquery Scan on bucket_sums  (cost=466.43..474.43 rows=400 width=24) (actual time=83.219..83.554 rows=2015 loops=1)
                    ->  HashAggregate  (cost=466.43..470.43 rows=400 width=24) (actual time=83.217..83.437 rows=2015 loops=1)
                          Group Key: f."time", u.i
                          Batches: 1  Memory Usage: 241kB
                          ->  Nested Loop  (cost=0.00..373.14 rows=12438 width=20) (actual time=0.011..47.167 rows=335270 loops=1)
                                ->  CTE Scan on filtered f  (cost=0.00..124.38 rows=6219 width=40) (actual time=0.001..0.426 rows=5158 loops=1)
                                ->  Function Scan on unnest u  (cost=0.00..0.02 rows=2 width=12) (actual time=0.002..0.005 rows=65 loops=5158)
Planning Time: 0.284 ms
Execution Time: 91.854 ms
```

### series-30d-day-route-raw

Same series computed from raw events

```
GroupAggregate  (cost=319634.79..328612.42 rows=58309 width=48) (actual time=531.208..557.625 rows=31 loops=1)
  Group Key: (date_trunc('day'::text, e.received_at, 'UTC'::text))
  Buffers: shared hit=15339 read=207513
  ->  Gather Merge  (cost=319634.79..326425.83 rows=58309 width=24) (actual time=531.096..545.485 rows=58428 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=15339 read=207513
        ->  Sort  (cost=318634.76..318695.50 rows=24297 width=24) (actual time=506.172..506.794 rows=19476 loops=3)
              Sort Key: (date_trunc('day'::text, e.received_at, 'UTC'::text))
              Sort Method: quicksort  Memory: 1635kB
              Buffers: shared hit=15339 read=207513
              Worker 0:  Sort Method: quicksort  Memory: 1612kB
              Worker 1:  Sort Method: quicksort  Memory: 1592kB
              ->  Parallel Append  (cost=0.00..316864.91 rows=24297 width=24) (actual time=95.639..501.592 rows=19476 loops=3)
                    Buffers: shared hit=15225 read=207513
                    ->  Parallel Seq Scan on events_p20261025 e_27  (cost=0.00..10576.01 rows=804 width=24) (actual time=92.894..139.734 rows=1935 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331398
                          Buffers: shared hit=413 read=7036
                    ->  Parallel Seq Scan on events_p20261019 e_21  (cost=0.00..10574.99 rows=798 width=24) (actual time=93.795..134.829 rows=1937 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331396
                          Buffers: shared hit=445 read=7003
                    ->  Parallel Seq Scan on events_p20261027 e_29  (cost=0.00..10574.96 rows=786 width=24) (actual time=0.165..49.323 rows=1978 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331355
                          Buffers: shared hit=384 read=7064
                    ->  Parallel Seq Scan on events_p20261021 e_23  (cost=0.00..10574.10 rows=841 width=24) (actual time=0.065..42.609 rows=1962 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331371
                          Buffers: shared hit=386 read=7061
                    ->  Parallel Seq Scan on events_p20261026 e_28  (cost=0.00..10574.01 rows=805 width=24) (actual time=0.152..38.029 rows=2002 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331331
                          Buffers: shared hit=480 read=6967
                    ->  Parallel Seq Scan on events_p20261018 e_20  (cost=0.00..10573.99 rows=799 width=24) (actual time=0.055..48.865 rows=1968 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331365
                          Buffers: shared hit=480 read=6967
                    ->  Parallel Seq Scan on events_p20261020 e_22  (cost=0.00..10573.97 rows=788 width=24) (actual time=0.104..43.556 rows=1943 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331390
                          Buffers: shared hit=448 read=6999
                    ->  Parallel Seq Scan on events_p20261023 e_25  (cost=0.00..10573.07 rows=830 width=24) (actual time=0.078..38.094 rows=1971 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331362
                          Buffers: shared hit=417 read=7029
                    ->  Parallel Seq Scan on events_p20261022 e_24  (cost=0.00..10573.02 rows=808 width=24) (actual time=0.111..40.791 rows=1890 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331443
                          Buffers: shared hit=416 read=7030
                    ->  Parallel Seq Scan on events_p20261028 e_30  (cost=0.00..10572.98 rows=793 width=24) (actual time=0.093..37.513 rows=1956 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331377
                          Buffers: shared hit=416 read=7030
                    ->  Parallel Seq Scan on events_p20261024 e_26  (cost=0.00..10568.01 rows=804 width=24) (actual time=0.062..38.324 rows=1915 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331418
                          Buffers: shared hit=416 read=7025
                    ->  Parallel Seq Scan on events_p20261013 e_15  (cost=0.00..10566.94 rows=777 width=24) (actual time=0.096..41.253 rows=1983 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331350
                          Buffers: shared hit=416 read=7024
                    ->  Parallel Seq Scan on events_p20261017 e_19  (cost=0.00..10566.07 rows=831 width=24) (actual time=0.295..38.965 rows=1988 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331345
                          Buffers: shared hit=416 read=7023
                    ->  Parallel Seq Scan on events_p20261014 e_16  (cost=0.00..10565.00 rows=801 width=24) (actual time=0.076..38.422 rows=1877 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331456
                          Buffers: shared hit=385 read=7053
                    ->  Parallel Seq Scan on events_p20261016 e_18  (cost=0.00..10564.98 rows=793 width=24) (actual time=0.113..35.946 rows=1982 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331351
                          Buffers: shared hit=384 read=7054
                    ->  Parallel Seq Scan on events_p20261015 e_17  (cost=0.00..10564.93 rows=775 width=24) (actual time=0.090..35.596 rows=1933 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331400
                          Buffers: shared hit=387 read=7051
                    ->  Parallel Seq Scan on events_p20261012 e_14  (cost=0.00..10564.05 rows=821 width=24) (actual time=0.081..37.326 rows=1994 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331339
                          Buffers: shared hit=553 read=6884
                    ->  Parallel Seq Scan on events_p20261011 e_13  (cost=0.00..10527.14 rows=857 width=24) (actual time=0.064..36.081 rows=1951 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331382
                          Buffers: shared hit=550 read=6850
                    ->  Parallel Seq Scan on events_p20261007 e_9  (cost=0.00..10524.18 rows=874 width=24) (actual time=0.072..12.621 rows=667 loops=3)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 110444
                          Buffers: shared hit=1211 read=6186
                    ->  Parallel Seq Scan on events_p20261008 e_10  (cost=0.00..10524.04 rows=816 width=24) (actual time=0.121..18.935 rows=980 loops=2)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 165686
                          Buffers: shared hit=932 read=6465
                    ->  Parallel Seq Scan on events_p20261009 e_11  (cost=0.00..10524.02 rows=809 width=24) (actual time=0.038..35.055 rows=1925 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331408
                          Buffers: shared hit=527 read=6870
                    ->  Parallel Seq Scan on events_p20261003 e_5  (cost=0.00..10524.01 rows=804 width=24) (actual time=0.082..35.958 rows=1913 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331420
                          Buffers: shared hit=352 read=7045
                    ->  Parallel Seq Scan on events_p20261004 e_6  (cost=0.00..10523.99 rows=796 width=24) (actual time=0.181..36.935 rows=1964 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331369
                          Buffers: shared hit=416 read=6981
                    ->  Parallel Seq Scan on events_p20261010 e_12  (cost=0.00..10523.12 rows=851 width=24) (actual time=0.054..40.316 rows=1945 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331388
                          Buffers: shared hit=444 read=6952
                    ->  Parallel Seq Scan on events_p20261001 e_3  (cost=0.00..10523.11 rows=847 width=24) (actual time=0.054..37.344 rows=1865 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331468
                          Buffers: shared hit=416 read=6980
                    ->  Parallel Seq Scan on events_p20261002 e_4  (cost=0.00..10523.04 rows=818 width=24) (actual time=0.067..44.153 rows=1923 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331410
                          Buffers: shared hit=416 read=6980
                    ->  Parallel Seq Scan on events_p20260930 e_2  (cost=0.00..10522.02 rows=808 width=24) (actual time=0.085..44.528 rows=1873 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331460
                          Buffers: shared hit=448 read=6947
                    ->  Parallel Seq Scan on events_p20261006 e_8  (cost=0.00..10521.99 rows=796 width=24) (actual time=0.042..50.981 rows=1905 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331428
                          Buffers: shared hit=352 read=7043
                    ->  Parallel Seq Scan on events_p20261005 e_7  (cost=0.00..10519.97 rows=790 width=24) (actual time=0.141..43.660 rows=2008 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 331325
                          Buffers: shared hit=384 read=7009
                    ->  Parallel Seq Scan on events_p20261029 e_31  (cost=0.00..8974.91 rows=672 width=24) (actual time=0.068..34.059 rows=1725 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 281180
                          Buffers: shared hit=416 read=5905
                    ->  Parallel Seq Scan on events_p20260929 e_1  (cost=0.00..1786.80 rows=148 width=24) (actual time=100.226..105.927 rows=254 loops=1)
                          Filter: ((received_at >= '2026-09-29 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                          Rows Removed by Filter: 50174
                          Buffers: shared hit=1119
Planning Time: 1.037 ms
JIT:
  Functions: 376
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 43.087 ms (Deform 25.846 ms), Inlining 0.000 ms, Optimization 18.021 ms, Emission 269.171 ms, Total 330.279 ms
Execution Time: 571.791 ms
```

### routes-7d-rollup

Per-route LCP summary, 7 days (GET /routes)

```
Hash Join  (cost=258194.66..258202.69 rows=200 width=96) (actual time=2024.739..2026.592 rows=200 loops=1)
  Hash Cond: (bucket_sums.route = filtered.route)
  Buffers: shared hit=12971, temp read=4273 written=4273
  CTE filtered
    ->  Gather  (cost=35825.38..246667.20 rows=106955 width=311) (actual time=35.544..52.023 rows=107437 loops=1)
          Workers Planned: 2
          Workers Launched: 2
          Buffers: shared hit=12971
          ->  Parallel Bitmap Heap Scan on event_rollups_hourly r  (cost=34825.38..234971.70 rows=44565 width=311) (actual time=27.189..35.934 rows=35812 loops=3)
                Recheck Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-10-22 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                Heap Blocks: exact=867
                Buffers: shared hit=12971
                ->  Bitmap Index Scan on event_rollups_hourly_key  (cost=0.00..34798.64 rows=106955 width=0) (actual time=34.704..34.705 rows=107437 loops=1)
                      Index Cond: ((project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-10-22 21:00:00+00'::timestamp with time zone)) AND (hour < '2026-10-29 21:00:00+00'::timestamp with time zone))
                      Buffers: shared hit=6933
  ->  GroupAggregate  (cost=8046.92..8052.42 rows=200 width=64) (actual time=1915.898..1917.407 rows=200 loops=1)
        Group Key: bucket_sums.route
        Buffers: temp read=4273 written=1
        ->  Sort  (cost=8046.92..8047.92 rows=400 width=48) (actual time=1915.848..1916.310 rows=13000 loops=1)
              Sort Key: bucket_sums.route, bucket_sums.i
              Sort Method: quicksort  Memory: 1018kB
              Buffers: temp read=4273 written=1
              ->  Subquery Scan on bucket_sums  (cost=8021.63..8029.63 rows=400 width=48) (actual time=1904.954..1907.298 rows=13000 loops=1)
                    Buffers: temp read=4273 written=1
                    ->  HashAggregate  (cost=8021.63..8025.63 rows=400 width=48) (actual time=1904.948..1906.582 rows=13000 loops=1)
                          Group Key: f.route, u.i
                          Batches: 1  Memory Usage: 1681kB
                          Buffers: temp read=4273 written=1
                          ->  Nested Loop  (cost=0.00..6417.30 rows=213910 width=44) (actual time=0.076..999.959 rows=6983405 loops=1)
                                Buffers: temp read=4273 written=1
                                ->  CTE Scan on filtered f  (cost=0.00..2139.10 rows=106955 width=64) (actual time=0.040..20.985 rows=107437 loops=1)
                                      Buffers: temp read=4273 written=1
                                ->  Function Scan on unnest u  (cost=0.00..0.02 rows=2 width=12) (actual time=0.002..0.005 rows=65 loops=107437)
  ->  Hash  (cost=3478.04..3478.04 rows=200 width=64) (actual time=108.817..108.819 rows=200 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 24kB
        Buffers: shared hit=12971, temp written=4272
        ->  HashAggregate  (cost=3476.04..3478.04 rows=200 width=64) (actual time=108.677..108.710 rows=200 loops=1)
              Group Key: filtered.route
              Batches: 1  Memory Usage: 64kB
              Buffers: shared hit=12971, temp written=4272
              ->  CTE Scan on filtered  (cost=0.00..2139.10 rows=106955 width=48) (actual time=35.556..92.207 rows=107437 loops=1)
                    Buffers: shared hit=12971, temp written=4272
Planning Time: 0.235 ms
JIT:
  Functions: 41
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 2.905 ms (Deform 1.075 ms), Inlining 0.000 ms, Optimization 1.350 ms, Emission 21.220 ms, Total 25.475 ms
Execution Time: 2033.459 ms
```

### routes-7d-raw

Same summary computed from raw events

```
Sort  (cost=137886.53..137887.03 rows=200 width=53) (actual time=314.428..320.532 rows=200 loops=1)
  Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC
  Sort Method: quicksort  Memory: 39kB
  Buffers: shared hit=3319 read=55239, temp read=1621 written=1625
  ->  GroupAggregate  (cost=95642.39..137878.89 rows=200 width=53) (actual time=194.651..320.383 rows=200 loops=1)
        Group Key: e.route
        Buffers: shared hit=3319 read=55239, temp read=1621 written=1625
        ->  Gather Merge  (cost=95642.39..131038.30 rows=303915 width=29) (actual time=193.124..252.323 rows=304992 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=3319 read=55239, temp read=1621 written=1625
              ->  Sort  (cost=94642.37..94958.95 rows=126632 width=29) (actual time=171.363..181.297 rows=101664 loops=3)
                    Sort Key: e.route
                    Sort Method: external merge  Disk: 4936kB
                    Buffers: shared hit=3319 read=55239, temp read=1621 written=1625
                    Worker 0:  Sort Method: external merge  Disk: 4736kB
                    Worker 1:  Sort Method: external merge  Disk: 3296kB
                    ->  Parallel Append  (cost=0.00..80879.13 rows=126632 width=29) (actual time=23.898..127.663 rows=101664 loops=3)
                          Buffers: shared hit=3205 read=55239
                          ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=18460 width=29) (actual time=27.591..63.040 rows=44147 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289186
                                Buffers: shared hit=288 read=7161
                          ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=18112 width=29) (actual time=23.788..59.970 rows=44060 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289273
                                Buffers: shared hit=288 read=7160
                          ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=18565 width=29) (actual time=0.061..36.867 rows=44158 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289175
                                Buffers: shared hit=288 read=7159
                          ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=1454 width=29) (actual time=0.058..32.826 rows=3462 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 329871
                                Buffers: shared hit=319 read=7127
                          ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=18364 width=29) (actual time=0.051..13.641 rows=14681 loops=3)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 96430
                                Buffers: shared hit=821 read=6625
                          ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=18131 width=29) (actual time=0.073..19.653 rows=22054 loops=2)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 144612
                                Buffers: shared hit=593 read=6853
                          ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=18239 width=29) (actual time=0.048..35.902 rows=43657 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 289676
                                Buffers: shared hit=320 read=7121
                          ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=15307 width=29) (actual time=20.311..57.967 rows=37356 loops=1)
                                Filter: ((received_at >= '2026-10-22 21:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text))
                                Rows Removed by Filter: 245549
                                Buffers: shared hit=288 read=6033
Planning Time: 0.350 ms
JIT:
  Functions: 100
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 9.082 ms (Deform 5.022 ms), Inlining 0.000 ms, Optimization 2.920 ms, Emission 68.911 ms, Total 80.913 ms
Execution Time: 324.664 ms
```

### routes-30d-rollup

Per-route LCP summary, 30 days (GET /routes)

```
Hash Join  (cost=336815.19..336823.23 rows=200 width=96) (actual time=9166.011..9167.821 rows=200 loops=1)
  Hash Cond: (bucket_sums.route = filtered.route)
  Buffers: shared hit=7094 read=198761, temp read=17579 written=17579
  CTE filtered
    ->  Gather  (cost=1000.00..289921.24 rows=444225 width=311) (actual time=15.326..170.081 rows=442051 loops=1)
          Workers Planned: 2
          Workers Launched: 2
          Buffers: shared hit=7094 read=198761
          ->  Parallel Seq Scan on event_rollups_hourly r  (cost=0.00..244498.74 rows=185094 width=311) (actual time=9.534..177.415 rows=147350 loops=3)
                Filter: ((hour < '2026-10-29 21:00:00+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (hour >= date_trunc('hour'::text, '2026-09-29 21:00:00+00'::timestamp with time zone)))
                Rows Removed by Filter: 1227263
                Buffers: shared hit=7094 read=198761
  ->  GroupAggregate  (cost=32452.14..32457.64 rows=200 width=64) (actual time=8756.306..8757.914 rows=200 loops=1)
        Group Key: bucket_sums.route
        Buffers: temp read=17579 written=1
        ->  Sort  (cost=32452.14..32453.14 rows=400 width=48) (actual time=8756.243..8756.753 rows=13000 loops=1)
              Sort Key: bucket_sums.route, bucket_sums.i
              Sort Method: quicksort  Memory: 1018kB
              Buffers: temp read=17579 written=1
              ->  Subquery Scan on bucket_sums  (cost=32426.85..32434.85 rows=400 width=48) (actual time=8745.391..8747.826 rows=13000 loops=1)
                    Buffers: temp read=17579 written=1
                    ->  HashAggregate  (cost=32426.85..32430.85 rows=400 width=48) (actual time=8745.387..8747.095 rows=13000 loops=1)
                          Group Key: f.route, u.i
                          Batches: 1  Memory Usage: 1681kB
                          Buffers: temp read=17579 written=1
                          ->  Nested Loop  (cost=0.01..25763.47 rows=888450 width=44) (actual time=0.478..4916.265 rows=28733315 loops=1)
                                Buffers: temp read=17579 written=1
                                ->  CTE Scan on filtered f  (cost=0.00..8884.50 rows=444225 width=64) (actual time=0.026..83.795 rows=442051 loops=1)
                                      Buffers: temp read=17579 written=1
                                ->  Memoize  (cost=0.01..0.03 rows=2 width=12) (actual time=0.001..0.007 rows=65 loops=442051)
                                      Cache Key: f.buckets
                                      Cache Mode: binary
                                      Hits: 286820  Misses: 155231  Evictions: 152617  Overflows: 0  Memory Usage: 8193kB
                                      ->  Function Scan on unnest u  (cost=0.00..0.02 rows=2 width=12) (actual time=0.002..0.006 rows=65 loops=155231)
  ->  Hash  (cost=14439.31..14439.31 rows=200 width=64) (actual time=409.676..409.677 rows=200 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 24kB
        Buffers: shared hit=7094 read=198761, temp written=17578
        ->  HashAggregate  (cost=14437.31..14439.31 rows=200 width=64) (actual time=409.543..409.579 rows=200 loops=1)
              Group Key: filtered.route
              Batches: 1  Memory Usage: 64kB
              Buffers: shared hit=7094 read=198761, temp written=17578
              ->  CTE Scan on filtered  (cost=0.00..8884.50 rows=444225 width=48) (actual time=15.329..339.890 rows=442051 loops=1)
                    Buffers: shared hit=7094 read=198761, temp written=17578
Planning Time: 0.247 ms
JIT:
  Functions: 43
  Options: Inlining false, Optimization false, Expressions true, Deforming true
  Timing: Generation 3.160 ms (Deform 1.049 ms), Inlining 0.000 ms, Optimization 1.155 ms, Emission 22.859 ms, Total 27.175 ms
Execution Time: 9187.388 ms
```

### paths-page-1

Slowest paths of /products/:id, p75, 7 days, first page of 20 (GET /routes/paths)

```
Limit  (cost=83979.95..83980.00 rows=21 width=53) (actual time=122.049..127.125 rows=21 loops=1)
  Buffers: shared hit=7479 read=51079
  ->  Sort  (cost=83979.95..84011.73 rows=12712 width=53) (actual time=122.048..127.122 rows=21 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, e.path
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=7479 read=51079
        ->  GroupAggregate  (cost=81620.47..83637.21 rows=12712 width=53) (actual time=116.627..126.966 rows=1000 loops=1)
              Group Key: e.path
              Buffers: shared hit=7479 read=51079
              ->  Gather Merge  (cost=81620.47..83177.51 rows=13369 width=29) (actual time=116.599..124.062 rows=13637 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=7479 read=51079
                    ->  Sort  (cost=80620.44..80634.37 rows=5571 width=29) (actual time=104.938..105.131 rows=4546 loops=3)
                          Sort Key: e.path
                          Sort Method: quicksort  Memory: 457kB
                          Buffers: shared hit=7479 read=51079
                          Worker 0:  Sort Method: quicksort  Memory: 448kB
                          Worker 1:  Sort Method: quicksort  Memory: 244kB
                          ->  Parallel Append  (cost=0.00..80273.82 rows=5571 width=29) (actual time=0.086..101.217 rows=4546 loops=3)
                                Buffers: shared hit=7365 read=51079
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=804 width=29) (actual time=0.039..35.356 rows=1935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331398
                                      Buffers: shared hit=672 read=6777
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=786 width=29) (actual time=0.167..36.952 rows=1978 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331355
                                      Buffers: shared hit=672 read=6776
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=805 width=29) (actual time=0.143..35.863 rows=2002 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331331
                                      Buffers: shared hit=672 read=6775
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=76 width=29) (actual time=0.151..30.304 rows=155 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 333178
                                      Buffers: shared hit=703 read=6743
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=830 width=29) (actual time=0.050..18.008 rows=657 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110454
                                      Buffers: shared hit=1973 read=5473
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=794 width=29) (actual time=0.102..21.700 rows=978 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 165688
                                      Buffers: shared hit=1297 read=6149
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=804 width=29) (actual time=0.015..36.085 rows=1915 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331418
                                      Buffers: shared hit=704 read=6737
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=672 width=29) (actual time=0.049..30.613 rows=1725 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281180
                                      Buffers: shared hit=672 read=5649
Planning Time: 0.293 ms
Execution Time: 127.321 ms
```

### paths-page-2

Second page via keyset cursor

```
Limit  (cost=83847.08..83847.13 rows=21 width=53) (actual time=115.918..121.180 rows=21 loops=1)
  Buffers: shared hit=11999 read=46559
  ->  Sort  (cost=83847.08..83857.70 rows=4248 width=53) (actual time=115.916..121.176 rows=21 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, e.path
        Sort Method: top-N heapsort  Memory: 29kB
        Buffers: shared hit=11999 read=46559
        ->  GroupAggregate  (cost=81620.47..83732.55 rows=4248 width=53) (actual time=109.686..121.004 rows=980 loops=1)
              Group Key: e.path
              Filter: ((percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value) < '5556'::double precision) OR ((percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value) = '5556'::double precision) AND (e.path > '/products/25'::text)))
              Rows Removed by Filter: 20
              Buffers: shared hit=11999 read=46559
              ->  Gather Merge  (cost=81620.47..83177.51 rows=13369 width=29) (actual time=109.662..117.645 rows=13637 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=11999 read=46559
                    ->  Sort  (cost=80620.44..80634.37 rows=5571 width=29) (actual time=98.444..98.659 rows=4546 loops=3)
                          Sort Key: e.path
                          Sort Method: quicksort  Memory: 465kB
                          Buffers: shared hit=11999 read=46559
                          Worker 0:  Sort Method: quicksort  Memory: 260kB
                          Worker 1:  Sort Method: quicksort  Memory: 424kB
                          ->  Parallel Append  (cost=0.00..80273.82 rows=5571 width=29) (actual time=0.091..95.237 rows=4546 loops=3)
                                Buffers: shared hit=11885 read=46559
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10226.77 rows=804 width=29) (actual time=0.044..36.024 rows=1935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331398
                                      Buffers: shared hit=1088 read=6361
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10225.77 rows=786 width=29) (actual time=0.157..37.299 rows=1978 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331355
                                      Buffers: shared hit=1088 read=6360
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10224.77 rows=805 width=29) (actual time=0.125..37.284 rows=2002 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331331
                                      Buffers: shared hit=1088 read=6359
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10223.77 rows=76 width=29) (actual time=0.103..30.390 rows=155 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 333178
                                      Buffers: shared hit=1119 read=6327
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10223.77 rows=830 width=29) (actual time=0.093..12.965 rows=657 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110454
                                      Buffers: shared hit=3221 read=4225
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10223.77 rows=794 width=29) (actual time=0.073..19.064 rows=978 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 165688
                                      Buffers: shared hit=2073 read=5373
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10218.77 rows=804 width=29) (actual time=0.016..35.587 rows=1915 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331418
                                      Buffers: shared hit=1120 read=6321
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8678.54 rows=672 width=29) (actual time=0.071..31.164 rows=1725 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281180
                                      Buffers: shared hit=1088 read=5233
Planning Time: 0.307 ms
Execution Time: 121.390 ms
```

### attribution-lcp

Top LCP elements of /products/:id, 7 days (GET /routes/attribution)

```
Limit  (cost=86007.31..86007.36 rows=20 width=48) (actual time=131.784..138.453 rows=8 loops=1)
  Buffers: shared hit=15867 read=42691
  ->  Sort  (cost=86007.31..86007.36 rows=22 width=48) (actual time=131.783..138.451 rows=8 loops=1)
        Sort Key: (count(*)) DESC, ((e.attribution ->> 'target'::text))
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=15867 read=42691
        ->  GroupAggregate  (cost=84357.49..86006.82 rows=22 width=48) (actual time=128.405..138.442 rows=8 loops=1)
              Group Key: ((e.attribution ->> 'target'::text))
              Buffers: shared hit=15867 read=42691
              ->  Gather Merge  (cost=84357.49..85906.72 rows=13302 width=40) (actual time=127.952..136.224 rows=12307 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=15867 read=42691
                    ->  Sort  (cost=83357.46..83371.32 rows=5543 width=40) (actual time=116.855..116.992 rows=4102 loops=3)
                          Sort Key: ((e.attribution ->> 'target'::text))
                          Sort Method: quicksort  Memory: 264kB
                          Buffers: shared hit=15867 read=42691
                          Worker 0:  Sort Method: quicksort  Memory: 265kB
                          Worker 1:  Sort Method: quicksort  Memory: 372kB
                          ->  Parallel Append  (cost=0.00..83012.79 rows=5543 width=40) (actual time=0.086..115.482 rows=4102 loops=3)
                                Buffers: shared hit=15753 read=42691
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10576.00 rows=800 width=40) (actual time=0.054..48.816 rows=1746 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331587
                                      Buffers: shared hit=1472 read=5977
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10574.95 rows=782 width=40) (actual time=0.148..48.348 rows=1782 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331551
                                      Buffers: shared hit=1472 read=5976
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10574.00 rows=801 width=40) (actual time=0.126..48.849 rows=1821 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331512
                                      Buffers: shared hit=1472 read=5975
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10573.06 rows=826 width=40) (actual time=0.030..43.477 rows=1769 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331564
                                      Buffers: shared hit=3669 read=3777
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10572.97 rows=790 width=40) (actual time=0.074..14.819 rows=588 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110523
                                      Buffers: shared hit=3129 read=4317
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10571.18 rows=75 width=40) (actual time=0.084..36.886 rows=144 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 333189
                                      Buffers: shared hit=1563 read=5883
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10568.00 rows=800 width=40) (actual time=0.018..40.294 rows=1719 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 331614
                                      Buffers: shared hit=1504 read=5937
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8974.91 rows=669 width=40) (actual time=0.054..34.399 rows=1561 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'target'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'LCP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 281344
                                      Buffers: shared hit=1472 read=4849
Planning Time: 0.261 ms
Execution Time: 138.696 ms
```

### attribution-inp

Slowest INP targets of /products/:id, 7 days (GET /routes/attribution)

```
Limit  (cost=85063.01..85063.03 rows=7 width=48) (actual time=116.401..122.208 rows=10 loops=1)
  Buffers: shared hit=16102 read=42456
  ->  Sort  (cost=85063.01..85063.03 rows=7 width=48) (actual time=116.400..122.205 rows=10 loops=1)
        Sort Key: (percentile_cont('0.75'::double precision) WITHIN GROUP (ORDER BY e.value)) DESC, ((e.attribution ->> 'interactionTarget'::text))
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=16102 read=42456
        ->  GroupAggregate  (cost=84167.65..85062.91 rows=7 width=48) (actual time=114.707..122.193 rows=10 loops=1)
              Group Key: ((e.attribution ->> 'interactionTarget'::text))
              Filter: (count(*) >= '5'::bigint)
              Buffers: shared hit=16102 read=42456
              ->  Gather Merge  (cost=84167.65..85008.42 rows=7219 width=40) (actual time=114.373..121.069 rows=6558 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=16102 read=42456
                    ->  Sort  (cost=83167.63..83175.15 rows=3009 width=40) (actual time=103.331..103.415 rows=2186 loops=3)
                          Sort Key: ((e.attribution ->> 'interactionTarget'::text))
                          Sort Method: quicksort  Memory: 188kB
                          Buffers: shared hit=16102 read=42456
                          Worker 0:  Sort Method: quicksort  Memory: 188kB
                          Worker 1:  Sort Method: quicksort  Memory: 195kB
                          ->  Parallel Append  (cost=0.00..82993.78 rows=3009 width=40) (actual time=0.106..102.441 rows=2186 loops=3)
                                Buffers: shared hit=15988 read=42456
                                ->  Parallel Seq Scan on events_p20261025 e_4  (cost=0.00..10575.08 rows=434 width=40) (actual time=0.081..39.351 rows=944 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332389
                                      Buffers: shared hit=1258 read=6191
                                ->  Parallel Seq Scan on events_p20261027 e_6  (cost=0.00..10574.07 rows=430 width=40) (actual time=0.071..39.174 rows=916 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332417
                                      Buffers: shared hit=1258 read=6190
                                ->  Parallel Seq Scan on events_p20261026 e_5  (cost=0.00..10573.03 rows=415 width=40) (actual time=0.128..40.149 rows=1014 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332319
                                      Buffers: shared hit=1663 read=5784
                                ->  Parallel Seq Scan on events_p20261023 e_2  (cost=0.00..10572.12 rows=449 width=40) (actual time=0.066..43.609 rows=936 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332397
                                      Buffers: shared hit=3719 read=3727
                                ->  Parallel Seq Scan on events_p20261028 e_7  (cost=0.00..10572.09 rows=438 width=40) (actual time=0.124..14.756 rows=305 loops=3)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 110806
                                      Buffers: shared hit=3505 read=3941
                                ->  Parallel Seq Scan on events_p20261022 e_1  (cost=0.00..10571.10 rows=42 width=40) (actual time=0.490..14.679 rows=42 loops=2)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 166624
                                      Buffers: shared hit=1783 read=5663
                                ->  Parallel Seq Scan on events_p20261024 e_3  (cost=0.00..10567.08 rows=435 width=40) (actual time=0.011..38.081 rows=935 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 332398
                                      Buffers: shared hit=1490 read=5951
                                ->  Parallel Seq Scan on events_p20261029 e_8  (cost=0.00..8974.15 rows=366 width=40) (actual time=0.164..32.780 rows=813 loops=1)
                                      Filter: ((received_at >= '2026-10-22 20:30:08.515+00'::timestamp with time zone) AND ((attribution ->> 'interactionTarget'::text) IS NOT NULL) AND (project_id = 'db91d9d8-ce09-4229-8992-80f7501419b4'::uuid) AND (metric = 'INP'::text) AND (route = '/products/:id'::text))
                                      Rows Removed by Filter: 282092
                                      Buffers: shared hit=1312 read=5009
Planning Time: 0.260 ms
Execution Time: 122.458 ms
```

### rollup-job-3h

Rollup job: recompute last 3 hours from raw events and upsert

```
Insert on event_rollups_hourly  (cost=12644.10..18708.09 rows=0 width=0) (actual time=915.265..915.269 rows=0 loops=1)
  Conflict Resolution: UPDATE
  Conflict Arbiter Indexes: event_rollups_hourly_key
  Tuples Inserted: 0
  Conflicting Tuples: 11398
  Buffers: shared hit=176484 read=6249 dirtied=561 written=591
  ->  Hash Join  (cost=12644.10..18708.09 rows=53 width=114) (actual time=67.318..524.668 rows=11398 loops=1)
        Hash Cond: (e.metric = "*VALUES*".column1)
        Buffers: shared hit=297 read=6024 written=25
        ->  GroupAggregate  (cost=12643.98..14943.51 rows=2119 width=146) (actual time=67.224..112.370 rows=11398 loops=1)
              Group Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text))
              Buffers: shared hit=297 read=6024 written=25
              ->  GroupAggregate  (cost=12643.98..13968.60 rows=21194 width=102) (actual time=67.187..88.603 rows=18691 loops=1)
                    Group Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text)), ((("*VALUES*_1".column3 - width_bucket((- e.value), "*VALUES*_1".column2)) + 1))
                    Buffers: shared hit=297 read=6024 written=25
                    ->  Sort  (cost=12643.98..12696.96 rows=21194 width=78) (actual time=67.176..72.813 rows=20983 loops=1)
                          Sort Key: e.project_id, e.metric, e.route, e.device_type, e.release, (date_trunc('hour'::text, e.received_at, 'UTC'::text)), ((("*VALUES*_1".column3 - width_bucket((- e.value), "*VALUES*_1".column2)) + 1))
                          Sort Method: quicksort  Memory: 2902kB
                          Buffers: shared hit=297 read=6024 written=25
                          ->  Hash Join  (cost=0.12..11121.04 rows=21194 width=78) (actual time=0.056..36.195 rows=20983 loops=1)
                                Hash Cond: (e.metric = "*VALUES*_1".column1)
                                Buffers: shared hit=297 read=6024 written=25
                                ->  Seq Scan on events_p20261029 e  (cost=0.00..10564.58 rows=21194 width=74) (actual time=0.033..26.288 rows=20983 loops=1)
                                      Filter: ((received_at >= '2026-10-29 18:00:00+00'::timestamp with time zone) AND (received_at < '2026-10-29 21:00:00+00'::timestamp with time zone))
                                      Rows Removed by Filter: 261922
                                      Buffers: shared hit=297 read=6024 written=25
                                ->  Hash  (cost=0.06..0.06 rows=5 width=68) (actual time=0.014..0.014 rows=5 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 11kB
                                      ->  Values Scan on "*VALUES*_1"  (cost=0.00..0.06 rows=5 width=68) (actual time=0.001..0.002 rows=5 loops=1)
        ->  Hash  (cost=0.06..0.06 rows=5 width=36) (actual time=0.010..0.011 rows=5 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 9kB
              ->  Values Scan on "*VALUES*"  (cost=0.00..0.06 rows=5 width=36) (actual time=0.001..0.003 rows=5 loops=1)
        SubPlan 1
          ->  Aggregate  (cost=70.86..70.87 rows=1 width=32) (actual time=0.035..0.035 rows=1 loops=11398)
                ->  Merge Left Join  (cost=60.11..65.86 rows=1000 width=12) (actual time=0.024..0.031 rows=64 loops=11398)
                      Merge Cond: (s.i = u.i)
                      ->  Sort  (cost=59.83..62.33 rows=1000 width=4) (actual time=0.008..0.010 rows=64 loops=11398)
                            Sort Key: s.i
                            Sort Method: quicksort  Memory: 25kB
                            ->  Function Scan on generate_series s  (cost=0.01..10.01 rows=1000 width=4) (actual time=0.003..0.004 rows=64 loops=11398)
                      ->  Sort  (cost=0.27..0.30 rows=10 width=12) (actual time=0.015..0.015 rows=2 loops=11398)
                            Sort Key: u.i
                            Sort Method: quicksort  Memory: 25kB
                            ->  Function Scan on u  (cost=0.01..0.11 rows=10 width=12) (actual time=0.008..0.008 rows=2 loops=11398)
Planning:
  Buffers: shared hit=2
Planning Time: 0.432 ms
Execution Time: 915.739 ms
```
