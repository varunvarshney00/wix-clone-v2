# Architecture

Current state — end of Phase 1.

```text
        Client (curl / browser)
               │
               │ HTTP
               ▼
   ┌───────────────────────────┐
   │   Node process :3000      │
   │                           │
   │   Fastify                 │
   │     ├─ GET /health        │  liveness  — is the process alive?
   │     └─ GET /ready         │  readiness — can it serve traffic?
   │            │              │
   │       pg connection pool  │  max 10, 5s timeout
   └────────────┬──────────────┘
                │ TCP :5432
                ▼
        ┌───────────────┐
        │  PostgreSQL   │  in Docker, data on a named volume
        └───────────────┘
```

## Lifecycle

**Startup** — validate config → verify database → bind port.
Any failure exits non-zero before traffic is accepted.

**Shutdown** — SIGTERM/SIGINT → stop accepting connections →
drain in-flight requests → close pool → exit 0.
Forced exit after 10s.