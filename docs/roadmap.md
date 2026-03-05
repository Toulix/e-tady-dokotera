technical-roadmap-v1.5

# 🗺️ Technical Roadmap — Step-by-Step Build Guide

Madagascar Healthcare Booking Platform · Build order by priority

> 💡 **How to read this document**
> 
> 
> Every phase has a clear goal. Every step has concrete commands, file names, and acceptance criteria. Work top to bottom — do not skip ahead. The phases are ordered so that each one delivers real, testable value before the next begins.
> 

---

## ❓ First question: Cloud infra upfront or Docker Compose?

**Start with local Docker Compose. Do not touch cloud infrastructure until the end of Phase 6 (Week 7).**

Here is why. Your biggest risk right now is not “will the server be ready” — it is “will we build the right thing.” Every hour spent on DigitalOcean firewall rules before you have a working booking flow is a wasted hour that delivers zero user value.

The rule is simple:

- **Weeks 1–7** → `docker compose up` is your entire infrastructure. Nothing else.
- **End of Week 7** → You have a working booking flow. Now wire the cloud and CI/CD.
- **Never** pre-build infrastructure for scale you don’t have yet.

---

## 🗓️ Timeline at a glance

| Phase | Weeks | Goal | Done when |
| --- | --- | --- | --- |
| 0 — Foundation | 1–2 | One command starts everything locally | `localhost:3000/health` returns 200 |
| 1 — Auth | 2–3 | Register, OTP, login, JWT | Protected route shows user name |
| 2 — Doctors | 3–4 | Doctor profiles + search | Search returns seeded doctors |
| 3 — Scheduling | 4–5 | Doctor sets hours, patient sees slots | Slots appear on profile page |
| 4 — Booking | 5–6 | Patient books a slot end-to-end | Appointment in both dashboards |
| 5 — Notifications | 6–7 | SMS confirmations + reminders queued | Jobs visible in BullMQ dashboard |
| 6 — CI/CD + Cloud | 7 | App live on HTTPS, deploy on push | Production smoke test passes |
| 7 — Video | 8–9 | Doctor + patient can consult via video | Jitsi call works from SMS link |
| 8 — Hardening | 9–10 | Security, perf baseline, monitoring | k6 p95 < 500ms, Sentry wired |
| 9 — Mobile App | 10–12 | React Native parity with web | Booking works on iOS + Android |
| 10 — Payments | 12+ | Orange Money + MVola | Payment flow tested end-to-end |

---

## Phase 0 — Foundation

### Weeks 1–2 · Goal: every developer runs the full stack locally in one command

> Nothing is shipped to the cloud. Nothing is presented to users. The only goal is a solid, reproducible local development environment that the whole team can use from Day 1.
> 

---

### ✅ Step 1 — Monorepo scaffold

Create the repository structure immediately. Every file you write for the next 12 weeks lives here.

```bash
mkdir madagascar-health && cd madagascar-health
git init
npm install -g pnpm
pnpm init
pnpm add -D turbo
```

Repository layout:

```
/
├── apps/
│   ├── api/            ← NestJS backend
│   ├── web/            ← React PWA
│   └── mobile/         ← React Native (stub only for now)
├── packages/
│   ├── shared-types/   ← TypeScript interfaces shared between api + web + mobile
│   └── ui/             ← shared React component library (populated later)
├── infra/
│   ├── docker/
│   │   └── init-schemas.sql
│   └── terraform/      ← empty for now, do not touch
├── docker-compose.yml
├── docker-compose.test.yml
├── .env.example
├── turbo.json
└── package.json        ← pnpm workspace root
```

> ⚠️ **v1.1 fix:** pnpm workspaces are declared in `pnpm-workspace.yaml` at the root, **not** in `package.json`. The `"pnpm": { "workspaces" }` field in package.json is a common mistake — pnpm reads its own workspace config exclusively from `pnpm-workspace.yaml`.
> 

`pnpm-workspace.yaml` (create at repo root):

```yaml
packages:
-'apps/*'
-'packages/*'
```

`package.json` (workspace root):

```json
{
  "name": "madagascar-health",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "test:integration": "docker compose -f docker-compose.test.yml up -d && turbo test:integration && docker compose -f docker-compose.test.yml down"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.0.0"
  }
}
```

> ⚠️ **v1.2 fix — Turborepo v2 breaking change:** The `"pipeline"` key was renamed to `"tasks"` in Turborepo v2 (released 2024). Using `"pipeline"` with Turbo v2 causes a hard error: `"pipeline" is not a valid key`. The corrected `turbo.json` below uses `"tasks"`.
> 

`turbo.json` (create at repo root — required for `pnpm turbo` commands to work):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

**✔ Acceptance:** `pnpm install` runs without error from the root. `pnpm turbo build` runs without “pipeline not found” errors.

---

### ✅ Step 2 — Docker Compose (local dev environment)

This file defines your entire infrastructure for the next 7 weeks.

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: madagascar_health
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/docker/init-schemas.sql:/docker-entrypoint-initdb.d/01-schemas.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    # v1.3 fix — noeviction in dev too: BullMQ silently loses jobs under allkeys-lru
    # (the default). Use noeviction in ALL environments — dev, test, and prod —
    # so job loss is caught here before it ever reaches production.
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    env_file: .env
    volumes:
      - ./apps/api/src:/app/src
    command: pnpm dev

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    ports: ["5173:5173"]
    volumes:
      - ./apps/web/src:/app/src
    command: pnpm dev

  # NOTE: bull-board is NOT a separate container — it runs inside the NestJS app.
  # See Step 3 for the @bull-board/nestjs setup in main.ts.
  # The deadly0/bull-board Docker image only supports Bull v3/v4 and is INCOMPATIBLE with BullMQ.
  # Remove that image entirely. Access the board at http://localhost:3000/admin/queues instead.

volumes:
  pgdata:
```

`infra/docker/init-schemas.sql`:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Module schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS doctors;
CREATE SCHEMA IF NOT EXISTS appointments;
CREATE SCHEMA IF NOT EXISTS scheduling;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS video;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS payments;  -- Phase 2: Mobile Money (Orange Money, MVola, Airtel)
```

`.env.example` (commit this; never commit `.env`):

```bash
# Database
DATABASE_URL="postgresql://dev:dev@localhost:5432/madagascar_health"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# App
NODE_ENV=development
PORT=3000
TZ=Indian/Antananarivo
FRONTEND_URL=http://localhost:5173

# Bull Board (admin UI password)
BULL_BOARD_PASSWORD=change-me

# SMS (mock in development)
SMS_PROVIDER=mock

# Storage
STORAGE_BUCKET=madagascar-health-dev
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# Sentry (leave empty in development)
SENTRY_DSN=

# Sentry — frontend (Vite exposes VITE_ prefix vars to the browser)
VITE_SENTRY_DSN=

# Video consultation (Jitsi Meet — Phase 7)
JITSI_APP_ID=
JITSI_APP_SECRET=
JITSI_DOMAIN=video.yourdomain.com

# Push notifications (Firebase Cloud Messaging — Phase 9)
# Encode service account JSON: base64 -w 0 serviceAccount.json
FIREBASE_SERVICE_ACCOUNT_BASE64=
```

**✔ Acceptance:** `docker compose up` starts all services. `localhost:3000` responds (even 404 is fine). After completing Step 3, BullMQ board will be visible at `localhost:3000/admin/queues`.

---

### ✅ Step 2b — docker-compose.test.yml

This file is used by developers running integration tests locally. The CI pipeline in Phase 6 uses GitHub Actions service containers instead (no compose needed there).

`docker-compose.test.yml`:

```yaml
services:
  postgres-test:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: madagascar_health_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports: ["5433:5432"]  # different port to avoid conflicting with dev postgres
    tmpfs:
      - /var/lib/postgresql/data  # in-memory DB for fast test teardown
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports: ["6380:6379"]  # different port to avoid conflicting with dev redis
    # v1.3 fix — noeviction required in test environment too
    command: redis-server --maxmemory 128mb --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
```

Add to `.env.test` (committed, no secrets):

```bash
DATABASE_URL="postgresql://test:test@localhost:5433/madagascar_health_test"
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
JWT_SECRET=test-secret-not-real
SMS_PROVIDER=mock
NODE_ENV=test
```

---

### ✅ Step 3 — NestJS application scaffold

> ⚠️ **v1.3 fix — four packages added to the install list:** `cookie-parser` (required to read the httpOnly refresh token cookie in `POST /auth/refresh`), `helmet` (referenced in Step 34 security audit but never installed), `@nestjs/event-emitter` (required for the domain event bus used throughout Phases 4–5), and `@types/cookie-parser`. Without these, the auth refresh flow, the security headers, and all domain event handlers fail at runtime.
> 

```bash
cd apps/api
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add prisma @prisma/client
pnpm add bullmq @nestjs/bullmq ioredis
pnpm add class-validator class-transformer
pnpm add cookie-parser helmet
pnpm add @nestjs/event-emitter
pnpm add @bull-board/api @bull-board/nestjs @bull-board/express express-basic-auth
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
# Do NOT add @types/socket.io — socket.io v4 ships its own types; the old package targets v2 and causes conflicts
pnpm add -D @types/node @types/passport-jwt @types/cookie-parser typescript ts-node
npx prisma init --datasource-provider postgresql
```

Create the full module folder structure immediately — empty modules, no logic yet:

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── api/
│   ├── doctors/         (same sub-structure)
│   ├── appointments/    (same sub-structure)
│   ├── scheduling/      (same sub-structure)
│   ├── notifications/   (same sub-structure)
│   ├── video/           (same sub-structure)
│   ├── analytics/       (same sub-structure)
│   └── payments/        (stub only — Phase 2)
├── shared/
│   ├── events/          ← domain event definitions
│   ├── guards/          ← JwtAuthGuard, RolesGuard
│   ├── decorators/      ← @CurrentUser(), @Roles()
│   ├── filters/         ← GlobalHttpExceptionFilter
│   ├── interceptors/    ← ResponseEnvelopeInterceptor
│   ├── redis/           ← shared Redis provider (see Step 3b)
│   └── database/        ← PrismaService
├── app.module.ts
└── main.ts
```

> ⚠️ **v1.5 fix — populate shared/events/ immediately:** The `shared/events/` directory is created above but left empty. `@OnEvent` handlers in Steps 17 and 25 reference `AppointmentBookedEvent`, `AppointmentCancelledEvent`, and `ScheduleTemplateUpdatedEvent` — these classes must exist before any handler is written or TypeScript compilation fails. Create them now:
>

```tsx
// shared/events/appointment-booked.event.ts
export class AppointmentBookedEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly startTime: Date,
  ) {}
}

// shared/events/appointment-cancelled.event.ts
export class AppointmentCancelledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly cancelledBy: 'patient' | 'doctor' | 'system',
  ) {}
}

// shared/events/appointment-rescheduled.event.ts
export class AppointmentRescheduledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly newStartTime: Date,
  ) {}
}

// shared/events/schedule-template-updated.event.ts
export class ScheduleTemplateUpdatedEvent {
  constructor(public readonly doctorId: string) {}
}

// shared/events/slot-lock-expired.event.ts
export class SlotLockExpiredEvent {
  constructor(
    public readonly doctorId: string,
    public readonly slotTime: Date,
    public readonly lockToken: string,
  ) {}
}
```

---

### ✅ Step 3b — Shared infrastructure modules (Redis, Config, BullMQ, EventEmitter)

> ⚠️ **v1.3 addition — critical missing piece:** Multiple modules (BullMQ, ThrottlerStorageRedis, OtpService, SlotLockingService, AvailabilityCache) all need an `ioredis` client instance injected. Without a shared `RedisModule` exporting a named `REDIS_CLIENT` provider, every one of these modules fails to compile. `ConfigModule`, `BullModule`, and `EventEmitterModule` must also be registered in `AppModule` — `@nestjs/config` is installed in Step 3 but wired nowhere, which means `ConfigService` injection throws `No provider for ConfigService` throughout the app.
> 

**`shared/redis/redis.module.ts`** — shared Redis client, imported by any module that needs it:

```tsx
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()  // Global so every module can inject REDIS_CLIENT without re-importing RedisModule
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,  // required by BullMQ
          enableReadyCheck: false,     // required by BullMQ
        });
        client.on('error', (err) => console.error('Redis client error:', err));
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

**`app.module.ts`** — wire all shared infrastructure at root level:

```tsx
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { RedisModule, REDIS_CLIENT } from './shared/redis/redis.module';
import Redis from 'ioredis';
// ... import feature modules

@Module({
  imports: [
    // 1. Config — must be first; everything else depends on it
    ConfigModule.forRoot({
      isGlobal: true,      // ConfigService available everywhere without re-importing
      envFilePath: '.env',
      cache: true,
    }),

    // 2. Shared Redis provider
    RedisModule,

    // 3. BullMQ — creates its OWN dedicated Redis connection (separate from REDIS_CLIENT above).
    // BullMQ uses blocking Redis commands (BRPOPLPUSH) that are incompatible with a shared
    // ioredis client. Do NOT attempt to pass REDIS_CLIENT into BullMQ.forRootAsync — it will
    // deadlock. Two Redis connections is correct and expected: one for general-purpose use
    // (REDIS_CLIENT) and one owned by BullMQ for its queue operations.
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,  // required by BullMQ
          enableReadyCheck: false,
        },
      }),
      inject: [ConfigService],
    }),

    // 4. Domain event bus — in-process pub/sub for cross-module events
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      // ignoreErrors: true — event handler failures are isolated; a notification handler
      // throwing must NOT crash the booking service. Each @OnEvent handler is responsible
      // for its own try/catch and error logging.
      ignoreErrors: true,
    }),

    // 5. Rate limiting (uses the shared Redis client)
    ThrottlerModule.forRootAsync({
      useFactory: (redis: Redis) => ({
        storage: new ThrottlerStorageRedisService(redis),
        throttlers: [{ ttl: 60_000, limit: 100 }],  // ttl in ms in v5+
      }),
      inject: [REDIS_CLIENT],
    }),

    // Feature modules
    // AuthModule, DoctorsModule, AppointmentsModule, etc.
  ],
})
export class AppModule {}
```

> ⚠️ **v1.5 fix — mandatory @OnEvent error logging pattern:** `ignoreErrors: true` correctly prevents notification failures from crashing the booking service, but errors are swallowed completely — no log, no Sentry trace. On a healthcare platform, a failed SMS with no trace is operationally dangerous. ALL `@OnEvent` handlers MUST use the pattern below. No handler is permitted to have an empty catch block.
>

