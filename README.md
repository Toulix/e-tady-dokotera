# e-tady-dokotera

Healthcare appointment booking platform for Madagascar — connecting patients with doctors via online booking, SMS notifications, and video consultations.

---

## Overview

e-tady-dokotera ("Looking for a doctor" in Malagasy) is a full-stack web platform that lets patients in Madagascar find doctors, book appointments, and receive SMS confirmations, with video consultation support.

**Key features:**
- Patient and doctor registration with OTP phone verification
- Doctor search with fuzzy-text matching (`pg_trgm`) and geospatial proximity (PostGIS)
- Appointment booking with two-layer slot locking (Redis TTL + PostgreSQL `SELECT FOR UPDATE`)
- SMS notifications via Operators (Orange Madagascar, etc) (BullMQ async queue with retry)
- Real-time updates via WebSocket (Socket.io)
- Video consultations via Jitsi Meet (Phase 7)
- BullMQ admin dashboard at `/admin/queues`
- Interactive tech stack wiki at `/wiki`

---

## Tech Stack

**Frontend**
- React 19, Vite 7, TailwindCSS 4, Zustand 5, React Router 6

**Backend**
- NestJS 11, TypeScript 5.9, Passport JWT, Socket.io 4, BullMQ 5

**Database**
- PostgreSQL 16 + PostGIS (geospatial queries) + `pg_trgm` (fuzzy search)
- Prisma 7 ORM — schema-per-module layout

**Cache / Queue**
- Redis 7 (`noeviction` policy), BullMQ, ioredis

**Monorepo / Tooling**
- Turborepo v2, pnpm 10.30, Docker Compose, GitHub Actions

---

## Architecture

A **modular monolith** — one deployable NestJS process, with each domain owning a dedicated PostgreSQL schema. Cross-module communication uses domain events (`@nestjs/event-emitter`); no direct cross-module DB writes.

```
React PWA (Vite)          React Native (mobile)
       |                          |
       +----------+---------------+
                  |
          NestJS REST API  ←──  Socket.io (WebSocket)
                  |
     +------------+-------------+
     |            |             |
  Redis 7      PostgreSQL 16   Jitsi Meet
  (BullMQ,     (PostGIS,       (video)
   slot lock,   pg_trgm,
   JWT deny)    8 schemas)
                  |
              BullMQ Workers
              (SMS, reminders)
```

**Module → schema mapping:**

| Module         | PostgreSQL Schema | Responsibility                              |
|----------------|-------------------|---------------------------------------------|
| `auth`         | `auth`            | JWT, OTP, refresh tokens, sessions          |
| `doctors`      | `doctors`         | Profiles, specialties, geospatial search    |
| `appointments` | `appointments`    | Booking, two-layer slot locking             |
| `scheduling`   | `scheduling`      | Weekly templates, exceptions, slot generation |
| `notifications`| `notifications`   | SMS (Orange MG), email, BullMQ queue        |
| `video`        | `video`           | Jitsi Meet JWT tokens, consultation records |
| `analytics`    | `analytics`       | Read-only cross-schema reporting            |
| `payments`     | `payments`        | Mobile Money — Phase 2                      |

---

## Project Structure

```
/
├── apps/
│   ├── api/               # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/   # Feature modules (auth, doctors, appointments, …)
│   │   │   └── shared/    # Guards, filters, interceptors, events, Redis
│   │   └── prisma/        # Prisma schema files
│   ├── web/               # React 19 PWA (Vite)
│   └── mobile/            # React Native (planned)
├── packages/
│   ├── shared-types/      # TypeScript types shared across apps
│   └── ui/                # Shared UI components
├── infra/
│   ├── docker/            # init-schemas.sql, Dockerfiles
│   └── terraform/         # DigitalOcean infrastructure (production)
├── docs/                  # spec.md, roadmap.md, decisions.md, DEVLOG.md
├── docker-compose.yml     # Local dev stack
├── docker-compose.test.yml# Isolated integration test stack
└── turbo.json             # Turborepo task graph
```

