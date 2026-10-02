# Stack Reference: NestJS + Prisma + PostGIS + Redis + Tailwind

This file is the primary reference for backend, infrastructure, and Tailwind CSS reviews.
React-specific patterns (hooks, components, state, a11y) are in the **react-code-reviewer** skill.

---

## 🏗️ NestJS

### Security
- **Guard coverage**: Every controller route must have a Guard (`@UseGuards`) or be explicitly
  marked as public. A missing guard on a sensitive route is 🔴 Critical.
  ```ts
  // Bad — no auth guard
  @Get('admin/users')
  getUsers() {}

  // Good
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/users')
  getUsers() {}
  ```
- **DTO validation**: All incoming request bodies and params MUST use `class-validator` +
  `class-transformer` via `ValidationPipe`. Missing validation is 🟠 High.
  ```ts
  // Bad
  @Post() create(@Body() body: any) {}

  // Good — with global ValidationPipe and a typed DTO
  @Post() create(@Body() createDto: CreateUserDto) {}
  ```
- **`@IsEnum`, `@IsUUID`, `@IsInt({ min: 0 })`** on DTO fields prevents type coercion attacks.
- **Never trust `req.user` without verifying the JWT strategy populates it correctly.**
- **CORS**: Ensure `app.enableCors()` uses an allowlist, not `origin: '*'` in production.
- **Rate limiting**: Check that sensitive endpoints (auth, password reset) use `@Throttle`.
- **Interceptors & sensitive data**: Ensure response interceptors strip fields like
  `password`, `hashedPassword`, `refreshToken` before serialization. Use `@Exclude()` on
  entity/DTO fields with `ClassSerializerInterceptor`.

### Performance
- **No blocking I/O in synchronous providers**: All service methods that touch DB, Redis,
  or external APIs must be `async` and properly `await`ed.
- **N+1 via Prisma**: Avoid calling `prisma.user.findUnique` inside a loop — use `findMany`
  with `where: { id: { in: ids } }` or Prisma's `include`.
- **Circular dependency injection**: Detected at startup but can cause subtle lazy-loading
  bugs. Use `forwardRef()` as a last resort; prefer restructuring.
- **Module scope**: Providers are singleton by default. Stateful providers shared across
  requests can cause data leakage. Use `@Injectable({ scope: Scope.REQUEST })` only when
  truly needed (it has a performance cost).
- **Middleware vs Interceptors vs Guards**: Use the right abstraction — middleware for
  request transformation, guards for auth, interceptors for response shaping/logging.

### Exception Handling
- Use NestJS built-in `HttpException` subclasses (`NotFoundException`, `ForbiddenException`,
  etc.) — don't throw raw `Error` objects from controllers.
- **Global exception filter**: Ensure one is registered to catch unhandled exceptions and
  prevent stack traces leaking to the client.
- **Async exception propagation**: Unhandled promise rejections inside event emitters or
  `setInterval` callbacks won't be caught by NestJS exception filters — handle explicitly.
- **Prisma error codes**: Handle `PrismaClientKnownRequestError` — especially `P2002`
  (unique constraint) and `P2025` (record not found) — and map to appropriate HTTP exceptions.
  ```ts
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') throw new ConflictException('Already exists');
      if (e.code === 'P2025') throw new NotFoundException('Not found');
    }
    throw e;
  }
  ```

### Maintainability
- **Module boundaries**: Each feature should be its own module. Cross-feature access via
  exported providers, not direct imports of another module's internal services.
- **Repository pattern**: Business logic should not have raw `prisma.*` calls scattered
  everywhere — wrap in a repository service for testability and swap-ability.
- **Config**: Use `@nestjs/config` with a validated schema (via `joi` or `zod`) at startup.
  Never `process.env.X` inline — missing env vars should fail fast at boot.
- **DTOs vs Entities**: Keep Prisma-generated types internal to the data layer. Expose
  dedicated response DTOs to the API layer (prevents accidentally leaking DB schema changes).

---

## 🗄️ Prisma