**Mandatory `@OnEvent` handler pattern (enforced in code review):**

```tsx
import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

// Every @OnEvent handler must follow this pattern — no exceptions.
@OnEvent('appointment.booked')
async handleAppointmentBooked(event: AppointmentBookedEvent): Promise<void> {
  try {
    await this.notificationService.sendConfirmation(event.appointmentId);
  } catch (err) {
    // Log structured error (visible in Grafana Loki) and capture in Sentry.
    // Never rethrow — the booking has already succeeded.
    this.logger.error('Failed to send booking confirmation SMS', { err, appointmentId: event.appointmentId });
    Sentry.captureException(err, { extra: { event } });
  }
}
```

**Publishing domain events** (pattern used from Phase 4 onwards):

```tsx
// In any service — inject EventEmitter2 from @nestjs/event-emitter
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(private readonly eventEmitter: EventEmitter2) {}

// After a booking is confirmed:
this.eventEmitter.emit('appointment.booked', new AppointmentBookedEvent(appointmentId));
```

**Consuming domain events** (pattern used in NotificationsModule):

```tsx
import { OnEvent } from '@nestjs/event-emitter';

@OnEvent('appointment.booked')
async handleAppointmentBooked(event: AppointmentBookedEvent): Promise<void> {
  // enqueue SMS confirmation job
}
```

---

**`shared/middleware/request-id.middleware.ts`** — generates or forwards a `X-Request-ID` header so every log line, Sentry event, and response envelope shares the same correlation ID:

```tsx
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Reads X-Request-ID from the incoming request (set by Cloudflare/Nginx/client)
// or generates a fresh UUID if absent. Attaches to req.requestId and echoes it
// back in the response header so clients can correlate their requests in logs.
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
```

Register in `AppModule.configure()`:

```tsx
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

`ResponseEnvelopeInterceptor` reads `req.requestId` to populate `meta.request_id`. `HttpExceptionFilter` does the same (see filter above). Sentry middleware should also attach it as a tag.

Wire global middleware, interceptors, and exception filter in `main.ts`:

```tsx
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import * as basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { ResponseEnvelopeInterceptor } from './shared/interceptors/response.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security middleware — must be first
  app.use(helmet());

  // Cookie parsing — required for httpOnly refresh token on POST /auth/refresh
  app.use(cookieParser());

  // CORS — restrict to known frontend origins
  app.enableCors({
    origin: [
      config.get<string>('FRONTEND_URL', 'http://localhost:5173'),
      // add production domains here
    ],
    credentials: true,   // required: allows the browser to send httpOnly cookies cross-origin
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global pipes, interceptors, filters
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Bull Board — password-protected admin UI for BullMQ queues
  // Queues are registered here once created (see Phase 5, Step 24)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [], serverAdapter });
  app.use(
    '/admin/queues',
    basicAuth({
      users: { admin: config.get<string>('BULL_BOARD_PASSWORD', 'changeme') },
      challenge: true,
    }),
    serverAdapter.getRouter(),
  );

  // Health endpoint (before global prefix so it stays at /health)
  // Add a dedicated HealthController or use:
  app.getHttpAdapter().get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}
bootstrap();
```

**`shared/filters/http-exception.filter.ts`** — must be implemented before the app can return spec-compliant error envelopes:

```tsx
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

// Catches all thrown HttpExceptions and formats them into the standard error envelope:
// { success: false, data: null, meta: { timestamp, request_id }, error: { code, message } }
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Support both string and object thrown exceptions
    const code = typeof exceptionResponse === 'object' && 'code' in exceptionResponse
      ? (exceptionResponse as any).code
      : `HTTP_${status}`;
    const message = typeof exceptionResponse === 'object' && 'message' in exceptionResponse
      ? (exceptionResponse as any).message
      : exception.message;

    this.logger.warn(`${request.method} ${request.url} → ${status}: ${code}`);

    response.status(status).json({
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: (request as any).requestId ?? null,
      },
      error: { code, message },
    });
  }
}
```

**✔ Acceptance:** `GET /health` returns `{ "success": true, "data": { "status": "ok", "uptime": 12.3 } }`.

---

### ✅ Step 4 — Prisma schema (write this before any application code)

This is the most important step in Phase 0. The full database schema must be written and migrated before a single business logic file is created. Changing the schema later is expensive.

`apps/api/prisma/schema.prisma` — key patterns to enforce:

```jsx
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema", "postgresqlExtensions"]
  // Note: multiSchema and postgresqlExtensions are preview features.
  // Monitor https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions
  // for when they reach stable — the API may change on promotion.
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  schemas    = ["auth", "doctors", "appointments", "scheduling",
                "notifications", "video", "analytics"]
  extensions = [postgis, pg_trgm, uuidOssp(map: "uuid-ossp")]
}

// --- auth schema ---
model User {
  id                String    @id @default(uuid())
  userType          UserType  @map("user_type")
  phoneNumber       String    @unique @map("phone_number")
  email             String?   @unique
  passwordHash      String    @map("password_hash")
  firstName         String    @map("first_name")
  lastName          String    @map("last_name")
  dateOfBirth       DateTime? @map("date_of_birth") @db.Date
  gender            Gender?
  profilePhotoUrl   String?   @map("profile_photo_url")
  preferredLanguage Language  @default(malagasy) @map("preferred_language")
  isActive          Boolean   @default(true) @map("is_active")
  isVerified        Boolean   @default(false) @map("is_verified")
  lastLoginAt       DateTime? @map("last_login_at") @db.Timestamptz
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@map("users")
  @@schema("auth")
}

// ALL timestamps: @db.Timestamptz (never plain DateTime for this app)
// ALL money:      Int (Ariary as integer, never Decimal or Float)
// ALL IDs:        String @id @default(uuid())

// CRITICAL — PostGIS geometry fields MUST use Unsupported():
// Prisma does not have a native geometry type. Use:
//   geolocation Unsupported("geometry(Point, 4326)")
// Prisma will include the column in migrations but won't generate typed accessors.
// All ST_DWithin / ST_MakePoint / ST_Distance calls must use prisma.$queryRaw.
// Encapsulate these in FacilityRepository — never use $queryRaw outside a repository class.

model Facility {
  id          String  @id @default(uuid())
  name        String
  // ...other fields
  geolocation Unsupported("geometry(Point, 4326)")?  // PostGIS point — Unsupported() required
  // ...

  @@map("facilities")
  @@schema("doctors")
}

// Example raw geo query (in FacilityRepository, nowhere else):
// const facilities = await prisma.$queryRaw`
//   SELECT id, name, ST_AsGeoJSON(geolocation) as geo
//   FROM doctors.facilities
//   WHERE ST_DWithin(
//     geolocation::geography,
//     ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
//     ${radiusKm * 1000}
//   )
// `;

// SlotLock — used by the two-layer slot locking strategy in Phase 4
model SlotLock {
  id         String   @id @default(uuid())
  doctorId   String   @map("doctor_id")
  slotTime   DateTime @map("slot_time") @db.Timestamptz
  userId     String   @map("user_id")
  lockToken  String   @unique @map("lock_token")
  expiresAt  DateTime @map("expires_at") @db.Timestamptz

  @@unique([doctorId, slotTime])  // ← deduplication guarantee — only one lock per slot
  @@map("slot_locks")
  @@schema("appointments")
}
```

Translate every entity from the spec (Section 5) into this file. Key models: `User`, `DoctorProfile`, `Facility`, `DoctorFacility`, `Appointment`, `SlotLock`, `WeeklyScheduleTemplate`, `ScheduleException`, `NotificationLog`, `VideoSession`, `ConsentRecord`.

```bash
npx prisma migrate dev --name init_all_schemas
npx prisma generate
npx prisma studio   # verify all tables created in correct schemas
```

**✔ Acceptance:** Prisma Studio opens. All tables visible in their correct schemas. Zero migration errors.

---

### ✅ Step 5 — React frontend scaffold

```bash
cd apps/web
pnpm create vite . --template react-ts
pnpm add react-router-dom@6 zustand axios socket.io-client
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Create the full route skeleton — placeholder pages only, no logic:

```
apps/web/src/
├── pages/
│   ├── HomePage.tsx
│   ├── SearchPage.tsx
│   ├── DoctorProfilePage.tsx
│   ├── BookingPage.tsx
│   ├── BookingSuccessPage.tsx
│   ├── patient/
│   │   └── DashboardPage.tsx
│   ├── doctor/
│   │   ├── DashboardPage.tsx
│   │   └── SchedulePage.tsx
│   └── auth/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       └── VerifyOtpPage.tsx
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   └── Navbar.tsx
│   └── shared/
├── stores/
│   ├── authStore.ts     ← Zustand: user, tokens, login/logout actions
│   └── bookingStore.ts  ← Zustand: slot selection state during booking flow
├── api/
│   ├── client.ts        ← Axios instance + interceptors
│   ├── auth.api.ts
│   ├── doctors.api.ts
│   └── appointments.api.ts
└── App.tsx              ← React Router setup
```

> ⚠️ **v1.3 addition — authStore skeleton and refreshTokens():** The Axios interceptor calls `refreshTokens()` but neither the store nor the function were shown. Without them the interceptor cannot compile. The access token is stored in Zustand memory only — never in `localStorage`.
> 

**`stores/authStore.ts`:**

```tsx
import { create } from 'zustand';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  userType: 'patient' | 'doctor' | 'admin' | 'support';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
```

**`api/client.ts`** — wire the Axios interceptor for token refresh from day 1:

```tsx
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  withCredentials: true,  // required: sends httpOnly refresh_token cookie on every request
});

// Attach access token from in-memory store to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silently refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !(error.config as any)._retry) {
      (error.config as any)._retry = true;
      try {
        await refreshTokens();
        // Retry the original request with the new access token
        const token = useAuthStore.getState().accessToken;
        error.config.headers.Authorization = `Bearer ${token}`;
        return apiClient(error.config);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Silently refresh the access token.
 * The browser automatically sends the httpOnly refresh_token cookie — no JS action needed.
 * The API rotates the cookie and returns a new access_token in the response body.
 */
async function refreshTokens(): Promise<void> {
  // Use a plain axios instance (not apiClient) to avoid interceptor recursion
  const res = await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  useAuthStore.getState().setAccessToken(res.data.data.access_token);
}
```

**✔ Acceptance:** All routes render a placeholder `<h1>`. No console errors. Tailwind applies styles.

---

## Phase 1 — Auth Module

### Week 2–3 · Goal: register → OTP → verify → JWT

> First real feature. When this phase is done, a user can create an account and a protected route knows who they are.
> 

---

### ✅ Step 6 — Auth data layer

Create `AuthRepository` in `modules/auth/infrastructure/auth.repository.ts`. All database calls for the auth module go through this class — no Prisma calls in service or controller files.

```tsx
class AuthRepository {
  createUser(data: {
    phoneNumber: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    userType: UserType;
  }): Promise<User>

  findByPhone(phone: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  markVerified(id: string): Promise<void>
  updateLastLogin(id: string): Promise<void>
}
```

---

### ✅ Step 7 — OTP service

```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

OTP logic in `modules/auth/infrastructure/otp.service.ts`:

```tsx
// Generate: 6-digit code, stored as bcrypt hash in Redis
// Key pattern: otp:{phone_number}  TTL: 10 minutes (600 seconds)
// Verify:  compare input against stored hash, DELETE key on success (prevent replay)
// In development (SMS_PROVIDER=mock): console.log the OTP code

class OtpService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly smsService: SmsService,
  ) {}

  async generate(phone: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(code, 10);
    await this.redis.set(`otp:${phone}`, hash, 'EX', 600);
    await this.smsService.send({ to: phone, message: `Your code:${code}` });
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const hash = await this.redis.get(`otp:${phone}`);
    if (!hash) return false;
    const valid = await bcrypt.compare(code, hash);
    if (valid) await this.redis.del(`otp:${phone}`);
    return valid;
  }
}
```

---

### ✅ Step 8 — Auth endpoints

Implement in `modules/auth/api/auth.controller.ts`:

> ⚠️ **v1.1 correction — refresh token delivery:** The refresh token is delivered and consumed via an `HttpOnly` cookie, never via the JSON response body. JavaScript cannot read or write `HttpOnly` cookies — that is the security property being used. The NestJS controller must explicitly call `response.cookie()` with the correct flags. The JSON body only ever returns `access_token`.
> 

> ⚠️ **v1.3 fix — cookie reading in /auth/refresh:** The controller must also *read* the refresh token from the cookie. This requires `cookie-parser` middleware (installed in Step 3) and accessing `request.cookies.refresh_token`. Without `cookie-parser`, `req.cookies` is `undefined`.
> 

```
POST /api/v1/auth/register
  Body: { phone_number, password, first_name, last_name, user_type }
  → user_type MUST be validated with @IsIn(['patient']) in RegisterDto — self-registration
    as 'doctor', 'admin', or 'support' is forbidden. Doctor accounts are created via
    admin-initiated invite. Admin/support accounts via internal tooling only.
  → Creates user (is_verified: false), generates OTP, queues SMS job
  → Returns 201 { message: "OTP sent" }

POST /api/v1/auth/verify-otp
  Body: { phone_number, code }
  → Verifies OTP, marks user verified
  → Returns 200 { access_token: "..." }  ← access token in body ONLY
  → Sets header: Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800

POST /api/v1/auth/login
  Body: { phone_number, password }
  → Validates credentials, checks is_verified
  → Stores bcrypt-hashed refresh token in Redis: key refresh:{user_id}, TTL 7 days.
    Store the HASH, never the raw token: `await redis.set(`refresh:${userId}`,
    await bcrypt.hash(refreshToken, 10), 'EX', 7 * 24 * 3600)`. On /auth/refresh,
    compare the incoming token against the stored hash with bcrypt.compare(). This
    ensures a Redis compromise does not expose valid session tokens.
  → Returns 200 { access_token: "..." }  ← access token in body ONLY
  → Sets Set-Cookie header (same as above)

POST /api/v1/auth/refresh
  Cookie: refresh_token=... (read from httpOnly cookie via req.cookies.refresh_token)
  → Validates token exists in Redis, rotates (delete old, store new)
  → Returns 200 { access_token: "..." } + new Set-Cookie header

POST /api/v1/auth/logout
  Header: Authorization: Bearer <access_token>
  → Deletes refresh token from Redis (key: refresh:{user_id})
  → Clears the refresh_token cookie (Set-Cookie with Max-Age=0)
  → Returns 200 { message: "Logged out" }