Each module follows a strict layered structure:

```
modules/<name>/
├── domain/          # Entities, value objects, repository interfaces
├── application/     # Services, use cases, event handlers
├── infrastructure/  # Repository implementations, Prisma calls
└── api/             # Controllers, DTOs, guards
```

---

## Prerequisites

- **Node.js** >= 20.x
- **pnpm** >= 10.x (`corepack enable && corepack prepare pnpm@10.30.3 --activate`)
- **Docker** and **Docker Compose** (recommended for local dev)
- PostgreSQL 16 + PostGIS and Redis 7 (only needed if running without Docker)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

| Variable                      | Description                                              | Example / Default                  |
|-------------------------------|----------------------------------------------------------|------------------------------------|
| `DATABASE_URL`                | PostgreSQL connection string                             | `postgresql://dev:dev@localhost:5432/e_tady_dokotera` |
| `REDIS_HOST`                  | Redis hostname                                           | `localhost`                        |
| `REDIS_PORT`                  | Redis port                                               | `6379`                             |
| `REDIS_PASSWORD`              | Redis password (empty in dev)                            | —                                  |
| `JWT_SECRET`                  | Secret key for signing access tokens                     | `change-me-in-production`          |
| `JWT_ACCESS_EXPIRES_IN`       | Access token TTL                                         | `15m`                              |
| `JWT_REFRESH_EXPIRES_IN`      | Refresh token TTL                                        | `7d`                               |
| `PORT`                        | API port                                                 | `3000`                             |
| `TZ`                          | Server timezone                                          | `Indian/Antananarivo`              |
| `FRONTEND_URL`                | Allowed CORS origin                                      | `http://localhost:5173`            |
| `BULL_BOARD_PASSWORD`         | HTTP Basic Auth password for `/admin/queues`             | `change-me`                        |
| `ADMIN_ALLOWED_IPS`           | Comma-separated IPs allowed to reach `/admin/queues` in production | —              |
| `SMS_PROVIDER`                | SMS adapter (`mock` in dev, `orange` in prod)            | `mock`                             |
| `STORAGE_BUCKET`              | S3-compatible bucket name                                | `e-tady-dokotera-dev`              |
| `STORAGE_ENDPOINT`            | S3-compatible endpoint (DigitalOcean Spaces in prod)     | —                                  |
| `STORAGE_ACCESS_KEY`          | S3 access key                                            | —                                  |
| `STORAGE_SECRET_KEY`          | S3 secret key                                            | —                                  |
| `SENTRY_DSN`                  | Backend Sentry DSN (leave empty in dev)                  | —                                  |
| `VITE_SENTRY_DSN`             | Frontend Sentry DSN                                      | —                                  |
| `JITSI_APP_ID`                | Jitsi Meet application ID (Phase 7)                      | —                                  |
| `JITSI_APP_SECRET`            | Jitsi Meet secret for JWT signing (Phase 7)              | —                                  |
| `JITSI_DOMAIN`                | Jitsi Meet domain                                        | `video.yourdomain.com`             |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Base64-encoded Firebase service account (Phase 9)   | —                                  |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/Toulix/e-tady-dokotera.git
cd e-tady-dokotera

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — DATABASE_URL, JWT_SECRET, and BULL_BOARD_PASSWORD at minimum
```

---

## Running the Application

**Start the full local stack with Docker (recommended):**

```bash
docker compose up
```

Docker starts 5 services in dependency order:

| Service         | Role                                    | Port  |
|-----------------|-----------------------------------------|-------|
| `postgres`      | PostgreSQL 16 + PostGIS + `pg_trgm`     | 5432  |
| `redis`         | Redis 7 (BullMQ queues, slot locking)   | 6379  |
| `api`           | NestJS REST API                         | 3000  |
| `web`           | React + Vite (HMR)                      | 5173  |
| `prisma-studio` | Visual database browser                 | 5555  |

Database schemas (`auth`, `doctors`, `appointments`, …) and extensions (`postgis`, `pg_trgm`) are created automatically on first run via `infra/docker/init-schemas.sql`. No manual migration step is needed to start.

Source code in `apps/api/src/` and `apps/web/src/` is volume-mounted — edits take effect immediately without rebuilding.

**Available once running:**

```
http://localhost:5173          →  React frontend
http://localhost:5173/wiki     →  Interactive tech stack wiki
http://localhost:3000/api/v1   →  REST API base
http://localhost:3000/health   →  Health check (no auth required)
http://localhost:3000/admin/queues  →  BullMQ dashboard (HTTP Basic Auth)
http://localhost:5555          →  Prisma Studio (visual DB browser)
```

**Or run services individually (requires local Postgres and Redis):**

```bash
# Start only infra
docker compose up postgres redis -d

