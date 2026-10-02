# README Structure Reference

Use this as the exact blueprint for every README you generate. Do not skip sections. If a section has no content, write a minimal accurate stub — never omit it entirely.

---

## 1. Project Title

```md
# Project Name

One-sentence description of what it does and who it's for.
```

Rules:
- Name comes from `package.json` `name` field or repo folder name
- One sentence only — no adjectives like "powerful" or "robust"
- Example: `API and web app for managing geospatial delivery zones in real time.`

---

## 2. Overview

```md
## Overview

Brief explanation of:
- What the application does
- The main problem it solves
- Key features (bullet list, 4–7 items)
```

Rules:
- Max 3 sentences of prose, then bullet list
- Features should be concrete (e.g. "Real-time zone assignment via PostGIS queries") not vague ("Powerful features")

---

## 3. Tech Stack

```md
## Tech Stack

**Frontend**
- React 18, Vite, TailwindCSS

**Backend**
- NestJS, TypeORM

**Database**
- PostgreSQL 15 + PostGIS 3.3

**Caching / Infrastructure**
- Redis 7 (BullMQ queues, session cache)

**Tooling**
- Docker, pnpm, ESLint, Prettier
```

Rules:
- Extract exact versions from `package.json` or lock files when possible
- Group by category — don't dump everything in one list
- Include major libraries, not every dependency

---

## 4. Architecture

```md
## Architecture

[prose: 2–3 sentences max explaining the interaction model]

```
Frontend (React + Vite)
        |
        v
Backend API (NestJS)
        |
        +---- Redis  (BullMQ job queues, session cache)
        |
        +---- PostgreSQL + PostGIS  (primary data store, geospatial queries)
```

**Component roles:**
- **Frontend** — SPA served via Vite dev server or static build
- **Backend API** — REST/GraphQL API, handles auth, business logic, job dispatch
- **Redis** — Async job queues (BullMQ), caches hot data
- **PostgreSQL + PostGIS** — Stores all persistent data; PostGIS enables spatial queries
```

Rules:
- ASCII diagram is required
- Each component must have a one-line role description
- If there are external services (S3, Stripe, etc.), include them in the diagram

---

## 5. Project Structure

```md
## Project Structure

```
/
├── frontend/        # React app (Vite)
├── backend/         # NestJS API
│   ├── src/
│   │   ├── modules/ # Feature modules
│   │   ├── common/  # Shared utilities, guards, pipes
│   │   └── config/  # App configuration
├── docker/          # Docker Compose and Dockerfiles
├── scripts/         # Dev utility scripts
└── docs/            # Additional documentation
```
```

Rules:
- Only show top 2–3 levels
- Add a comment for each top-level folder
- Use `tree` output if available, otherwise infer from `find`

---

## 6. Prerequisites

```md
## Prerequisites

- Node.js >= 20.x
- pnpm >= 8.x (or npm >= 10)
- PostgreSQL >= 15 with PostGIS extension
- Redis >= 7
- Docker & Docker Compose (optional, recommended)
```

Rules:
- List minimum versions — use actual versions from config files when available
- Mark Docker as optional if the app can run without it
- Don't list things that are transitive dependencies (e.g. don't list `bcrypt`)

---

## 7. Environment Variables

```md
## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

| Variable          | Description                              | Example                          |
|-------------------|------------------------------------------|----------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string             | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL`       | Redis connection string                  | `redis://localhost:6379`         |
| `JWT_SECRET`      | Secret key for signing JWTs             | `a-long-random-string`           |
| `PORT`            | Port the backend listens on              | `3000`                           |
```

Rules:
- Use a table, not a list
- Source from `.env.example` if it exists
- Explain what each variable does, not just its name
- Use realistic examples, never real secrets

---

## 8. Installation

```md
## Installation

```bash
# 1. Clone the repository
git clone https://github.com/org/repo.git
cd repo

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Set up the database
pnpm run db:migrate
```
```

Rules:
- Numbered steps with inline comments
- Use actual script names from `package.json`
- If Docker is available, add a Docker variant

---

## 9. Running the Application

```md
## Running the Application

**Start all services with Docker (recommended):**
```bash
docker compose up
```

**Or start services individually:**

```bash
# Start Redis and PostgreSQL
docker compose up redis postgres

# Backend
cd backend
pnpm run start:dev

# Frontend
cd frontend
pnpm run dev
```

App will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs (Swagger): http://localhost:3000/api
```

Rules:
- Docker path first if available
- Individual commands second
- Include URLs with actual ports from config

---

## 10. Database

```md
## Database

Uses **PostgreSQL 15** as the primary database with the **PostGIS** extension for geospatial data.

**Migrations:**
```bash
pnpm run db:migrate        # Run pending migrations
pnpm run db:migrate:revert # Revert last migration
pnpm run db:seed           # Seed development data
```

**PostGIS** is used for: [e.g. storing delivery zones as polygons, proximity queries, route calculations]
```

Rules:
- Explain PostGIS purpose specifically for this project — don't be generic
- Include all migration commands from `package.json`
- If using TypeORM, Prisma, etc., name the ORM

---

## 11. Redis Usage

```md
## Redis

Redis is used for:
- **Job Queues** — BullMQ processes async jobs (e.g. notifications, data sync)
- **Caching** — Short-lived cache for [specific hot data]
- **Session storage** — User session tokens
```

Rules:
- Be specific about what's cached or queued — infer from the codebase if needed
- List the library used (BullMQ, ioredis, etc.)

---

## 12. API Overview

```md
## API Overview

Base URL: `http://localhost:3000/api`

Full API documentation available at `/api` (Swagger UI) when running locally.

**Main modules:**

| Module     | Base Path      | Description                        |
|------------|----------------|------------------------------------|
| Auth       | `/auth`        | Login, register, token refresh     |
| Users      | `/users`       | User management                    |
| Zones      | `/zones`       | Geospatial zone CRUD               |

**Example request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'
```

**Example response:**
```json
{
  "access_token": "eyJhbGc...",
  "user": { "id": 1, "email": "user@example.com" }
}
```
```

Rules:
- Infer modules from `src/modules/` folder structure
- Include one real request/response example
- Link to Swagger if NestJS is used (it generates `/api` docs by default)

---

## 13. Testing

```md
## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage report
pnpm run test:cov
```
```

Rules:
- Use actual scripts from `package.json`
- If no tests exist, write: `> Tests are not yet configured.` — don't fabricate

---

## 14. Development Workflow

```md
## Development Workflow

**Branch naming:**
- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `chore/<description>` — maintenance

**Commit style:** [Conventional Commits](https://www.conventionalcommits.org/)
```
feat(zones): add polygon intersection query
fix(auth): handle expired token edge case
```

**Adding a new module (NestJS):**
```bash
cd backend
nest generate module <name>
nest generate service <name>
nest generate controller <name>
```
```

Rules:
- Infer from existing commits or `.commitlintrc` if available
- Include framework-specific scaffolding commands when applicable

---

## 15. Deployment

```md
## Deployment

**Docker:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

**Environment:** Set `NODE_ENV=production` and configure production `.env`.

[Add CI/CD pipeline info if found in `.github/workflows/` or similar]
```

Rules:
- Check for `docker-compose.prod.yml`, `.github/workflows/`, `Dockerfile`
- If no deployment config found: `> Deployment configuration not yet defined.`

---

## 16. Contributing

```md
## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes following the commit style above
4. Open a pull request against `main`

Please make sure tests pass before submitting: `pnpm run test`
```

Rules:
- Keep it short — this is not a full contributing guide
- Reference the commit style from section 14
- Link to a `CONTRIBUTING.md` if one exists