```

NestJS controller implementation — cookie helper:

```tsx
// auth.controller.ts

import { Controller, Post, Body, Res, Req, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Helper to set the refresh token cookie — call from login, verify-otp, and refresh.
  // Path is derived from ConfigService so it stays in sync if the global API prefix changes.
  // A hardcoded '/api/v1/auth/refresh' would break if app.setGlobalPrefix() changes.
  private setRefreshCookie(response: Response, token: string): void {
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1');
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `/${prefix}/auth/refresh`,  // cookie only sent to the refresh endpoint
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
    });
  }

  // Helper to clear the refresh token cookie on logout
  private clearRefreshCookie(response: Response): void {
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1');
    response.clearCookie('refresh_token', { path: `/${prefix}/auth/refresh` });
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };  // ResponseEnvelopeInterceptor wraps this
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // cookie-parser middleware (wired in main.ts) populates req.cookies
    const oldToken = req.cookies['refresh_token'];
    if (!oldToken) throw new UnauthorizedException('No refresh token');
    const { accessToken, refreshToken } = await this.authService.rotateRefreshToken(oldToken);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sub);
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }
}
```

---

### ✅ Step 9 — JWT guards

Implement once, never change:

```tsx
// shared/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// shared/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user.userType);
  }
}

// Usage on any endpoint:
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
@Get('doctor-only-endpoint')
```

---

### ✅ Step 10 — Auth frontend

Build three real pages (not placeholders):

**RegisterPage:** Phone input with `+261` prefix locked. Password field. On submit → `POST /auth/register` → redirect to OTP page.

**VerifyOtpPage:** Six individual digit inputs. Auto-advance to next box on keystroke. On complete → `POST /auth/verify-otp` → store `access_token` in Zustand via `useAuthStore.getState().setAuth(user, accessToken)` → redirect to dashboard.

**LoginPage:** Phone + password. On success → store the `access_token` from the response body in Zustand memory only (never `localStorage`, never `sessionStorage`). The `refresh_token` is automatically stored in the browser’s cookie jar via the `Set-Cookie` header — the frontend code does nothing to persist it. On subsequent page loads, the Axios interceptor calls `POST /auth/refresh` (the browser automatically sends the httpOnly cookie with `withCredentials: true`) to silently restore the session.

**✔ Acceptance:** Register a new account. OTP appears in API console log. Enter it. See `"Welcome, [Name]"` on the dashboard route. Refresh the page — user stays logged in (refresh token restores session).

---

## Phase 2 — Doctor Module + Search

### Week 3–4 · Goal: doctor profiles exist, patients can search and find them

---

### ✅ Step 11 — Doctor profile API

Implement CRUD for doctor profiles in `modules/doctors/`:

```
GET    /api/v1/doctors/:id           Public profile
PATCH  /api/v1/doctors/profile       Doctor updates own profile [auth: doctor]
POST   /api/v1/doctors/:id/verify    Admin marks doctor verified [auth: admin]
```

Create `DoctorRepository` with the same pattern as `AuthRepository`.

---

### ✅ Step 12 — Database seed

> ⚠️ **v1.3 fix — seed script must be configured in package.json:** `npx prisma db seed` reads the seed command from the `"prisma"` key in `apps/api/package.json`. Without it, Prisma responds with `Error: No seed script found` and exits. Also add `ts-node` as a dev dependency if not already present.
> 

Add to `apps/api/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  },
  "devDependencies": {
    "ts-node": "^10.9.0"
  }
}
```

`apps/api/prisma/seed.ts` — create 20 realistic seeded doctors:

```tsx
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed realistic data:
  // - Malagasy names (Rakoto, Randria, Rabe, etc.)
  // - Specialties in French (Cardiologie, Pédiatrie, Médecine Générale, etc.)
  // - Antananarivo coordinates (lat: -18.9, lng: 47.5 area) — inserted via $executeRaw
  // - Consultation fees in MGA as integers (50000–200000)
  // - Mix of videoConsultationEnabled: true/false

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const doctor of doctorSeedData) {
    const user = await prisma.user.create({
      data: {
        phoneNumber: doctor.phoneNumber,
        passwordHash,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        userType: 'doctor',
        isVerified: true,
        isActive: true,
      },
    });
    // Create DoctorProfile and Facility rows...
    // Use prisma.$executeRaw for geolocation insertion (PostGIS column):
    await prisma.$executeRaw`
      UPDATE doctors.facilities
      SET geolocation = ST_SetSRID(ST_MakePoint(${doctor.lng},${doctor.lat}), 4326)
      WHERE id =${facilityId}::uuid
    `;
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

```bash
npx prisma db seed
```

---

### ✅ Step 13 — Search endpoint

`GET /api/v1/doctors/search` — build this query in four incremental layers, shipping after each:

> ⚠️ **v1.1 bug fix:** `first_name` and `last_name` are on `auth.users`, not on `doctors.profiles`. Layer 2 (fuzzy name search) requires an explicit JOIN — without it the query will fail at runtime with a “column does not exist” error.
> 

> ⚠️ **v1.3 bug fix — positional parameter numbering:** Each layer below shows its parameters independently for clarity. When combining layers into a single query, parameters must be renumbered sequentially — they cannot restart at `$1` in each layer. The combined layer notes (`$N` with correct offsets) show the correct numbering for the final query.
> 

**Layer 1** (ship first) — base query with specialty filter:

```sql
-- Parameters: $1 = specialty filter, $2 = limit, $3 = offset
SELECT
  p.*,
  u.first_name,
  u.last_name,
  u.profile_photo_url
FROM doctors.profiles p
INNER JOIN auth.users u ON u.id = p.user_id
WHERE p.is_profile_live = true
  AND u.is_active = true
  AND ($1 = '' OR p.specialties @> ARRAY[$1]::text[])
ORDER BY p.average_rating DESC NULLS LAST
LIMIT $2 OFFSET $3
```

**Layer 2** — add fuzzy name search (requires JOIN already present from Layer 1):

```sql
-- New parameters: $4 = name query string
-- Add to WHERE clause (before ORDER BY):
AND ($4 = '' OR similarity(u.first_name || ' ' || u.last_name, $4) > 0.3)
-- Replace ORDER BY with:
ORDER BY
  CASE WHEN $4 != '' THEN similarity(u.first_name || ' ' || u.last_name, $4) ELSE 0 END DESC,
  p.average_rating DESC NULLS LAST
```

**Layer 3** — add PostGIS location filter:

```sql
-- New parameters: $5 = radius_km (NULL = no geo filter), $6 = lng, $7 = lat
-- Add to WHERE clause:
AND ($5 IS NULL OR ST_DWithin(
  f.geolocation::geography,
  ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
  $5 * 1000
))
-- Requires adding to FROM:
LEFT JOIN doctors.doctor_facilities df ON df.doctor_id = p.user_id
LEFT JOIN doctors.facilities f ON f.id = df.facility_id
```

**Layer 4** — add next-available-slot subquery (write this as a separate raw SQL function called via JOIN LATERAL, not inline).

> ⚠️ Write all four layers as raw SQL in a `DoctorSearchRepository` method, not Prisma ORM. Prisma cannot handle these query patterns efficiently.
> 

---

### ✅ Step 14 — Search + Doctor Profile UI

Build:

- `SearchPage`: search bar, specialty filter pills, results list with doctor cards (photo, name, specialty, next slot, fee, distance)
- `DoctorProfilePage`: full profile display, photo, bio, specialties, languages, working hours summary, rating display. No booking button yet.

**✔ Acceptance:** Searching “cardiologue” or “Rakoto” returns seeded doctors. Clicking a result shows the full profile page.

---

## Phase 3 — Scheduling Module

### Week 4–5 · Goal: doctor defines weekly schedule, patient sees available time slots

> This is the most algorithmically complex phase. The slot generation algorithm is the core of the entire product.
> 

---

### ✅ Step 15 — Weekly schedule API

Doctor-facing endpoints in `modules/scheduling/`:

```
POST   /api/v1/scheduling/templates
  Body: { day_of_week, start_time, end_time, slot_duration_minutes,
          appointment_type, buffer_minutes, effective_from, facility_id? }

GET    /api/v1/scheduling/templates      Own templates
DELETE /api/v1/scheduling/templates/:id

POST   /api/v1/scheduling/exceptions
  Body: { exception_date, exception_type, custom_start_time?,
          custom_end_time?, reason? }

GET    /api/v1/scheduling/exceptions?from=&to=
DELETE /api/v1/scheduling/exceptions/:id
```

---

### ✅ Step 16 — Slot generation algorithm

Write this as a **pure function with zero database calls**. It is the most important function in the codebase.

```tsx
// modules/scheduling/domain/slot-generator.ts

export function generateAvailableSlots(
  templates: WeeklyScheduleTemplate[],
  exceptions: ScheduleException[],
  existingAppointments: { startTime: Date; durationMinutes: number }[],
  activeSlotLocks: { slotTime: Date }[],
  dateRange: { from: Date; to: Date },
  timezone: string = 'Indian/Antananarivo',
): TimeSlot[] {
  // Algorithm:
  // 1. For each date in range:
  //    a. Find templates matching date's day_of_week
  //    b. Check for ScheduleException on this date:
  //       - 'day_off'        → skip entire date
  //       - 'custom_hours'   → use exception times instead of template
  //       - 'emergency_only' → mark slots accordingly
  //    c. Split template window into slots of slot_duration_minutes + buffer_minutes
  //    d. Remove slots that overlap with existing appointments
  //    e. Remove slots covered by active Redis locks
  //    f. Remove slots in the past or within min_advance_booking window (2h default)
  // 2. Return flat array of { startTime, endTime, appointmentType, isAvailable }
}
```

> ⚠️ **v1.5 fix — timezone arithmetic for TIME + DATE combination:** `WeeklyScheduleTemplate.start_time` is a `TIME` column (no timezone). Combining a calendar date with a local time-of-day must use explicit GMT+3 arithmetic or boundary-day slots will have the wrong day-of-week and the 2h advance-booking check will be 3 hours off. Use `luxon` for this:
>
> ```tsx
> import { DateTime } from 'luxon';
>
> // Inside the loop for each date × template pair:
> const slotStart = DateTime.fromObject(
>   { year: date.year, month: date.month, day: date.day,
>     hour: template.startTime.getUTCHours(), minute: template.startTime.getUTCMinutes() },
>   { zone: timezone },  // 'Indian/Antananarivo' (GMT+3)
> ).toUTC().toJSDate();
> ```
>
> Add `luxon` to the install list: `pnpm add luxon && pnpm add -D @types/luxon`.

**Write unit tests before writing a single integration or controller around this function:**

```tsx
// scheduling/domain/slot-generator.spec.ts
describe('generateAvailableSlots', () => {
  it('returns slots for a standard working day')
  it('returns empty array when exception_type is day_off')
  it('uses custom hours when exception_type is custom_hours')
  it('excludes slots overlapping with existing appointments')
  it('excludes slots within the min_advance_booking window')
  it('handles buffer time between slots correctly')
  it('handles date range spanning a week boundary')
  it('marks slots as unavailable when covered by active slot locks')
})
```

---

### ✅ Step 17 — Availability endpoint

```
GET /api/v1/doctors/:id/availability
  Query: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), facility_id?
  → Fetches templates + exceptions + existing appointments from DB
  → Fetches active slot locks from Redis
  → Calls generateAvailableSlots()
  → Returns: { [date: string]: TimeSlot[] }
```

> ⚠️ **v1.3 addition — cache invalidation pattern:** Step 17 in v1.2 said “Cache the response in Redis for 30 seconds” but showed no code for cache population or invalidation. A stale cache that isn’t invalidated on booking events defeats the purpose. The pattern below is required.
> 

**Cache population and invalidation in `AvailabilityService`:**

```tsx
private cacheKey(doctorId: string, startDate: string, endDate: string): string {
  return `avail:${doctorId}:${startDate}:${endDate}`;
}

async getAvailability(doctorId: string, startDate: string, endDate: string) {
  const key = this.cacheKey(doctorId, startDate, endDate);
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);

  const slots = await this.computeAvailability(doctorId, startDate, endDate);
  await this.redis.set(key, JSON.stringify(slots), 'EX', 30);
  return slots;
}

// Call this from any event handler that changes availability for a doctor:
async invalidateAvailabilityCache(doctorId: string): Promise<void> {
  const keys = await this.redis.keys(`avail:${doctorId}:*`);
  if (keys.length > 0) await this.redis.del(...keys);
}
```

Wire invalidation to domain events:

```tsx
@OnEvent('appointment.booked')
async onBooked(event: AppointmentBookedEvent) {
  await this.availabilityService.invalidateAvailabilityCache(event.doctorId);
}

@OnEvent('appointment.cancelled')
async onCancelled(event: AppointmentCancelledEvent) {
  await this.availabilityService.invalidateAvailabilityCache(event.doctorId);
}

@OnEvent('schedule.template.updated')
async onTemplateUpdated(event: ScheduleTemplateUpdatedEvent) {
  await this.availabilityService.invalidateAvailabilityCache(event.doctorId);
}
```

---

### ✅ Step 18 — Calendar slot picker UI

This is the most visible UI component. Invest time in it.

- Week view by default on mobile (7 columns, scrollable)
- Available slots shown as green buttons with time label
- Booked slots shown as grey, disabled
- Loading skeleton while fetching
- “No slots available” empty state with next-available-date suggestion
- Slot selection highlights the chosen slot and advances to Step 2 of booking

**✔ Acceptance:** Doctor sets “Tuesday 9:00–12:00, 30-min slots” via API (or Prisma Studio). Patient visits doctor profile and sees six green slot buttons under Tuesday.

---

### ✅ Step 18b — WebSocket Gateway for real-time slot availability

The spec mandates real-time slot availability via WebSocket. Without this, two patients viewing the same doctor simultaneously won’t see each other’s slot locks until they refresh. This step must be completed before Phase 4 booking.

> ⚠️ **v1.2 fix — `@types/socket.io` must NOT be installed:** Socket.io v4+ ships its own TypeScript declarations. The `@types/socket.io` package is a legacy community type stub for Socket.io v2 and is incompatible with v4 — installing it causes type conflicts and `Cannot find module` errors. Remove it entirely if present.
> 

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
# Do NOT add @types/socket.io — socket.io v4 ships its own types
```

`modules/scheduling/api/availability.gateway.ts`:

```tsx
import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// Note: process.env.FRONTEND_URL is read at class decoration time (module load), before
// DI is available. If undefined, Socket.io treats origin:undefined as origin:'*' — all
// origins permitted. The afterInit() check below catches this at startup, not at runtime.
@WebSocketGateway({
  namespace: '/availability',
  cors: { origin: process.env.FRONTEND_URL },
})
export class AvailabilityGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AvailabilityGateway.name);

  // Called immediately after the gateway is initialized — fail fast if CORS is misconfigured.
  afterInit(): void {
    if (!process.env.FRONTEND_URL) {
      throw new Error(
        'FRONTEND_URL env var is required for WebSocket CORS. Without it, Socket.io allows all origins.',
      );
    }
    this.logger.log(`AvailabilityGateway initialized. CORS origin: ${process.env.FRONTEND_URL}`);
  }

  // Patient joins a "room" for a specific doctor to receive live slot updates
  @SubscribeMessage('watch-doctor')
  handleWatch(@MessageBody() data: { doctorId: string }, @ConnectedSocket() client: Socket): void {
    client.join(`doctor:${data.doctorId}`);
  }

  @SubscribeMessage('unwatch-doctor')
  handleUnwatch(@MessageBody() data: { doctorId: string }, @ConnectedSocket() client: Socket): void {
    client.leave(`doctor:${data.doctorId}`);
  }

  // Called by SlotLockingService when a slot is locked or released
  emitSlotUpdate(doctorId: string, event: 'slot-locked' | 'slot-released', slotTime: string): void {
    this.server.to(`doctor:${doctorId}`).emit(event, { slotTime });
  }
}
```

In `SlotLockingService`, inject and call `AvailabilityGateway.emitSlotUpdate()` after every successful lock/release. In the React frontend:

```tsx
// In the slot picker component:
import { io } from 'socket.io-client';