# Backend
cd apps/api
pnpm dev

# Frontend (separate terminal)
cd apps/web
pnpm dev
```

**Common Docker commands:**

```bash
docker compose up -d               # Start in background
docker compose logs -f api         # Stream API logs
docker compose down                # Stop (data preserved)
docker compose down -v             # Stop and wipe the database volume
docker compose build               # Rebuild images after Dockerfile or dependency changes
```

### What happens when you run `docker compose up`

Four services start in the right order automatically. Here is what each one does and why it matters.

**1. Database (PostgreSQL) and cache (Redis) start first**

The API waits for both to be confirmed ready before booting — this is enforced via `depends_on` with a health check condition, which prevents connection errors on startup.

The database sets itself up automatically on first boot: it installs the extensions needed for map-based doctor search and fuzzy name matching (`PostGIS` and `pg_trgm`), then creates a separate schema (database namespace) for each feature area — auth, appointments, notifications, etc. No manual setup is needed.

Redis starts with a safety setting called the `noeviction` policy — it rejects new writes when memory is full rather than silently discarding existing data. Without it, BullMQ jobs (background tasks like SMS notifications and reminders) could be lost with no error or trace.

**2. The backend image is built (first run only)**

Docker installs dependencies then runs `prisma generate` to build the type-safe database client from the schema. Both steps are layer-cached — on subsequent builds, Docker reuses the cached `node_modules` layer and skips reinstall if only application code changed. The `src/` directory is not baked into the image; it is volume-mounted (linked live from the host machine) so code changes take effect immediately without a rebuild.

**3. The frontend image is built (first run only)**

Dependencies are installed inside the container rather than copied from the host. This matters because packages like `esbuild` compile platform-specific native binaries — a macOS `node_modules` copied into a Linux container will crash at runtime. The `src/` directory is volume-mounted as well, enabling HMR (hot module replacement) so the browser reflects file changes within milliseconds.

**4. The API boots**

Before accepting any request, NestJS runs through a middleware stack: Helmet adds security headers, cookie-parser reads the `HttpOnly` refresh token, CORS restricts cross-origin requests to the frontend origin only, and a global validation pipe strips unknown fields and rejects malformed payloads with a `400` — all before any business logic runs. Once ready, all routes are served under `/api/v1`.

> **Why are `DATABASE_URL` and `REDIS_HOST` overridden in the compose file?**
> The `.env` file uses `localhost` for host-side development. Inside the Docker network, containers resolve each other by service name (`postgres`, `redis`) — `localhost` would point to the container itself. The compose file overrides just those two values; everything else comes from `.env`.

**5. The frontend starts**

Vite binds to `0.0.0.0` (all network interfaces inside the container) so Docker can forward port `5173` to the host. Binding to `127.0.0.1` instead would silently break the port mapping. Changes in `apps/web/src/` appear in the browser instantly via HMR.

**Edits are always live — no rebuild needed:**

| What changes                        | What to do                                              |
|-------------------------------------|---------------------------------------------------------|
| `apps/api/src/`                     | Backend hot-reloads automatically                       |
| `apps/web/src/`                     | Browser updates instantly via HMR                       |
| A `Dockerfile` or `package.json`    | Run `docker compose build` then `docker compose up`     |
| The Prisma schema                   | Run `docker compose build` to re-run `prisma generate`  |

---

## Database

Uses **PostgreSQL 16** with **PostGIS** (geospatial doctor search) and **`pg_trgm`** (fuzzy doctor name search). **Prisma 7** is the ORM — all DB calls go through a Repository class; no `$queryRaw` outside of repositories.

**Migrations:**

```bash
# Create and apply a new migration (dev only)
pnpm --filter @e-tady-dokotera/api db:migrate

