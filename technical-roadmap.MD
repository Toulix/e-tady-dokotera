

# 🗺️ Technical Roadmap — Step-by-Step Build Guide

Madagascar Healthcare Booking Platform · Build order by priority

> 💡 **How to read this document**
> 

> Every phase has a clear goal. Every step has concrete commands, file names, and acceptance criteria. Work top to bottom — do not skip ahead. The phases are ordered so that each one delivers real, testable value before the next begins.
> 

---

## ❓ First question: Cloud infra upfront or Docker Compose?

**Start with local Docker Compose. Do not touch cloud infrastructure until the end of Phase 6 (Week 7).**

Here is why. Your biggest risk right now is not "will the server be ready" — it is "will we build the right thing." Every hour spent on DigitalOcean firewall rules before you have a working booking flow is a wasted hour that delivers zero user value.

The rule is simple:

- **Weeks 1–7** → `docker compose up` is your entire infrastructure. Nothing else.
- **End of Week 7** → You have a working booking flow. Now wire the cloud and CI/CD.
- **Never** pre-build infrastructure for scale you don't have yet.

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
  - 'apps/*'
  - 'packages/*'
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
    "lint": "turbo lint"
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
    "lint": {
      "outputs": []
    }
  }
}
```

**✔ Acceptance:** `pnpm install` runs without error from the root. `pnpm turbo build` runs without "pipeline not found" errors.

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
```

`.env.example` (commit this; never commit `.env`):

```bash
# Database
DATABASE_URL="postgresql://dev:dev@localhost:5432/madagascar_health"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# App
NODE_ENV=development
PORT=3000
TZ=Indian/Antananarivo

# SMS (mock in development)
SMS_PROVIDER=mock

# Storage
STORAGE_BUCKET=madagascar-health-dev
STORAGE_REGION=us-east-1
```

**✔ Acceptance:** `docker compose up` starts all services. `localhost:3000` responds (even 404 is fine). After completing Step 3, BullMQ board will be visible at `localhost:3000/admin/queues`.

---

### ✅ Step 2b — docker-compose.test.yml (referenced in Step 1, now defined)

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
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
```

Add to root `package.json` scripts:

```json
"test:integration": "docker compose -f docker-compose.test.yml up -d && turbo test:integration && docker compose -f docker-compose.test.yml down"
```

Add to `.env.test` (committed, no secrets):

```bash
DATABASE_URL="postgresql://test:test@localhost:5433/madagascar_health_test"
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_SECRET=test-secret-not-real
SMS_PROVIDER=mock
```

---

### ✅ Step 3 — NestJS application scaffold

```bash
cd apps/api
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add prisma @prisma/client
pnpm add bullmq @nestjs/bullmq ioredis
pnpm add class-validator class-transformer
pnpm add -D @types/node @types/passport-jwt typescript ts-node
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
│   └── analytics/       (same sub-structure)
├── shared/
│   ├── events/          ← domain event definitions
│   ├── guards/          ← JwtAuthGuard, RolesGuard
│   ├── decorators/      ← @CurrentUser(), @Roles()
│   ├── filters/         ← GlobalHttpExceptionFilter
│   ├── interceptors/    ← ResponseEnvelopeInterceptor
│   └── database/        ← PrismaService
├── app.module.ts
└── main.ts
```

Wire global interceptor and exception filter in `main.ts` immediately — every endpoint uses them:

```tsx
// src/shared/interceptors/response.interceptor.ts
// Wraps ALL responses: { success: true, data: ..., meta: { timestamp, request_id } }

// src/shared/filters/http-exception.filter.ts
// Catches ALL errors: { success: false, error: { code, message } }

// src/main.ts
app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

// Bull Board — mount BEFORE app.listen()
// pnpm add @bull-board/api @bull-board/nestjs @bull-board/express express-basic-auth
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
const { addQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [],  // queues added here once BullMQ queues are created in Phase 5
  serverAdapter,
});
app.use('/admin/queues', basicAuth({ users: { admin: process.env.BULL_BOARD_PASSWORD }, challenge: true }), serverAdapter.getRouter());
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
  // ...
  geolocation Unsupported("geometry(Point, 4326)")?  // PostGIS point
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
pnpm add react-router-dom@6 zustand axios
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

Wire the Axios interceptor for token refresh from day 1:

```tsx
// api/client.ts
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await refreshTokens(); // calls POST /auth/refresh, updates store
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);
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
  createUser(data: CreateUserDto): Promise<User>
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
  async generate(phone: string): Promise<void>        // stores in Redis, sends SMS
  async verify(phone: string, code: string): Promise<boolean>
}
```

---

### ✅ Step 8 — Auth endpoints

Implement in `modules/auth/api/auth.controller.ts`:

