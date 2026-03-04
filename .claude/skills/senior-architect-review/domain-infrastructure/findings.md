# Infrastructure & DevOps Review — e-tady-dokotera

**Reviewer:** Senior DevOps Engineer / Infrastructure Architect
**Date:** 2026-03-03
**Documents reviewed:** `docs/spec.md` (v1.2/v1.3), `docs/roadmap.md` (v1.4)

**15 findings: 4 Critical, 3 High, 5 Medium, 3 Low**

---

## CRITICAL-1: Redis `--maxmemory-policy` in CI `options:` Block Does NOT Configure Redis

**Location:** `docs/roadmap.md`, Step 27, `.github/workflows/ci.yml`

**Problem:** `options:` in GitHub Actions service containers passes flags to `docker run`, not to the Redis server process. `--maxmemory` and `--maxmemory-policy` are Redis server startup parameters, not Docker run flags. Docker silently ignores them. CI Redis runs with default eviction policy. Memory-pressure BullMQ job loss bugs will not be caught in CI.

**Fix:** Use the Docker entrypoint override pattern:
```yaml
redis:
  image: redis:7-alpine
  options: >-
    --health-cmd "redis-cli ping"
    --health-interval 5s
    --health-retries 5
    --entrypoint redis-server
    -- --maxmemory 256mb --maxmemory-policy noeviction
```

Add a verification step:
```yaml
- name: Verify Redis noeviction policy
  run: |
    policy=$(redis-cli -h localhost -p 6379 CONFIG GET maxmemory-policy | tail -1)
    [ "$policy" = "noeviction" ] || { echo "ERROR: Redis policy is '$policy'"; exit 1; }
```

---

## CRITICAL-2: pnpm Version Mismatch (CI: v8, Docker: v10)

**Location:** `docs/roadmap.md`, Step 27 CI YAML; `apps/api/Dockerfile.dev`; `apps/web/Dockerfile.dev`

**Problem:** CI pins pnpm to v8. Dev Dockerfiles use `pnpm@latest` which is v10. pnpm v10 changed lockfile format, workspace resolution, and `onlyBuiltDependencies` security policy (v9+ only). Running `pnpm install --frozen-lockfile` in CI with v8 against a v10 lockfile will fail or silently install wrong versions.

**Fix:** Add `packageManager` to root `package.json`:
```json
{ "packageManager": "pnpm@10.12.1" }
```
In CI: remove `version:` key (pnpm/action-setup reads `packageManager` field).
In Dockerfiles: `RUN corepack enable && corepack prepare --activate`

---

## CRITICAL-3: No `prisma generate` Step in CI — All Prisma-Dependent Code Fails

**Location:** `docs/roadmap.md`, Step 27, `.github/workflows/ci.yml`

**Problem:** CI runs `pnpm install` then `pnpm turbo test` with no `prisma generate`. Every import of `@prisma/client` throws `@prisma/client did not initialize yet. Please run "prisma generate"`. All repository-touching tests fail.

**Fix:** Add after `pnpm install --frozen-lockfile`:
```yaml
- name: Generate Prisma Client
  run: pnpm --filter @madagascar-health/api exec prisma generate
  env:
    DATABASE_URL: postgresql://test:test@localhost:5432/test

- name: Init DB extensions and schemas
  run: |
    PGPASSWORD=test psql -h localhost -U test -d test -c "
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS doctors;
      CREATE SCHEMA IF NOT EXISTS appointments;
      CREATE SCHEMA IF NOT EXISTS scheduling;
      CREATE SCHEMA IF NOT EXISTS notifications;
      CREATE SCHEMA IF NOT EXISTS video;
      CREATE SCHEMA IF NOT EXISTS analytics;
    "

- name: Run database migrations
  run: pnpm --filter @madagascar-health/api exec prisma migrate deploy
  env:
    DATABASE_URL: postgresql://test:test@localhost:5432/test
```

Also uncomment `prisma generate` in `apps/api/Dockerfile.dev`.

---

## CRITICAL-4: `node_count = 1` Provides No Automated Failover — Contradicts Spec Section 4.2

**Location:** `docs/roadmap.md`, Step 28, `infra/terraform/main.tf`; `docs/spec.md` Section 4.2

**Problem:** Spec Section 4.2 claims "Managed PostgreSQL with automated failover (DigitalOcean Managed DB provides this)." But `node_count = 1` is a single-node cluster. DigitalOcean only provides automated failover with `node_count >= 2`. Hardware failure = 15–60 min manual recovery.