useEffect(() => {
  const socket = io('/availability', { withCredentials: true });
  socket.emit('watch-doctor', { doctorId });
  socket.on('slot-locked',   ({ slotTime }) => markSlotUnavailable(slotTime));
  socket.on('slot-released', ({ slotTime }) => markSlotAvailable(slotTime));
  return () => { socket.disconnect(); };
}, [doctorId]);
```

**✔ Acceptance:** Open the slot picker for the same doctor in two browser tabs simultaneously. Lock a slot in Tab 1 — Tab 2 should visually grey out that slot within 1 second without any page refresh.

---

## Phase 4 — Appointment Booking

### Week 5–6 · Goal: patient completes a full booking end-to-end

---

### ✅ Step 19 — Slot locking

Two-layer locking strategy — both layers are required:

**LAYER 1: Redis lock (UX hold — “slot reserved for 10 minutes”)**

```tsx
// Returns true if lock acquired, false if slot already taken
async acquireRedisLock(doctorId: string, slotTime: Date, userId: string): Promise<boolean> {
  const key = `slot_lock:${doctorId}:${slotTime.toISOString()}`;
  const result = await this.redis.set(key, userId, 'NX', 'EX', 600);
  // 'NX' = only set if not exists; returns 'OK' on success, null if key already exists
  return result === 'OK';
}
```

> ⚠️ **v1.1 critical bug fix — wrong table for SELECT FOR UPDATE:** The original code used `SELECT FOR UPDATE` on `scheduling.weekly_templates`. This is wrong for two reasons: (1) it locks the doctor’s entire schedule template row, blocking all schedule edits during every concurrent booking; (2) it does not prevent double-booking because two concurrent requests for different template rows both succeed. The correct pattern is an `INSERT ... ON CONFLICT DO NOTHING` against `appointments.slot_locks`, which has a `UNIQUE(doctor_id, slot_time)` constraint. PostgreSQL enforces uniqueness atomically — exactly one of two concurrent inserts will succeed.
> 

**LAYER 2: PostgreSQL unique constraint (transactional integrity)**

```tsx
// The SlotLock model in schema.prisma has @@unique([doctorId, slotTime])
// This is the hard guarantee — Redis is the soft UX hold only.

async acquireDbLock(
  doctorId: string,
  slotTime: Date,
  userId: string,
  lockToken: string,
): Promise<void> {
  const result: number = await this.prisma.$executeRaw`
    INSERT INTO appointments.slot_locks (id, doctor_id, slot_time, user_id, lock_token, expires_at)
    VALUES (
      gen_random_uuid(),
${doctorId}::uuid,
${slotTime}::timestamptz,
${userId}::uuid,
${lockToken},
      NOW() + INTERVAL '10 minutes'
    )
    ON CONFLICT (doctor_id, slot_time) DO NOTHING
  `;
  // $executeRaw returns the number of rows inserted
  if (result === 0) {
    // Conflict — another user's DB lock already exists. Release our Redis lock and throw.
    await this.releaseRedisLock(doctorId, slotTime);
    throw new HttpException(
      { code: 'SLOT_ALREADY_LOCKED', message: 'This slot is currently reserved by another user.' },
      HttpStatus.CONFLICT,
    );
  }
}
```

**Combined lock flow in `SlotLockingService`:**

```tsx
async lockSlot(doctorId: string, slotTime: Date, userId: string): Promise<string> {
  // Step 1: Redis soft lock (fast, best-effort)
  const redisAcquired = await this.acquireRedisLock(doctorId, slotTime, userId);
  if (!redisAcquired) {
    throw new HttpException(
      { code: 'SLOT_ALREADY_LOCKED', message: 'This slot is currently reserved.' },
      HttpStatus.CONFLICT,
    );
  }

  // Step 2: PostgreSQL hard lock (atomic, guaranteed)
  const lockToken = randomUUID();
  await this.acquireDbLock(doctorId, slotTime, userId, lockToken);

  // Step 3: Emit real-time WebSocket update
  this.availabilityGateway.emitSlotUpdate(doctorId, 'slot-locked', slotTime.toISOString());

  // Step 4: Schedule BullMQ cleanup job for when the lock expires
  await this.slotLockQueue.add(
    'release-expired-lock',
    { doctorId, slotTime: slotTime.toISOString(), lockToken },
    { delay: 600_000 },  // 10 minutes
  );

  return lockToken;
}
```

> ⚠️ **v1.4 addition — slot-lock queue must be registered:** `SlotLockingService` injects `@InjectQueue('slot-lock')` but the queue must be registered with `BullModule.registerQueue()` in the module that provides `SlotLockingService` (the `AppointmentsModule` or `SchedulingModule`). Without this, NestJS throws `No provider for Queue(slot-lock)` at startup.
>

```tsx
// appointments.module.ts (or scheduling.module.ts — wherever SlotLockingService lives)
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'slot-lock' },
    ),
  ],
  providers: [SlotLockingService, SlotLockWorker, /* ... */],
  exports: [SlotLockingService],
})
export class AppointmentsModule {}
```

> ⚠️ **v1.5 addition — `SlotLockWorker` must be defined:** `lockSlot()` enqueues a `release-expired-lock` job but no `@Processor('slot-lock')` worker existed in previous versions. Without it BullMQ moves the job to the failed queue and the slot is never released after expiry.
>

```tsx
// appointments/infrastructure/slot-lock.worker.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('slot-lock')
export class SlotLockWorker extends WorkerHost {
  constructor(
    private readonly slotLockRepo: SlotLockRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly availabilityGateway: AvailabilityGateway,
  ) { super(); }

  async process(job: Job<{ doctorId: string; slotTime: string; lockToken: string }>): Promise<void> {
    const { doctorId, slotTime, lockToken } = job.data;
    // Returns 0 if the lock was already consumed by a successful booking — that is the happy path.
    const deleted = await this.slotLockRepo.deleteLockByToken(lockToken);
    if (deleted === 0) return;
    // Lock was not consumed — it genuinely expired. Release the Redis key and emit the slot update.
    await this.redis.del(`slot_lock:${doctorId}:${slotTime}`);
    this.availabilityGateway.emitSlotUpdate(doctorId, 'slot-released', slotTime);
  }
}
```

---

### ✅ Step 20 — Booking endpoints

> ⚠️ **v1.3 fix — atomic lock validation + delete:** The lock validation check and the `DELETE FROM slot_locks` must happen in the same database transaction. Both operations must be inside `prisma.$transaction(async (tx) => { ... })` — the **interactive callback form**. The array form `prisma.$transaction([...])` is a batch, not a true serializable transaction; mixing `tx.$queryRaw` with `tx.model.create` in the callback form guarantees they share the same connection and serialization context.
>
> ⚠️ **v1.5 addition — ownership checks required on all appointment reads/writes:** `GET /appointments/:id`, `POST /appointments/:id/cancel`, `POST /appointments/:id/reschedule` must verify `patientId === req.user.sub` (patient) or `doctorId === req.user.sub` (doctor) before returning or mutating data. This check belongs in `AppointmentService`, not the controller. Without it, any authenticated user can read or cancel any other patient's medical appointment (IDOR).
>
> ⚠️ **v1.5 addition — cancel and reschedule are separate endpoints:** They have different advance-notice windows (24h vs 48h), different required parameters, and emit different domain events. A single `PATCH /appointments/:id` cannot enforce both sets of rules simultaneously.

```
POST /api/v1/auth/resend-otp
  Body: { phone_number }
  Throttle: 3 requests per phone per hour (PhoneThrottlerGuard — see Step 33)
  → Overwrites otp:{phone} Redis key, resends SMS via SmsAdapter
  → 200 { data: { message: "OTP resent", expires_in_seconds: 600 } }

GET /api/v1/users/me
  Header: Authorization: Bearer <token>
  → Returns user profile for session restore after page refresh
  → 200 { data: { id, userType, firstName, lastName, phoneNumber, profilePhotoUrl, preferredLanguage } }

POST /api/v1/slots/lock
  Body: { doctor_id, slot_time, facility_id? }
  → Acquire Redis lock (NX)
  → Acquire DB lock (INSERT ... ON CONFLICT DO NOTHING)
  → Schedule BullMQ cleanup job (SlotLockWorker)
  → Emit slot-locked WebSocket event
  → 201 { data: { lock_token, expires_at } }

DELETE /api/v1/slots/lock/:lock_token
  → Delete from appointments.slot_locks WHERE lock_token = $1 AND user_id = $2
  → Delete Redis key
  → Emit slot-released WebSocket event
  → 204 No Content  ← DELETE with no response body returns 204, not 200

POST /api/v1/appointments
  Body: { doctor_id, facility_id?, start_time, appointment_type,
          reason_for_visit, is_first_visit, lock_token }
  → ATOMIC DB TRANSACTION (interactive callback form):
      tx.$queryRaw`DELETE FROM appointments.slot_locks
                   WHERE lock_token = ${lockToken}
                     AND user_id    = ${userId}::uuid
                     AND expires_at > NOW()
                   RETURNING id`
      -- if 0 rows → lock expired or stolen → throw ConflictException('LOCK_EXPIRED_OR_STOLEN')
      tx.appointment.create({ data: { ...appointmentData, status: 'pending_confirmation' } })
  → Delete Redis slot_lock key (best-effort, after transaction commits)
  → Publish AppointmentBooked domain event
  → 201 { data: { appointment_id, booking_reference } }
  Note: status defaults to 'pending_confirmation'. Auto-confirm (doctor preference) is a Phase 2 feature.

GET  /api/v1/appointments          List (filtered by auth user role — patient sees own, doctor sees own)
GET  /api/v1/appointments/:id      Detail — OWNERSHIP CHECK required (see note above)
POST /api/v1/appointments/:id/cancel
  Body: { reason? }
  Guard: 24-hour advance-notice check
  → OWNERSHIP CHECK: patientId === req.user.sub
  → Update status = 'cancelled', set cancellation_reason, cancelled_by
  → Publish AppointmentCancelled event (triggers reminder job cancellation — see Step 25)
  → 200

POST /api/v1/appointments/:id/reschedule
  Body: { lock_token, new_start_time }
  Guard: 48-hour advance-notice check
  → OWNERSHIP CHECK: patientId === req.user.sub
  → Atomic: delete old lock, create new appointment, release old slot
  → Publish AppointmentRescheduled event
  → 200

PATCH /api/v1/appointments/:id/status
  Body: { status: 'completed' | 'no_show' }
  Guard: @Roles('doctor') + doctorId === req.user.sub
  → 200

POST /api/v1/appointments/:id/confirm
  Guard: @Roles('doctor') + doctorId === req.user.sub
  → Update status from 'pending_confirmation' → 'confirmed'
  → Publish AppointmentConfirmed event (triggers confirmation SMS if not already sent)
  → 200

POST /api/v1/doctors/:id/reviews
  Body: { rating: 1-5, comment?: string }
  Guard: JwtAuthGuard + patient must have a completed appointment with this doctor
  → Insert review, update DoctorProfile.average_rating and total_reviews atomically
  → 201

GET /api/v1/doctors/:id/reviews
  Query: page, limit (default 20)
  → 200 { data: { items: Review[], meta: { page, total } } }
```

---

### ✅ Step 21 — Booking UI (3-step flow)

**Step 1 — Slot picker** (reuses Phase 3 calendar component)

**Step 2 — Patient details form:**

- Pre-fill all fields if user is authenticated (name, phone)
- Reason for visit dropdown + free-text
- “Is this your first visit?” checkbox
- Form validates inline (no submit-then-error)

**Step 3 — Confirmation summary:**

- Doctor photo, name, specialty
- Date, time, duration, type, location
- Fee in MGA
- “Confirm Booking” button → calls `POST /appointments` → shows BookingSuccessPage

**BookingSuccessPage:**

- Booking reference in large text (e.g. APT-2026-38291)
- “Add to calendar” link (generate `.ics` file client-side)
- “Back to search” and “View my appointments” buttons

---

### ✅ Step 22 — Patient and Doctor dashboards

**Patient dashboard:**

- Upcoming appointments list (sorted by date, with countdown “in 2 hours”)
- Past appointments with “Leave a review” and “Rebook” actions
- Quick cancel/reschedule buttons (enforce 24h rule, show error if too late)

**Doctor dashboard:**

- Today’s schedule (chronological list)
- Upcoming week summary
- Pending actions (new bookings needing confirmation)
- Quick actions: mark complete, mark no-show, add note

**✔ Acceptance:** Full end-to-end flow: search → profile → pick slot → fill form → confirm → see appointment in patient dashboard AND in doctor dashboard.

---

> ⚠️ **Waitlist System — Phase 2 deferral:** Spec §3.2.3 defines a Waitlist System (add patients to waitlist for fully booked days, auto-notify when slot opens, priority ordering). The `waitlist` table is also noted in the `appointments` schema comment. **No roadmap step implements this for MVP.** Defer to Phase 2 alongside payments and EHR Lite. Before Phase 2 begins: design the `appointments.waitlist` Prisma model, a `PatientAddedToWaitlist` domain event, and a `WaitlistNotificationJob` BullMQ worker that fires when a slot is released via `AppointmentCancelled`.

---

## Phase 5 — Notifications Module

### Week 6–7 · Goal: SMS confirmations sent, reminders scheduled, retries working

---

### ✅ Step 23 — SMS provider adapter pattern

Define the interface first — all providers implement this:

```tsx
// modules/notifications/domain/sms-provider.interface.ts
export interface SmsProvider {
  send(params: {
    to: string;        // E.164 format: +261340000000
    message: string;
  }): Promise<{
    messageId: string;
    status: 'sent' | 'failed';
    provider: string;
  }>;
}
```

Implement these providers in order:

```tsx
// infrastructure/providers/mock-sms.provider.ts
//   → console.log the SMS. Used in development + tests.

