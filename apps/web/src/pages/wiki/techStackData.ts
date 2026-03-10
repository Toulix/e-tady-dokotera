export interface TechEntry {
  id: number;
  name: string;
  category: string;
  whatItIs: string;
  /** Optional subsections rendered between "what it is" and "why we use it" */
  details?: string;
  whyWeUseIt: string[];
  withoutIt: string;
  codeExample?: string;
  /** Rendered as a markdown-style table: [header[], ...rows[]] */
  table?: string[][];
  /** Small callout / warning / note */
  note?: string;
}

export interface QuickRef {
  problem: string;
  tool: string;
  explanation: string;
}

// ──────────────────────────────────────────────
// Categories (used for sidebar grouping)
// ──────────────────────────────────────────────
export const categories = [
  'Backend',
  'Language',
  'Database',
  'Cache & Queue',
  'Real-time',
  'Frontend',
  'Mobile',
  'Monorepo & Build',
  'Infrastructure',
  'Security',
  'Authentication',
  'Events & Communication',
  'CI/CD & Quality',
  'Monitoring',
  'Testing',
  'External Services',
  'API Documentation',
  'Phase 2',
] as const;

export type Category = (typeof categories)[number];

// ──────────────────────────────────────────────
// Tech entries
// ──────────────────────────────────────────────
export const techEntries: TechEntry[] = [
  // 1
  {
    id: 1,
    name: 'NestJS',
    category: 'Backend',
    whatItIs:
      'NestJS is a Node.js backend framework for building server-side applications. Think of it as the skeleton of our API — it organizes our code into modules, handles incoming HTTP requests, and manages how different parts of the app talk to each other.',
    whyWeUseIt: [
      'Built-in module system. Our app is split into independent modules (auth, doctors, appointments, etc.). NestJS enforces this structure natively.',
      'Dependency injection. Instead of creating objects manually with `new SmsService()`, NestJS automatically creates and passes ("injects") services where they\'re needed — easy to swap implementations for testing.',
      'TypeScript-first. The whole team writes TypeScript on both frontend and backend. Zero friction.',
      'Rich ecosystem. Libraries for authentication (Passport), queues (BullMQ), WebSockets (Socket.io), and database (Prisma) all have official NestJS integrations.',
    ],
    withoutIt:
      "You'd need to build your own module system, dependency injection, and request pipeline from scratch using plain Express.js. That's weeks of plumbing work that delivers zero user value, plus every new developer would need to learn your custom conventions.",
  },
  // 2
  {
    id: 2,
    name: 'TypeScript',
    category: 'Language',
    whatItIs:
      'TypeScript is JavaScript with types. When you write `function getDoctor(id: string): Doctor`, TypeScript checks at build time that you actually pass a string and that the return value matches the `Doctor` shape. Errors are caught before the code runs.',
    whyWeUseIt: [
      'Catch bugs early. If you accidentally pass a number where a string is expected, TypeScript tells you immediately — not at 2 AM in production.',
      'One language everywhere. Backend (NestJS), frontend (React), mobile (React Native) — all TypeScript.',
      'Self-documenting code. Types act as living documentation — you see the data shape without reading a separate doc.',
    ],
    withoutIt:
      "You'd use plain JavaScript. Bugs caused by wrong types (`undefined is not a function`) would only surface at runtime. In a healthcare app, that could mean a patient's appointment silently fails to book.",
  },
  // 3
  {
    id: 3,
    name: 'Prisma',
    category: 'Database',
    whatItIs:
      'Prisma is an ORM (Object-Relational Mapper). It lets you interact with the database using TypeScript code instead of writing raw SQL for every query. It also manages migrations — when you change the database structure, Prisma generates the SQL migration files and applies them safely.',
    whyWeUseIt: [
      'Type-safe queries. If you try to filter by a column that doesn\'t exist, TypeScript catches it before you run the code.',
      'Automatic migrations. Change the schema file, run `prisma migrate`, and the database updates. No hand-writing ALTER TABLE statements.',
      'Schema as documentation. The `schema.prisma` file is the single source of truth for what our database looks like.',
    ],
    withoutIt:
      "You'd write raw SQL strings everywhere, which are invisible to TypeScript (no autocomplete, no type checking). Database migrations would be manual SQL files. Schema drift between code and database would be a constant problem.",
    codeExample: `// Instead of: SELECT * FROM doctors WHERE specialty = 'cardiology'
const doctors = await prisma.doctor.findMany({
  where: { specialty: 'cardiology' }
});`,
    note: 'Project rule: Prisma calls only happen inside Repository classes — never in controllers or services.',
  },
  // 4
  {
    id: 4,
    name: 'PostgreSQL',
    category: 'Database',
    whatItIs:
      'PostgreSQL (often called "Postgres") is our relational database — the place where all persistent data lives: users, doctors, appointments, schedules, notifications.',
    whyWeUseIt: [
      'Schema-per-module. PostgreSQL supports multiple schemas within a single database. Each module (auth, doctors, appointments…) gets its own schema — enforcing data boundaries without multiple database instances.',
      'Advanced features built in. Full-text search (pg_trgm), geospatial queries (PostGIS), JSON columns, row-level locking — all without external services.',
      'Data integrity. Foreign keys, constraints, and transactions guarantee that an appointment always references a real doctor and a real patient.',
      "Proven in healthcare. ACID transactions guarantee that a booking either fully succeeds or fully fails. MongoDB offers weaker guarantees by default.",
    ],
    withoutIt:
      "With MongoDB, you'd lose relational integrity (a booking could reference a deleted doctor), schema enforcement, and multi-table transactions. You'd end up reimplementing most of what PostgreSQL gives you for free — badly.",
  },
  // 5
  {
    id: 5,
    name: 'PostGIS',
    category: 'Database',
    whatItIs:
      'PostGIS is a PostgreSQL extension that adds geographic capabilities. It lets the database understand and query locations (latitude/longitude points, distances, areas).',
    details: 'Used for the "Near Me" feature — when a patient searches for doctors nearby.',
    whyWeUseIt: [
      'Fast spatial queries. PostGIS uses spatial indexes (GIST) to find nearby doctors in milliseconds, even with thousands of records.',
      "Correct distance calculation. It uses proper geographic math (accounting for Earth's curvature), not naive lat/lng subtraction.",
      "No extra service. It's a free extension to PostgreSQL — no separate geospatial API to maintain.",
    ],
    withoutIt:
      "You'd either calculate distances in application code (slow — requires loading ALL doctors from the database, then filtering), or use Google Maps Distance Matrix API (expensive — charges per request). Neither scales well.",
    codeExample: `-- Find doctors within 5km of the patient
SELECT * FROM doctors.profiles
WHERE ST_DWithin(
  geolocation,
  ST_MakePoint(47.5, -18.9)::geography,
  5000
);`,
  },
  // 6
  {
    id: 6,
    name: 'pg_trgm',
    category: 'Database',
    whatItIs:
      'pg_trgm is a PostgreSQL extension for fuzzy text search. It breaks words into groups of three characters ("trigrams") and compares them to find similar-sounding matches.',
    details:
      'Used for doctor search. When a patient types "kardyoloji" instead of "cardiologie", pg_trgm still finds cardiologists because the trigrams overlap enough.',
    whyWeUseIt: [
      "Typo tolerance. Patients in Madagascar may search in Malagasy, French, or English with varying spelling. Exact-match search would return zero results for common misspellings.",
      "No extra infrastructure. It's a PostgreSQL extension — no need for Elasticsearch until we have 100k+ doctors.",
      'Simple. One `CREATE EXTENSION pg_trgm;` and it works.',
    ],
    withoutIt:
      'Search would only work with exact matches. A patient typing "Rakt" wouldn\'t find "Dr. Rakoto." You\'d need to build or buy a separate search service much earlier than necessary.',
    codeExample: `-- Fuzzy match on doctor name or specialty
SELECT * FROM doctors.profiles
WHERE name % 'Rakoto'
ORDER BY similarity(name, 'Rakoto') DESC;`,
  },
  // 7
  {
    id: 7,
    name: 'Redis',
    category: 'Cache & Queue',
    whatItIs:
      'Redis is an in-memory data store. It stores data in RAM (not on disk like PostgreSQL), making reads and writes extremely fast — microseconds instead of milliseconds.',
    whyWeUseIt: [
      'Speed. Checking "is this slot locked?" or "is this token valid?" happens on every booking and every API request. Redis responds in <1ms.',
      'Automatic expiry (TTL). Set a key with a time-to-live and Redis deletes it automatically. Perfect for slot locks (10 min), sessions (7 days), and rate limit counters (1 min).',
      'Required by BullMQ. BullMQ cannot work without Redis. No Redis = no background job processing.',
    ],
    withoutIt:
      "Slot locking would require polling PostgreSQL on every check — slow and unnecessary load on the main database. Rate limiting would need a separate service. BullMQ simply wouldn't run.",
    table: [
      ['Use case', 'How it works'],
      ['Session / refresh tokens', 'Stores refresh tokens with a 7-day TTL. When a token expires, Redis automatically deletes it.'],
      ['Slot locking', 'When a patient starts booking, a Redis key locks that time slot for 10 minutes.'],
      ['Rate limiting', 'Counts requests per IP per minute. If someone sends 100+ requests, they get blocked.'],
      ['BullMQ backend', 'BullMQ stores all its job data (pending, active, failed jobs) in Redis.'],
      ['JWT denylist', 'When an admin suspends a user, their token ID is added to a Redis set.'],
    ],
    note: 'Critical config: Redis MUST use `--maxmemory-policy noeviction`. The default `allkeys-lru` silently deletes old keys when memory is full — including BullMQ job data. SMS reminders would disappear without any error.',
  },
  // 8
  {
    id: 8,
    name: 'BullMQ',
    category: 'Cache & Queue',
    whatItIs:
      'BullMQ is a job queue library. It lets you say "do this task later" or "do this task in the background" without blocking the API response.',
    details:
      'When a patient books: (1) API saves appointment → responds "Success!" in ~200ms. (2) In the background, BullMQ sends the SMS confirmation. (3) BullMQ schedules three future reminder jobs (72h, 24h, 2h before).',
    whyWeUseIt: [
      'Non-blocking. Sending an SMS takes 1–3 seconds. Without a queue, the patient would stare at a loading spinner.',
      'Retry on failure. If the SMS provider is temporarily down, BullMQ retries automatically (with exponential backoff).',
      'Scheduled jobs. "Send a reminder in exactly 24 hours" is a single line. Without BullMQ, you\'d need a cron job polling the database every minute.',
      'Visibility. Bull Board (admin dashboard at `/admin/queues`) lets you see every pending, active, completed, and failed job.',
    ],
    withoutIt:
      'SMS would be sent synchronously — every booking takes 3+ seconds. Failed sends are lost forever. Scheduled reminders would need a cron job waking up every minute. Debugging would mean grepping through logs.',
    table: [
      ['Queue', 'Job', 'Triggered by'],
      ['sms-immediate', 'Send booking confirmation SMS', 'Patient books an appointment'],
      ['sms-reminder', 'Send reminder SMS (72h, 24h, 2h)', 'AppointmentBooked event'],
      ['slot-lock', 'Release expired slot locks', '10 minutes after lock created'],
      ['analytics', 'Record events for reporting', 'Various domain events'],
    ],
  },
  // 9
  {
    id: 9,
    name: 'Socket.io',
    category: 'Real-time',
    whatItIs:
      'Socket.io provides real-time, two-way communication between the server and the browser. Unlike normal HTTP (browser asks, server answers), Socket.io keeps a persistent connection open so the server can push updates at any time.',
    details:
      'Used for live slot availability: when Patient A locks a time slot, all other patients viewing that doctor\'s schedule instantly see the slot become unavailable — no page refresh needed.',
    whyWeUseIt: [
      'Instant updates. Without WebSockets, Patient B would need to refresh the page to see that a slot was taken.',
      'Reduced server load. Polling (asking "any updates?" every 2 seconds) creates enormous unnecessary traffic.',
      'Better user experience. Real-time availability prevents double-bookings and reduces frustration.',
    ],
    withoutIt:
      'Two patients could both see the same slot as "available," both click "Book," and one would get an error. With Socket.io, the second patient sees the slot disappear the moment the first patient starts booking.',
  },
  // 10
  {
    id: 10,
    name: 'React 18 + Vite',
    category: 'Frontend',
    whatItIs:
      'React is a JavaScript library for building user interfaces. You describe what the UI should look like, and React updates the screen efficiently when data changes. Vite is a build tool that starts in <1 second and updates the browser instantly when you save a file (Hot Module Replacement).',
    whyWeUseIt: [
      'Component-based. The appointment card, doctor profile, search bar — each is a reusable component. Build once, use everywhere.',
      'Huge ecosystem. Need a date picker? A map component? A form library? There are well-maintained React packages for all of them.',
      'Code sharing with mobile. Our mobile app uses React Native — same concepts, same language.',
      'Vite is fast. Starts in ~300ms vs. Webpack\'s 10–30 seconds. HMR updates the browser in <50ms.',
    ],
    withoutIt:
      'Development would be painfully slow with Webpack. Every code change → wait 5 seconds → see the result. Over a full day, that adds up to 30+ minutes of staring at a loading screen.',
    note: 'We build a PWA (Progressive Web App). The app can be "installed" on a phone and work offline for basic features — important in Madagascar where internet connectivity is intermittent.',
  },
  // 11
  {
    id: 11,
    name: 'Zustand',
    category: 'Frontend',
    whatItIs:
      'Zustand is a state management library for React. "State" is any data your app needs to remember: the logged-in user, the current search filters, the selected appointment slot.',
    whyWeUseIt: [
      'Minimal boilerplate. Redux requires actions, reducers, action creators, selectors. Zustand needs one `create()` call.',
      'Easy to learn. A junior developer can understand Zustand in 15 minutes. Redux takes days.',
      'Sufficient. Our state (access token, user profile, a few UI flags) doesn\'t need Redux\'s overhead.',
    ],
    withoutIt:
      "You'd either use React's built-in useState/useContext (gets messy when many components share data) or Redux (too much boilerplate for our needs). Zustand is the sweet spot.",
    codeExample: `const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, accessToken: null }),
}));`,
    note: 'Security: The JWT access token is stored in Zustand (memory only). Never in localStorage — those can be read by malicious scripts (XSS).',
  },
  // 12
  {
    id: 12,
    name: 'React Native',
    category: 'Mobile',
    whatItIs:
      'React Native lets you build native mobile apps (iOS + Android) using React and TypeScript — the same tools our web developers already know.',
    whyWeUseIt: [
      'Same language as the web app. No need to hire Swift/Kotlin developers or learn Dart (Flutter).',
      'Shared logic. Business logic (API calls, data validation) can be shared between web and mobile via the `packages/shared-types/` workspace.',
      'One codebase, two platforms. Write once, deploy to both iOS and Android.',
    ],
    withoutIt:
      "You'd need separate iOS (Swift) and Android (Kotlin) teams, each implementing the same features independently. Bug fixes would be applied twice. Feature parity would constantly drift. For a startup, this is unaffordable.",
  },
  // 13
  {
    id: 13,
    name: 'OpenStreetMap + react-leaflet',
    category: 'Frontend',
    whatItIs:
      "OpenStreetMap (OSM) is a free, open-source map of the world — like Google Maps but without per-request charges. react-leaflet is a React component library that displays OSM maps in the browser.",
    details: 'Used for showing doctor/facility locations on a map, "Near Me" search results, and distance/directions for patients.',
    whyWeUseIt: [
      "Zero cost. Google Maps charges $7 per 1,000 map loads after 28,000 free monthly loads.",
      "Good Madagascar coverage. OSM has adequate coverage of Madagascar's cities and roads.",
      'Swappable. The adapter pattern means switching to Google Maps later requires changing one file.',
    ],
    withoutIt:
      'At 10,000 daily active users viewing maps, Google Maps would cost ~$500/month just for map tiles. That\'s more than our entire server infrastructure. OSM costs $0.',
  },
  // 14
  {
    id: 14,
    name: 'Turborepo + pnpm',
    category: 'Monorepo & Build',
    whatItIs:
      'pnpm is a package manager (like npm) that installs dependencies faster and uses less disk space. Turborepo is a build system for monorepos — repositories containing multiple projects (apps/api, apps/web, apps/mobile, packages/shared-types).',
    whyWeUseIt: [
      'Shared TypeScript types between frontend and backend — change once, both update.',
      'One pull request can update the API endpoint AND the frontend that calls it.',
      'Turborepo: smart caching skips rebuilding unchanged projects. Parallel execution of independent tasks.',
      'pnpm: 2–3x faster installs than npm. Strict — prevents "phantom dependency" bugs.',
    ],
    withoutIt:
      "Without Turborepo: `pnpm build` rebuilds everything every time. Without pnpm: node_modules consumes 2–3x more disk space. Without a monorepo: API types and frontend types would drift apart.",
  },
  // 15
  {
    id: 15,
    name: 'Docker + Docker Compose',
    category: 'Infrastructure',
    whatItIs:
      'Docker packages an application into a container — a lightweight, portable unit that runs identically on every machine. Docker Compose defines multi-container setups in a single file. Our `docker-compose.yml` starts PostgreSQL, Redis, the API, and the web app with one command.',
    whyWeUseIt: [
      '"Works on my machine" is dead. Every developer gets the exact same PostgreSQL, Redis, and Node.js versions.',
      'One-command setup. A new developer clones the repo, runs `docker compose up`, and has a working local environment in minutes.',
      'Production parity. Docker containers in dev are nearly identical to production.',
    ],
    withoutIt:
      'Every developer would manually install PostgreSQL 16, Redis 7, PostGIS, and Node.js 20 on their local machine. Mac, Windows, and Linux all have different installation steps. Configuration drift would cause constant "works on my machine" bugs.',
  },
  // 16
  {
    id: 16,
    name: 'Nginx',
    category: 'Infrastructure',
    whatItIs:
      'Nginx (pronounced "engine-x") is a reverse proxy — it sits in front of our NestJS application and handles incoming internet traffic.',
    whyWeUseIt: [
      'SSL termination. Handles HTTPS encryption so NestJS doesn\'t have to.',
      'Static files. Serves the React app\'s HTML/CSS/JS files directly (faster than Node.js).',
      'WebSocket routing. Passes Socket.io connections through with the correct `Upgrade` headers.',
      'Request limits. Caps request body size at 10MB to prevent abuse.',
    ],
    withoutIt:
      "NestJS would be directly exposed to the internet. It would need to handle SSL, serve static files (it's bad at this), and absorb malicious traffic directly. Node.js is single-threaded — a flood of requests could block the entire application.",
    table: [
      ['Role', 'What Nginx does'],
      ['SSL termination', 'Handles HTTPS encryption so NestJS doesn\'t have to'],
      ['Static files', 'Serves React app\'s HTML/CSS/JS directly (faster than Node.js)'],
      ['Load balancing', 'Distributes requests between multiple NestJS instances'],
      ['WebSocket routing', 'Passes Socket.io connections with correct Upgrade headers'],
      ['Request limits', 'Caps request body size at 10MB'],
    ],
  },
  // 17
  {
    id: 17,
    name: 'Cloudflare',
    category: 'Infrastructure',
    whatItIs:
      'Cloudflare is a CDN (Content Delivery Network) + WAF (Web Application Firewall) service. It sits between the internet and our server.',
    whyWeUseIt: [
      'CDN. Caches static files on servers worldwide. A patient in Toamasina loads assets from a nearby server.',
      'DDoS protection. Absorbs malicious traffic floods before they reach our server.',
      'WAF. Blocks common attacks (SQL injection, XSS) using the OWASP rule set.',
      'Free SSL certificates. No manual certificate management.',
    ],
    withoutIt:
      'Our server would handle all traffic directly — including attack traffic. Static files would be slow for distant patients. A basic DDoS attack could take the entire platform offline.',
    note: 'Cost: Free tier covers all our MVP needs. Pro tier ($20/month) adds advanced WAF rules if needed.',
  },
  // 18
  {
    id: 18,
    name: 'Jitsi Meet',
    category: 'Real-time',
    whatItIs:
      'Jitsi Meet is a free, open-source video conferencing platform (like Zoom, but self-hosted). It uses WebRTC for peer-to-peer video calls directly in the browser — no app download needed.',
    details: 'Used for online medical consultations. Falls back to audio-only if the connection is poor (common in rural Madagascar).',
    whyWeUseIt: [
      'Self-hosted. Patient medical consultations stay on our infrastructure — important for data privacy.',
      'Free. Zoom API costs $100+/month. Twilio Video charges per participant-minute. Jitsi costs only the server (~$40/month).',
      'No download required. Patients open a link and the call starts.',
      'Audio fallback. Built-in handling for poor connections — critical for rural Madagascar.',
    ],
    withoutIt:
      'Video consultations would require a paid service (Twilio Video ~$200/month for 500 consultations) or patients would need to download a separate app (Zoom), adding friction.',
  },
  // 19
  {
    id: 19,
    name: 'JWT (JSON Web Tokens)',
    category: 'Authentication',
    whatItIs:
      "JWT is a standard for authentication tokens. When a user logs in, the server creates a signed token containing the user's ID and role. The browser sends this token with every API request to prove who it is.",
    details:
      'We use two tokens: an access token (15 min, in Zustand memory) and a refresh token (7 days, in HttpOnly cookie). When the access token expires, the browser silently uses the refresh token to get a new one.',
    whyWeUseIt: [
      'Access token (15 min): short-lived, so if stolen, the damage window is tiny. Stored in memory only — disappears when the tab closes.',
      'Refresh token (7 days): stored in an HttpOnly cookie that JavaScript cannot read — immune to XSS attacks.',
      'Stateless verification. The server doesn\'t need to query a database on every request — just verify the JWT signature.',
    ],
    withoutIt:
      "You'd need server-side sessions for every user (storing state in the database for every request), which is slower and harder to scale.",
  },
  // 20
  {
    id: 20,
    name: 'Helmet',
    category: 'Security',
    whatItIs:
      'Helmet is a tiny middleware that sets HTTP security headers on every response from our API. These headers tell browsers to enable security features.',
    whyWeUseIt: [
      "One line of code (`app.use(helmet())`) that closes a whole category of common web security vulnerabilities.",
      'Sets X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, CSP, and more.',
      'Every security audit checklist includes these headers. Not setting them would be flagged immediately.',
    ],
    withoutIt:
      "The API would be vulnerable to clickjacking, MIME-type sniffing attacks, and wouldn't enforce HTTPS.",
    table: [
      ['Header', 'What it does'],
      ['X-Content-Type-Options: nosniff', 'Prevents browsers from guessing file types'],
      ['X-Frame-Options: DENY', 'Prevents loading in an iframe (stops clickjacking)'],
      ['Strict-Transport-Security', 'Forces HTTPS — browsers refuse plain HTTP'],
      ['Content-Security-Policy', 'Controls which scripts/styles/images can load'],
    ],
  },
  // 21
  {
    id: 21,
    name: 'cookie-parser',
    category: 'Security',
    whatItIs:
      'A simple Express/NestJS middleware that reads cookies from incoming HTTP requests and makes them available as `req.cookies`.',
    details: 'Our refresh token is stored in an HttpOnly cookie. Without cookie-parser, NestJS can\'t read it.',
    whyWeUseIt: [
      'Required for the refresh token flow. Without it, `req.cookies` is undefined.',
      'Dead simple — one line of setup in main.ts.',
    ],
    withoutIt:
      "The refresh token flow would completely break. Users would be logged out every 15 minutes (when the access token expires) because the server couldn't read the refresh token cookie.",
  },
  // 22
  {
    id: 22,
    name: '@nestjs/event-emitter',
    category: 'Events & Communication',
    whatItIs:
      'An event bus for NestJS. It lets modules communicate without knowing about each other. One module emits an event; other modules listen for it and react.',
    whyWeUseIt: [
      "Loose coupling. The Appointments module doesn't import or depend on Notifications. They communicate through events.",
      'Multiple listeners. One event can trigger multiple actions: send SMS, record a metric, update a dashboard.',
      'Module boundary enforcement. Our architecture rule says "no direct cross-module calls for side effects."',
    ],
    withoutIt:
      'The Appointments module would need to directly call NotificationsService and AnalyticsService. Every module would depend on every other module, creating a tangled mess.',
    codeExample: `// Appointments module — doesn't know about Notifications
this.eventEmitter.emit('appointment.booked', {
  appointmentId,
  patientPhone,
});

// Notifications module — doesn't know about Appointments
@OnEvent('appointment.booked')
async handleBooking(event) {
  await this.smsService.sendConfirmation(event.patientPhone);
}`,
  },
  // 23
  {
    id: 23,
    name: 'GitHub Actions',
    category: 'CI/CD & Quality',
    whatItIs:
      'GitHub Actions is a CI/CD (Continuous Integration / Continuous Deployment) service built into GitHub. It automatically runs tasks (tests, builds, deployments) when you push code or open a pull request.',
    whyWeUseIt: [
      'Automated quality gates. No code reaches production without passing all tests.',
      'Free for our scale. 2,000 minutes/month on the free plan.',
      'Built into GitHub. No separate service to set up. Configuration is a YAML file in the repo.',
    ],
    withoutIt:
      "Deployments would be manual. A developer would run tests locally (or forget to), then SSH into the server. One bad deploy with no automated rollback could take the platform offline.",
  },
  // 24
  {
    id: 24,
    name: 'Sentry',
    category: 'Monitoring',
    whatItIs:
      'Sentry is an error monitoring service. When something crashes in production, Sentry captures the error with full context (stack trace, request data, user info) and alerts the team.',
    whyWeUseIt: [
      'Real-time alerts. If the booking endpoint starts throwing errors at 3 AM, Sentry sends a notification immediately.',
      'Error grouping. 500 users hitting the same bug = 1 issue in Sentry (not 500 separate log entries).',
      'Context. Every error shows the stack trace, the request, the user, and the device info.',
      'Release tracking. See which deploy introduced a new error.',
    ],
    withoutIt:
      "You'd only know about production errors when users complain. Debugging would mean SSHing into the server and grepping through log files.",
    note: 'Cost: Free tier (5,000 errors/month) is sufficient for MVP.',
  },
  // 25
  {
    id: 25,
    name: 'Grafana Cloud',
    category: 'Monitoring',
    whatItIs:
      'Grafana Cloud provides metrics dashboards and log aggregation. It shows how the application is performing over time — request rates, response times, error rates, CPU/memory usage.',
    whyWeUseIt: [
      'Visibility into performance trends. See if response times are gradually increasing.',
      'Structured dashboards. BullMQ queue depth, database query duration, CPU/memory — all in one place.',
      'Alerting. Get notified when metrics cross thresholds.',
    ],
    withoutIt:
      "No visibility into performance trends. You wouldn't know if one endpoint is 10x slower than others, or if the server is running out of memory. Flying blind in production.",
    table: [
      ['Metric', 'Why it matters'],
      ['API response time (p50, p95, p99)', 'Are patients waiting too long?'],
      ['Error rate by endpoint', 'Which features are broken?'],
      ['Database query duration', 'Is a slow query degrading performance?'],
      ['BullMQ queue depth', 'Are SMS jobs piling up (provider down)?'],
      ['CPU / Memory usage', 'Do we need to upgrade the server?'],
    ],
    note: 'Cost: Free tier (50 GB logs, 10,000 metrics series) covers our MVP.',
  },
  // 26
  {
    id: 26,
    name: 'DigitalOcean',
    category: 'Infrastructure',
    whatItIs:
      "DigitalOcean is a cloud hosting provider — it rents us virtual servers (\"Droplets\"), managed databases, and object storage.",
    whyWeUseIt: [
      'Simpler. AWS has 200+ services. DigitalOcean has ~20 with transparent, fixed pricing.',
      'Cheaper at our scale. A comparable AWS setup costs 30–50% more due to data transfer and NAT gateway fees.',
      'Faster to set up. A developer can understand the full infrastructure in an afternoon.',
      'Migration path. Our Docker containers can move to AWS ECS/EKS later if needed.',
    ],
    withoutIt:
      "Self-hosting would mean physical servers, network configuration, backups, OS updates, and hardware failure handling. A single server failure would take the platform offline.",
    table: [
      ['Service', 'Spec', 'Monthly cost'],
      ['App Droplet', '2 vCPU / 4 GB RAM', '~$24'],
      ['Managed PostgreSQL', '1 vCPU / 2 GB', '~$30'],
      ['Jitsi Droplet', '2 vCPU / 4 GB', '~$40'],
      ['Managed Redis', '1 GB', '~$15'],
      ['Object Storage (S3)', 'For files/recordings', '~$5'],
      ['Total', '', '~$114/month'],
    ],
  },
  // 27
  {
    id: 27,
    name: 'Passport + Passport-JWT',
    category: 'Authentication',
    whatItIs:
      'Passport is the most popular authentication middleware for Node.js. It supports 500+ authentication strategies (Google login, Facebook login, JWT, etc.). We use `passport-jwt` — the strategy that validates JWT tokens from incoming requests.',
    whyWeUseIt: [
      'Battle-tested. Used in production by thousands of Node.js apps. Writing your own JWT validation is risky.',
      'Extensible. If we later add Google or Facebook login, we just add a new Passport strategy — no rewriting.',
    ],
    withoutIt:
      "You'd write manual JWT verification in a custom middleware. You'd need to handle expired tokens, malformed tokens, algorithm confusion attacks — things Passport already covers.",
    codeExample: `@UseGuards(JwtAuthGuard)
@Get('appointments')
getMyAppointments(@CurrentUser() user: User) {
  // If we reach here, the JWT is valid
  // and \`user\` is populated automatically
}`,
  },
  // 28
  {
    id: 28,
    name: 'bcrypt',
    category: 'Security',
    whatItIs:
      "bcrypt is a password hashing algorithm. When a user creates an account, we don't store their password — we store a bcrypt hash of it. When they log in, we hash the submitted password and compare hashes.",
    whyWeUseIt: [
      'Intentionally slow. Takes ~250ms per hash — if an attacker steals the database, brute-force cracking would take years.',
      'Salt built in. Each password gets a random salt, so identical passwords produce different hashes. Rainbow tables are useless.',
      'Industry standard. The go-to password hashing algorithm for 25+ years.',
    ],
    withoutIt:
      'If passwords were stored in plain text or with a fast hash (MD5/SHA-256), a database breach would instantly expose every password. In a healthcare app, that\'s a catastrophic privacy violation.',
    codeExample: `// Registration — hash the password
const hashed = await bcrypt.hash('patient123', 12);
// Stored in DB: "$2b$12$LJ3m4ys3..." (irreversible)

// Login — compare
const isMatch = await bcrypt.compare('patient123', hashed);
// true → login succeeds`,
  },
  // 29
  {
    id: 29,
    name: 'class-validator + class-transformer',
    category: 'Security',
    whatItIs:
      'class-validator validates incoming data against rules you define with decorators. class-transformer converts plain JSON objects into typed class instances. Together, they form NestJS\'s input validation layer — the bouncer at the API door.',
    whyWeUseIt: [
      'Security. Unvalidated input is the #1 source of vulnerabilities (SQL injection, XSS, data corruption). Validation at the API boundary stops bad data.',
      'Declarative. Rules are decorators on the DTO class — easy to read, easy to maintain.',
      'NestJS native. Built-in integration via `ValidationPipe`. One line in main.ts and every endpoint is validated.',
    ],
    withoutIt:
      'Every controller would need manual `if` checks for every field. Developers would forget checks, leading to invalid data in the database. In healthcare, data integrity is non-negotiable.',
    codeExample: `class RegisterDto {
  @IsPhoneNumber('MG')   // Madagascar phone number
  phone: string;

  @IsString()
  @MinLength(8)          // At least 8 characters
  password: string;

  @IsIn(['patient'])     // Can't self-register as admin!
  user_type: string;
}`,
  },
  // 30
  {
    id: 30,
    name: 'Luxon',
    category: 'Frontend',
    whatItIs:
      'Luxon is a date and time library for JavaScript. It handles timezones, date arithmetic, and formatting correctly — things that JavaScript\'s built-in `Date` object does poorly.',
    details: 'Madagascar is in the EAT timezone (UTC+3). Our app deals heavily with time: appointment slots, reminders, schedule templates.',
    whyWeUseIt: [
      'Timezone-aware arithmetic. "Send SMS 24 hours before the appointment" — correct even across DST changes.',
      "JavaScript's `Date` has no timezone awareness. `new Date()` uses the server's local timezone, which differs between dev and production.",
      'Immutable. Every operation returns a new DateTime — no accidental mutation bugs.',
    ],
    withoutIt:
      "Timezone bugs are insidious. A patient books at 10:00 AM, but the server records 7:00 AM (UTC). The SMS reminder arrives 3 hours too early. These bugs only appear when server and user timezones differ.",
    codeExample: `const appointmentTime = DateTime.fromISO(
  '2026-03-15T10:00',
  { zone: 'Indian/Antananarivo' }
);
const reminderTime = appointmentTime.minus({ hours: 24 });
// Result: March 14th at 10:00 AM EAT — correct!`,
  },
  // 31
  {
    id: 31,
    name: 'Tailwind CSS',
    category: 'Frontend',
    whatItIs:
      'Tailwind CSS is a utility-first CSS framework. Instead of writing custom CSS classes, you compose styles directly in your HTML/JSX using predefined utility classes.',
    whyWeUseIt: [
      'Speed. No switching between JSX and CSS files. No inventing class names.',
      "Consistency. Tailwind's default spacing scale, color palette, and typography are designed to look good together.",
      'Small bundle. Only ships CSS classes you actually use. Final CSS is typically 10–30 KB.',
      'Responsive design built in. `md:flex lg:grid` — breakpoint-specific styles are trivial.',
    ],
    withoutIt:
      "You'd write custom CSS for every component. Over time, CSS files grow uncontrollably, styles conflict, and the design becomes inconsistent.",
    codeExample: `{/* Traditional CSS */}
<button className="primary-button">Book</button>
{/* + separate CSS file with .primary-button rules */}

{/* Tailwind — everything in one place */}
<button className="bg-blue-600 px-4 py-2 rounded
  text-white hover:bg-blue-700">
  Book
</button>`,
  },
  // 32
  {
    id: 32,
    name: 'Terraform',
    category: 'Infrastructure',
    whatItIs:
      "Terraform is an Infrastructure as Code (IaC) tool. Instead of clicking through DigitalOcean's web dashboard to create servers, you describe them in code files — and Terraform creates/updates them automatically.",
    whyWeUseIt: [
      'Reproducible. If the production server dies, `terraform apply` recreates everything in minutes — not hours of clicking.',
      'Version controlled. Infrastructure changes go through code review, just like application code.',
      'Documentation as code. Terraform files ARE the documentation of what\'s running in production.',
    ],
    withoutIt:
      'Infrastructure would be configured manually via the dashboard. No one would remember exactly what was set up. Disaster recovery would involve guessing.',
    codeExample: `resource "digitalocean_droplet" "api" {
  name   = "madagascar-health-api"
  region = "ams3"
  size   = "s-2vcpu-4gb"
  image  = "docker-20-04"
}
# Run: terraform apply → server created`,
    note: 'Terraform is used only for production (Phase 6 onwards). During development, Docker Compose is your infrastructure.',
  },
  // 33
  {
    id: 33,
    name: 'ESLint + Prettier',
    category: 'CI/CD & Quality',
    whatItIs:
      'ESLint is a linter — it scans code for potential bugs and anti-patterns. Prettier is a code formatter — it automatically reformats code to follow consistent style rules.',
    whyWeUseIt: [
      'Consistent code. Every file looks the same, regardless of who wrote it. Code reviews focus on logic, not formatting.',
      'Catch bugs early. ESLint catches `=` instead of `===`, unused imports, missing error handling — before the code is committed.',
      'Automated. Both run in CI (via GitHub Actions) and can run on every save in your editor.',
    ],
    withoutIt:
      'Code style would vary by developer. PRs would be cluttered with formatting debates. Subtle bugs (like `if (user = null)`) would only be found by careful review — or in production.',
    table: [
      ['Tool', 'What it catches', 'Example'],
      ['ESLint', 'Bugs and anti-patterns', 'Unused variables, unreachable code, missing await'],
      ['Prettier', 'Style inconsistency', 'Tabs vs spaces, single vs double quotes'],
    ],
  },
  // 34
  {
    id: 34,
    name: 'Jest + Supertest',
    category: 'Testing',
    whatItIs:
      'Jest is a JavaScript testing framework. It runs your test files, makes assertions, and reports pass/fail results. Supertest is a library for testing HTTP endpoints — it sends real HTTP requests to your NestJS app and checks responses.',
    whyWeUseIt: [
      'Confidence. When you change the booking logic, tests tell you immediately if you broke something.',
      'Living documentation. Test files describe exactly what each function/endpoint should do.',
      'CI gate. Tests run automatically on every push. A failing test blocks the deploy.',
    ],
    withoutIt:
      "Every code change would require manual testing — clicking through the UI, checking the database. This is slow, error-prone, and doesn't scale. Bugs would reach production regularly.",
    codeExample: `// Unit test (Jest)
describe('OtpService', () => {
  it('should generate a 6-digit code', () => {
    const code = otpService.generate();
    expect(code).toMatch(/^\\d{6}$/);
  });
});

// Integration test (Supertest)
describe('POST /auth/register', () => {
  it('should create a new patient', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '+261340000000', password: 'secure123', user_type: 'patient' });

    expect(res.status).toBe(201);
  });
});`,
  },
  // 35
  {
    id: 35,
    name: 'k6',
    category: 'Testing',
    whatItIs:
      'k6 is a load testing tool. It simulates hundreds or thousands of users hitting your API simultaneously to find out where it breaks.',
    whyWeUseIt: [
      'Find bottlenecks before users do. If the booking endpoint slows down at 50 concurrent users, we fix it before launch.',
      'Set performance baselines. Our target: p95 response time < 500ms.',
      'Test concurrency. Does the slot locking mechanism hold up when 10 users try to book the same slot simultaneously?',
    ],
    withoutIt:
      "You'd launch and hope for the best. If 200 patients try to book during peak hours and the server can't handle it, the platform goes down. In healthcare, that means patients can't access doctors.",
    codeExample: `export default function () {
  http.post(
    'https://api.example.com/appointments',
    JSON.stringify({
      doctor_id: 'doc-123',
      slot_id: 'slot-456',
    })
  );
}

export const options = {
  vus: 100,        // 100 virtual users
  duration: '5m',  // for 5 minutes
};`,
  },
  // 36
  {
    id: 36,
    name: '@nestjs/throttler',
    category: 'Security',
    whatItIs:
      'A NestJS package for rate limiting — it restricts how many requests a user/IP can make in a given time window.',
    whyWeUseIt: [
      'Brute-force prevention. Without rate limiting, an attacker could try thousands of passwords per minute.',
      'OTP abuse prevention. SMS costs money. Without throttling, someone could trigger thousands of OTP sends.',
      'Fair usage. Prevents one misbehaving client from consuming all server resources.',
    ],
    withoutIt:
      'An attacker could automate login attempts, trigger massive SMS bills by spamming OTP requests, or DDoS the API from a single machine.',
    codeExample: `// Global: 100 requests per minute per IP
ThrottlerModule.forRoot({
  ttl: 60000,
  limit: 100,
})

// Stricter on auth: 10 per minute
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post('auth/login')
login() { /* ... */ }`,
  },
  // 37
  {
    id: 37,
    name: "Africa's Talking",
    category: 'External Services',
    whatItIs:
      "Africa's Talking is an SMS gateway API focused on African markets. It connects our app to mobile operators (Orange Madagascar, Telma, Airtel) to send and receive SMS messages.",
    details: 'Used for appointment confirmations, 72h/24h/2h reminders, and OTP codes.',
    whyWeUseIt: [
      "Better African coverage. Built for the African market — higher delivery rates to Madagascar operators.",
      "Cost. ~$0.02/message vs. Twilio's ~$0.05/message. At 10,000 SMS/month: $200 vs. $500.",
      'Swappable. Our adapter pattern means switching to Twilio requires changing one file.',
    ],
    withoutIt:
      "No appointment confirmations, no reminders, no OTP verification. SMS is the primary communication channel in Madagascar — without it, the platform loses its core value.",
  },
  // 38
  {
    id: 38,
    name: 'Amazon SES',
    category: 'External Services',
    whatItIs:
      "Amazon SES (Simple Email Service) is an email sending service. It handles deliverability, bounce management, and spam compliance so we don't have to run our own email server.",
    whyWeUseIt: [
      'Dirt cheap. $0.10 per 1,000 emails. At our scale, email costs less than $5/month.',
      'High deliverability. Amazon manages IP reputation, SPF/DKIM/DMARC records, and bounce handling. Self-hosted email often lands in spam.',
      'Simple API. Send an email with one API call. No SMTP server configuration.',
    ],
    withoutIt:
      "You'd run your own email server (Postfix/Sendmail), manage DNS records, handle bounces, and fight spam filters. Most self-hosted email ends up in spam.",
  },
  // 39
  {
    id: 39,
    name: 'Swagger / OpenAPI',
    category: 'API Documentation',
    whatItIs:
      'Swagger (OpenAPI) automatically generates interactive API documentation from your NestJS controllers and DTOs. Developers can browse all endpoints, see request/response shapes, and test API calls from the browser.',
    details: 'Visit `http://localhost:3000/api/docs` to see every endpoint, its parameters, request body, and response format — all auto-generated from code.',
    whyWeUseIt: [
      'Frontend-backend sync. Frontend developers know exactly what the API expects and returns.',
      'Always up to date. Generated from actual code — can\'t go stale.',
      'Test from browser. Click "Try it out", fill in parameters, and send a real request.',
    ],
    withoutIt:
      "API contracts would live in Slack messages, Notion pages, or developers' heads. They'd constantly drift from reality.",
  },
  // 40
  {
    id: 40,
    name: 'Grafana Alloy + Loki',
    category: 'Monitoring',
    whatItIs:
      'Grafana Alloy is a lightweight log and metrics collection agent that runs alongside our app. Grafana Loki is a log aggregation system (like Elasticsearch for logs, but simpler). They work together to ship and store logs.',
    details: 'NestJS app → stdout (JSON logs) → Grafana Alloy (collects) → Grafana Loki (stores) → Grafana Dashboard (view).',
    whyWeUseIt: [
      "Centralized logs. Search logs in a web dashboard with filters — no SSHing into the server.",
      'Correlation. Each request gets a unique ID (X-Request-Id). Search by request ID to see every log line from that request.',
      "Retention. Logs are stored for weeks/months. Server logs on disk get rotated and deleted.",
    ],
    withoutIt:
      "Debugging production issues means SSHing into the server, hoping logs haven't been rotated, and manually grepping through thousands of lines. Doesn't scale.",
  },
  // 41
  {
    id: 41,
    name: 'PgBouncer',
    category: 'Phase 2',
    whatItIs:
      'PgBouncer is a connection pooler for PostgreSQL. It sits between your app and the database, maintaining a pool of reusable connections.',
    details:
      'Without PgBouncer: 100 connections → 1 GB memory → PostgreSQL crashes. With PgBouncer: 100 requests share 20 pooled connections → 200 MB → everything works.',
    whyWeUseIt: [
      'Prevents connection exhaustion. PostgreSQL\'s default `max_connections` is 100. When that limit is hit, new requests fail.',
      "Reduces memory usage. Each connection consumes ~10 MB. Pooling dramatically reduces this.",
    ],
    withoutIt:
      "At scale, database connection exhaustion. The app appears down even though the server is healthy.",
    note: "Phase 2 (not MVP). At MVP traffic, Prisma's built-in connection pool is sufficient. PgBouncer becomes necessary when concurrent users exceed ~100.",
  },
  // 42
  {
    id: 42,
    name: 'Firebase Cloud Messaging',
    category: 'External Services',
    whatItIs:
      "Firebase Cloud Messaging (FCM) is Google's service for sending push notifications to mobile devices (Android and iOS). It's the standard way to deliver notifications when the app is closed or in the background.",
    whyWeUseIt: [
      'Cross-platform. FCM handles both Android (natively) and iOS (via APNs bridge) from a single API.',
      'Free. No per-message charges, unlike SMS.',
      'Reliable delivery. FCM queues notifications and delivers them when the device comes online.',
      'Complements SMS. Push is free and instant (requires app), SMS works on any phone (costs money). We use both.',
    ],
    withoutIt:
      "The mobile app would have no way to notify users when it's closed. Patients would only see reminders if they actively open the app — which defeats the purpose.",
  },
];

