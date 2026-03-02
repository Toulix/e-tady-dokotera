## Daily log

---

### 2026-03-02 — Phase 0 / Step 2: Docker Compose local dev environment

**Goal:** `docker compose up` starts all services. `localhost:3000` responds.

**Status:** ✅ Complete

#### What was implemented

**New files:**
- `apps/api/Dockerfile.dev` — Node 20-slim image; installs pnpm via corepack; copies `package.json` + tsconfig files; runs `pnpm install` (with native postinstall scripts allowed via `pnpm.onlyBuiltDependencies`); prisma generate left commented out pending Step 4
- `apps/web/Dockerfile.dev` — Same base; installs deps; explicitly copies only static config files (`index.html`, `vite.config.ts`, `tsconfig*.json`, `public/`) — never copies `node_modules/`

**Modified files:**
- `docker-compose.yml` — Added `api` (port 3000) and `web` (port 5173) services; `api` waits on postgres+redis health checks; env overrides swap `localhost` for Docker service names (`postgres`, `redis`)
- `apps/web/vite.config.ts` — Added `server: { host: true, port: 5173 }` so Vite binds to `0.0.0.0` inside the container
- `apps/api/package.json` — Added `pnpm.onlyBuiltDependencies` allowlist (mirrors root `package.json`, required because Docker build context is `./apps/api` and the root workspace config is not available)
- `apps/web/package.json` — Same fix; added `pnpm.onlyBuiltDependencies: ["esbuild"]` so esbuild's native binary compiles for Linux

#### Bugs hit and fixed

1. **`prisma generate` — schema not found.** Prisma can't find the schema because `prisma.config.ts` lives at a non-default location. Commented out the `prisma generate` step for now; will revisit in Step 4 once the schema location is confirmed.

2. **pnpm v10 security policy blocks postinstall scripts in Docker.** `pnpm install` inside the container silently skipped `@nestjs/core`, `@prisma/engines`, `msgpackr-extract`, and `esbuild` postinstall scripts. Root cause: the `pnpm.onlyBuiltDependencies` allowlist lives in the root `package.json`, which is outside the Docker build context (`./apps/api`). Fix: duplicate the allowlist into each app's `package.json`.

3. **`ts-node` crashes — `Unknown file extension ".ts"`.** The API Dockerfile originally only copied `package.json`. Without `tsconfig.json` in the container, `ts-node` falls back to Node's native ESM loader which rejects `.ts` extensions. Fix: added `tsconfig.json tsconfig.build.json` to the `COPY` instruction.

4. **`COPY . .` overwrites `node_modules` in the web container.** The web Dockerfile originally did `COPY . .` after `pnpm install`. Since `apps/web/node_modules/` exists on the host, Docker copied the host's `node_modules` on top of the freshly installed container deps, overwriting the Linux-compiled esbuild binary with wrong-platform versions. Fix: replaced `COPY . .` with explicit copies of only the static files needed to start Vite.

#### Acceptance verified

```
GET  localhost:3000/health        → {"success":true,"data":{"status":"ok","uptime":...}}
GET  localhost:5173               → HTTP 200 (Vite dev server)
GET  localhost:3000/admin/queues  → HTTP 401 (BullBoard running inside NestJS, password-protected)
     postgres                     → healthy (PostGIS 16-3.4, schemas initialised)
     redis                        → healthy (noeviction policy enforced)
```