// infrastructure/providers/orange-madagascar.provider.ts
//   → Real Orange Madagascar API client

// infrastructure/providers/africas-talking.provider.ts
//   → Fallback: Africa's Talking API (better African routes than Twilio)

// infrastructure/providers/telma-sms.provider.ts   ← Phase 2 — deferred
// infrastructure/providers/airtel-madagascar.provider.ts  ← Phase 2 — deferred
// Spec §8.1 defines a 4-tier hierarchy. Telma and Airtel adapters are stubbed here but
// not wired into the factory below until Phase 2. The adapter interface ensures they can
// be added without touching business logic.
```

Provider selected by config — never `if/else` in business logic:

```tsx
// In NotificationsModule:
{
  provide: SmsProvider,
  useFactory: (config: ConfigService): SmsProvider => {
    switch (config.get('SMS_PROVIDER')) {
      case 'orange':           return new OrangeMadagascarProvider(config);
      case 'africas_talking':  return new AfricasTalkingProvider(config);
      default:                 return new MockSmsProvider();
    }
  },
  inject: [ConfigService],
}
```

---

### ✅ Step 24 — Notification queue workers

> ⚠️ **v1.3 addition — BullMQ queue registration in module:** Queues must be registered with `BullModule.registerQueue()` in the module that uses them before workers can consume them. Without this, `@InjectQueue('sms-immediate')` throws `No provider for Queue(sms-immediate)`.

> ⚠️ **v1.5 fix — BullMQ retry options belong on the job, not the Worker:** `attempts` and `backoff` are job-level options passed to `.add()`. Putting them in the Worker constructor options is silently ignored — jobs exhausted with zero retries and the on-failure handler never fires. Additionally, reminder jobs must use deterministic `jobId`s (e.g. `reminder:${appointmentId}:${offsetMs}`) so they can be retrieved by ID and cancelled when an appointment is cancelled. Without a `jobId`, `queue.getJob(id)` cannot find the job.
> 

```tsx
// notifications.module.ts
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'sms-immediate' },
      { name: 'sms-reminder' },
    ),
  ],
  providers: [NotificationService, SmsWorker, /* ... */],
})
export class NotificationsModule {}
```

Set up BullMQ queues and workers in `modules/notifications/infrastructure/`:

```tsx
// Retry options go on the JOB (.add() call), not the Worker constructor.
// Worker constructor options are for concurrency/rate-limiting, not retries.
export const SMS_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  // Retry timing: 5 s → 25 s → 125 s between attempts
};

// On exhausted retries (worker's `onFailed` or a separate failed event listener):
//   1. Log failure to notifications.notification_log (status: 'failed')
//   2. If email on file → queue email fallback job
//   3. Alert via Sentry if failure rate exceeds 10%

// In SmsWorker (implements WorkerHost from @nestjs/bullmq):
@Processor('sms-immediate')
export class SmsImmediateWorker extends WorkerHost {
  async process(job: Job<SmsJobData>): Promise<void> {
    await this.smsService.send(job.data);
    await this.notificationLogService.record({ ...job.data, status: 'sent' });
  }
}
```

**Register queue adapters for Bull Board** (back in `main.ts`, update the `createBullBoard` call once queues exist):

```tsx
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
// After injecting queue references:
createBullBoard({
  queues: [
    new BullMQAdapter(smsImmediateQueue),
    new BullMQAdapter(smsReminderQueue),
    new BullMQAdapter(slotLockQueue),
  ],
  serverAdapter,
});
```

---

### ✅ Step 25 — Domain event handlers

Wire the domain event bus in `modules/notifications/application/`:

```tsx
// AppointmentBooked event → triggers:
//   1. sms-immediate: booking confirmation SMS
//   2. sms-reminder:  three delayed reminder jobs (72h, 24h, 2h before)

@OnEvent('appointment.booked')
async handleAppointmentBooked(event: AppointmentBookedEvent): Promise<void> {
  // Confirmation SMS — fire immediately
  await this.smsImmediateQueue.add('confirmation', { appointmentId: event.appointmentId }, SMS_JOB_OPTIONS);

  const appointment = await this.appointmentService.findById(event.appointmentId);
  const msUntilAppt = appointment.startTime.getTime() - Date.now();

  // Track scheduled count. For same-day bookings (< 2h until appointment), ALL three
  // guards are false — no reminders queue. This is intentional: the confirmation SMS
  // above is the only notification for same-day bookings. Log it explicitly so ops
  // can distinguish correct behaviour from a bug.
  let queuedCount = 0;
  for (const offset of [72 * 3600_000, 24 * 3600_000, 2 * 3600_000]) {
    if (msUntilAppt > offset) {
      await this.smsReminderQueue.add(
        'reminder',
        { appointmentId: event.appointmentId, offsetMs: offset },
        {
          ...SMS_JOB_OPTIONS,
          delay: msUntilAppt - offset,
          // Deterministic jobId: enables lookup + cancellation when appointment is cancelled
          jobId: `reminder:${event.appointmentId}:${offset}`,
        },
      );
      queuedCount++;
    }
  }
  if (queuedCount === 0) {
    this.logger.log(
      `No reminders queued for appointment ${event.appointmentId} — booked less than 2h in advance. Confirmation SMS only.`,
    );
  }
}

// AppointmentCancelled event → triggers:
//   1. sms-immediate: cancellation SMS to patient
//   2. Remove all pending reminder jobs for this appointment

@OnEvent('appointment.cancelled')
async handleAppointmentCancelled(event: AppointmentCancelledEvent): Promise<void> {
  // 1. Cancellation SMS
  await this.smsImmediateQueue.add(
    'cancellation',
    { appointmentId: event.appointmentId },
    SMS_JOB_OPTIONS,
  );

  // 2. Cancel pending reminder jobs using deterministic jobIds
  // Without jobId on enqueue, getJob() returns null and reminders fire after cancellation.
  for (const offset of [72 * 3600_000, 24 * 3600_000, 2 * 3600_000]) {
    const job = await this.smsReminderQueue.getJob(`reminder:${event.appointmentId}:${offset}`);
    if (job) await job.remove();
  }
}

// AppointmentCompleted event → triggers:
//   1. sms-immediate: "Please rate Dr. X" SMS with link
```

SMS templates loaded from i18n files (never hardcoded in service logic):

`apps/api/src/shared/i18n/fr.sms.json`:

```json
{
  "appointment.confirmation": "Confirmation: RDV avec Dr. {{doctorName}}\nLe {{date}} à {{time}}\nLieu: {{clinic}}, {{address}}\nRéf: {{ref}}\nRépondre STOP pour se désabonner",
  "appointment.reminder_24h": "Rappel: RDV demain avec Dr. {{doctorName}} à {{time}} - {{clinic}}\nRépondre C pour annuler\nRéf: {{ref}}",
  "appointment.reminder_72h": "Rappel: RDV dans 3 jours avec Dr. {{doctorName}} le {{date}} à {{time}}\nRéf: {{ref}}",
  "appointment.reminder_2h": "Rappel: RDV dans 2 heures avec Dr. {{doctorName}} à {{time}}\nLieu: {{address}}\nRéf: {{ref}}",
  "appointment.cancellation": "RDV annulé: Dr. {{doctorName}} le {{date}} à {{time}}\nRéf: {{ref}}",
  "appointment.review_request": "Comment s'est passé votre RDV avec Dr. {{doctorName}}? Laissez un avis: {{reviewUrl}}"
}
```

`apps/api/src/shared/i18n/mg.sms.json`:

```json
{
  "appointment.confirmation": "Fanamafisana: Fihaonana amin'ny Dr. {{doctorName}}\nFady {{date}} amin'ny {{time}}\nToerana: {{clinic}}, {{address}}\nRef: {{ref}}\nValio STOP hanafoana",
  "appointment.reminder_24h": "Tsahivina: Fihaonana rahampitso amin'ny Dr. {{doctorName}} amin'ny {{time}} - {{clinic}}\nValio C hanafoana\nRef: {{ref}}",
  "appointment.cancellation": "Nafoanana: Dr. {{doctorName}} ny {{date}} amin'ny {{time}}\nRef: {{ref}}"
}
```

In `NotificationService`, select the template file based on the patient’s `preferred_language` field. Fall back to French if a Malagasy template key is missing.

---

### ✅ Step 26 — Notification log

> ⚠️ **v1.5 addition — `bullmq_job_id` field:** The notification log must store the BullMQ job ID at enqueue time. This is required to correlate log entries with queued jobs for observability (visible in Bull Board) and to support cancellation auditing (confirm the job was removed when appointment was cancelled).

Every SMS attempt (success or failure) logged to `notifications.notification_log`:

```tsx
{
  id, appointment_id, notification_type,
  recipient_phone, message_body,
  provider_used, provider_message_id,
  status: 'queued' | 'sent' | 'delivered' | 'failed',
  attempt_count, last_attempt_at,
  bullmq_job_id,   // TEXT — stored at enqueue time; null for immediate jobs with auto-generated IDs
  created_at
}
```

**✔ Acceptance:** Book an appointment. See three delayed jobs in BullMQ board at `localhost:3000/admin/queues` (BullMQ board runs inside the NestJS process — not a separate container or port). Switch `SMS_PROVIDER=mock` and see the confirmation SMS text in the API console log immediately.

---

## Phase 6 — CI/CD + Cloud Deployment

### End of Week 7 · Goal: app live on HTTPS, deploys on every push to main

> This is the first time you create any cloud infrastructure. Not before.
> 

---

### ✅ Step 27 — GitHub Actions CI pipeline

`.github/workflows/ci.yml` — runs on every pull request:

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        # CRITICAL: --maxmemory-policy noeviction is a Redis server arg.
        # It MUST go in `command:`, not `options:`. The `options:` field is for
        # Docker container args (health checks, etc.) — Redis server args in
        # `options:` are silently ignored, leaving allkeys-lru as the policy,
        # which causes BullMQ jobs to be evicted under memory pressure.
        command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v3
        with:
          version: 10   # Must match the version in the repo (check engines.pnpm in root package.json)
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          REDIS_PASSWORD: ""
          JWT_SECRET: test-secret
          SMS_PROVIDER: mock
          NODE_ENV: test
      - run: pnpm turbo build
```

`.github/workflows/deploy.yml` — runs on push to `main`:

> ⚠️ **v1.1 addition:** The original workflow was missing DigitalOcean Container Registry authentication. Without `doctl registry login`, `docker push` will fail with an authentication error. Also: `docker compose exec api npx prisma migrate deploy` requires `prisma` to be installed in the production image — use the `prisma` binary from `node_modules/.bin/prisma` or include a dedicated `migrate` service. The corrected workflow is below.

> ⚠️ **v1.5 fix — deploy must gate on CI success:** Triggering deploy on `push: branches: [main]` runs the deploy workflow in parallel with the CI workflow — a broken push deploys before tests have even run. Use `workflow_run` to make the deploy wait for the CI workflow to succeed first. Without this, a failing test suite on main can push broken code to production.

```yaml
name: Deploy
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

env:
  REGISTRY: registry.digitalocean.com
  REPO: ${{ secrets.DO_REGISTRY_NAME }}

jobs:
  deploy:
    # Only run if the triggering CI workflow succeeded
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}

      - name: Log in to DO Container Registry
        run: doctl registry login --expiry-seconds 600

      - name: Build and push Docker image
        run: |
          docker build \
            --build-arg NODE_ENV=production \
            -t $REGISTRY/$REPO/api:$GITHUB_SHA \
            -t $REGISTRY/$REPO/api:latest \
            ./apps/api
          docker push $REGISTRY/$REPO/api:$GITHUB_SHA
          docker push $REGISTRY/$REPO/api:latest

      - name: Deploy to Droplet via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: deploy
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/madagascar-health
            docker compose -f docker-compose.prod.yml pull api
            # Run migrations BEFORE swapping the container
            docker compose -f docker-compose.prod.yml run --rm api \
              ./node_modules/.bin/prisma migrate deploy
            docker compose -f docker-compose.prod.yml up -d --no-deps --remove-orphans api
            docker image prune -f

# Required GitHub Secrets (set in repo Settings → Secrets):
# DO_API_TOKEN      — DigitalOcean Personal Access Token
# DO_REGISTRY_NAME  — Container Registry name (e.g. "madagascar-health")
# DROPLET_IP        — Production Droplet IP address
# DEPLOY_SSH_KEY    — Private SSH key for the deploy user on the Droplet

```

---

### ✅ Step 28 — DigitalOcean provisioning

Create resources in this exact order:

```
1. DigitalOcean project: "madagascar-health-production"
2. Managed PostgreSQL cluster
   - Plan: Basic, 1 GB RAM, 1 vCPU (~$50/month)
   - Region: Frankfurt (fra1) — closest DO region to Madagascar
   - Enable: automated daily backups, connection pooling (PgBouncer)
3. Droplet (app server)
   - Plan: 4 vCPU / 8 GB RAM (~$80/month)
   - OS: Ubuntu 22.04 LTS
   - Same region as database
   - SSH key: your deploy key
4. Spaces bucket (object storage)
   - Name: madagascar-health-prod
   - Access: Private
   - CDN: Enabled
5. Container Registry
   - For storing Docker images
```

**Terraform — provision resources as code** (the `infra/terraform/` stub from Step 1, now populated):

> ⚠️ **v1.3 fix — Terraform S3 backend requires DO Spaces credentials:** The `backend "s3"` block uses DigitalOcean Spaces as the state store, which uses an S3-compatible API. `terraform init` authenticates with the Spaces API key — not your DO personal access token. You must set these as environment variables before running `terraform init` or it will fail with `No valid credential sources found`.
> 