**Fix (Option A — preferred for MVP cost):** Update spec Section 4.2: "Single-node Managed PostgreSQL for MVP. Automated failover added at Phase 2 via `node_count = 2`."
**Fix (Option B — if failover is required from launch):** `size = "db-s-1vcpu-2gb"` and `node_count = 2` (~doubles DB cost).

---

## HIGH-1: Redis Health Check `${REDIS_PASSWORD}` Array Form — No Variable Substitution

**Location:** `docs/roadmap.md`, Step 28, `docker-compose.prod.yml`

**Problem:** Docker Compose substitutes variables in string values but NOT in array elements. `["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]` passes the literal string `${REDIS_PASSWORD}` to redis-cli. Redis was started with the real password (string form `command:` is substituted correctly). Authentication fails → container marked unhealthy → api depends_on redis healthy → entire production stack fails to start.

**Fix:** Use CMD-SHELL form:
```yaml
healthcheck:
  test: ["CMD-SHELL", "redis-cli -a $REDIS_PASSWORD ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 5s
```

---

## HIGH-2: No Production Dockerfile Exists — `docker build ./apps/api` Fails Immediately

**Location:** `docs/roadmap.md`, Step 27, `.github/workflows/deploy.yml`

**Problem:** The deploy workflow runs `docker build ./apps/api` with no `-f` flag. Docker looks for `./apps/api/Dockerfile` which does not exist. Only `Dockerfile.dev` exists, which uses `ts-node` (not compiled), has `prisma generate` commented out, and is a development hot-reload image — not suitable for production.

**Fix:** Create `apps/api/Dockerfile` (multi-stage production):
```dockerfile
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
RUN pnpm exec prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build

FROM node:20-slim AS production
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY prisma ./prisma
RUN addgroup --system app && adduser --system --ingroup app app
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## HIGH-3: CI Test DB Has No Extensions or Schemas — Integration Tests Fail

**Location:** `docs/roadmap.md`, Step 27, `.github/workflows/ci.yml`

**Problem:** GitHub Actions service containers do not support volume mounts for init SQL files. `infra/docker/init-schemas.sql` is never run in CI. All 7 module schemas and `postgis`/`pg_trgm` extensions are absent from the CI test database. Every integration test that references a schema throws `ERROR: schema "auth" does not exist`.

**Fix:** See CRITICAL-3 fix — the DB init step covers this.

---

## MEDIUM-1: Nginx `proxy_read_timeout 86400s` Applies to ALL Requests

**Location:** `docs/roadmap.md`, Step 28, Nginx config

**Problem:** 86400s is correct for WebSocket connections but holds HTTP API worker connections open for 24 hours on hung handlers. Under load this exhausts the Nginx connection pool.

**Fix:** Split WebSocket and HTTP routing:
```nginx
location /socket.io/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
}
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 30s;
  proxy_send_timeout 30s;
  proxy_connect_timeout 5s;
}
```

---

## MEDIUM-2: Terraform S3 Backend Missing `force_path_style` and `skip_region_validation`

**Location:** `docs/roadmap.md`, Step 28, `infra/terraform/main.tf`

**Problem:** DO Spaces uses path-style S3 URLs. Without `force_path_style = true`, Terraform constructs virtual-hosted URLs that fail. Without `skip_region_validation = true`, Terraform validates `us-east-1` against the AWS region list.

**Fix:**
```hcl
backend "s3" {
  endpoint                    = "fra1.digitaloceanspaces.com"
  region                      = "us-east-1"
  bucket                      = "madagascar-health-tfstate"
  key                         = "prod/terraform.tfstate"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true   # add
  force_path_style            = true   # add
}
```

---

## MEDIUM-3: k6 Script Syntax Error — Script Never Runs

**Location:** `docs/roadmap.md`, Step 35

**Problem:** Unclosed object literal in `http.post()` call (missing `}` after headers object). k6 fails to parse the script entirely.

**Fix:**
```javascript
const lockRes = http.post(
  `${BASE_URL}/slots/lock`,
  JSON.stringify({ doctor_id: doctorId, slot_time: slotTime }),
  {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    tags: { name: 'slot-lock' },
  },
);
```

---

## MEDIUM-4: Infrastructure Cost Estimate Inconsistency ($50/mo vs $15/mo for PostgreSQL)

**Location:** `docs/spec.md` Section 16.2; `docs/roadmap.md` Step 28 Terraform

**Problem:** Spec Section 16.2 lists ~$50/month for Managed PostgreSQL. Terraform provisions `db-s-1vcpu-1gb` which costs ~$15/month on DigitalOcean. Also `db-s-1vcpu-1gb` (1 GB RAM) is undersized for production PostGIS + concurrent connections.

**Fix:** Upgrade Terraform plan to `db-s-1vcpu-2gb` (~$30/month, 2 GB RAM) and update spec cost estimate accordingly.

---

## MEDIUM-5: Grafana Alloy Config References Deprecated `"experimental": true` Docker Flag

**Location:** `docs/roadmap.md`, Step 36

**Problem:** `"experimental": true` in `/etc/docker/daemon.json` was required for Docker <24 metrics. Docker 24+ makes this stable and generates deprecation warnings.

**Fix:** Remove `"experimental": true` from the example. Note only `"metrics-addr": "127.0.0.1:9323"` is needed on Docker 24+.

---

## LOW-1: `pnpm@latest` in Dockerfiles Is Non-Deterministic

**Severity:** Low
**Fix:** After adding `packageManager` to root `package.json`, use `RUN corepack enable && corepack prepare --activate` in Dockerfiles.

---

## LOW-2: Redis Dev Healthchecks Missing `timeout` and `retries`

**Severity:** Low
**Fix:**
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 3s
  retries: 5
  start_period: 2s
```