# Regenerate the Prisma client after schema changes
pnpm --filter @e-tady-dokotera/api db:generate

# Apply pending migrations non-interactively (CI / production)
pnpm --filter @e-tady-dokotera/api db:migrate:deploy
```

**Seed data:**

```bash
# Seed 20 doctors + 3 patients for local development
cd apps/api
DATABASE_URL="postgresql://dev:dev@localhost:5432/e_tady_dokotera" pnpm db:seed
```

The seed script creates 20 doctor profiles with realistic Malagasy names, French-language specialties, Antananarivo-area coordinates (PostGIS), and facilities — plus 3 test patient accounts. All seeded accounts use the password `password123` and are pre-verified so you can log in immediately.

The script is idempotent — re-running it cleans up previous seed data before re-inserting.

> **Prisma 7 note:** seed configuration lives in `prisma.config.ts` under `migrations.seed`, not in `package.json` (breaking change from Prisma 6).

**Prisma Studio** — visual database browser:

Opens at `http://localhost:5555` via the `prisma-studio` Docker service — lets you browse and edit all tables across every schema without writing SQL.

**Schema conventions:**
- All IDs: `String @id @default(uuid())`
- All timestamps: `@db.Timestamptz`
- All monetary values: `Int` (Ariary as integer, never `Decimal` or `Float`)
- PostGIS columns: `Unsupported("geometry(Point, 4326)")` — queried via `$queryRaw`

---

## Redis

Redis runs with `--maxmemory-policy noeviction` — it rejects new writes when full rather than silently evicting data. This is required for BullMQ: `allkeys-lru` would silently drop queued jobs.

Redis is used for:
- **Slot locking** — short-TTL keys reserve appointment slots while a patient completes checkout
- **BullMQ job queues** — SMS confirmations, appointment reminders, cancellation notifications
- **JWT denylist** — invalidated tokens tracked per user on logout/suspend
- **Rate limiting** — per-phone OTP throttling via `@nest-lab/throttler-storage-redis`

---

## API Overview

Base URL: `http://localhost:3000/api/v1`

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

**Modules:**

| Module          | Base path                  | Description                                       |
|-----------------|----------------------------|---------------------------------------------------|
| Auth            | `/api/v1/auth`             | Register, login, OTP verify, token refresh, logout |
| Doctors         | `/api/v1/doctors`          | Public profiles, profile update, admin verify     |
| Appointments    | `/api/v1/appointments`     | Book, cancel, reschedule, confirm, review         |
| Scheduling      | `/api/v1/scheduling`       | Weekly templates, schedule exceptions, slot locks |
| Notifications   | `/api/v1/notifications`    | Preferences, SMS opt-out webhook                  |
| Video           | `/api/v1/consultations`    | Jitsi token generation, video session records     |
| Analytics       | `/api/v1/analytics`        | Read-only reporting (admin only)                  |
| Health          | `/health`                  | Liveness probe (no auth)                          |

**Example — register a patient:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+261340000000",
    "password": "s3cret",
    "first_name": "Hery",
    "last_name": "Rakoto"
  }'