```bash
# Create a DO Spaces access key at: cloud.digitalocean.com → Spaces → Manage Keys
export AWS_ACCESS_KEY_ID=<your-spaces-access-key>
export AWS_SECRET_ACCESS_KEY=<your-spaces-secret-key>

# Create the tfstate bucket MANUALLY first (chicken-and-egg: Terraform can't create its own state bucket)
# Then:
cd infra/terraform
terraform init
terraform plan
terraform apply
```

`infra/terraform/main.tf`:

```hcl
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
  backend "s3" {
    endpoint = "fra1.digitaloceanspaces.com"
    region   = "us-east-1"  # DO Spaces requires this value literally
    bucket   = "madagascar-health-tfstate"
    key      = "prod/terraform.tfstate"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    # Credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars (DO Spaces keys)
  }
}

variable "do_token" {}
variable "ssh_fingerprint" {}

provider "digitalocean" { token = var.do_token }

resource "digitalocean_droplet" "app" {
  name     = "madagascar-health-app"
  region   = "fra1"
  size     = "s-4vcpu-8gb"
  image    = "ubuntu-22-04-x64"
  ssh_keys = [var.ssh_fingerprint]
  tags     = ["madagascar-health", "production"]
}

resource "digitalocean_database_cluster" "postgres" {
  name       = "madagascar-health-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = "fra1"
  node_count = 1
}

resource "digitalocean_spaces_bucket" "storage" {
  name   = "madagascar-health-prod"
  region = "fra1"
  acl    = "private"
}

resource "digitalocean_container_registry" "registry" {
  name                   = "madagascar-health"
  subscription_tier_slug = "starter"
}
```

Store `do_token` and `ssh_fingerprint` in `terraform.tfvars` — **git-ignored**. Never hardcode credentials.

**Droplet setup** (SSH in as root and run once):

> ⚠️ **v1.3 fix — deploy user creation:** The CI workflow connects as the `deploy` user (`username: deploy`) and Step 28 runs `chown deploy:deploy /opt/madagascar-health`. Neither creates the `deploy` user. Without this user, `ssh deploy@<ip>` fails with `Permission denied`. Create and configure the user before any CI run.
> 

```bash
# Create the deploy user
useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/   # copy root's authorized keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy   # allow deploy to run docker without sudo

# Install Nginx + certbot
apt install -y nginx certbot python3-certbot-nginx

# Create app directory
mkdir -p /opt/madagascar-health
chown deploy:deploy /opt/madagascar-health

# Switch to deploy user and test docker access
su - deploy -c "docker info"

# Copy docker-compose.prod.yml and .env.production (never via git — use scp)
# Then:
docker compose -f /opt/madagascar-health/docker-compose.prod.yml up -d
```

> ⚠️ **v1.2 fix — Nginx WebSocket headers missing:** Without `Upgrade` and `Connection` headers, Nginx drops WebSocket upgrade requests. Socket.io silently falls back to long-polling or fails entirely. These headers are mandatory for the real-time slot availability feature.
> 

Nginx config at `/etc/nginx/sites-available/api.yourdomain.com`:

```
server {
  server_name api.yourdomain.com;

  location / {
    proxy_pass         http://localhost:3000;
    proxy_http_version 1.1;

    # Required for WebSocket (Socket.io) upgrade
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";

    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    # Prevent Nginx from closing idle WebSocket connections
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
  }
}
```

```bash
certbot --nginx -d api.yourdomain.com   # free Let's Encrypt SSL
```

**`docker-compose.prod.yml`** (copy to `/opt/madagascar-health/` on the Droplet via SCP — never via git):

```yaml
services:
  api:
    image: registry.digitalocean.com/madagascar-health/api:latest
    restart: unless-stopped
    ports: ["3000:3000"]
    env_file: .env.production
    environment:
      NODE_ENV: production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    # No port exposed externally — only accessible within Docker network
    volumes:
      - redis_data:/data
    # CRITICAL: noeviction prevents BullMQ job data from being silently evicted.
    # allkeys-lru (the default) would evict active job data under memory pressure
    # with no error — appointments would lose SMS reminders silently.
    # noeviction returns a hard OOM error instead, which is detectable and alertable.
    # Monitor Redis memory via Grafana and scale before approaching maxmemory limit.
    # v1.3 fix: added --requirepass for defense-in-depth. Set REDIS_PASSWORD in .env.production.
    command: >
      redis-server
      --appendonly yes
      --maxmemory 512mb
      --maxmemory-policy noeviction
      --requirepass ${REDIS_PASSWORD}

    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s

volumes:
  redis_data:

```

Note: PostgreSQL is **not** in the production compose file — it runs as a DigitalOcean Managed Database (external connection string in `.env.production`).

---

### ✅ Step 29 — Production smoke test checklist

Run this checklist manually after every first deploy to a new environment:

- [ ]  `GET https://api.yourdomain.com/health` returns 200
- [ ]  Register a new patient account via the API
- [ ]  OTP appears in production logs (SMS_PROVIDER=mock initially)
- [ ]  Verify OTP → access token returned in body; refresh_token Set-Cookie header present
- [ ]  Create a doctor profile via API
- [ ]  Search returns the doctor
- [ ]  Book an appointment
- [ ]  Three reminder jobs visible in BullMQ board at `/admin/queues`
- [ ]  HTTPS certificate valid (no browser warning)
- [ ]  Database migrations applied cleanly (`prisma migrate status`)
- [ ]  WebSocket connection succeeds (open slot picker, check Network tab for `101 Switching Protocols`)

**✔ Acceptance:** All checklist items pass. App is live. Subsequent pushes to `main` auto-deploy within 3 minutes.

---

## Phase 7 — Video Consultation

### Week 8–9 · Goal: doctor and patient can conduct a real-time video call

---

### ✅ Step 30 — Jitsi Meet server

Provision a **separate** Droplet (2 vCPU / 4 GB, ~$40/month). Jitsi’s quick install targets Debian/Ubuntu:

```bash
# Ubuntu 22.04 — use the modern apt key method (apt-key is deprecated)
curl -fsSL https://download.jitsi.org/jitsi-key.gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/jitsi-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/" \
  > /etc/apt/sources.list.d/jitsi-stable.list
apt-get update && apt-get install -y jitsi-meet

# Configure domain: video.yourdomain.com
# certbot auto-configures SSL during the Jitsi install wizard
# Test: open https://video.yourdomain.com in two browser tabs → call should work
```

Enable JWT room authentication in Jitsi config (prevents unauthorized room access):

```
# /etc/prosody/conf.d/video.yourdomain.com.cfg.lua
# Set app_id and app_secret — used by your API to sign room tokens
```

> ⚠️ Do NOT install Jibri (call recording) at this stage. It requires an additional VM and significant configuration. Deferred to Phase 2 per spec.
> 

---

### ✅ Step 31 — Video module API

> ⚠️ **v1.3 fix — jsonwebtoken package never installed:** Step 31 signs JWT tokens for Jitsi room access using the Jitsi `app_secret`, but no signing library was ever installed. Add the install before writing the service.
> 

```bash
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

```tsx
// POST /api/v1/consultations/:appointmentId/start  [auth: doctor]
//   → Validates appointment is confirmed and within 15 min of start time
//   → Generates non-guessable room name: crypto.randomUUID()
//   → Signs JWT for doctor (role: moderator) using Jitsi app_secret
//   → Creates video.sessions row (room_name, started_at)
//   → Publishes VideoSessionStarted domain event → Analytics (record session start)
//   → Returns { room_url: "https://video.yourdomain.com/{room_name}",
//               token: "...", room_name: "..." }

import * as jwt from 'jsonwebtoken';

function signJitsiToken(roomName: string, role: 'moderator' | 'participant', config: ConfigService): string {
  return jwt.sign(
    {
      context: { user: { name: 'Dr. Name' } },
      aud: 'jitsi',
      iss: config.get('JITSI_APP_ID'),
      sub: config.get('JITSI_DOMAIN'),
      room: roomName,
      moderator: role === 'moderator',
    },
    config.get('JITSI_APP_SECRET'),
    { expiresIn: '2h' },
  );
}

// GET /api/v1/consultations/:appointmentId/join  [auth: patient]
//   → Validates patient is participant of this appointment
//   → Validates session exists (doctor has started)
//   → Signs JWT for patient (role: participant)
//   → Returns { room_url, token }

// POST /api/v1/consultations/:appointmentId/end  [auth: doctor]
//   → Records ended_at, computes duration_minutes
//   → Publishes VideoSessionCompleted domain event
//   → VideoSessionCompleted → Analytics (record) + Notifications (send prescription prompt)
```

---

### ✅ Step 32 — Video UI

**Pre-call checklist page (patient and doctor):**

- Camera permission check (`navigator.mediaDevices.getUserMedia`)
- Microphone permission check
- Browser compatibility check (WebRTC support)
- Network quality indicator
- “Everything looks good — Join Call” button

**In-call UI:**

- Embed Jitsi in an `<iframe>` using the [Jitsi Meet IFrame API](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe) — no need to build custom WebRTC UI
- Doctor controls panel alongside iframe: timer, notes field, “End Consultation” button
- Patient controls: audio-only toggle, “Leave” button

**Post-call:**

- Doctor sees “Consultation complete” with duration displayed
- Follow-up booking suggestion shown to patient

**✔ Acceptance:** Doctor clicks “Start Consultation” in dashboard. Patient receives SMS with join link. Both join and can see/hear each other. Doctor ends call. Duration is recorded.

---

## Phase 8 — Security Hardening & Launch Prep

### Week 9–10 · Goal: production-ready security posture, performance baseline, monitoring live

---

### ✅ Step 33 — Rate limiting

> ⚠️ **v1.2 fix — two corrections:** (1) `ThrottlerStorageRedisService` is **not** exported from `@nestjs/throttler` — it lives in a separate community package `@nest-lab/throttler-storage-redis`. Using the wrong import causes a runtime crash. (2) In `@nestjs/throttler` v5+, `ttl` is in **milliseconds**, not seconds. `{ ttl: 60, limit: 100 }` creates a 60ms window. Use `{ ttl: 60_000, limit: 100 }` for 1 minute.
> 

```bash
pnpm add @nestjs/throttler @nest-lab/throttler-storage-redis
```

`ThrottlerModule` is already wired in `AppModule` in Step 3b. Apply per-route overrides for stricter limits:

```tsx
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// Override globally for sensitive routes:
@Throttle({ default: { ttl: 60_000, limit: 10 } })   // 10/min on auth routes
@Post('login')
async login() {}

@Throttle({ default: { ttl: 3_600_000, limit: 3 } }) // 3/hour on OTP request (matches resend-otp)
@Post('request-otp')
async requestOtp() {}

// verify-otp MUST be throttled to prevent OTP brute force.
// A 6-digit OTP has 1,000,000 combinations — unthrottled, an attacker can
// exhaust the space in seconds. IP-based throttling is insufficient because
// Madagascar carriers (Orange, Telma) use carrier-grade NAT — thousands of
// users share one IP. Use PhoneThrottlerGuard (keyed on phone_number in body).
@UseGuards(PhoneThrottlerGuard)
@Throttle({ default: { ttl: 600_000, limit: 5 } })   // 5 attempts per phone per 10 minutes
@Post('verify-otp')
async verifyOtp() {}
```

`PhoneThrottlerGuard` — keys the throttle on the phone number in the request body instead of the client IP:

```tsx
// auth/api/guards/phone-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class PhoneThrottlerGuard extends ThrottlerGuard {
  // Override the tracker key: use phone_number from request body, not IP.
  // This survives carrier-grade NAT where many users share the same IP.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.body?.phone_number ?? req.ip;
  }
}
```

---

### ✅ Step 34 — Security audit checklist

Run through this before any public launch:

- [ ]  All DTOs have `class-validator` decorators — no unvalidated inputs
- [ ]  Parameterized queries everywhere — run `grep -rn ‘\`.*${‘ src/` and audit every hit for SQL injection risk
- [ ]  `$queryRawUnsafe` banned — add to CI: `grep -rn ‘\$queryRawUnsafe’ apps/api/src/ && exit 1`. All dynamic queries must use `$queryRaw` with Prisma’s tagged template literal, which parameterizes automatically
- [ ]  IDOR checks on all patient-scoped endpoints — `patientId` in DB row must equal `req.user.sub`; add `appointmentRepo.findOneByIdAndPatient(id, userId)` pattern and verify the check exists in every appointment controller method
- [ ]  `helmet()` middleware enabled in `main.ts` (sets X-Frame-Options, CSP, HSTS, etc.)
- [ ]  CORS configured to allow only your frontend domains (`app.enableCors` in `main.ts`)
- [ ]  No secrets in git: `git grep -iE "password|secret|apikey|token" -- ‘*.ts’ ‘*.json’`
- [ ]  PII scrubbed from logs and Sentry — configure `beforeSend` in Sentry to strip `phone_number`, `otp`, `password`, `refresh_token` fields from breadcrumbs and event data; verify that NestJS logger does not print request bodies on auth routes
- [ ]  Admin controller has application-level guard — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(‘admin’)` on the controller class (not just individual methods); Nginx IP allowlist alone is not sufficient defense-in-depth
- [ ]  All S3/Spaces objects served via pre-signed URLs (no public bucket access)
- [ ]  Admin routes behind IP allowlist in Nginx
- [ ]  SSH password auth disabled on all Droplets (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ]  `pnpm audit` passes with no critical vulnerabilities
- [ ]  Sentry source maps uploaded (stack traces readable in production)
- [ ]  Redis protected with `-requirepass` in production (set in `docker-compose.prod.yml`)

---

### ✅ Step 35 — Performance baseline with k6

> ⚠️ **v1.3 fix — k6 script had no actual HTTP calls:** The previous script only contained comments where requests should have been. A k6 script with no `http.*` calls runs instantly and reports 0 requests — the test passes vacuously. The implementation below includes real HTTP calls across the full booking flow.
> 

```jsx
// infra/k6/booking-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'https://api.yourdomain.com/api/v1';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up to 100 VUs
    { duration: '5m', target: 100 },   // hold at 100 VUs
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95th percentile under 500ms
    'http_req_failed': ['rate<0.01'],    // less than 1% errors
  },
};