### Security
- **Raw queries**: `prisma.$queryRaw` and `prisma.$executeRaw` MUST use tagged template
  literals (`` prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}` ``) — never string
  concatenation. The tagged template version is parameterized; concatenation is SQL injection.
- **Field selection**: Use `select` or omit sensitive fields explicitly. Returning the full
  Prisma model object to the API layer risks leaking `password`, `refreshToken`, etc.
- **Soft deletes**: If using soft delete (`deletedAt`), ensure all queries filter
  `where: { deletedAt: null }` — Prisma has no automatic soft-delete filter without middleware.

### Performance
- **`select` over full model**: Only select needed fields — avoid `findMany` returning entire
  rows when only 2 fields are needed. Especially important for tables with text/blob fields.
- **Pagination**: Any `findMany` without `take`/`skip` or cursor pagination on a growing
  table is a ticking time bomb. Flag unbounded queries as 🟠 High.
- **`include` depth**: Deeply nested `include` (3+ levels) generates expensive JOINs.
  Consider splitting into separate queries or using `select` to limit fields.
- **Transactions**: Use `prisma.$transaction([...])` for multi-step writes that must be atomic.
  Missing transaction on related writes is a data integrity bug.
- **Connection pool**: In serverless/edge environments, use `@prisma/client` with connection
  pooling (`pgBouncer` / Prisma Accelerate). Each Lambda cold start creating a new pool is
  a known issue.
- **`upsert` vs `create`+`update`**: `upsert` is not atomic under concurrent load without
  unique constraints — ensure the `where` clause matches a unique index.

### Migrations
- Check that new columns have defaults or are nullable if the table is large (long locks).
- Avoid `ALTER TABLE` that rewrites the whole table in a hot migration.

---

## 🗺️ PostGIS

### Security
- **User-supplied coordinates**: Always validate lat/lng ranges (`-90 ≤ lat ≤ 90`,
  `-180 ≤ lng ≤ 180`) before constructing geometry. Invalid values can cause query errors
  or unexpected spatial results.
- **Raw spatial queries**: Same SQL injection rules as Prisma raw queries — use parameterized
  inputs, never string-interpolated coordinates.

### Performance
- **Spatial indexes**: Every column used in `ST_DWithin`, `ST_Intersects`, `ST_Contains`, etc.
  MUST have a GIST index. Missing spatial index on a geometry column is 🔴 Critical for
  any table with significant row count.
  ```sql
  CREATE INDEX idx_locations_geom ON locations USING GIST (geom);
  ```
- **`ST_DWithin` over `ST_Distance`**: For proximity queries, `ST_DWithin(geom, point, radius)`
  uses the spatial index. `WHERE ST_Distance(...) < radius` does NOT use the index — full
  table scan. This is a 🔴 Critical performance bug.
  ```sql
  -- Bad (no index usage)
  WHERE ST_Distance(geom, ST_MakePoint($1, $2)::geography) < 1000

  -- Good (index-aware)
  WHERE ST_DWithin(geom::geography, ST_MakePoint($1, $2)::geography, 1000)
  ```
- **Geography vs Geometry**: `geography` type accounts for Earth's curvature (accurate for
  distance in meters); `geometry` uses Cartesian math (fast, but only accurate for small areas
  or projected CRS). Flag mismatches between what the code implies and what type is used.
- **SRID consistency**: All geometry values must share the same SRID. Mixing SRID 4326
  (WGS84) and 3857 (Web Mercator) in a spatial operation silently produces wrong results.
- **`ST_AsGeoJSON` in SELECT**: Computing GeoJSON inside the DB query is fine for small
  results; for large result sets, consider returning raw coordinates and serializing in app.
- **Clustering**: For point-heavy maps, query clustered results in the DB
  (`ST_ClusterWithin`, `ST_ClusterDBSCAN`) rather than returning thousands of raw points
  to the client.

### Edge Cases
- `ST_MakePoint(lng, lat)` — note the order is **longitude first**, latitude second.
  Swapped coordinates are a classic silent bug.
- Empty geometry: `ST_IsEmpty(geom)` check before spatial operations on nullable columns.
- Antimeridian (±180° longitude): bounding box queries that cross the antimeridian require
  special handling.

---

## ⚡ Redis

### Security
- **Never store plain-text passwords or full JWT secrets in Redis** — store only session
  references or opaque tokens.
- **Key namespacing**: All keys must be namespaced (e.g., `session:{userId}`, `cache:products:{id}`)
  to prevent accidental cross-feature key collisions.
- **AUTH**: Redis instance must require authentication in all non-local environments.
- **TLS**: Redis connections in production must use TLS (rediss:// URL).

### Performance
- **TTL on every key**: Every key set with `SET` or `HSET` must have a TTL. Missing TTL
  causes unbounded memory growth — 🟠 High.
  ```ts
  // Bad
  await redis.set(`cache:${id}`, JSON.stringify(data));

  // Good
  await redis.set(`cache:${id}`, JSON.stringify(data), 'EX', 3600);
  ```
- **`KEYS *` in production**: `KEYS` is O(n) and blocks Redis. Use `SCAN` for key iteration.
- **Large values**: Storing large JSON blobs (>10KB) in Redis is a smell — consider whether
  the data should be in Postgres and cached more selectively.
- **Pipeline / multi-exec**: Multiple sequential Redis commands in a hot path should be
  batched with `pipeline()` to reduce round trips.
- **Cache stampede**: On cache miss, multiple concurrent requests can all hit the DB
  simultaneously. Use a mutex/lock pattern (Redis `SET NX`) to prevent thundering herd.

### NestJS Cache Integration
- `@nestjs/cache-manager` with `cache-manager-ioredis` or `ioredis` directly.
- Ensure `CacheModule` is configured with `isGlobal: true` if used across modules.
- `@CacheKey` and `@CacheTTL` decorators on controller methods for HTTP response caching.
- Manual cache invalidation: check that write operations invalidate relevant cache keys.

### Session / Queue Patterns
- **Bull/BullMQ queues**: Check for missing `removeOnComplete` / `removeOnFail` options —
  completed jobs accumulate in Redis without these.
- **Job idempotency**: Queue consumers must be idempotent — network failures can cause
  jobs to be retried.

---

## 🎨 Tailwind CSS (Frontend)

> **React-specific patterns** (hooks, state management, component architecture, re-renders,
> data fetching, a11y, security) are handled by the **react-code-reviewer** skill.
> This section covers only Tailwind CSS concerns that apply regardless of framework.

### Tailwind Patterns
- **Inline conditional class logic**: Long ternary chains in `className` are hard to read —
  use `clsx` or `tailwind-merge` for conditional classes.
  ```tsx
  // Bad
  className={`px-4 py-2 ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}

  // Good
  className={clsx('px-4 py-2', {
    'bg-blue-500 text-white hover:bg-blue-600': isActive && !disabled,
    'bg-gray-100 text-gray-700': !isActive,
    'opacity-50 cursor-not-allowed': disabled,
  })}
  ```
- **Arbitrary values**: `w-[347px]` is a smell — prefer design tokens or standard scale
  values. Flag when arbitrary values could be replaced with existing utilities.
- **`tailwind-merge`**: Required when merging Tailwind classes from props — without it,
  conflicting utilities like `p-4` and `p-2` both appear in the class string (last one wins
  in CSS, not the last one in the string, which is confusing).
- **Dark mode**: Check consistency — mixing `dark:` variants and manual theme toggling leads
  to flash-of-wrong-theme bugs.
- **Responsive prefixes**: Ensure breakpoints are mobile-first (`md:`, `lg:`) and not
  accidentally applied at the wrong breakpoint.

---

## 🔗 Full-Stack Integration Points

These cross-cutting issues span multiple layers and are easy to miss:

| Pattern | What to check |
|---|---|
| **Auth flow** | JWT issued by NestJS → stored as httpOnly cookie → sent on every request → Guard validates → user injected into request |
| **Error shape** | NestJS exception filter produces consistent `{ statusCode, message, error }` → frontend checks `error.response.data` consistently |
| **Pagination** | Backend `take`/`skip` or cursor → frontend passes `page`/`limit` params → response includes `total` for UI pagination |
| **Geolocation flow** | Browser `navigator.geolocation` → lat/lng sent to API → validated → `ST_DWithin` query with GIST index → GeoJSON response → rendered on map |
| **Cache invalidation** | Write endpoint in NestJS → invalidates Redis key → next read re-populates from Postgres |
| **Queue jobs** | API enqueues BullMQ job → worker processes → updates DB → optionally pushes update via WebSocket/SSE to React client |
| **DTO ↔ API contract** | Prisma model changes → update service DTOs → update API response types → update React API client types (ideally shared via a `types` package or OpenAPI codegen) |