```jsx
POST /api/v1/auth/register
  Body: { phone_number, password, first_name, last_name, user_type }
  → Creates user (is_verified: false), generates OTP, queues SMS job
  → Returns 201 { message: "OTP sent" }

> ⚠️ **v1.1 correction — refresh token delivery:** The refresh token is delivered and consumed via an `HttpOnly` cookie, never via the JSON response body. JavaScript cannot read or write `HttpOnly` cookies — that is the security property being used. The NestJS controller must explicitly call `response.cookie()` with the correct flags. The JSON body only ever returns `access_token`.

POST /api/v1/auth/verify-otp
  Body: { phone_number, code }
  → Verifies OTP, marks user verified
  → Returns 200 { access_token: "..." }  ← access token in body ONLY
  → Sets header: Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800

POST /api/v1/auth/login
  Body: { phone_number, password }
  → Validates credentials, checks is_verified
  → Stores hashed refresh_token in Redis: key refresh:{user_id}, TTL 7 days
  → Returns 200 { access_token: "..." }  ← access token in body ONLY
  → Sets Set-Cookie header (same as above)

NestJS implementation:
```

// In auth.controller.ts — inject @Res({ passthrough: true }) response: Response

response.cookie('refresh_token', refreshToken, {

httpOnly: true,

secure: process.env.NODE_ENV === 'production',

sameSite: 'strict',

path: '/api/v1/auth/refresh',  // cookie only sent to refresh endpoint

maxAge: 7  *24*  60  *60*  1000,

});

return { access_token: accessToken };

```

POST /api/v1/auth/refresh
  Cookie: refresh_token=... (read from httpOnly cookie, not request body)
  → Validates token exists in Redis, rotates (delete old, store new)
  → Returns 200 { access_token: "..." } + new Set-Cookie header

POST /api/v1/auth/logout
  Header: Authorization: Bearer <access_token>
  → Deletes refresh token from Redis
  → Returns 200 { message: "Logged out" }
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
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
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

**VerifyOtpPage:** Six individual digit inputs. Auto-advance to next box on keystroke. On complete → `POST /auth/verify-otp` → store tokens → redirect to dashboard.

**LoginPage:** Phone + password. On success → store the `access_token` from the response body in Zustand memory (in-memory only, never localStorage). The `refresh_token` is automatically stored in the browser's cookie jar via the `Set-Cookie` header set by the API — the frontend code does nothing to persist it. On subsequent page loads, the Axios interceptor calls `POST /auth/refresh` (the browser automatically sends the httpOnly cookie) to silently restore the session.

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

`apps/api/prisma/seed.ts` — create 20 realistic seeded doctors:

```tsx
// Seed realistic data:
// - Malagasy names (Rakoto, Randria, Rabe, etc.)
// - Specialties in French (Cardiologie, Pédiatrie, Médecine Générale, etc.)
// - Antananarivo coordinates (lat: -18.9, lng: 47.5 area)
// - Consultation fees in MGA (50000–200000)
// - Mix of video_enabled: true/false

npx prisma db seed
```

---

### ✅ Step 13 — Search endpoint

`GET /api/v1/doctors/search` — build this query in four incremental layers, shipping after each:

> ⚠️ **v1.1 bug fix:** `first_name` and `last_name` are on `auth.users`, not on `doctors.profiles`. Layer 2 (fuzzy name search) requires an explicit JOIN — without it the query will fail at runtime with a "column does not exist" error.
> 

**Layer 1** (ship first):

```sql
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
LIMIT $2 OFFSET $3
```

**Layer 2** — add fuzzy name search (requires JOIN from Layer 1):

```sql
-- Add to WHERE clause:
AND ($2 = '' OR similarity(u.first_name || ' ' || u.last_name, $2) > 0.3)
-- Add to ORDER BY:
ORDER BY
  CASE WHEN $2 != '' THEN similarity(u.first_name || ' ' || u.last_name, $2) ELSE 0 END DESC,
  p.average_rating DESC NULLS LAST
