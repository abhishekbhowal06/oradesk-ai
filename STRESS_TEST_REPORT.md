# 💥 Stress Test Report

> Generated: 2026-02-14T10:46:08.579Z
> Target: http://localhost:3000
> Max Concurrency: 50

## Summary

| Metric         | Value       |
| -------------- | ----------- |
| Total Requests | 310         |
| Total Errors   | 0           |
| Error Rate     | 0.0%        |
| p50 Latency    | 18ms        |
| p95 Latency    | 27ms        |
| p99 Latency    | 30ms        |
| Max Latency    | 30ms        |
| Memory Delta   | 6.9MB       |
| Server Status  | ✅ Survived |

## Phase Results

### Warm-Up

- Requests: 10
- Success: 10 | Errors: 0
- p50: 2ms | p95: 29ms | p99: 29ms

### Ramp-Up

- Requests: 50
- Success: 50 | Errors: 0
- p50: 8ms | p95: 20ms | p99: 20ms

### Full Load

- Requests: 100
- Success: 100 | Errors: 0
- p50: 18ms | p95: 20ms | p99: 26ms

### Spike

- Requests: 150
- Success: 150 | Errors: 0
- p50: 25ms | p95: 27ms | p99: 30ms

## Verdict: ✅ SURVIVED