export default function () {
  // Step 1: Search for doctors
  const searchRes = http.get(
    `${BASE_URL}/doctors/search?specialty=M%C3%A9decine+G%C3%A9n%C3%A9rale&limit=10`,
    { tags: { name: 'doctor-search' } },
  );
  check(searchRes, { 'search 200': (r) => r.status === 200 });

  if (searchRes.status !== 200) return;
  const doctors = searchRes.json('data.items');
  if (!doctors || doctors.length === 0) return;
  const doctorId = doctors[0].id;

  sleep(1);

  // Step 2: Get doctor availability
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0];
  const availRes = http.get(
    `${BASE_URL}/doctors/${doctorId}/availability?start_date=${today}&end_date=${nextWeek}`,
    { tags: { name: 'availability' } },
  );
  check(availRes, { 'availability 200': (r) => r.status === 200 });

  sleep(1);

  // Step 3: Lock a slot (requires auth — use a pre-seeded test token)
  const token = __ENV.TEST_AUTH_TOKEN;
  if (!token) return;

  const slots = Object.values(availRes.json('data') || {}).flat();
  if (!slots.length) return;
  const slotTime = slots[0].startTime;

  const lockRes = http.post(
    `${BASE_URL}/slots/lock`,
    JSON.stringify({ doctor_id: doctorId, slot_time: slotTime }),
    // v1.5 fix: previously the `headers` object was missing its closing `}`,
    // and `tags` was passed as a second params argument (invalid). Both must
    // be top-level properties of the single params object.
    {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      tags: { name: 'slot-lock' },
    },
  );
  check(lockRes, { 'lock 201 or 409': (r) => r.status === 201 || r.status === 409 });

  sleep(1);
}
```

```bash
# Provide a valid JWT for authenticated steps
k6 run infra/k6/booking-flow.js \
  --env BASE_URL=https://api.yourdomain.com \
  --env TEST_AUTH_TOKEN=<valid-patient-jwt>
```

Fix any query that shows up in slow query logs during the k6 run. Check `pg_stat_statements` for missing indexes.

---

### ✅ Step 36 — Monitoring setup

**Sentry (errors):**

```tsx
// apps/api — install @sentry/nestjs (or @sentry/node for NestJS)
// Init in main.ts BEFORE NestFactory.create():
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });

// apps/web — @sentry/react
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE });
```

**Grafana Cloud (metrics + logs):**

> ⚠️ **v1.2 fix — Grafana Agent → Grafana Alloy:** Grafana Agent was replaced by **Grafana Alloy** (announced 2024, Agent deprecated). The old `grafana/agent` download URL returns 404 for new installs. Use Alloy.
> 

> ⚠️ **v1.3 addition — Grafana Alloy config example:** The v1.2 roadmap referenced `/etc/alloy/config.alloy` but showed no content for it. Without a config, Alloy starts and collects nothing. The minimal config below scrapes Docker container metrics and ships stdout logs to Grafana Loki.
> 

```bash
# Install Grafana Alloy on the Droplet:
curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
  > /etc/apt/sources.list.d/grafana.list
apt-get update && apt-get install -y alloy
systemctl enable alloy && systemctl start alloy
```

`/etc/alloy/config.alloy` — minimal config for metrics + logs to Grafana Cloud:

```
// Replace <GRAFANA_CLOUD_*> with values from your Grafana Cloud stack settings

// Scrape Docker container metrics
// ⚠️ Docker metrics are NOT exposed by default. Before this works, enable the Docker metrics endpoint:
// Add to /etc/docker/daemon.json: { "metrics-addr": "127.0.0.1:9323", "experimental": true }
// Then: systemctl restart docker
prometheus.scrape "docker" {
  targets = [{ __address__ = "localhost:9323" }]  // Docker metrics endpoint
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = "https://prometheus-prod-<id>.grafana.net/api/prom/push"
    basic_auth {
      username = "<GRAFANA_CLOUD_METRICS_USER>"
      password = "<GRAFANA_CLOUD_API_KEY>"
    }
  }
}

// Ship Docker stdout logs to Loki
loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = []
  forward_to = [loki.write.grafana_cloud.receiver]
}

loki.write "grafana_cloud" {
  endpoint {
    url = "https://logs-prod-<id>.grafana.net/loki/api/v1/push"
    basic_auth {
      username = "<GRAFANA_CLOUD_LOGS_USER>"
      password = "<GRAFANA_CLOUD_API_KEY>"
    }
  }
}
```

**BetterUptime (uptime):**

- HTTP monitor on `GET /health` every 3 minutes
- Alert: email + Telegram if down for 2 consecutive checks

**Alerts to configure:**

- API 5xx error rate > 5% for 5 minutes → Sentry alert
- DB connection pool > 80% utilised → Grafana alert
- SMS delivery failure rate > 10% → custom metric from `notification_log`
- Disk usage > 80% → Grafana alert
- Droplet CPU > 90% for 10 minutes → Grafana alert
- Redis memory > 70% of maxmemory → Grafana alert (early warning before OOM threshold)

---

### ✅ Step 37 — Doctor onboarding + admin panel

> ⚠️ **v1.5 fix — admin controller must have an application-level guard:** The admin endpoints were listed without a guard decorator. An Nginx IP allowlist is a network-level control only — any request that reaches the NestJS process (e.g., from within the Docker network, or if Nginx is misconfigured) would have unrestricted access. The controller class must carry `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` so that even internal requests require a valid admin JWT.

Build a minimal admin UI (simple HTML table, no fancy design needed):

```tsx
// admin/api/admin-doctors.controller.ts
@Controller('admin/doctors')
@UseGuards(JwtAuthGuard, RolesGuard)  // Application-level guard — required on the class, not just methods
@Roles('admin')
export class AdminDoctorsController {
  // ...
}
```

```
GET  /api/v1/admin/doctors/pending    List unverified doctor registrations
POST /api/v1/admin/doctors/:id/verify Approve → publishes DoctorVerified event → sets is_profile_live = true
POST /api/v1/admin/doctors/:id/reject Reject with reason
```

Doctor onboarding checklist (enforced in registration flow):

- Medical council registration number (required, displayed on profile)
- Valid government-issued ID photo
- Professional photo
- At least one specialty
- Consultation fee set
- At least one facility linked

**✔ Acceptance:** k6 p95 < 500ms. Sentry receives a test error. Grafana dashboard shows request metrics. Doctor can register and get approved through the admin panel.

---

## Phase 9 — Mobile Application

### Week 10–12 · Goal: iOS and Android apps with full booking parity

---

### ✅ Step 38 — Extract shared API client package

Before starting React Native, extract the API client from the web app into a shared package:

```bash
# packages/api-client/
# → Move all files from apps/web/src/api/ here
# → Update imports in apps/web to use @madagascar-health/api-client
# → apps/mobile will import the same package
```

This means you write zero API integration code twice.

---

### ✅ Step 39 — React Native scaffold

> ⚠️ **v1.3 fix — `npx react-native init` is deprecated:** As of React Native 0.73+, the `init` command was removed from the `react-native` package and moved to `@react-native-community/cli`. Running `npx react-native init` will either fail or create a project with an outdated template. Use the community CLI directly.
> 

```bash
cd apps/mobile
npx @react-native-community/cli init MadagascarHealth --template react-native-template-typescript
pnpm add @react-navigation/native @react-navigation/stack
pnpm add react-native-safe-area-context react-native-screens
pnpm add @react-native-async-storage/async-storage
pnpm add react-native-permissions
pnpm add @notifee/react-native   # local notification display
pnpm add @react-native-firebase/app @react-native-firebase/messaging   # FCM receipt (required by @notifee)
pnpm add react-native-geolocation-service   # GPS for "Near Me" search
pnpm add react-native-biometrics   # Face ID / fingerprint login
```

Implement features in this order (matches launch criticality):

```
1. Auth (login, register, OTP input with 6-box UI)
2. Doctor search with native GPS (react-native-geolocation-service)
3. Doctor profile + slot picker calendar
4. Booking flow (same 3 steps as web)
5. Patient dashboard
6. Push notifications (FCM for Android, APNs for iOS)
7. Video consultation (WebView pointing at Jitsi URL — no native WebRTC needed)
8. Biometric login (Face ID / fingerprint via react-native-biometrics)
```

---

### ✅ Step 40 — Push notification backend

> ⚠️ **v1.3 addition — Firebase Admin service account setup:** `firebase-admin` requires a service account JSON file to authenticate with FCM. Hardcoding the JSON file path is fragile in containers. The secure pattern is to base64-encode the JSON and provide it as an environment variable, then decode it at runtime.
> 

```bash
pnpm add firebase-admin  # in apps/api
```

Secure credential injection in `.env.production`:

```bash
# Download service account JSON from Firebase Console → Project Settings → Service Accounts
# Then encode: base64 -w 0 serviceAccount.json
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded-service-account-json>
```

In the NestJS app:

```tsx
import * as admin from 'firebase-admin';

// In NotificationsModule initialisation (or a dedicated PushModule):
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
```

```tsx
// Add device token registration endpoint:
// POST /api/v1/notifications/device-token
//   Body: { token: string, platform: 'ios' | 'android' }
//   → Store in notifications.device_tokens table (user_id, token, platform, updated_at)
//   → Upsert on (user_id, platform) — one token per platform per user

// Extend NotificationService to send push alongside SMS:
if (user.deviceToken) {
  await admin.messaging().send({
    token: user.deviceToken,
    notification: { title: 'Rappel RDV', body: 'Votre RDV est dans 2 heures' },
  });
}
```

**✔ Acceptance:** Full booking flow works on a physical iOS and Android device. Push notification arrives 2 hours before a test appointment.

---

## Phase 10 — Mobile Money Payments

### Week 12+ · Only begin after 4+ weeks of live usage data

> Do not start this phase until the core booking flow has been live for at least 4 weeks. Real user data will reveal payment UX requirements you cannot anticipate today.
> 

---

### ✅ Step 41 — Payment provider adapter pattern

```tsx
// modules/payments/domain/mobile-money-provider.interface.ts
export interface MobileMoneyProvider {
  initiatePayment(params: {
    amountMga: number;       // integer — Ariary, never float
    customerPhone: string;
    reference: string;       // appointment booking_reference
    description: string;
  }): Promise<{ transactionId: string; paymentUrl?: string; ussdCode?: string }>

  checkStatus(transactionId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    completedAt?: Date;
  }>

  handleWebhook(payload: unknown, signature: string): PaymentWebhookEvent
}
```

Implement in order: `OrangeMoneyProvider` first (largest user base), then `MVolaProvider` (Telma), then `AirtelMoneyProvider`.

---

### ✅ Step 42 — Payment flow

```
1. At booking confirmation:
   → Show "Pay now" (mobile money) or "Pay at clinic" options
   → "Pay now" → POST /api/v1/payments/initiate
      → Returns USSD code (*144*...) or redirect URL
   → Patient completes payment on their phone

2. Payment webhook received from Orange/MVola:
   → POST /api/v1/payments/webhook/:provider
   → Verify signature
   → Update appointment.payment_status → 'paid'
   → Publish PaymentCompleted domain event
   → PaymentCompleted → Notifications (send receipt SMS)

3. Timeout (no payment in 15 minutes):
   → BullMQ delayed job cancels appointment
   → Releases slot lock
   → Sends SMS: "Payment not received, booking cancelled. Book again at..."