```

**Layer 3** — add PostGIS location filter:

```sql
AND ($3 IS NULL OR ST_DWithin(
  geolocation::geography,
  ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
  $3 * 1000  -- radius_km to meters
))
```

**Layer 4** — add next-available-slot subquery (write this as a separate raw SQL function, not inline).

> ⚠️ Write all four layers as raw SQL in a repository method, not Prisma ORM. Prisma cannot handle these query patterns efficiently.
> 

---

### ✅ Step 14 — Search + Doctor Profile UI

Build:

- `SearchPage`: search bar, specialty filter pills, results list with doctor cards (photo, name, specialty, next slot, fee, distance)
- `DoctorProfilePage`: full profile display, photo, bio, specialties, languages, working hours summary, rating display. No booking button yet.

**✔ Acceptance:** Searching "cardiologue" or "Rakoto" returns seeded doctors. Clicking a result shows the full profile page.

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

Cache the response in Redis for 30 seconds (invalidate on any booking or schedule change in this doctor's key space).

---

### ✅ Step 18 — Calendar slot picker UI

This is the most visible UI component. Invest time in it.

- Week view by default on mobile (7 columns, scrollable)
- Available slots shown as green buttons with time label
- Booked slots shown as grey, disabled
- Loading skeleton while fetching
- "No slots available" empty state with next-available-date suggestion
- Slot selection highlights the chosen slot and advances to Step 2 of booking

**✔ Acceptance:** Doctor sets "Tuesday 9:00–12:00, 30-min slots" via API (or Prisma Studio). Patient visits doctor profile and sees six green slot buttons under Tuesday.

---

### ✅ Step 18b — WebSocket Gateway for real-time slot availability

The spec mandates real-time slot availability via WebSocket. Without this, two patients viewing the same doctor simultaneously won't see each other's slot locks until they refresh. This step must be completed before Phase 4 booking.

> ⚠️ **v1.2 fix — `@types/socket.io` removed:** [Socket.io](http://Socket.io) v4+ ships its own TypeScript declarations. The `@types/socket.io` package is a legacy community type stub for [Socket.io](http://Socket.io) v2 and is incompatible with v4 — installing it causes type conflicts and `Cannot find module` errors. Remove it entirely.
> 

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
# Do NOT add @types/socket.io — socket.io v4 ships its own types
```

`modules/scheduling/api/availability.gateway.ts`:

```tsx
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/availability', cors: { origin: process.env.FRONTEND_URL } })
export class AvailabilityGateway {
  @WebSocketServer() server: Server;

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

In `SlotLockingService`, inject and call `AvailabilityGateway.emitSlotUpdate()` after every successful lock/release. In the React frontend, use the `socket.io-client` package:

```tsx
// In the slot picker component:
const socket = io('/availability');
socket.emit('watch-doctor', { doctorId });
socket.on('slot-locked',   ({ slotTime }) => markSlotUnavailable(slotTime));
socket.on('slot-released', ({ slotTime }) => markSlotAvailable(slotTime));
// Disconnect on component unmount:
return () => socket.disconnect();
```

**✔ Acceptance:** Open the slot picker for the same doctor in two browser tabs simultaneously. Lock a slot in Tab 1 — Tab 2 should visually grey out that slot within 1 second without any page refresh.

---

## Phase 4 — Appointment Booking

### Week 5–6 · Goal: patient completes a full booking end-to-end

---

### ✅ Step 19 — Slot locking

Two-layer locking strategy — both layers are required:

```tsx
// LAYER 1: Redis lock (UX hold — "slot reserved for 10 minutes")
await redis.set(
  `slot_lock:${doctorId}:${slotTime.toISOString()}`,
  userId,
  'NX',   // only set if not exists
  'EX',   // expire
  600     // 10 minutes
);
// Returns null if key already exists → slot is taken → throw 409

> ⚠️ **v1.1 critical bug fix:** The original code used `SELECT FOR UPDATE` on `scheduling.weekly_templates`. This is **wrong for two reasons**: (1) it locks the doctor's *entire schedule template* row, blocking any schedule edits for the duration of every concurrent booking; (2) it does not prevent double-booking because two concurrent requests for *different* template rows would both succeed. The correct pattern for slot deduplication is an `INSERT ... ON CONFLICT DO NOTHING` against the `appointments.slot_locks` table, which has a `UNIQUE(doctor_id, slot_time)` constraint. PostgreSQL enforces uniqueness atomically — exactly one of two concurrent inserts will succeed.

```

// LAYER 2: PostgreSQL unique constraint (correct transactional integrity pattern)

// The slot_locks table must have: UNIQUE(doctor_id, slot_time)

// In the Prisma schema:

//   model SlotLock {

//     id         String   @id @default(uuid())

//     doctorId   String   @map("doctor_id")

//     slotTime   DateTime @map("slot_time") @db.Timestamptz

//     userId     String   @map("user_id")

//     lockToken  String   @unique @map("lock_token")

//     expiresAt  DateTime @map("expires_at") @db.Timestamptz

//     @@unique([doctorId, slotTime])  // ← THIS is the deduplication guarantee

//     @@map("slot_locks")

//     @@schema("appointments")

//   }

const result = await prisma.$executeRaw`

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

// result is the number of rows inserted

// 0 rows inserted → conflict → slot already locked → throw HttpException 409

if (result === 0) {

throw new HttpException(

{ code: 'SLOT_ALREADY_LOCKED', message: 'This slot is currently reserved by another user.' },

HttpStatus.CONFLICT,

);

}

