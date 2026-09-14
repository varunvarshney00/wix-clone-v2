# wix-clone

A production-oriented website building platform, built step by step for learning.

## Prerequisites

- Node.js 20+
- Docker Desktop
- Git

## Setup

```bash
git clone <repo-url>
cd wix-clone
npm install
cp .env.example .env
docker compose up -d
npm run dev
```

The API listens on http://127.0.0.1:3000

## Verify

```bash
curl http://127.0.0.1:3000/health   # process is alive
curl http://127.0.0.1:3000/ready    # database is reachable
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build --workspace=apps/api` | Compile TypeScript to `dist/` |
| `npm run start --workspace=apps/api` | Run the compiled build |
| `npm run typecheck --workspace=apps/api` | Type-check without emitting |
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL (data preserved) |
| `docker compose down -v` | Stop and **delete all data** |

## Layout

```text
apps/api/          Backend service
packages/          Shared code (added in Phase 6)
docs/decisions/    Architecture Decision Records
docker-compose.yml Local infrastructure
```

## Architecture

See [docs/architecture.md](docs/architecture.md) and the ADRs in `docs/decisions/`.