```

**✔ Acceptance:** End-to-end payment tested with Orange Money sandbox. Appointment status updates to `paid` on successful payment. Slot is released on payment timeout.

---

## 📋 Day 1 checklist

If you start tomorrow, do exactly these steps in order:

- [ ]  Create GitHub repository, invite team
- [ ]  `pnpm init` + Turborepo at root; create `pnpm-workspace.yaml` (NOT in `package.json`)
- [ ]  Write `turbo.json` with `"tasks"` key (NOT `"pipeline"` — Turborepo v2 breaking change)
- [ ]  Write `docker-compose.yml` (postgis, redis with `noeviction`, api stub, web stub — no bull-board container)
- [ ]  Write `docker-compose.test.yml` (postgres-test on 5433, redis-test on 6380, both with `noeviction`, test DB on tmpfs)
- [ ]  Write `infra/docker/init-schemas.sql` (7 schemas + 3 extensions)
- [ ]  Scaffold NestJS in `apps/api` — install all packages from Step 3 (including `cookie-parser`, `helmet`, `@nestjs/event-emitter`)
- [ ]  Wire `ConfigModule`, `RedisModule`, `BullModule`, `EventEmitterModule` in `AppModule` (Step 3b)
- [ ]  Wire `cookieParser()`, `helmet()`, `enableCors()`, global interceptor + exception filter in `main.ts`
- [ ]  Scaffold React + Vite in `apps/web` — route skeleton, Tailwind, authStore, Axios client with refresh interceptor
- [ ]  `docker compose up` — everything green
- [ ]  Write the full Prisma schema (`prisma/schema.prisma`) — all entities from spec Section 5
- [ ]  Add Prisma seed config to `apps/api/package.json`
- [ ]  `npx prisma migrate dev --name init` — verify in Prisma Studio
- [ ]  Commit: `feat: project foundation — monorepo, docker compose, prisma schema`

That is a complete, working foundation. Every developer on the team can now clone and run `docker compose up` and be fully operational.

---

## 🏁 Summary timeline

| Milestone | Week | What you have |
| --- | --- | --- |
| Foundation complete | 2 | Local stack runs in one command |
| Auth working | 3 | Register + OTP + JWT |
| Doctors searchable | 4 | Search returns real results |
| Slots visible | 5 | Doctor sets schedule, patient sees slots |
| Booking works | 6 | Full end-to-end booking flow |
| SMS reminders live | 7 | BullMQ jobs queued and sending |
| **App deployed on HTTPS** | **7** | **First production deploy** |
| Video calls working | 9 | Jitsi consults end-to-end |
| Production-hardened | 10 | Security, monitoring, k6 baseline |
| Mobile apps | 12 | iOS + Android in TestFlight / Play beta |
| Payments | 14+ | Orange Money + MVola live |

---

## 🛠️ Roadmap Review Summary

### v1.1 Changes (retained)

Critical bugs fixed: (1) `SELECT FOR UPDATE` on wrong table — replaced with `INSERT ... ON CONFLICT DO NOTHING` against `slot_locks` with `UNIQUE(doctor_id, slot_time)`, (2) `deadly0/bull-board` Docker image replaced with `@bull-board/nestjs` (incompatible with BullMQ), (3) pnpm workspace config moved to `pnpm-workspace.yaml`, (4) search SQL missing `JOIN` on `auth.users`, (5) refresh token delivery corrected to `Set-Cookie` header. Additions: `turbo.json`, `docker-compose.test.yml`, `docker-compose.prod.yml`, WebSocket gateway setup, Docker registry auth in CI, Terraform basics, i18n SMS template files.

### v1.2 Changes (retained)

| # | Location | v1.1 | v1.2 | Reason |
| --- | --- | --- | --- | --- |
| 1 | Phase 5, Step 26 | `localhost:3001` | `localhost:3000/admin/queues` | BullMQ board mounts inside the NestJS process |
| 2 | Phase 0, Step 1 — `turbo.json` | `"pipeline": {}` | `"tasks": {}` | `"pipeline"` renamed in Turborepo v2 — hard startup error |
| 3 | Phase 3, Step 18b | `pnpm add -D @types/socket.io` | Remove entirely | Socket.io v4+ ships own types; `@types/socket.io` targets v2 |
| 4 | Phase 8, Step 33 | Missing install + wrong import | `@nest-lab/throttler-storage-redis`; `ttl` in ms | `ThrottlerStorageRedisService` not in `@nestjs/throttler`; ttl unit changed in v5+ |
| 5 | Phase 8, Step 36 | `curl grafana/agent` | `apt install alloy` via Grafana apt repo | Agent deprecated; replaced by Alloy; old URL returns 404 |
| 6 | Phase 6, Step 28 — Nginx | Missing WebSocket headers | Added `Upgrade`, `Connection: upgrade`, timeouts | Nginx drops Socket.io upgrade handshakes without them |
| 7 | Phase 0, Step 3 | Missing `express-basic-auth` install | Added to install | `basicAuth()` call in `main.ts` requires the package |
| 8 | Day 1 checklist | Incorrect item count in description | Removed count | Minor inconsistency |

### v1.3 Changes (this review)

| # | Location | v1.2 | v1.3 | Reason |
| --- | --- | --- | --- | --- |
| 1 | Step 2 — dev `docker-compose.yml` | Redis started with default eviction policy | Added `--maxmemory-policy noeviction` command | Spec v1.3 mandates `noeviction` for ALL Redis instances with BullMQ; dev parity prevents silent job loss being discovered only in production |
| 2 | Step 2b — `docker-compose.test.yml` | Redis started with default eviction policy | Added `--maxmemory-policy noeviction` command | Same reason as above |
| 3 | Step 3 — NestJS install | Missing `cookie-parser`, `helmet`, `@nestjs/event-emitter` | All three added to install + `@types/cookie-parser` | `cookie-parser` required to read httpOnly refresh token in `POST /auth/refresh`; `helmet` referenced in Step 34 but never installed; `@nestjs/event-emitter` required for all domain events in Phases 4–5 |
| 4 | Step 3b — new step | Entirely missing | Added shared `RedisModule`, `AppModule` wiring of `ConfigModule`/`BullModule`/`EventEmitterModule`/`ThrottlerModule`, domain event publish/consume patterns | Multiple modules inject `REDIS_CLIENT` and `ConfigService` — without these providers every module fails to compile; BullMQ requires `BullModule.forRoot()` before any queue can be registered |
| 5 | Step 3 — `main.ts` | Missing `cookieParser()`, `helmet()`, `enableCors()` | All three added with correct configuration | `cookie-parser` must be wired in `main.ts` or `req.cookies` is always `undefined`; `helmet` was installed but not applied; `enableCors` with `credentials: true` is required for httpOnly cookie delivery cross-origin |
| 6 | Step 5 — authStore + `refreshTokens()` | Referenced but never shown | `authStore.ts` skeleton + full `refreshTokens()` implementation in `client.ts` | Axios interceptor calls `refreshTokens()` which uses the store — both must exist for the frontend to compile |
| 7 | Step 8 — `POST /auth/refresh` | Cookie reading not shown; NestJS code block formatting broken | Added `req.cookies['refresh_token']` reading pattern; added `clearCookie` in logout; reformatted code block | `cookie-parser` populates `req.cookies` — this must be read explicitly in the controller |
| 8 | Step 12 — Prisma seed | `npx prisma db seed` shown without config | Added `"prisma": { "seed": "ts-node ..." }` to `apps/api/package.json` and `ts-node` devDependency | Without this config key, Prisma exits with “No seed script found” |
| 9 | Step 13 — search SQL | Each layer restarts parameter numbering at `$1` | Added note: parameters must be renumbered sequentially when layers are combined | Conflicting `$1`/`$2` across combined layers causes PostgreSQL parameter binding errors at runtime |
| 10 | Step 17 — availability cache | “Cache for 30 seconds” in prose only | Added `cacheKey()`, `getAvailability()`, `invalidateAvailabilityCache()` implementation and `@OnEvent` wiring for invalidation | Without invalidation on booking/cancel/schedule-change, stale availability data causes double-bookings |
| 11 | Step 19 — slot locking | Code blocks severely broken: warning callout embedded mid-fence, unclosed backticks | Fully rewritten with correct fencing; layer 1 and layer 2 in clearly separated blocks; combined flow in `lockSlot()` method | Unreadable in any Markdown renderer; impossible to implement correctly from the v1.2 version |
| 12 | Step 20 — booking transaction | Lock validation and DELETE implied as separate operations | Added explicit note: both operations must be inside `prisma.$transaction()` | Separate check + delete creates a TOCTOU race condition that allows double-booking |
| 13 | Step 27 — GitHub Actions | Missing `actions/setup-node@v4` and pnpm version pin | Added `setup-node@v4` with `node-version: '20'`; added `version: 8` to pnpm setup | Without node version, CI uses the runner default which may not match development; without pnpm version pin, builds are non-deterministic |
| 14 | Step 28 — Droplet setup | `deploy` user never created; `usermod -aG docker deploy` runs on non-existent user | Added `useradd -m -s /bin/bash deploy` and SSH authorized_keys setup before `usermod` | CI workflow SSHs as `deploy` user — if the user doesn’t exist, all deploys fail with `Permission denied` |
| 15 | Step 28 — `docker-compose.prod.yml` | Redis has no password | Added `--requirepass ${REDIS_PASSWORD}` and matching health check flag | Defense-in-depth: Redis on the Docker network should require auth even if the port is not externally exposed |
| 16 | Step 28 — Terraform | `terraform init` fails silently on S3 backend | Added explicit note: requires `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` set to DO Spaces keys; must create state bucket manually first | Terraform cannot create its own state bucket; missing credentials produce an opaque “No valid credential sources” error |
| 17 | Step 30 — Jitsi install | Used deprecated `apt-key add` | Updated to `gpg --dearmor` + `signed-by=` keyring pattern | `apt-key` is deprecated on Ubuntu 22.04 and removed on newer systems |
| 18 | Step 31 — Jitsi JWT | `jsonwebtoken` never installed | Added `pnpm add jsonwebtoken @types/jsonwebtoken` | Jitsi room token signing requires a JWT library; calling `jwt.sign()` without the package throws at runtime |
| 19 | Step 35 — k6 script | Only comments where HTTP calls should be | Replaced with real `http.get` / `http.post` calls across the full booking flow | A k6 script with no HTTP calls reports 0 requests and trivially passes all thresholds |
| 20 | Step 36 — Grafana Alloy | `/etc/alloy/config.alloy` mentioned but empty | Added minimal `config.alloy` scraping Docker metrics + shipping logs to Grafana Cloud Loki | Without a config file, Alloy starts but collects nothing |
| 21 | Step 39 — React Native | `npx react-native init` | `npx @react-native-community/cli init` | `react-native init` removed from the `react-native` package in RN 0.73+; old command fails or uses outdated template |
| 22 | Step 40 — Firebase Admin | Service account file path not addressed | Added base64 env var encoding pattern + runtime decode | Service account JSON files must not be committed to git or baked into Docker images; env var encoding is the container-safe pattern |
| 23 | `.env.example` | Missing `REDIS_PASSWORD`, `BULL_BOARD_PASSWORD`, `FRONTEND_URL` | All three added | Required by the fixes above: Redis auth, Bull Board auth, CORS origin |
| 24 | Day 1 checklist | Did not reflect new required steps | Updated to include `cookie-parser`/`helmet`/`@nestjs/event-emitter`, `ConfigModule`/`BullModule` wiring, authStore, and `noeviction` Redis | Checklist must reflect the complete foundation |

---

*Roadmap version 1.5 · March 2026 · Derived from Technical Specification v1.3*

---

### v1.4 Changes (retained)

| # | Location | v1.3 | v1.4 | Reason |
| --- | --- | --- | --- | --- |
| 1 | Step 5 — `client.ts` request interceptor |  `Bearer$ {token}`  (space after `$`, broken template literal) |  `Bearer ${token}`  | Runtime bug: produces literal string `"Bearer$ {token}"` — every authenticated API call returns 401 |
| 2 | Step 5 — `client.ts` response interceptor | `error.config._retry` (untyped property) | `(error.config as any)._retry` | TypeScript compilation error: `_retry` is not on `AxiosRequestConfig`; `tsc` rejects the file |
| 3 | Step 3b — `EventEmitterModule.forRoot` | `ignoreErrors: false` | `ignoreErrors: true` | A notification handler throwing with `ignoreErrors: false` propagates and can crash the booking service process — unacceptable for a healthcare platform. Each `@OnEvent` handler must use its own try/catch. |
| 4 | Step 19 — `SlotLockingService` | `slotLockQueue` injected but no queue registration shown | Added `BullModule.registerQueue({ name: 'slot-lock' })` to `AppointmentsModule` | `@InjectQueue('slot-lock')` throws `No provider for Queue(slot-lock)` at startup without this |
| 5 | Step 27 — GitHub Actions CI redis service | Default Redis eviction policy | Added `--maxmemory 256mb --maxmemory-policy noeviction` to service options | Spec v1.3 mandates `noeviction` for all Redis instances with BullMQ; CI omission means tests silently lose BullMQ jobs under memory pressure |
| 6 | Step 28 — `docker-compose.prod.yml` volumes | `redis_data::` (double colon) | `redis_data:` | YAML syntax error: double colon causes `docker compose up` to fail with a parse error |
| 7 | Step 35 — k6 script |  Authorization: `Bearer${token}`  (missing space) |  Authorization: `Bearer ${token}`  | Produces `"BearerXXX"` — all authenticated k6 requests return 401; load test passes vacuously |
| 8 | Step 36 — Grafana Alloy config | Docker metrics scrape at `localhost:9323` with no prerequisite | Added note to enable Docker metrics endpoint in `/etc/docker/daemon.json` first | Docker does not expose a Prometheus metrics endpoint by default; without enabling it, Alloy scrapes nothing |
| 9 | Step 39 — React Native install | `@notifee/react-native` only | Added `@react-native-firebase/app` and `@react-native-firebase/messaging` | Notifee requires the Firebase messaging package for FCM message receipt; without it push notifications fail silently on device |

### v1.5 Changes (this review)

| # | Location | v1.4 | v1.5 | Reason |
| --- | --- | --- | --- | --- |
| 1 | Step 24 — BullMQ worker config | `workerOptions` object with `attempts`/`backoff` implied for Worker constructor | `SMS_JOB_OPTIONS` const passed to every `.add()` call | BullMQ retry options are job-level, not Worker-level. Worker constructor options control concurrency/rate-limiting. Job-level options in the Worker are silently ignored — all retries fail on first attempt |
| 2 | Step 25 — `handleAppointmentBooked` reminder jobs | No `jobId` on reminder jobs | Deterministic `jobId: reminder:${appointmentId}:${offsetMs}` on every reminder add | Without a stored `jobId`, `queue.getJob(id)` cannot find the job; reminder cancellation on appointment cancel is impossible |
| 3 | Step 25 — `handleAppointmentCancelled` | Comment only: "Remove pending reminder jobs" | Full implementation: `getJob(deterministic-id)` + `job.remove()` for each offset | Comment was not implementable — no jobId pattern, no code shown; reminder jobs would fire after the appointment was already cancelled |
| 4 | Step 26 — `notification_log` schema | Missing `bullmq_job_id` field | Added `bullmq_job_id TEXT` column | Required to correlate log rows with BullMQ jobs for observability and cancellation auditing |
| 5 | Step 27 — CI Redis service | `--maxmemory-policy noeviction` in `options:` block | Moved to `command: redis-server --maxmemory 256mb --maxmemory-policy noeviction`; added `ports: - 6379:6379` | `options:` maps to Docker container flags (health checks), not Redis server args. Redis server args in `options:` are silently ignored, leaving default eviction policy which drops BullMQ jobs |
| 6 | Step 27 — CI pnpm version | `version: 8` | `version: 10` | pnpm v10 is the project's development version (matches lockfile format); v8 produces a lockfile version mismatch error on `--frozen-lockfile` |
| 7 | Step 27 — deploy.yml trigger | `on: push: branches: [main]` | `on: workflow_run: workflows: ["CI"] types: [completed]` + `if: conclusion == 'success'` | Deploy and CI ran in parallel — a broken push would deploy to production before tests even finished. Deploy must gate on CI success |
| 8 | Step 33 — `verify-otp` throttle | No throttle on OTP verification endpoint | Added `@Throttle({ default: { ttl: 600_000, limit: 5 } })` + `@UseGuards(PhoneThrottlerGuard)` | 6-digit OTP has 1,000,000 combinations; unthrottled verification allows full brute force in seconds |
| 9 | Step 33 — OTP throttle keying | IP-based ThrottlerGuard on auth routes | `PhoneThrottlerGuard` with `getTracker()` keyed on `req.body.phone_number` | Madagascar carriers (Orange, Telma) use carrier-grade NAT — thousands of subscribers share one IP. IP-based throttle blocks innocent users while attackers on the same carrier are also blocked; phone-keyed throttle targets the actual attack vector |
| 10 | Step 34 — security checklist | Missing `$queryRawUnsafe` ban, IDOR check, PII scrubbing, admin guard | Added all four items with implementation guidance | Critical security controls were absent from the audit checklist: raw SQL injection via `$queryRawUnsafe`, patient record access without ownership check, PII leakage to Sentry logs, and unguarded admin routes |
| 11 | Step 35 — k6 `http.post` params | `headers` object missing closing `}`, `tags` passed as second argument | Fixed: `headers` and `tags` as top-level properties of a single params object | JavaScript syntax error — k6 would throw at parse time; the load test could not run at all |
| 12 | Step 37 — admin controller | No guard shown on admin endpoints | Added `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` on controller class | Nginx IP allowlist is network-level only; requests reaching the NestJS process from within the Docker network (or misconfigured proxy) would have unrestricted admin access without an application-level guard |