```

```

Slot lock expiry handled by BullMQ delayed job:

```tsx
// When slot is locked, schedule a cleanup job:
await slotLockQueue.add(
  'release-expired-lock',
  { doctorId, slotTime, lockToken },
  { delay: 600_000 } // 10 minutes
);
// Worker: if appointment not confirmed, delete Redis key, publish SlotLockExpired event
```

---

### ✅ Step 20 — Booking endpoints

```jsx
POST /api/v1/slots/lock
  Body: { doctor_id, slot_time, facility_id? }
  → Acquire Redis lock
  → Schedule BullMQ cleanup job
  → Return { lock_token, expires_at }

DELETE /api/v1/slots/lock/:lock_token
  → Release Redis lock early (user abandoned booking)

POST /api/v1/appointments
  Body: { doctor_id, facility_id?, start_time, appointment_type,
          reason_for_visit, is_first_visit, lock_token, patient_info? }
  → Validate lock_token exists in appointments.slot_locks AND belongs to authenticated user
     AND has not expired (expires_at > NOW())
  → Open DB transaction:
      1. DELETE FROM appointments.slot_locks WHERE lock_token = $1 AND user_id = $2
         (if 0 rows deleted → lock expired or stolen → 409)
      2. INSERT INTO appointments.appointments (..., status: 'confirmed')
  → Delete Redis slot_lock key (Redis key is the soft UX hold; DB lock is the hard guarantee)
  → Publish AppointmentBooked domain event
  → Return 201 { appointment_id, booking_reference }

GET  /api/v1/appointments          List (filtered by auth user role)
GET  /api/v1/appointments/:id      Detail
PATCH /api/v1/appointments/:id     Reschedule or cancel
PATCH /api/v1/appointments/:id/status  Doctor: mark complete / no-show
```

---

### ✅ Step 21 — Booking UI (3-step flow)

**Step 1 — Slot picker** (reuses Phase 3 calendar component)

**Step 2 — Patient details form:**

- Pre-fill all fields if user is authenticated (name, phone)
- Reason for visit dropdown + free-text
- "Is this your first visit?" checkbox
- Form validates inline (no submit-then-error)

**Step 3 — Confirmation summary:**

- Doctor photo, name, specialty
- Date, time, duration, type, location
- Fee in MGA
- "Confirm Booking" button → calls `POST /appointments` → shows BookingSuccessPage

**BookingSuccessPage:**

- Booking reference in large text (e.g. APT-2026-38291)
- "Add to calendar" link (generate `.ics` file client-side)
- "Back to search" and "View my appointments" buttons

---

### ✅ Step 22 — Patient and Doctor dashboards

**Patient dashboard:**

- Upcoming appointments list (sorted by date, with countdown "in 2 hours")
- Past appointments with "Leave a review" and "Rebook" actions
- Quick cancel/reschedule buttons (enforce 24h rule, show error if too late)

**Doctor dashboard:**

- Today's schedule (chronological list)
- Upcoming week summary
- Pending actions (new bookings needing confirmation)
- Quick actions: mark complete, mark no-show, add note

**✔ Acceptance:** Full end-to-end flow: search → profile → pick slot → fill form → confirm → see appointment in patient dashboard AND in doctor dashboard.

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
```

Provider selected by config:

```tsx
// Config-driven, never if/else in business logic:
// SMS_PROVIDER=mock | orange | africas_talking
```

---

### ✅ Step 24 — Notification queue workers

Set up BullMQ queues in `modules/notifications/infrastructure/`:

```tsx
// Queues:
// - sms-immediate   → send right now (confirmations, OTPs)
// - sms-reminder    → delayed jobs (72h, 24h, 2h before appointment)

// Worker config (for both queues):
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  // 5s → 25s → 125s between retries
}

// On exhausted retries:
//   1. Log failure to notifications.notification_log (status: 'failed')
//   2. If email on file → queue email fallback job
//   3. Alert (Sentry error) if failure rate exceeds 10%
```

---

### ✅ Step 25 — Domain event handlers

Wire the domain event bus in `shared/events/`:

```tsx
// AppointmentBooked event → triggers:
//   1. sms-immediate: booking confirmation SMS
//   2. sms-reminder:  three delayed reminder jobs (72h, 24h, 2h before)

// AppointmentCancelled event → triggers:
//   1. sms-immediate: cancellation SMS to patient
//   2. BullMQ: remove pending reminder jobs for this appointment