---

## LOW-3: No `client_max_body_size` in Nginx — File Uploads >1MB Rejected with 413

**Severity:** Low
**Fix:**
```nginx
client_max_body_size 10M;
```

---

## What Is Correctly Designed

- `postgis/postgis:16-3.4` image — correct version with PostGIS bundled
- `depends_on: condition: service_healthy` — correctly blocks API startup
- Port differentiation dev (5432/6379) vs test (5433/6380) — prevents conflicts
- `tmpfs` for test PostgreSQL — fast teardown
- `noeviction` in dev, test, and prod compose files
- Redis not externally exposed in production compose
- `prisma migrate deploy` BEFORE container swap in deploy workflow — correct order
- `doctl registry login` before `docker push`
- Per-commit image tags (`$GITHUB_SHA`) for rollback capability
- `docker image prune -f` post-deploy
- WebSocket headers (Upgrade, Connection, proxy_http_version 1.1) in Nginx
- `certbot --nginx` for Let's Encrypt
- DO Spaces as Terraform remote state — shared, prevents concurrent apply conflicts
- `acl = "private"` for object storage
- Grafana Alloy (not deprecated Agent)
- Redis memory alert at 70% of maxmemory — smart early-warning

---

## Summary Table

| ID | Severity | Issue |
|---|---|---|
| CRITICAL-1 | Critical | Redis `--maxmemory-policy` in CI `options:` — Docker flag, not Redis config — noeviction not applied |
| CRITICAL-2 | Critical | pnpm v8 in CI vs v10 in Docker — lockfile version mismatch |
| CRITICAL-3 | Critical | No `prisma generate` in CI — all Prisma tests fail |
| CRITICAL-4 | Critical | `node_count = 1` — no automated failover despite spec claiming it |
| HIGH-1 | High | `${REDIS_PASSWORD}` in array healthcheck form — no substitution, container always unhealthy |
| HIGH-2 | High | No production Dockerfile — deploy workflow fails immediately |
| HIGH-3 | High | CI test DB missing extensions and schemas |
| MEDIUM-1 | Medium | 86400s timeout on all Nginx routes including HTTP API |
| MEDIUM-2 | Medium | Missing `force_path_style` and `skip_region_validation` in Terraform S3 backend |
| MEDIUM-3 | Medium | k6 script syntax error — unclosed object literal |
| MEDIUM-4 | Medium | PostgreSQL cost estimate $50/mo vs Terraform-provisioned $15/mo plan |
| MEDIUM-5 | Medium | Deprecated `"experimental": true` in Grafana Alloy Docker config note |
| LOW-1 | Low | `pnpm@latest` in Dockerfiles is non-deterministic |
| LOW-2 | Low | Redis dev healthchecks missing `timeout` and `retries` |
| LOW-3 | Low | No `client_max_body_size` — uploads >1MB rejected with 413 |
