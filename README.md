# e-tady-dokotera

Healthcare appointment booking platform for Madagascar.

---

## What happens when you run `docker compose up`

This command starts the full local development stack: a database, a cache, a backend API, and a frontend — all wired together and ready to use. Here is exactly what Docker does, step by step.

---

### Step 1 — Docker reads `docker-compose.yml`

Docker parses the compose file and finds **4 services** to start:

| Service    | Role                          | Port   |
|------------|-------------------------------|--------|
| `postgres`  | PostgreSQL 16 + PostGIS        | 5432   |
| `redis`     | Redis 7 cache and job queue    | 6379   |
| `api`       | NestJS REST API                | 3000   |
| `web`       | React + Vite frontend          | 5173   |

---

### Step 2 — Infrastructure services start first (`postgres` and `redis`)

The `api` service declares `depends_on` with `condition: service_healthy`, meaning Docker will not start the API until both `postgres` and `redis` pass their health checks. This prevents the API from crashing on startup because the database is not ready yet.

**PostgreSQL** starts and runs its initialization script automatically:

```
infra/docker/init-schemas.sql  →  mounted at /docker-entrypoint-initdb.d/
```

That script does two things as soon as the database is created for the first time:

1. **Installs PostgreSQL extensions** — `postgis` (geospatial queries) and `pg_trgm` (fuzzy text search for doctor names).
2. **Creates all module schemas** — each domain module gets its own isolated namespace inside the single `e_tady_dokotera` database:

```
auth | doctors | appointments | scheduling | notifications | video | analytics | payments
```

PostgreSQL then confirms it is ready by responding to `pg_isready -U dev`. Only then does Docker allow the API to proceed.

**Redis** starts with a specific memory policy:

```
redis-server --maxmemory 256mb --maxmemory-policy noeviction
```

The `noeviction` policy is critical — it makes Redis reject new writes when memory is full rather than silently deleting existing data. If `allkeys-lru` were used instead, Redis could evict BullMQ job records, causing queued jobs (SMS notifications, reminders) to disappear without any error. Redis confirms it is alive by responding to `redis-cli ping`.

---

### Step 3 — The API image is built (`apps/api/Dockerfile.dev`)

If no image exists yet (first run), Docker builds it from [apps/api/Dockerfile.dev](apps/api/Dockerfile.dev). Here is what the build does, layer by layer:

**Layer 1 — Install pnpm (pinned version)**
```dockerfile
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
```
pnpm is pinned to `10.12.1` rather than `latest` so every developer and CI run gets the exact same package manager. An unpinned version can silently change behaviour between builds.

**Layer 2 — Copy manifests and install dependencies**
```dockerfile
COPY package.json tsconfig.json tsconfig.build.json ./
RUN pnpm install
```
Only `package.json` and TypeScript config files are copied at this stage — not `src/`. This is intentional: Docker caches each layer independently. If you only change application source code, Docker reuses the cached `node_modules` layer and skips reinstalling packages, making subsequent builds much faster.

**Layer 3 — Generate the Prisma client**
```dockerfile
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm exec prisma generate
```
Prisma reads the schema and generates a type-safe client tailored to the database models. This must happen at build time so the application can import `@prisma/client` when it starts. If the schema changes, rebuild the image.

The `src/` directory is **not copied into the image**. It is volume-mounted at runtime (see Step 4), which means you can edit source files on your machine and the running container sees the changes immediately.

---

### Step 4 — The web image is built (`apps/web/Dockerfile.dev`)

Docker builds the frontend image from [apps/web/Dockerfile.dev](apps/web/Dockerfile.dev):

**Install dependencies inside the container**
```dockerfile
RUN pnpm install
```
Dependencies are installed *inside* the container, not copied from your host machine. This matters because some packages (like `esbuild`) compile native binaries for the current operating system. If you copy your Mac's `node_modules` into a Linux container, those binaries will be the wrong platform and will crash.

**Copy only static config files**
```dockerfile
COPY index.html vite.config.ts tsconfig*.json ./
COPY public/ ./public/
```
`src/` is excluded here too — it is volume-mounted at runtime for the same reason as the API: so Vite's hot module replacement (HMR) can detect your file changes and instantly update the browser without rebuilding the image.

---

### Step 5 — Containers start and the API boots

With `postgres` and `redis` healthy, the `api` container runs:

```
pnpm dev
```