// AppointmentCompleted event → triggers:
//   1. sms-immediate: "Please rate Dr. X" SMS with link
```

SMS templates loaded from i18n files (never hardcoded in service logic). Create these files:

`apps/api/src/shared/i18n/fr.sms.json`:

```json
{
  "appointment.confirmation": "Confirmation: RDV avec Dr. {{doctorName}}\nLe {{date}} \u00e0 {{time}}\nLieu: {{clinic}}, {{address}}\nR\u00e9f: {{ref}}\nR\u00e9pondre STOP pour se d\u00e9sabonner",
  "appointment.reminder_24h": "Rappel: RDV demain avec Dr. {{doctorName}} \u00e0 {{time}} - {{clinic}}\nR\u00e9pondre C pour annuler\nR\u00e9f: {{ref}}",
  "appointment.reminder_72h": "Rappel: RDV dans 3 jours avec Dr. {{doctorName}} le {{date}} \u00e0 {{time}}\nR\u00e9f: {{ref}}",
  "appointment.reminder_2h": "Rappel: RDV dans 2 heures avec Dr. {{doctorName}} \u00e0 {{time}}\nLieu: {{address}}\nR\u00e9f: {{ref}}",
  "appointment.cancellation": "RDV annul\u00e9: Dr. {{doctorName}} le {{date}} \u00e0 {{time}}\nR\u00e9f: {{ref}}",
  "appointment.review_request": "Comment s'est pass\u00e9 votre RDV avec Dr. {{doctorName}}? Laissez un avis: {{reviewUrl}}"
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

In `NotificationService`, select the template file based on the patient's `preferred_language` field. Fall back to French if a Malagasy template key is missing.

---

### ✅ Step 26 — Notification log

Every SMS attempt (success or failure) logged to `notifications.notification_log`:

```tsx
{
  id, appointment_id, notification_type,
  recipient_phone, message_body,
  provider_used, provider_message_id,
  status: 'queued' | 'sent' | 'delivered' | 'failed',
  attempt_count, last_attempt_at,
  created_at
}
```

**✔ Acceptance:** Book an appointment. See three delayed jobs in BullMQ board at `localhost:3000/admin/queues` (BullMQ board runs inside the NestJS process on the same port as the API — not a separate container or port). Switch `SMS_PROVIDER=mock` and see the confirmation SMS text in the API console log immediately.

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
      redis:
        image: redis:7-alpine
        options: --health-cmd "redis-cli ping" --health-interval 5s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_HOST: localhost
          JWT_SECRET: test-secret
          SMS_PROVIDER: mock
      - run: pnpm turbo build
```

`.github/workflows/deploy.yml` — runs on push to `main`:

> ⚠️ **v1.1 addition:** The original workflow was missing DigitalOcean Container Registry authentication. Without `doctl registry login`, `docker push` will fail with an authentication error. Also: `docker compose exec api npx prisma migrate deploy` requires `prisma` to be installed in the production image — use the `prisma` binary from `node_modules/.bin/prisma` or include a dedicated `migrate` service. The corrected workflow is below.
> 

```yaml
name: Deploy
on:
  push:
    branches: [main]

env:
  REGISTRY: registry.digitalocean.com
  REPO: ${{ secrets.DO_REGISTRY_NAME }}  # e.g. "madagascar-health"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Authenticate with DigitalOcean (required before docker push)
      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}  # DO Personal Access Token, stored in GitHub secrets

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
            # Pull latest image
            docker compose -f docker-compose.prod.yml pull api
            # Run migrations BEFORE swapping the container
            docker compose -f docker-compose.prod.yml run --rm api \
              ./node_modules/.bin/prisma migrate deploy
            # Hot-swap only the api container (zero downtime for stateless service)
            docker compose -f docker-compose.prod.yml up -d --no-deps --remove-orphans api
            # Prune dangling images to save disk
            docker image prune -f

# Required GitHub Secrets (set in repo Settings → Secrets):
# DO_API_TOKEN      — DigitalOcean Personal Access Token (write access to container registry)
# DO_REGISTRY_NAME  — DigitalOcean Container Registry name (e.g. "madagascar-health")
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
   - Region: Frankfurt or Amsterdam (closest to Madagascar with DO presence)
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

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply  # creates all resources below in one command
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
  # Store state remotely (DO Spaces bucket created manually first)
  backend "s3" {
    endpoint = "fra1.digitaloceanspaces.com"
    region   = "us-east-1"
    bucket   = "madagascar-health-tfstate"
    key      = "prod/terraform.tfstate"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
  }
}

variable "do_token" {}
variable "ssh_fingerprint" {}

provider "digitalocean" { token = var.do_token }

resource "digitalocean_droplet" "app" {
  name   = "madagascar-health-app"
  region = "fra1"
  size   = "s-4vcpu-8gb"  # ~$80/month
  image  = "ubuntu-22-04-x64"
  ssh_keys = [var.ssh_fingerprint]
  tags   = ["madagascar-health", "production"]
}

