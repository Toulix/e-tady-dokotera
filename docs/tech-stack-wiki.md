# Tech Stack Wiki — e-tady-dokotera

**Audience:** All developers
**Last updated:** March 2026

This document explains every technology we use, **why** we chose it, and **what would go wrong** if we didn't use it. If you're new to the team, read this first.

---

## Table of Contents

1. [NestJS (Backend Framework)](#1-nestjs)
2. [TypeScript (Programming Language)](#2-typescript)
3. [Prisma (ORM)](#3-prisma)
4. [PostgreSQL (Database)](#4-postgresql)
5. [PostGIS (Geospatial Extension)](#5-postgis)
6. [pg_trgm (Fuzzy Search Extension)](#6-pg_trgm)
7. [Redis (Cache & Queue Backend)](#7-redis)
8. [BullMQ (Job Queue)](#8-bullmq)
9. [Socket.io (Real-time Communication)](#9-socketio)
10. [React 18 + Vite (Web Frontend)](#10-react--vite)
11. [Zustand (State Management)](#11-zustand)
12. [React Native (Mobile)](#12-react-native)
13. [OpenStreetMap + react-leaflet (Maps)](#13-openstreetmap--react-leaflet)
14. [Turborepo + pnpm (Monorepo Tooling)](#14-turborepo--pnpm)
15. [Docker + Docker Compose (Containerization)](#15-docker--docker-compose)
16. [Nginx (Reverse Proxy)](#16-nginx)
17. [Cloudflare (CDN + WAF)](#17-cloudflare)
18. [Jitsi Meet (Video Consultation)](#18-jitsi-meet)
19. [JWT (Authentication Tokens)](#19-jwt)
20. [Helmet (HTTP Security Headers)](#20-helmet)
21. [cookie-parser (Cookie Handling)](#21-cookie-parser)
22. [@nestjs/event-emitter (Domain Events)](#22-nestjs-event-emitter)
23. [GitHub Actions (CI/CD)](#23-github-actions)
24. [Sentry (Error Monitoring)](#24-sentry)
25. [Grafana Cloud (Metrics & Logging)](#25-grafana-cloud)
26. [DigitalOcean (Cloud Hosting)](#26-digitalocean)
27. [Passport + Passport-JWT (Authentication Strategy)](#27-passport--passport-jwt)
28. [bcrypt (Password Hashing)](#28-bcrypt)
29. [class-validator + class-transformer (Input Validation)](#29-class-validator--class-transformer)
30. [Luxon (Date & Time)](#30-luxon)
31. [Tailwind CSS (Styling)](#31-tailwind-css)
32. [Terraform (Infrastructure as Code)](#32-terraform)
33. [ESLint + Prettier (Code Quality)](#33-eslint--prettier)
34. [Jest + Supertest (Testing)](#34-jest--supertest)
35. [k6 (Load Testing)](#35-k6)
36. [@nestjs/throttler (Rate Limiting)](#36-nestjs-throttler)
37. [Africa's Talking (SMS Gateway)](#37-africas-talking)
38. [Amazon SES (Email)](#38-amazon-ses)
39. [Swagger / OpenAPI (API Documentation)](#39-swagger--openapi)
40. [Grafana Alloy + Loki (Log Collection)](#40-grafana-alloy--loki)
41. [PgBouncer (Connection Pooling — Phase 2)](#41-pgbouncer)
42. [Firebase Cloud Messaging (Mobile Push Notifications)](#42-firebase-cloud-messaging)

---

## 1. NestJS

**What it is:**
NestJS is a Node.js backend framework for building server-side applications. Think of it as the skeleton of our API — it organizes our code into **modules**, handles incoming HTTP requests, and manages how different parts of the app talk to each other.

**Why we use it:**
- **Built-in module system.** Our app is split into independent modules (auth, doctors, appointments, etc.). NestJS enforces this structure natively — you don't have to invent your own way to organize code.
- **Dependency injection.** Instead of creating objects manually with `new SmsService()`, NestJS automatically creates and passes ("injects") services where they're needed. This makes swapping implementations easy (e.g., switching from a real SMS provider to a mock for testing).
- **TypeScript-first.** The whole team writes TypeScript on both frontend and backend. NestJS is built for TypeScript, so there's zero friction.
- **Rich ecosystem.** Libraries for authentication (Passport), queues (BullMQ), WebSockets (Socket.io), and database (Prisma) all have official NestJS integrations.

**Without it:**
You'd need to build your own module system, dependency injection, and request pipeline from scratch using plain Express.js. That's weeks of plumbing work that delivers zero user value, plus every new developer would need to learn your custom conventions.

---

## 2. TypeScript

**What it is:**
TypeScript is JavaScript with **types**. When you write `function getDoctor(id: string): Doctor`, TypeScript checks at build time that you actually pass a string and that the return value matches the `Doctor` shape. Errors are caught before the code runs.

**Why we use it:**
- **Catch bugs early.** If you accidentally pass a number where a string is expected, TypeScript tells you immediately — not at 2 AM in production.
- **One language everywhere.** Backend (NestJS), frontend (React), mobile (React Native) — all TypeScript. A developer can move between layers without learning a new language.
- **Self-documenting code.** Types act as living documentation. When you see `appointment: { doctorId: string, startTime: Date, status: 'pending' | 'confirmed' }`, you understand the data shape without reading a separate doc.

**Without it:**
You'd use plain JavaScript. Bugs caused by wrong types (`undefined is not a function`) would only surface at runtime. In a healthcare app, that could mean a patient's appointment silently fails to book.

---

## 3. Prisma

**What it is:**
Prisma is an **ORM** (Object-Relational Mapper). It lets you interact with the database using TypeScript code instead of writing raw SQL for every query.

```typescript
// Instead of: SELECT * FROM doctors WHERE specialty = 'cardiology'
const doctors = await prisma.doctor.findMany({
  where: { specialty: 'cardiology' }
});
```

It also manages **migrations** — when you change the database structure (add a column, create a table), Prisma generates the SQL migration files and applies them safely.

**Why we use it:**
- **Type-safe queries.** If you try to filter by a column that doesn't exist, TypeScript catches it before you run the code.
- **Automatic migrations.** Change the schema file, run `prisma migrate`, and the database updates. No hand-writing ALTER TABLE statements.
- **Schema as documentation.** The `schema.prisma` file is the single source of truth for what our database looks like.

**Without it:**
You'd write raw SQL strings everywhere, which are invisible to TypeScript (no autocomplete, no type checking). Database migrations would be manual SQL files that you'd have to track and apply by hand. Schema drift between code and database would be a constant problem.

**Important project rule:** Prisma calls only happen inside Repository classes — never in controllers or services. This keeps database access in one place and makes it easy to swap or test.

---

## 4. PostgreSQL

**What it is:**
PostgreSQL (often called "Postgres") is our **relational database** — the place where all persistent data lives: users, doctors, appointments, schedules, notifications.

**Why we use it (and not MySQL, MongoDB, etc.):**
- **Schema-per-module.** PostgreSQL supports multiple schemas within a single database. Each module (auth, doctors, appointments...) gets its own schema. This enforces data boundaries without running multiple database instances.
- **Advanced features built in.** Full-text search (`pg_trgm`), geospatial queries (`PostGIS`), JSON columns, row-level locking — all available without adding external services.
- **Data integrity.** Foreign keys, constraints, and transactions guarantee that an appointment always references a real doctor and a real patient. A NoSQL database like MongoDB doesn't enforce this.
- **Proven in healthcare.** When a patient books an appointment, that booking must either fully succeed or fully fail (a "transaction"). PostgreSQL's ACID transactions guarantee this. MongoDB offers weaker guarantees by default.

**Without it:**
With MongoDB, you'd lose relational integrity (a booking could reference a deleted doctor), schema enforcement (any shape of data could be inserted), and multi-table transactions. You'd end up reimplementing most of what PostgreSQL gives you for free — badly.

---

## 5. PostGIS

**What it is:**
PostGIS is a **PostgreSQL extension** that adds geographic capabilities. It lets the database understand and query locations (latitude/longitude points, distances, areas).

**Where we use it:**
The "Near Me" feature — when a patient searches for doctors nearby, PostGIS calculates distances efficiently:

```sql
-- Find doctors within 5km of the patient
SELECT * FROM doctors.profiles
WHERE ST_DWithin(geolocation, ST_MakePoint(47.5, -18.9)::geography, 5000);
```

**Why we use it:**
- **Fast spatial queries.** PostGIS uses spatial indexes (GIST) to find nearby doctors in milliseconds, even with thousands of records.
- **Correct distance calculation.** It uses proper geographic math (accounting for Earth's curvature), not naive lat/lng subtraction.
- **No extra service.** It's a free extension to PostgreSQL — no separate geospatial API or service to maintain.

**Without it:**
You'd either calculate distances in application code (slow — requires loading ALL doctors from the database, then filtering), or use Google Maps Distance Matrix API (expensive — charges per request). Neither scales well.

---

## 6. pg_trgm

**What it is:**
`pg_trgm` is a PostgreSQL extension for **fuzzy text search**. It breaks words into groups of three characters ("trigrams") and compares them to find similar-sounding matches.

**Where we use it:**
Doctor search. When a patient types "kardyoloji" instead of "cardiologie", pg_trgm still finds cardiologists because the trigrams overlap enough.

```sql
-- Fuzzy match on doctor name or specialty
SELECT * FROM doctors.profiles
WHERE name % 'Rakoto'  -- % is the similarity operator
ORDER BY similarity(name, 'Rakoto') DESC;
```

**Why we use it:**
- **Typo tolerance.** Patients in Madagascar may search in Malagasy, French, or English with varying spelling. Exact-match search would return zero results for common misspellings.
- **No extra infrastructure.** It's a PostgreSQL extension — no need for Elasticsearch or Algolia until we have 100k+ doctors.
- **Simple.** One `CREATE EXTENSION pg_trgm;` and it works. No new service to deploy or maintain.

**Without it:**
Search would only work with exact matches. A patient typing "Rakt" wouldn't find "Dr. Rakoto." You'd need to build or buy a separate search service much earlier than necessary.

---

## 7. Redis

**What it is:**
Redis is an **in-memory data store**. It stores data in RAM (not on disk like PostgreSQL), making reads and writes extremely fast — microseconds instead of milliseconds.

**Where we use it (multiple critical roles):**

| Use case | How it works |
|----------|-------------|
| **Session / refresh tokens** | Stores refresh tokens with a 7-day TTL. When a token expires, Redis automatically deletes it. |
| **Slot locking** | When a patient starts booking, a Redis key locks that time slot for 10 minutes. Other patients see it as unavailable. |
| **Rate limiting** | Counts requests per IP per minute. If someone sends 100+ requests, they get blocked. Prevents abuse. |
| **BullMQ backend** | BullMQ stores all its job data (pending, active, failed jobs) in Redis. More on this below. |
| **JWT denylist** | When an admin suspends a user, their token ID is added to a Redis set. The auth guard checks this set on every request. |

**Why we use it:**
- **Speed.** Checking "is this slot locked?" or "is this token valid?" happens on every booking and every API request. These must be fast — Redis responds in <1ms.
- **Automatic expiry (TTL).** Set a key with a time-to-live and Redis deletes it automatically. Perfect for slot locks (10 min), sessions (7 days), and rate limit counters (1 min).
- **Required by BullMQ.** BullMQ cannot work without Redis. No Redis = no background job processing.

**Without it:**
- Slot locking would require polling PostgreSQL on every check — slow and puts unnecessary load on the main database.
- Rate limiting would need a separate service or database queries on every request.
- BullMQ simply wouldn't run. You'd need to process everything synchronously (blocking the API) or find a completely different queue system.

**Critical config note:** Redis in this project MUST use `--maxmemory-policy noeviction`. The default `allkeys-lru` policy silently deletes old keys when memory is full — including BullMQ job data. This means SMS reminders would silently disappear without any error.

---

## 8. BullMQ

**What it is:**
BullMQ is a **job queue** library. It lets you say "do this task later" or "do this task in the background" without blocking the API response.

**Where we use it:**

| Queue | Job | Triggered by |
|-------|-----|-------------|
| `sms-immediate` | Send booking confirmation SMS | Patient books an appointment |
| `sms-reminder` | Send reminder SMS (72h, 24h, 2h before) | `AppointmentBooked` event |
| `slot-lock` | Release expired slot locks | 10 minutes after a lock is created |
| `analytics` | Record events for reporting | Various domain events |

**Real example — what happens when a patient books:**

1. Patient clicks "Book" → API saves appointment to PostgreSQL → API responds "Success!" in ~200ms
2. *In the background*, BullMQ picks up the job and sends the SMS confirmation
3. BullMQ also schedules three future reminder jobs (72h, 24h, 2h before the appointment)

The patient gets an instant response. The SMS arrives seconds later. The reminders arrive on schedule.

**Why we use it:**
- **Non-blocking.** Sending an SMS takes 1-3 seconds (network call to Orange Madagascar's API). Without a queue, the patient would stare at a loading spinner for 3 seconds after clicking "Book."
- **Retry on failure.** If the SMS provider is temporarily down, BullMQ retries the job automatically (with exponential backoff). Without it, the SMS is simply lost.
- **Scheduled jobs.** "Send a reminder in exactly 24 hours" is a single line: `queue.add('reminder', data, { delay: 86400000 })`. Without BullMQ, you'd need a cron job polling the database every minute — wasteful and imprecise.
- **Visibility.** Bull Board (the admin dashboard at `/admin/queues`) lets you see every pending, active, completed, and failed job. When a patient complains "I didn't get my SMS", you can look up the exact job, see the error, and retry it with one click.

**Without it:**
- SMS would be sent **synchronously** — every booking request takes 3+ seconds.
- Failed SMS sends are lost forever. No retry, no record.
- Scheduled reminders would need a cron job waking up every minute to query the database for upcoming appointments. This is slow, wasteful, and easy to get wrong (timezone bugs, missed executions, duplicate sends).
- Debugging would mean grepping through logs hoping to find why an SMS wasn't sent.

---

## 9. Socket.io

**What it is:**
Socket.io provides **real-time, two-way communication** between the server and the browser. Unlike normal HTTP (browser asks, server answers), Socket.io keeps a persistent connection open so the server can push updates to the browser at any time.

**Where we use it:**
- **Live slot availability.** When Patient A locks a time slot, all other patients viewing that doctor's schedule instantly see the slot become unavailable — no page refresh needed.
- **In-app notifications.** Appointment confirmations, status changes, and chat messages appear in real time.

**How it works in our app:**

```
Patient A books 10:00 AM slot
       ↓
Server locks the slot
       ↓
Server pushes "slot-locked" event via Socket.io
       ↓
Patient B's browser receives the event
       ↓
Patient B's UI instantly grays out the 10:00 AM slot
```

**Why we use it:**
- **Instant updates.** Without WebSockets, Patient B would need to refresh the page (or we'd need to poll the server every 2 seconds) to see that a slot was taken.
- **Reduced server load.** Polling (asking "any updates?" every 2 seconds) creates enormous unnecessary traffic. WebSockets only send data when something actually changes.
- **Better user experience.** Patients see real-time availability, which prevents double-bookings and reduces frustration.

**Without it:**
Two patients could both see the same slot as "available," both click "Book," and one would get an error. This is a terrible user experience. With Socket.io, the second patient sees the slot disappear the moment the first patient starts booking.

---

## 10. React 18 + Vite

**What it is:**
- **React** is a JavaScript library for building user interfaces. You describe what the UI should look like, and React updates the screen efficiently when data changes.
- **Vite** is a build tool that runs your React app in development. It starts in <1 second and updates the browser instantly when you save a file (Hot Module Replacement / HMR).

**Why React:**
- **Component-based.** The appointment card, doctor profile, search bar — each is a reusable component. Build once, use everywhere.
- **Huge ecosystem.** Need a date picker for appointment selection? A map component? A form library? There are well-maintained React packages for all of them.
- **Code sharing with mobile.** Our mobile app uses React Native (same concepts, same language). Developers move between web and mobile without relearning.

**Why Vite (and not Create React App or Webpack):**
- **Speed.** Vite starts in ~300ms. Create React App (Webpack) takes 10-30 seconds. When you save a file, Vite updates the browser in <50ms. Webpack can take 2-5 seconds.
- **Modern.** Create React App is deprecated (no longer maintained). Vite is the current standard.
- **Simple config.** A `vite.config.ts` file with 10 lines vs. Webpack's 100+ line config that nobody understands.

**We build a PWA (Progressive Web App):**
The React app can be "installed" on a phone's home screen and work offline for basic features. This matters in Madagascar where internet connectivity is intermittent — patients can still view cached doctor profiles and their upcoming appointments.

**Without Vite:**
Development would be painfully slow. Every code change → wait 5 seconds → see the result. Over a full day of development, that adds up to 30+ minutes of staring at a loading screen.

---

## 11. Zustand

**What it is:**
Zustand is a **state management** library for React. "State" is any data your app needs to remember: the logged-in user, the current search filters, the selected appointment slot.

**Simple example:**

```typescript
// Define a store
const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, accessToken: null }),
}));

// Use it in any component
function Navbar() {
  const user = useAuthStore((state) => state.user);
  return <span>Hello, {user?.name}</span>;
}
```

**Why we use it (and not Redux):**
- **Minimal boilerplate.** Redux requires actions, reducers, action creators, selectors, and a store setup file. Zustand needs one `create()` call.
- **Easy to learn.** A junior developer can understand Zustand in 15 minutes. Redux takes days.
- **Sufficient.** Our app's state is not complex enough to justify Redux's overhead. We store the access token, user profile, and a few UI flags. Zustand handles this perfectly.

**Security note:** The JWT access token is stored in Zustand (in memory). It is **never** saved to localStorage or sessionStorage, because those can be read by malicious scripts (XSS attacks). When the browser tab closes, the token is gone — the user gets a new one via the refresh token cookie.

**Without it:**
You'd either use React's built-in `useState`/`useContext` (gets messy when many components need the same data) or Redux (too much boilerplate for our needs). Zustand hits the sweet spot.

---

## 12. React Native

**What it is:**
React Native lets you build **native mobile apps** (iOS + Android) using React and TypeScript — the same tools our web developers already know.

**Why we use it (and not Flutter or native Swift/Kotlin):**
- **Same language as the web app.** Our team writes TypeScript. React Native uses TypeScript. No need to hire Swift/Kotlin developers or learn Dart (Flutter).
- **Shared logic.** Business logic (API calls, data validation, date formatting) can be shared between the web and mobile apps via our `packages/shared-types/` workspace.
- **One codebase, two platforms.** Write once, deploy to both iOS and Android. Maintaining two separate native codebases would double the development effort.

**Without it:**
You'd need separate iOS (Swift) and Android (Kotlin) teams, each implementing the same features independently. Bug fixes would need to be applied twice. Feature parity would constantly drift. For a startup in Madagascar, this is an unaffordable luxury.

---

## 13. OpenStreetMap + react-leaflet

**What it is:**
- **OpenStreetMap (OSM)** is a free, open-source map of the world — like Google Maps but without per-request charges.
- **react-leaflet** is a React component library that displays OSM maps in the browser.

**Where we use it:**
- Showing doctor/facility locations on a map
- "Near Me" search results displayed geographically
- Patients can see how far a clinic is and get directions

**Why we use it (and not Google Maps):**
- **Zero cost.** Google Maps charges $7 per 1,000 map loads after 28,000 free monthly loads. For a healthcare app in Madagascar with potentially thousands of daily users, this adds up fast.
- **Good Madagascar coverage.** OSM has adequate coverage of Madagascar's cities, roads, and points of interest for our use case.
- **Swappable.** Thanks to the adapter pattern, we can switch to Google Maps later if the product team decides the UX is worth the cost.

**Without it (using Google Maps):**
At 10,000 daily active users viewing maps, Google Maps would cost ~$500/month just for map tiles. That's more than our entire server infrastructure. OSM costs $0.

---

## 14. Turborepo + pnpm

**What they are:**
- **pnpm** is a package manager (like npm or yarn) that installs Node.js dependencies. It's faster and uses less disk space because it shares packages between projects.
- **Turborepo** is a build system for **monorepos** — repositories that contain multiple projects (in our case: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared-types`).

**Why a monorepo:**
Our API, web app, and mobile app all live in one repository. This means:
- Shared TypeScript types between frontend and backend (change once, both update)
- One pull request can update the API endpoint AND the frontend that calls it
- Consistent linting, testing, and build configuration across all projects

**Why Turborepo:**
- **Smart caching.** If you only changed the web app, Turborepo skips rebuilding the API. This makes `pnpm build` fast.
- **Parallel execution.** Turborepo runs independent tasks (lint web + lint api) in parallel automatically.
- **Dependency graph awareness.** It knows that `apps/web` depends on `packages/shared-types`, so it builds shared-types first.

**Why pnpm (and not npm or yarn):**
- **Disk space.** npm creates a separate copy of every package in every project. pnpm shares packages via hard links — saving gigabytes on developer machines.
- **Strictness.** pnpm doesn't let you accidentally import packages you didn't explicitly declare as dependencies (a common npm bug called "phantom dependencies").
- **Speed.** 2-3x faster than npm for installs.

**Without them:**
- Without Turborepo: `pnpm build` would rebuild everything every time, even if you only changed one file. CI would be slow.
- Without pnpm: `node_modules` would consume 2-3x more disk space, installs would be slower, and phantom dependency bugs would creep in.
- Without a monorepo: API types and frontend types would drift apart. A backend developer could change an endpoint response shape without the frontend team knowing until it breaks in production.

---

## 15. Docker + Docker Compose

**What it is:**
- **Docker** packages an application and all its dependencies into a **container** — a lightweight, portable unit that runs identically on every machine.
- **Docker Compose** defines multi-container setups in a single file. Our `docker-compose.yml` starts PostgreSQL, Redis, the API, and the web app with one command: `docker compose up`.

**Why we use it:**
- **"Works on my machine" is dead.** Every developer gets the exact same PostgreSQL version, Redis version, and Node.js version. No more "it works on my laptop but not yours."
- **One-command setup.** A new developer clones the repo, runs `docker compose up`, and has a fully working local environment in minutes — not hours of installing and configuring databases.
- **Production parity.** The Docker containers we develop in are nearly identical to what runs in production. Bugs from environment differences are eliminated.

**Without it:**
Every developer would need to manually install PostgreSQL 16, Redis 7, PostGIS, and Node.js 20 on their local machine. Mac, Windows, and Linux all have different installation steps. Configuration drift between developers would cause constant "works on my machine" bugs.

---

## 16. Nginx

**What it is:**
Nginx (pronounced "engine-x") is a **reverse proxy** — it sits in front of our NestJS application and handles incoming internet traffic.

**What it does for us:**

```
Internet → Cloudflare → Nginx → NestJS app
```

| Role | What Nginx does |
|------|----------------|
| **SSL termination** | Handles HTTPS encryption so NestJS doesn't have to |
| **Static files** | Serves the React app's HTML/CSS/JS files directly (faster than Node.js) |
| **Load balancing** | If we later run multiple NestJS instances, Nginx distributes requests between them |
| **WebSocket routing** | Passes Socket.io connections through with the correct `Upgrade` headers |
| **Request limits** | Caps request body size at 10MB (prevents abuse) |
| **Rate limiting** | First line of defense against brute-force attacks |

**Without it:**
NestJS would be directly exposed to the internet. It would need to handle SSL certificates, serve static files (it's bad at this), and absorb malicious traffic directly. Node.js is single-threaded — a flood of requests could block the entire application. Nginx handles thousands of concurrent connections efficiently where Node.js would choke.

---

## 17. Cloudflare

**What it is:**
Cloudflare is a **CDN (Content Delivery Network) + WAF (Web Application Firewall)** service. It sits between the internet and our server.

**What it does:**

| Role | Explanation |
|------|------------|
| **CDN** | Caches static files (images, CSS, JS) on servers worldwide. A patient in Toamasina loads assets from a nearby Cloudflare server instead of from our DigitalOcean server in another region. |
| **DDoS protection** | Absorbs malicious traffic floods before they reach our server. Free tier handles most attacks. |
| **WAF** | Blocks common attacks (SQL injection, XSS) using the OWASP rule set. |
| **SSL certificates** | Provides free HTTPS certificates automatically. No manual certificate management. |
| **DNS** | Manages our domain's DNS records with fast global resolution. |

**Without it:**
- Our server would need to handle all traffic directly — including attack traffic.
- Static files would be served from a single server in one region — slow for patients far from that server.
- SSL certificates would need manual setup and renewal (Let's Encrypt is free but requires cron job management).
- A basic DDoS attack could take the entire platform offline.

**Cost:** Free tier covers all our MVP needs. Pro tier ($20/month) adds advanced WAF rules if needed.

---

## 18. Jitsi Meet

**What it is:**
Jitsi Meet is a **free, open-source video conferencing platform** (like Zoom, but self-hosted). It uses WebRTC technology for peer-to-peer video calls directly in the browser — no app download needed.

**Where we use it:**
Online medical consultations. A doctor and patient join a video call from their browsers. The system falls back to audio-only if the connection is poor (common in rural Madagascar).

**Why we use it (and not Zoom, Twilio, or Daily.co):**
- **Self-hosted.** We run Jitsi on our own server. Patient medical consultations stay on our infrastructure — important for data privacy compliance with Madagascar law.
- **Free.** Zoom API costs $100+/month. Twilio Video charges per participant-minute. Jitsi costs only the server it runs on (~$40/month for a small DigitalOcean Droplet).
- **No download required.** Patients open a link in their browser and the call starts. No app store, no account creation.
- **Audio fallback.** Built-in handling for poor connections — critical for rural Madagascar where bandwidth is limited.

**Without it:**
Video consultations would require a paid service (Twilio Video at ~$0.004/participant-minute = ~$200/month for 500 consultations) or patients would need to download a separate app (Zoom), adding friction and reducing adoption.

---

## 19. JWT (JSON Web Tokens)

**What it is:**
JWT is a standard for **authentication tokens**. When a user logs in, the server creates a signed token containing the user's ID and role. The browser sends this token with every API request to prove who it is.

**How it works in our app:**

```
1. Patient logs in → Server verifies credentials
2. Server creates two tokens:
   - Access token (lives 15 minutes, stored in Zustand memory)
   - Refresh token (lives 7 days, stored in HttpOnly cookie)
3. Every API request includes the access token
4. When the access token expires, the browser silently uses the
   refresh token cookie to get a new one
5. The patient never notices — they stay logged in for 7 days
```

**Why two tokens:**
- **Access token (15 min):** Short-lived, so if stolen, the damage window is tiny. Stored in memory only — disappears when the tab closes.
- **Refresh token (7 days):** Long-lived for convenience, but stored in an HttpOnly cookie that JavaScript cannot read — immune to XSS attacks.

**Without it:**
You'd need server-side sessions for every user (storing state in the database for every request), which is slower and harder to scale. Or you'd use a single long-lived token, which is a security risk — if stolen, the attacker has access for days.

---

## 20. Helmet

**What it is:**
Helmet is a tiny middleware that sets **HTTP security headers** on every response from our API. These headers tell browsers to enable security features.

**What it sets:**

| Header | What it does |
|--------|-------------|
| `X-Content-Type-Options: nosniff` | Prevents browsers from guessing file types (stops some attacks) |
| `X-Frame-Options: DENY` | Prevents our app from being loaded in an iframe (stops clickjacking) |
| `Strict-Transport-Security` | Forces HTTPS — browsers refuse to connect via plain HTTP |
| `X-XSS-Protection` | Enables browser's built-in XSS filter |
| `Content-Security-Policy` | Controls which scripts/styles/images can load (prevents injection attacks) |

**Why we use it:**
It's one line of code (`app.use(helmet())`) that closes a whole category of common web security vulnerabilities. Not using it is like leaving your front door unlocked — it costs nothing to lock it.

**Without it:**
The API would be vulnerable to clickjacking, MIME-type sniffing attacks, and wouldn't enforce HTTPS. These are items on every security audit checklist. Failing to set them would be flagged immediately.

---

## 21. cookie-parser

**What it is:**
A simple Express/NestJS middleware that **reads cookies** from incoming HTTP requests and makes them available as `req.cookies`.

**Why we need it:**
Our refresh token is stored in an HttpOnly cookie. When the browser sends a request to `/auth/refresh`, the refresh token comes as a cookie — not in the request body or headers. Without `cookie-parser`, NestJS can't read it.

```typescript
// Without cookie-parser: req.cookies is undefined
// With cookie-parser: req.cookies.refresh_token = "eyJhbG..."
```

**Without it:**
The refresh token flow would completely break. Users would be logged out every 15 minutes (when the access token expires) because the server couldn't read the refresh token cookie to issue a new access token.

---

## 22. @nestjs/event-emitter

**What it is:**
An event bus for NestJS. It lets modules communicate without knowing about each other. One module **emits** an event; other modules **listen** for it and react.

**How we use it:**

```typescript
// In the Appointments module — doesn't know about Notifications
this.eventEmitter.emit('appointment.booked', { appointmentId, patientPhone });

// In the Notifications module — doesn't know about Appointments
@OnEvent('appointment.booked')
async handleBooking(event) {
  await this.smsService.sendConfirmation(event.patientPhone);
  await this.reminderService.scheduleReminders(event.appointmentId);
}
```

**Why we use it:**
- **Loose coupling.** The Appointments module doesn't import or depend on the Notifications module. They communicate through events. This means you can change how notifications work without touching appointment code.
- **Multiple listeners.** One event can trigger multiple actions: `AppointmentBooked` sends an SMS (Notifications), records a metric (Analytics), and updates the doctor's dashboard (WebSocket). Each listener is independent.
- **Module boundary enforcement.** Our architecture rule says "no direct cross-module calls for side effects." Events are how we enforce this.

**Without it:**
The Appointments module would need to directly call `NotificationsService.sendSms()` and `AnalyticsService.recordBooking()`. This creates tight coupling — changing Notifications would risk breaking Appointments. As the app grows, every module would depend on every other module, creating a tangled mess.

---

## 23. GitHub Actions

**What it is:**
GitHub Actions is a **CI/CD (Continuous Integration / Continuous Deployment)** service built into GitHub. It automatically runs tasks (tests, builds, deployments) when you push code or open a pull request.

**Our pipeline:**

```
Developer pushes code
       ↓
GitHub Actions automatically:
  1. Installs dependencies (pnpm install)
  2. Runs linters (catches code style issues)
  3. Runs unit tests
  4. Runs integration tests (with real PostgreSQL + Redis in Docker)
  5. Builds the application
  6. If on main branch → deploys to production
```

**Why we use it:**
- **Automated quality gates.** No code reaches production without passing all tests. A developer can't accidentally break the booking flow and deploy it.
- **Free for our scale.** GitHub Actions is free for public repos and generous for private repos (2,000 minutes/month on the free plan).
- **Built into GitHub.** No separate service to set up (unlike Jenkins or CircleCI). Configuration is a YAML file in the repo.

**Without it:**
Deployments would be manual. A developer would run tests locally (or forget to), then SSH into the server and pull code. This is error-prone, unreproducible, and risky — one bad deploy with no automated rollback could take the platform offline.

---

## 24. Sentry

**What it is:**
Sentry is an **error monitoring** service. When something crashes in production, Sentry captures the error with full context (stack trace, request data, user info) and alerts the team.

**What it gives us:**
- **Real-time alerts.** If the appointment booking endpoint starts throwing errors at 3 AM, Sentry sends a Slack/email notification immediately.
- **Error grouping.** 500 users hitting the same bug = 1 issue in Sentry (not 500 separate log entries to sift through).
- **Context.** Every error shows the stack trace, the request that caused it, the user who triggered it, and the browser/device info.
- **Release tracking.** See which deploy introduced a new error.

**Without it:**
You'd only know about production errors when users complain (or when the team happens to check logs). By then, hundreds of patients might have failed to book appointments. Debugging would mean SSHing into the server and grepping through log files — slow and painful.

**Cost:** Free tier (5,000 errors/month) is sufficient for MVP.

---

## 25. Grafana Cloud

**What it is:**
Grafana Cloud provides **metrics dashboards and log aggregation**. It shows you how the application is performing over time — request rates, response times, error rates, CPU/memory usage.

**What it shows us:**

| Metric | Why it matters |
|--------|---------------|
| API response time (p50, p95, p99) | Are patients waiting too long? |
| Error rate by endpoint | Which features are broken? |
| Database query duration | Is a slow query degrading performance? |
| BullMQ queue depth | Are SMS jobs piling up (provider down)? |
| CPU / Memory usage | Do we need to upgrade the server? |

**How it works:**
Our NestJS app outputs structured JSON logs to stdout. Grafana Alloy (a lightweight agent running alongside our app) collects these logs and sends them to Grafana Cloud, where we build dashboards.

**Without it:**
You'd have no visibility into performance trends. You wouldn't know if response times are gradually increasing (until users complain), if one endpoint is 10x slower than others, or if the server is running out of memory. Flying blind in production.

**Cost:** Free tier (50 GB logs, 10,000 metrics series) covers our MVP needs.

---

## 26. DigitalOcean

**What it is:**
DigitalOcean is a **cloud hosting provider** — it rents us virtual servers ("Droplets"), managed databases, and object storage.

**Our infrastructure:**

| Service | Spec | Monthly cost |
|---------|------|-------------|
| App Droplet | 2 vCPU / 4 GB RAM | ~$24 |
| Managed PostgreSQL | 1 vCPU / 2 GB | ~$30 |
| Jitsi Droplet | 2 vCPU / 4 GB | ~$40 |
| Managed Redis | 1 GB | ~$15 |
| Object Storage (S3) | For files/recordings | ~$5 |
| **Total** | | **~$114/month** |

**Why DigitalOcean (and not AWS):**
- **Simpler.** AWS has 200+ services with complex pricing. DigitalOcean has ~20 services with transparent, fixed pricing.
- **Cheaper at our scale.** A comparable AWS setup costs 30-50% more due to data transfer fees, NAT gateway charges, and per-request pricing on various services.
- **Faster to set up.** A new developer can understand the full DigitalOcean infrastructure in an afternoon. AWS would take a week.
- **Migration path exists.** Our app runs in Docker containers. Moving to AWS later is straightforward — just push the same containers to AWS ECS/EKS.

**Without it (self-hosting):**
You'd need physical servers, network configuration, backups, OS updates, and hardware failure handling. A single server failure would take the platform offline with no automated recovery. DigitalOcean handles all of this.

---

## 27. Passport + Passport-JWT

**What it is:**
Passport is the most popular **authentication middleware** for Node.js. It supports 500+ authentication strategies (Google login, Facebook login, JWT, etc.). We use `passport-jwt` — the strategy that validates JWT tokens from incoming requests.

**How it works in our app:**

```typescript
// NestJS guard checks the JWT on every protected request
@UseGuards(JwtAuthGuard)
@Get('appointments')
getMyAppointments(@CurrentUser() user: User) {
  // If we reach here, the JWT is valid and `user` is populated
}
```

Behind the scenes:
1. Request arrives with `Authorization: Bearer <token>` header
2. Passport extracts the token, verifies the signature, checks expiry
3. If valid → populates `req.user` and the request proceeds
4. If invalid → returns 401 Unauthorized

**Why we use it:**
- **Battle-tested.** Passport has been used in production by thousands of Node.js apps. Writing your own JWT validation logic is risky — one subtle bug and your auth is broken.
- **Extensible.** If we later add Google or Facebook login, we just add a new Passport strategy — no rewriting of the auth pipeline.

**Without it:**
You'd write manual JWT verification in a custom middleware. It would work, but you'd need to handle edge cases (expired tokens, malformed tokens, algorithm confusion attacks) that Passport already covers. It's reinventing a well-solved wheel.

---

## 28. bcrypt

**What it is:**
bcrypt is a **password hashing algorithm**. When a user creates an account, we don't store their password — we store a bcrypt hash of it. When they log in, we hash the submitted password and compare hashes.

```typescript
// Registration — hash the password
const hashedPassword = await bcrypt.hash('patient123', 12);
// Stored in DB: "$2b$12$LJ3m4ys3..."  (irreversible)

// Login — compare
const isMatch = await bcrypt.compare('patient123', hashedPassword);
// true → login succeeds
```

**Why we use it:**
- **Intentionally slow.** bcrypt is designed to take ~250ms per hash. This sounds bad, but it's the point — if an attacker steals the database, trying to crack passwords by brute force would take years instead of seconds.
- **Salt built in.** Each password gets a random salt, so two users with the same password have different hashes. An attacker can't use precomputed tables (rainbow tables).
- **Industry standard.** bcrypt has been the go-to password hashing algorithm for 25+ years. It's well-understood and proven secure.

**Without it:**
If passwords were stored in plain text or with a fast hash (like MD5/SHA-256), a database breach would instantly expose every user's password. In a healthcare app, that's a catastrophic privacy violation.

---

## 29. class-validator + class-transformer

**What it is:**
- **class-validator** validates incoming data against rules you define with decorators.
- **class-transformer** converts plain JSON objects into typed class instances.

Together, they form NestJS's **input validation layer** — the bouncer at the API door.

```typescript
// DTO (Data Transfer Object) — defines what a valid registration looks like
class RegisterDto {
  @IsPhoneNumber('MG')        // Must be a valid Madagascar phone number
  phone: string;

  @IsString()
  @MinLength(8)               // Password must be at least 8 characters
  password: string;

  @IsIn(['patient'])          // Only 'patient' is allowed (no self-registering as admin!)
  user_type: string;
}
```

If someone sends `{ "phone": "not-a-phone", "password": "123" }`, the API automatically returns a 400 error with clear messages — before any business logic runs.

**Why we use it:**
- **Security.** Unvalidated input is the #1 source of security vulnerabilities (SQL injection, XSS, data corruption). Validation at the API boundary stops bad data before it enters the system.
- **Declarative.** Rules are decorators on the DTO class — easy to read, easy to maintain. No `if (typeof phone !== 'string')` spaghetti.
- **NestJS native.** Built-in integration via `ValidationPipe`. One line in `main.ts` and every endpoint is automatically validated.

**Without it:**
Every controller would need manual `if` checks for every field. Developers would forget checks, leading to invalid data in the database (a phone number stored as "undefined", a negative appointment duration, etc.). In a healthcare system, data integrity is non-negotiable.

---

## 30. Luxon

**What it is:**
Luxon is a **date and time library** for JavaScript. It handles timezones, date arithmetic, and formatting correctly — things that JavaScript's built-in `Date` object does poorly.

**Why we need it:**
Madagascar is in the **EAT timezone (UTC+3)**. Our app deals heavily with time:
- Appointment slots: "10:00 AM on March 15th in Madagascar time"
- Reminders: "Send SMS 24 hours before the appointment"
- Schedule templates: "Doctor works Monday 8:00-12:00, 14:00-17:00"

```typescript
// Luxon handles timezone-aware arithmetic correctly
const appointmentTime = DateTime.fromISO('2026-03-15T10:00', { zone: 'Indian/Antananarivo' });
const reminderTime = appointmentTime.minus({ hours: 24 });
// Result: March 14th at 10:00 AM EAT — correct even across DST changes
```

**Why not just use `Date`:**
JavaScript's `Date` object has no timezone awareness. `new Date('2026-03-15T10:00')` uses the server's local timezone, which could be UTC in production and your laptop's timezone in development — leading to appointments booked at the wrong time.

**Without it:**
Timezone bugs are insidious. A patient books a 10:00 AM appointment, but the server records it as 7:00 AM (UTC). The SMS reminder arrives 3 hours too early. The doctor's schedule shows the wrong time. These bugs are hard to reproduce (they only appear when server and user timezones differ) and devastating when they happen.

---

## 31. Tailwind CSS

**What it is:**
Tailwind CSS is a **utility-first CSS framework**. Instead of writing custom CSS classes, you compose styles directly in your HTML/JSX using predefined utility classes.

```jsx
// Traditional CSS approach
<button className="primary-button">Book</button>
// + separate CSS file: .primary-button { background: blue; padding: 8px 16px; border-radius: 4px; }

// Tailwind approach — everything in one place
<button className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700">Book</button>
```

**Why we use it:**
- **Speed.** No switching between JSX and CSS files. No inventing class names. Just add utilities and move on.
- **Consistency.** Tailwind's default spacing scale (4px increments), color palette, and typography are designed to look good together. Prevents the "every page looks slightly different" problem.
- **Small bundle.** Tailwind only ships the CSS classes you actually use. The final CSS file is typically 10-30 KB instead of 200+ KB.
- **Responsive design built in.** `md:flex lg:grid` — breakpoint-specific styles are trivial.

**Without it:**
You'd write custom CSS for every component. Over time, CSS files grow uncontrollably, styles conflict, and the design becomes inconsistent. Every new developer adds their own patterns, creating a maintenance burden.

---

## 32. Terraform

**What it is:**
Terraform is an **Infrastructure as Code (IaC)** tool. Instead of clicking through DigitalOcean's web dashboard to create servers, databases, and firewalls, you describe them in code files — and Terraform creates/updates them automatically.

```hcl
# This code creates our production Droplet
resource "digitalocean_droplet" "api" {
  name   = "madagascar-health-api"
  region = "ams3"
  size   = "s-2vcpu-4gb"
  image  = "docker-20-04"
}
```

Run `terraform apply` → DigitalOcean creates the server. Change the `size` → run `terraform apply` again → it upgrades the server. Everything is versioned in git.

**Why we use it:**
- **Reproducible.** If the production server dies, `terraform apply` recreates the entire infrastructure in minutes — not hours of clicking through dashboards.
- **Version controlled.** Infrastructure changes go through code review, just like application code. No one can silently change a firewall rule.
- **Documentation as code.** The Terraform files ARE the documentation of what's running in production. No outdated wiki pages.

**Without it:**
Infrastructure would be configured manually via the DigitalOcean dashboard. No one would remember exactly what was set up. Recreating the environment after a disaster would involve guessing and trial-and-error.

**Note:** Terraform is used only for production deployment (Phase 6 onwards). During development, Docker Compose is your infrastructure.

---

## 33. ESLint + Prettier

**What it is:**
- **ESLint** is a **linter** — it scans your code for potential bugs, anti-patterns, and style violations.
- **Prettier** is a **code formatter** — it automatically reformats your code to follow consistent style rules (indentation, quote style, line length).

**Why we use both:**

| Tool | What it catches | Example |
|------|----------------|---------|
| ESLint | Bugs and anti-patterns | Unused variables, unreachable code, missing `await` |
| Prettier | Style inconsistency | Tabs vs spaces, single vs double quotes, trailing commas |

**Why they matter:**
- **Consistent code.** Every file in the project looks the same, regardless of who wrote it. Code reviews focus on logic, not formatting.
- **Catch bugs early.** ESLint catches common mistakes (`=` instead of `===`, unused imports, missing error handling) before the code is committed.
- **Automated.** Both run automatically in CI (via GitHub Actions) and can be configured to run on every save in your editor.

**Without them:**
Code style would vary by developer. Pull requests would be cluttered with formatting debates. Subtle bugs (like `if (user = null)` instead of `if (user === null)`) would only be found by careful human review — or in production.

---

## 34. Jest + Supertest

**What it is:**
- **Jest** is a JavaScript **testing framework**. It runs your test files, makes assertions, and reports pass/fail results.
- **Supertest** is a library for **testing HTTP endpoints**. It sends real HTTP requests to your NestJS app and checks the responses.

```typescript
// Unit test (Jest)
describe('OtpService', () => {
  it('should generate a 6-digit code', () => {
    const code = otpService.generate();
    expect(code).toMatch(/^\d{6}$/);
  });
});

// Integration test (Supertest)
describe('POST /auth/register', () => {
  it('should create a new patient', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '+261340000000', password: 'secure123', user_type: 'patient' });

    expect(response.status).toBe(201);
    expect(response.body.data.user_type).toBe('patient');
  });
});
```

**Why we use them:**
- **Confidence.** When you change the booking logic, tests tell you immediately if you broke something. Without tests, you'd only find out when a patient can't book.
- **Living documentation.** Test files describe exactly what each function/endpoint should do. A new developer reads the test to understand the expected behavior.
- **CI gate.** Tests run automatically on every push. A failing test blocks the deploy.

**Without them:**
Every code change would require manual testing — clicking through the UI, checking the database, verifying SMS was sent. This is slow, error-prone, and doesn't scale. Bugs would reach production regularly.

---

## 35. k6

**What it is:**
k6 is a **load testing** tool. It simulates hundreds or thousands of users hitting your API simultaneously to find out where it breaks.

```javascript
// k6 script — simulate 100 users booking appointments for 5 minutes
export default function () {
  http.post('https://api.example.com/appointments', JSON.stringify({
    doctor_id: 'doc-123',
    slot_id: 'slot-456',
  }));
}

export const options = {
  vus: 100,        // 100 virtual users
  duration: '5m',  // for 5 minutes
};
```

**Why we use it:**
- **Find bottlenecks before users do.** If the booking endpoint slows down at 50 concurrent users, we fix it before launch — not during a peak Monday morning.
- **Set performance baselines.** Our target: p95 response time < 500ms. k6 measures this.
- **Test concurrency.** Does the slot locking mechanism hold up when 10 users try to book the same slot simultaneously? k6 answers this.

**Without it:**
You'd launch and hope for the best. If 200 patients try to book during peak hours and the server can't handle it, the entire platform goes down. In healthcare, that means patients can't access doctors.

---

## 36. @nestjs/throttler

**What it is:**
A NestJS package for **rate limiting** — it restricts how many requests a user/IP can make in a given time window.

```typescript
// Global: 100 requests per minute per IP
@Module({
  imports: [ThrottlerModule.forRoot({ ttl: 60000, limit: 100 })],
})

// Stricter on auth endpoints: 10 per minute (prevents brute-force login attempts)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post('auth/login')
login() { ... }
```

**Why we use it:**
- **Brute-force prevention.** Without rate limiting, an attacker could try thousands of passwords per minute against the login endpoint.
- **OTP abuse prevention.** SMS costs money. Without throttling, someone could trigger thousands of OTP sends (costing us per-SMS fees).
- **Fair usage.** Prevents one misbehaving client from consuming all server resources.

**Without it:**
An attacker could automate login attempts (trying every password), trigger massive SMS bills by spamming OTP requests, or DDoS the API from a single machine. Rate limiting is the first line of defense.

---

## 37. Africa's Talking

**What it is:**
Africa's Talking is an **SMS gateway API** focused on African markets. It connects our app to mobile operators (Orange Madagascar, Telma, Airtel) to send and receive SMS messages.

**Where we use it:**
- Appointment confirmation SMS
- 72h / 24h / 2h reminder SMS before appointments
- OTP codes for phone number verification

```typescript
// Simplified: sending an SMS via Africa's Talking
await smsGateway.send({
  to: '+261340000000',           // Madagascar phone number
  message: 'Your appointment with Dr. Rakoto is confirmed for March 15 at 10:00 AM.',
});
```

**Why we use it (and not Twilio):**
- **Better African coverage.** Africa's Talking is built for the African market. Delivery rates to Madagascar operators are higher and cheaper.
- **Cost.** SMS to Madagascar via Twilio costs ~$0.05/message. Africa's Talking costs ~$0.02/message. At 10,000 SMS/month, that's $200 vs. $500.
- **Swappable.** Our adapter pattern means switching to Twilio (or a direct operator API) requires changing one file — not rewriting the notification system.

**Without an SMS gateway:**
No appointment confirmations, no reminders, no OTP verification. SMS is the primary communication channel in Madagascar (many users don't have email or reliable internet). Without it, the platform loses its core value proposition.

---

## 38. Amazon SES

**What it is:**
Amazon SES (Simple Email Service) is an **email sending service**. It handles deliverability, bounce management, and spam compliance so we don't have to run our own email server.

**Where we use it:**
- Email appointment confirmations (for users who provide an email)
- Doctor verification communications
- Admin notifications and reports

**Why we use it:**
- **Dirt cheap.** $0.10 per 1,000 emails. At our scale, email costs less than $5/month.
- **High deliverability.** Amazon manages IP reputation, SPF/DKIM/DMARC records, and bounce handling. Self-hosted email has a high chance of landing in spam folders.
- **Simple API.** Send an email with one API call. No SMTP server configuration.

**Without it:**
You'd need to run your own email server (Postfix/Sendmail), manage DNS records, handle bounces, and fight spam filters. Most self-hosted email ends up in spam. Amazon SES solves all of this for pennies.

---

## 39. Swagger / OpenAPI

**What it is:**
Swagger (OpenAPI) automatically generates **interactive API documentation** from your NestJS controllers and DTOs. Developers and frontend engineers can browse all endpoints, see request/response shapes, and test API calls directly from the browser.

**What it looks like:**
Visit `http://localhost:3000/api/docs` and you see every endpoint, its parameters, request body shape, and response format — all auto-generated from your code.

**Why we use it:**
- **Frontend-backend sync.** Frontend developers know exactly what the API expects and returns — no Slack messages asking "what's the response format for GET /doctors?"
- **Always up to date.** Documentation is generated from the actual code. It can't go stale (unlike a manually maintained wiki).
- **Test from browser.** Click "Try it out", fill in parameters, and send a real request. Great for debugging and exploring.

**Without it:**
API contracts would live in Slack messages, Notion pages, or developers' heads. They'd constantly drift from reality. Frontend developers would guess at response shapes and discover mismatches only at integration time.

---

## 40. Grafana Alloy + Loki

**What it is:**
- **Grafana Alloy** is a lightweight **log and metrics collection agent** that runs alongside our app. It reads structured JSON logs from stdout and ships them to Grafana Cloud.
- **Grafana Loki** is a **log aggregation system** (like Elasticsearch for logs, but simpler and cheaper). It stores logs and lets you search/filter them in Grafana dashboards.

**How they work together:**

```
NestJS app → stdout (JSON logs) → Grafana Alloy (collects) → Grafana Loki (stores) → Grafana Dashboard (view)
```

**Why we use them:**
- **Centralized logs.** Instead of SSHing into the server and running `tail -f`, you search logs in a web dashboard with filters (by endpoint, user, error level).
- **Correlation.** Each request gets a unique ID (`X-Request-Id`). When a patient reports an issue, you search by their request ID and see every log line from that request.
- **Retention.** Logs are stored for weeks/months. Server logs on disk get rotated and deleted.

**Without them:**
Debugging production issues means SSHing into the server, hoping the logs haven't been rotated away, and manually grepping through thousands of lines. With multiple server instances, you'd need to check each one. This is slow and doesn't scale.

---

## 41. PgBouncer (Connection Pooling — Phase 2)

**What it is:**
PgBouncer is a **connection pooler** for PostgreSQL. It sits between your app and the database, maintaining a pool of reusable database connections.

**The problem it solves:**
Each database query needs a connection. Opening a new PostgreSQL connection takes ~50ms and consumes ~10 MB of memory. If 100 users make simultaneous requests:
- **Without PgBouncer:** 100 connections opened → 1 GB memory used → PostgreSQL crashes or rejects new connections
- **With PgBouncer:** 100 requests share 20 pooled connections → 200 MB memory → everything works fine

**Why it's Phase 2 (not MVP):**
At MVP traffic levels (tens of concurrent users), Prisma's built-in connection pool is sufficient. PgBouncer becomes necessary when concurrent users exceed ~100 or when we add a read replica.

**Without it (at scale):**
Database connection exhaustion. PostgreSQL's default `max_connections` is 100. When that limit is hit, new requests fail with "too many connections" errors. The app appears down even though the server is healthy.

---

## 42. Firebase Cloud Messaging (Mobile Push Notifications)

**What it is:**
Firebase Cloud Messaging (FCM) is Google's service for sending **push notifications** to mobile devices (Android and iOS). It's the standard way to deliver notifications when the app is closed or in the background.

**Where we use it:**
- Appointment confirmation push notification
- Reminder notifications (72h, 24h, 2h before appointment)
- Doctor accepting/rejecting appointment requests
- Video consultation start notification

**Why we use it:**
- **Cross-platform.** FCM handles both Android (natively) and iOS (via APNs bridge) from a single API.
- **Free.** No per-message charges, unlike SMS.
- **Reliable delivery.** FCM queues notifications and delivers them when the device comes online — important for patients in areas with intermittent connectivity.
- **Complements SMS.** Push notifications are free and instant but require the app to be installed. SMS works on any phone but costs money. We use both.

**Without it:**
The mobile app would have no way to notify users when it's closed. Patients would only see appointment reminders if they actively open the app — which defeats the purpose of reminders.

---

## Quick Reference: "Which tool solves which problem?"

| Problem | Tool | One-line explanation |
|---------|------|---------------------|
| "Where does our code live?" | NestJS + Turborepo | Organized backend modules + monorepo build system |
| "Where does our data live?" | PostgreSQL | Relational database with schema-per-module |
| "How do we find nearby doctors?" | PostGIS | Geospatial extension for distance queries |
| "How do we handle fuzzy search?" | pg_trgm | Trigram-based similarity matching in PostgreSQL |
| "How do we process background tasks?" | BullMQ + Redis | Job queue for SMS, reminders, async work |
| "How do we show real-time updates?" | Socket.io | WebSocket push for live slot availability |
| "How do we secure API requests?" | JWT + Helmet + Cloudflare | Authentication + security headers + WAF |
| "How do we do video calls?" | Jitsi Meet | Self-hosted, free video conferencing |
| "How do we deploy?" | Docker + GitHub Actions + DigitalOcean | Containerized app, automated CI/CD, cloud hosting |
| "How do we know if something breaks?" | Sentry + Grafana | Error tracking + performance monitoring |
| "How do modules talk to each other?" | @nestjs/event-emitter | Domain events for loose coupling |
| "How do we authenticate users?" | Passport + Passport-JWT | Strategy-based auth framework for NestJS |
| "How do we store passwords safely?" | bcrypt | Slow, salted hashing that resists brute-force |
| "How do we validate incoming data?" | class-validator + class-transformer | Decorator-based DTO validation and transformation |
| "How do we handle timezones?" | Luxon | Immutable, timezone-aware date/time library |
| "How do we style the frontend?" | Tailwind CSS | Utility-first CSS — no custom stylesheet files |
| "How do we manage cloud infra?" | Terraform | Declarative infrastructure as code |
| "How do we enforce code style?" | ESLint + Prettier | Lint for bugs, Prettier for formatting |
| "How do we test our code?" | Jest + Supertest | Unit tests + HTTP endpoint integration tests |
| "Can our API handle traffic spikes?" | k6 | Load testing to find breaking points before users do |
| "How do we prevent API abuse?" | @nestjs/throttler | Rate limiting per IP / per user |
| "How do we send SMS?" | Africa's Talking | SMS gateway with Madagascar coverage |
| "How do we send emails?" | Amazon SES | Reliable, cheap transactional email |
| "How do we document our API?" | Swagger / OpenAPI | Auto-generated interactive API docs |
| "How do we collect server logs?" | Grafana Alloy + Loki | Push logs from Docker to Grafana Cloud |
| "How do we handle many DB connections?" | PgBouncer (Phase 2) | Connection pooling to avoid exhausting PostgreSQL |
| "How do we send mobile push notifications?" | Firebase Cloud Messaging | Free cross-platform push via Google's infrastructure |

---

*If a technology isn't listed here but shows up in the codebase, ask the team before removing it — it's likely there for a reason that should be documented.*