// ──────────────────────────────────────────────
// Quick Reference
// ──────────────────────────────────────────────
export const quickReference: QuickRef[] = [
  { problem: 'Where does our code live?', tool: 'NestJS + Turborepo', explanation: 'Organized backend modules + monorepo build system' },
  { problem: 'Where does our data live?', tool: 'PostgreSQL', explanation: 'Relational database with schema-per-module' },
  { problem: 'How do we find nearby doctors?', tool: 'PostGIS', explanation: 'Geospatial extension for distance queries' },
  { problem: 'How do we handle fuzzy search?', tool: 'pg_trgm', explanation: 'Trigram-based similarity matching in PostgreSQL' },
  { problem: 'How do we process background tasks?', tool: 'BullMQ + Redis', explanation: 'Job queue for SMS, reminders, async work' },
  { problem: 'How do we show real-time updates?', tool: 'Socket.io', explanation: 'WebSocket push for live slot availability' },
  { problem: 'How do we secure API requests?', tool: 'JWT + Helmet + Cloudflare', explanation: 'Authentication + security headers + WAF' },
  { problem: 'How do we do video calls?', tool: 'Jitsi Meet', explanation: 'Self-hosted, free video conferencing' },
  { problem: 'How do we deploy?', tool: 'Docker + GitHub Actions + DO', explanation: 'Containerized app, automated CI/CD, cloud hosting' },
  { problem: 'How do we know if something breaks?', tool: 'Sentry + Grafana', explanation: 'Error tracking + performance monitoring' },
  { problem: 'How do modules talk to each other?', tool: '@nestjs/event-emitter', explanation: 'Domain events for loose coupling' },
  { problem: 'How do we authenticate users?', tool: 'Passport + Passport-JWT', explanation: 'Strategy-based auth framework for NestJS' },
  { problem: 'How do we store passwords safely?', tool: 'bcrypt', explanation: 'Slow, salted hashing that resists brute-force' },
  { problem: 'How do we validate incoming data?', tool: 'class-validator', explanation: 'Decorator-based DTO validation' },
  { problem: 'How do we handle timezones?', tool: 'Luxon', explanation: 'Immutable, timezone-aware date/time library' },
  { problem: 'How do we style the frontend?', tool: 'Tailwind CSS', explanation: 'Utility-first CSS — no custom stylesheet files' },
  { problem: 'How do we manage cloud infra?', tool: 'Terraform', explanation: 'Declarative infrastructure as code' },
  { problem: 'How do we enforce code style?', tool: 'ESLint + Prettier', explanation: 'Lint for bugs, Prettier for formatting' },
  { problem: 'How do we test our code?', tool: 'Jest + Supertest', explanation: 'Unit tests + HTTP endpoint integration tests' },
  { problem: 'Can our API handle traffic spikes?', tool: 'k6', explanation: 'Load testing to find breaking points' },
  { problem: 'How do we prevent API abuse?', tool: '@nestjs/throttler', explanation: 'Rate limiting per IP / per user' },
  { problem: 'How do we send SMS?', tool: "Africa's Talking", explanation: 'SMS gateway with Madagascar coverage' },
  { problem: 'How do we send emails?', tool: 'Amazon SES', explanation: 'Reliable, cheap transactional email' },
  { problem: 'How do we document our API?', tool: 'Swagger / OpenAPI', explanation: 'Auto-generated interactive API docs' },
  { problem: 'How do we collect server logs?', tool: 'Grafana Alloy + Loki', explanation: 'Push logs from Docker to Grafana Cloud' },
  { problem: 'How do we handle many DB connections?', tool: 'PgBouncer (Phase 2)', explanation: 'Connection pooling to avoid exhausting PostgreSQL' },
  { problem: 'How do we send push notifications?', tool: 'Firebase Cloud Messaging', explanation: 'Free cross-platform push via Google' },
];