resource "digitalocean_database_cluster" "postgres" {
  name       = "madagascar-health-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"  # ~$50/month
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

Store `do_token` and `ssh_fingerprint` in a `terraform.tfvars` file that is **git-ignored**. Never hardcode credentials.

---

Droplet setup (SSH in and run once):

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# Install Nginx + certbot
apt install -y nginx certbot python3-certbot-nginx

# Create app directory
mkdir -p /opt/madagascar-health
chown deploy:deploy /opt/madagascar-health

# Copy docker-compose.prod.yml and .env.production (never via git)
# Then:
docker compose up -d
```

> ⚠️ **v1.2 fix — Nginx WebSocket headers missing:** Without `Upgrade` and `Connection` headers, Nginx drops WebSocket upgrade requests with a `101` handshake failure. [Socket.io](http://Socket.io) connections will silently fall back to long-polling or fail entirely. These headers are mandatory.
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
    image: registry.digitalocean.com/${DO_REGISTRY_NAME}/api:latest
    restart: unless-stopped
    ports: ["3000:3000"]
    env_file: .env.production  # copied to Droplet manually, never committed
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
    # MVP: Redis on same host. Move to DO Managed Redis at Phase 2.
    # No port exposed externally — only accessible within Docker network
    volumes:
      - redis_data:/data
    # CRITICAL: Do NOT use allkeys-lru with BullMQ.
    # allkeys-lru evicts ANY key under memory pressure — including active BullMQ job data —
    # causing silent job loss (appointments never get SMS reminders, no error thrown).
    # Use noeviction: Redis returns an OOM error instead of silently evicting jobs.
    # Monitor Redis memory usage and scale before approaching the limit.
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
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
- [ ]  Verify OTP → access token returned
- [ ]  Create a doctor profile via API
- [ ]  Search returns the doctor
- [ ]  Book an appointment
- [ ]  Three reminder jobs visible in BullMQ board
- [ ]  HTTPS certificate valid (no browser warning)
- [ ]  Database migrations applied cleanly (`prisma migrate status`)

**✔ Acceptance:** All checklist items pass. App is live. Subsequent pushes to `main` auto-deploy within 3 minutes.

---

## Phase 7 — Video Consultation

### Week 8–9 · Goal: doctor and patient can conduct a real-time video call

---

### ✅ Step 30 — Jitsi Meet server

Provision a **separate** Droplet (2 vCPU / 4 GB, ~$40/month):

```bash
# Official Jitsi self-hosting quick install:
curl https://download.jitsi.org/stable/xenial/gpg.key | apt-key add -
add-apt-repository "deb https://download.jitsi.org stable/"
apt install -y jitsi-meet

# Configure domain: video.yourdomain.com
# certbot auto-configures SSL during Jitsi install wizard
# Test: open https://video.yourdomain.com in two browser tabs → call should work
```

Enable JWT room authentication in Jitsi config (prevents unauthorized room access):

```
/etc/prosody/conf.d/video.yourdomain.com.cfg.lua
→ Set app_id and app_secret
→ These are used by your API to sign room tokens
```

> ⚠️ Do NOT install Jibri (call recording) at this stage. It requires an additional VM and significant configuration. Deferred to Phase 2 per spec.
> 

---

### ✅ Step 31 — Video module API

```tsx
// POST /api/v1/consultations/:appointmentId/start  [auth: doctor]
//   → Validates appointment is confirmed and within 15 min of start time
//   → Generates non-guessable room name: crypto.randomUUID()
//   → Signs JWT for doctor (role: moderator) using Jitsi app_secret
//   → Creates video.sessions row (room_name, started_at)
//   → Returns { room_url: "https://video.yourdomain.com/{room_name}#token=...",
//               token: "...", room_name: "..." }

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

- Camera permission check (navigator.mediaDevices.getUserMedia)
- Microphone permission check
- Browser compatibility check (WebRTC support)
- Network quality indicator
- "Everything looks good — Join Call" button

**In-call UI:**

- Embed Jitsi in an `<iframe>` using the [Jitsi Meet IFrame API](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe) — no need to build custom WebRTC UI
- Doctor controls panel alongside iframe: timer, notes field, "End Consultation" button
- Patient controls: audio-only toggle, "Leave" button

**Post-call:**

- Doctor sees "Consultation complete" with duration displayed
- Follow-up booking suggestion shown to patient

**✔ Acceptance:** Doctor clicks "Start Consultation" in dashboard. Patient receives SMS with join link. Both join and can see/hear each other. Doctor ends call. Duration is recorded.

---

## Phase 8 — Security Hardening & Launch Prep

### Week 9–10 · Goal: production-ready security posture, performance baseline, monitoring live

---

### ✅ Step 33 — Rate limiting

> ⚠️ **v1.2 fix — two corrections:** (1) Install command was missing. (2) `ThrottlerStorageRedisService` is **not** exported from `@nestjs/throttler` — it lives in a separate community package `@nest-lab/throttler-storage-redis`. Using the wrong import causes a runtime crash.
> 

```bash
pnpm add @nestjs/throttler @nest-lab/throttler-storage-redis
```

```tsx
// NestJS rate limit guard (using @nestjs/throttler + Redis store):
// Global:        100 requests / minute / IP
// Auth routes:    10 requests / minute / IP (stricter)
// OTP endpoint:   5 requests / minute / phone number

```

import { ThrottlerModule } from '@nestjs/throttler';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';  // separate package

@Module({

imports: [

ThrottlerModule.forRootAsync({

useFactory: (redis: Redis) => ({

storage: new ThrottlerStorageRedisService(redis),

throttlers: [{ ttl: 60000, limit: 100 }],  // ttl in ms in v5+

}),

inject: [REDIS_CLIENT],

}),

],

})

```
> ⚠️ **Note:** In `@nestjs/throttler` v5+, `ttl` is in **milliseconds**, not seconds. `{ ttl: 60, limit: 100 }` would be a 60ms window. Use `{ ttl: 60_000, limit: 100 }` for a 1-minute window.
```

---

### ✅ Step 34 — Security audit checklist

Run through this before any public launch:

- [ ]  All DTOs have `class-validator` decorators — no unvalidated inputs
- [ ]  Parameterized queries everywhere — run `grep -r '${'  src/` and audit every hit
- [ ]  `helmet()` middleware enabled in `main.ts` (sets security headers)
- [ ]  CORS configured to allow only your frontend domains
- [ ]  No secrets in git: `git grep -iE "password|secret|apikey|token" -- '*.ts' '*.json'`
- [ ]  All S3/Spaces objects served via pre-signed URLs (no public bucket access)
- [ ]  Admin routes behind IP allowlist in Nginx
- [ ]  SSH password auth disabled on all Droplets
- [ ]  `pnpm audit` passes with no critical vulnerabilities
- [ ]  Sentry source maps uploaded (stack traces readable in production)

---

### ✅ Step 35 — Performance baseline with k6

```jsx
// infra/k6/booking-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up
    { duration: '5m', target: 100 },   // hold
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95th percentile under 500ms
    'http_req_failed': ['rate<0.01'],    // <1% error rate
  },
};

export default function () {
  // GET /doctors/search
  // GET /doctors/:id/availability
  // POST /slots/lock
  // POST /appointments
  sleep(1);
}
```

```bash
k6 run infra/k6/booking-flow.js --env BASE_URL=https://api.yourdomain.com
```

Fix any query that shows up in slow query logs during the k6 run. Check `pg_stat_statements` for missing indexes.

---

### ✅ Step 36 — Monitoring setup

**Sentry (errors):**

```tsx
// apps/api: @sentry/node — init in main.ts before anything else
// apps/web: @sentry/react — wrap App in Sentry.ErrorBoundary
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV })
```

**Grafana Cloud (metrics + logs):**

> ⚠️ **v1.2 fix — Grafana Agent → Grafana Alloy:** Grafana Agent was replaced by **Grafana Alloy** (announced 2024, Agent deprecated). The old download URL (`grafana/agent`) returns 404 for new installs. Use Alloy instead.
> 

```bash
# Install Grafana Alloy on the Droplet (replaces deprecated Grafana Agent):
curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
  > /etc/apt/sources.list.d/grafana.list
apt-get update && apt-get install -y alloy
systemctl enable alloy && systemctl start alloy
# Config file: /etc/alloy/config.alloy
# Scrape Docker metrics + ship stdout logs to Grafana Loki
```

**BetterUptime (uptime):**

- HTTP monitor on `GET /health` every 3 minutes
- Alert: email + Telegram if down for 2 consecutive checks

**Alerts to configure:**

- API 5xx error rate > 5% for 5 minutes → Sentry alert
- DB connection pool > 80% → Grafana alert
- SMS delivery failure rate > 10% → custom metric from notification_log
- Disk usage > 80% → Grafana alert
- Droplet CPU > 90% for 10 minutes → Grafana alert

---

### ✅ Step 37 — Doctor onboarding + admin panel

Build a minimal admin UI (simple HTML table, no fancy design needed):

```
GET  /api/v1/admin/doctors/pending    List unverified doctor registrations
POST /api/v1/admin/doctors/:id/verify Approve → publishes DoctorVerified event
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

```bash
cd apps/mobile
npx react-native init MadagascarHealth --template react-native-template-typescript
pnpm add @react-navigation/native @react-navigation/stack
pnpm add react-native-safe-area-context react-native-screens
pnpm add @react-native-async-storage/async-storage
pnpm add react-native-permissions
pnpm add @notifee/react-native  # push notifications
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

```bash
pnpm add firebase-admin  # in apps/api
```

```tsx
// Add device token registration endpoint:
POST /api/v1/notifications/device-token
  Body: { token: string, platform: 'ios' | 'android' }
  → Store in notifications.device_tokens table (user_id, token, platform)

// Extend NotificationService to send push alongside SMS:
if (user.deviceToken) {
  await firebaseAdmin.messaging().send({
    token: user.deviceToken,
    notification: { title: 'Rappel RDV', body: 'Votre RDV est dans 2 heures' }
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
    amountMga: number;
    customerPhone: string;
    reference: string;        // appointment booking_reference
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
- [ ]  `pnpm init` + Turborepo at root; create `pnpm-workspace.yaml` (NOT in package.json)
- [ ]  Write `turbo.json` with build/dev/test/lint pipeline definitions
- [ ]  Write `docker-compose.yml` (postgres/postgis, redis, api stub, web stub — no bull-board container)
- [ ]  Write `docker-compose.test.yml` (postgres-test on 5433, redis-test on 6380, both on tmpfs)
- [ ]  Write `infra/docker/init-schemas.sql` (7 schemas + 3 extensions)
- [ ]  Scaffold NestJS in `apps/api` — global exception filter + response interceptor
- [ ]  Scaffold React + Vite in `apps/web` — route skeleton, Tailwind
- [ ]  `docker compose up` — everything green
- [ ]  Write the full Prisma schema (`prisma/schema.prisma`) — all entities from spec Section 5
- [ ]  `npx prisma migrate dev --name init` — verify in Prisma Studio
- [ ]  Commit with message: `feat: project foundation — monorepo, docker compose, prisma schema`

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

---

## 🛠️ Roadmap Review Summary — v1.2 Changes

> This section documents all changes made in the v1.2 review. All v1.1 changes remain documented in the v1.1 note below.
> 

| # | Location | v1.1 | v1.2 | Reason |
| --- | --- | --- | --- | --- |
| 1 | Phase 5, Step 26 — acceptance criterion | `localhost:3001` | `localhost:3000/admin/queues` | BullMQ board mounts inside the NestJS process; there is no separate container or port |
| 2 | Phase 0, Step 1 — `turbo.json` | `"pipeline": {}` key | `"tasks": {}` key | `"pipeline"` was renamed to `"tasks"` in Turborepo v2 — a hard breaking change that causes a startup error |
| 3 | Phase 3, Step 18b | `pnpm add -D @types/socket.io` | Remove entirely | [Socket.io](http://Socket.io) v4+ ships its own TypeScript types; `@types/socket.io` is for v2 and causes type conflicts with v4 |
| 4 | Phase 8, Step 33 | Missing install + wrong import | `pnpm add @nestjs/throttler @nest-lab/throttler-storage-redis`; import from `@nest-lab/...` | `ThrottlerStorageRedisService` is not in `@nestjs/throttler` — it requires a separate package; also `ttl` is milliseconds in v5+ |
| 5 | Phase 8, Step 36 | `curl grafana/agent` download | `apt install alloy` via Grafana apt repo | Grafana Agent is deprecated; replaced by Grafana Alloy; old download URL returns 404 |
| 6 | Phase 6, Step 28 — Nginx config | Missing WebSocket headers | Added `Upgrade`, `Connection: upgrade`, `proxy_http_version 1.1`, read/send timeouts | Without these headers Nginx drops [Socket.io](http://Socket.io) WebSocket upgrade handshakes silently |
| 7 | Phase 0, Step 3 | `// pnpm add @bull-board/...` comment | Added `express-basic-auth` to the install | `basicAuth()` call in `main.ts` requires `express-basic-auth` but no install was shown |
| 8 | Day 1 checklist | "do exactly these 10 things" (12 items listed) | Removed the incorrect count | Minor but confusing inconsistency |

---

*Roadmap version 1.2 · February 2026 · Derived from Technical Specification v1.3*

> 🔧 **Roadmap Review Note (v1.1):** This roadmap has been reviewed and corrected. Critical bugs fixed: (1) `SELECT FOR UPDATE` was on the wrong table — replaced with INSERT + unique constraint pattern, (2) `deadly0/bull-board` replaced with `@bull-board/nestjs` (incompatible with BullMQ), (3) pnpm workspace config moved to `pnpm-workspace.yaml`, (4) search SQL missing JOIN on `auth.users`, (5) refresh token delivery corrected to `Set-Cookie` header. Additions: `turbo.json`, `docker-compose.test.yml`, `docker-compose.prod.yml`, WebSocket gateway setup, Docker registry auth in CI, Terraform basics, i18n SMS template files.*
>