```

```json
{
  "success": true,
  "data": {
    "message": "OTP sent to +261340000000"
  }
}
```

**Auth flow:**
1. `POST /auth/register` — creates account, sends OTP via SMS
2. `POST /auth/verify-otp` — verifies OTP, returns access token in body + refresh token as `HttpOnly` cookie
3. `POST /auth/refresh` — exchanges refresh cookie for new access token
4. Include `Authorization: Bearer <access_token>` on all authenticated requests

> Access tokens are stored in Zustand memory only — never `localStorage`. Refresh tokens are `HttpOnly` cookies only — never in the response body.

---

## Testing

```bash
# Unit tests (no DB or Redis — all deps mocked)
pnpm test

# Unit tests with coverage report (coverage/unit/)
pnpm --filter @e-tady-dokotera/api test:coverage

# Integration tests (requires docker-compose.test.yml stack)
docker compose -f docker-compose.test.yml up -d
pnpm test:integration
docker compose -f docker-compose.test.yml down
```

---

## Development Workflow

**Branch naming:**
- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `chore/<description>` — maintenance, deps, config
- `docs/<description>` — documentation only

**Commit style:** [Conventional Commits](https://www.conventionalcommits.org/)

```
feat(appointments): add two-layer slot locking with Redis TTL
fix(auth): handle expired OTP when clock skew exceeds 30s
chore(deps): upgrade prisma to 7.4.2
```

**Adding a new NestJS module:**

```bash
cd apps/api

# Scaffold the module skeleton
nest generate module modules/<name>
nest generate service modules/<name>/application/<name>
nest generate controller modules/<name>/api/<name>

# Then create domain/, infrastructure/ folders manually
# and move generated files into the correct layer
```

**Code conventions (enforced by review):**
- No Prisma calls in services or controllers — always through a Repository class
- No `$queryRaw` outside a Repository class
- No `$queryRawUnsafe` anywhere
- Cross-module calls only through public service interfaces — no direct cross-module DB writes
- Side effects via domain events (e.g. `AppointmentBooked` → SMS)

---

## Deployment

**Production stack:**

```bash
docker compose -f docker-compose.prod.yml up -d
```

**CI/CD:** GitHub Actions (`.github/workflows/`) runs lint, unit tests, and integration tests on every push.

**Infrastructure:** DigitalOcean (Droplet + Managed PostgreSQL + Spaces) provisioned via Terraform in `infra/terraform/`. Nginx proxies the API with WebSocket upgrade headers for Socket.io.

**Production checklist before deploy:**
- Set `NODE_ENV=production`
- Rotate `JWT_SECRET` and `BULL_BOARD_PASSWORD`
- Set `ADMIN_ALLOWED_IPS` to restrict `/admin/queues`
- Verify Redis uses `--maxmemory-policy noeviction`
- Ensure `__Host-refresh_token` cookie is used (enforced by `NODE_ENV=production` in the API)

---

## Implementation Status

Features already built and working:

- **Auth module** (backend) — register, login, OTP verify, token refresh, logout, role-based guards
- **Auth pages** (frontend) — login, register, OTP verification with auto-logout on idle
- **Doctor CRUD** (backend) — `GET /doctors/:id` public profile, `PATCH /doctors/profile` self-update, `POST /doctors/:id/verify` admin verification
- **Database seed** — 20 doctors + 3 patients with PostGIS coordinates, ready for local testing
- **Docker Compose dev stack** — all services (postgres, redis, api, web, prisma-studio) with health checks
- **Tech stack wiki** — interactive wiki page at `/wiki`

See [`docs/roadmap.md`](docs/roadmap.md) for the full implementation plan and next steps.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Follow the commit style above (Conventional Commits)
4. Make sure unit tests pass: `pnpm test`
5. Open a pull request against `main`

See [`docs/decisions.md`](docs/decisions.md) for architecture decision records and [`docs/roadmap.md`](docs/roadmap.md) for the implementation plan before starting significant work.