NestJS starts up and performs the following initialization in [apps/api/src/main.ts](apps/api/src/main.ts):

1. **Helmet** — sets secure HTTP response headers (XSS protection, content sniffing prevention, etc.).
2. **Cookie parser** — enables the API to read the `HttpOnly` refresh token cookie that the browser sends on every request.
3. **CORS** — allows only `http://localhost:5173` (the frontend) to make credentialed cross-origin requests. This prevents other websites from calling the API on behalf of a logged-in user.
4. **Validation pipe** — automatically validates every incoming request body against its DTO class. Unknown fields are stripped; invalid payloads are rejected with a `400` before they reach any business logic.
5. **Global prefix** — all API routes are mounted under `/api/v1` (e.g. `GET /api/v1/doctors`).
6. **Bull Board** — a web dashboard for inspecting BullMQ job queues, mounted at `/admin/queues` and protected by HTTP Basic Auth. This is not a separate container — it runs inside the NestJS process.
7. **Health endpoint** — `GET /health` is registered outside the `/api/v1` prefix so monitoring tools can check liveness without authentication.

**Environment variable resolution** — the compose file loads `.env` via `env_file`, then overrides two values that must differ inside Docker:

```yaml
environment:
  DATABASE_URL: "postgresql://dev:dev@postgres:5432/madagascar_health"
  REDIS_HOST: redis
```

Inside a Docker network, `localhost` means the container itself, not another service. The service names `postgres` and `redis` are the correct hostnames within the Docker network.

---

### Step 6 — The frontend starts

The `web` container runs `pnpm dev`, which starts the Vite development server. Vite is configured to bind to `0.0.0.0` (all network interfaces inside the container) so that Docker can forward port `5173` to your machine. If it only bound to `127.0.0.1` inside the container, the port mapping would silently not work.

---

### What you have when everything is running

```
http://localhost:5173          →  React frontend (Vite HMR active)
http://localhost:5173/wiki     →  Tech Stack Wiki (see below)
http://localhost:3000/api/v1   →  NestJS REST API
http://localhost:3000/health   →  Health check  {"success":true,"data":{"status":"ok"}}
http://localhost:3000/admin/queues  →  BullMQ dashboard (requires password)
localhost:5432                 →  PostgreSQL (user: dev, password: dev, db: e_tady_dokotera)
localhost:6379                 →  Redis
```

---

### Tech Stack Wiki

**URL:** `http://localhost:5173/wiki`

An interactive reference that explains every technology used in this project — what it is, why it was chosen, and what would break without it. Written for all developers, joining the team.

**Features:**
- 42 technologies documented across 18 categories (Backend, Database, Cache & Queue, Auth, Testing, etc.)
- Full-text search across names, categories, and descriptions
- Category filter pills to focus on one layer of the stack
- Sticky sidebar with scroll-based highlighting — jump to any technology instantly
- Quick Reference table at the bottom: maps common problems to the tool that solves them

The source data lives in [`apps/web/src/pages/wiki/techStackData.ts`](apps/web/src/pages/wiki/techStackData.ts). If you add a new dependency worth explaining to the project, add an entry there.

---

### Volume mounts — why your edits take effect immediately

| Host path           | Container path | Effect                                          |
|---------------------|----------------|-------------------------------------------------|
| `./apps/api/src`    | `/app/src`     | Edit backend code → NestJS reloads automatically |
| `./apps/web/src`    | `/app/src`     | Edit frontend code → Vite updates the browser instantly |
| `pgdata` (named volume) | `/var/lib/postgresql/data` | Database data persists across `docker compose down` and restarts |

---

### Common commands

```bash
# Start everything
docker compose up

# Start in the background
docker compose up -d

# View logs for one service
docker compose logs -f api

# Stop everything (data is preserved)
docker compose down

# Stop everything and delete the database volume (full reset)
docker compose down -v

# Rebuild images after changing a Dockerfile or adding a dependency
docker compose build
docker compose up
```

---

### First-time setup checklist

1. Copy the environment file and fill in any values you need:
   ```bash
   cp .env.example .env
   ```
2. Run the stack:
   ```bash
   docker compose up
   ```
3. Verify the API is healthy:
   ```bash
   curl http://localhost:3000/health
   # Expected: {"success":true,"data":{"status":"ok","uptime":...}}
   ```

The database schemas and extensions are created automatically on first run. No manual migration step is needed to get the local environment started.
