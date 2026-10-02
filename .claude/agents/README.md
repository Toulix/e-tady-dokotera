# e-tady-dokotera Explorer Agent

A specialized agent for navigating the e-tady-dokotera modular monolith codebase before implementing features.

## What It Does

The explorer agent helps you:

1. **Find the right files** — Identify which modules and layers you need to modify
2. **Locate documentation** — With exact line numbers for quick reference
3. **Understand flows** — Trace how features move through the system
4. **Check constraints** — Validate business rules and edge cases
5. **Verify dependencies** — See how modules talk to each other

## How to Use It

### In Claude Code / VSCode Extension:

```
/explore "I need to implement [feature]. Where do I start?"
```

### Example Queries:

**Navigation questions:**
- "Show me where the appointment booking endpoint is"
- "I need to add SMS confirmation. Which modules?"
- "Where does the slot locking logic live?"

**Documentation questions:**
- "Find docs on refresh token strategy with line numbers"
- "Show me all references to slot locking"
- "Where is the data model documented?"

**Flow questions:**
- "Show me the end-to-end flow for booking an appointment"
- "How do scheduling and appointments modules interact?"
- "What happens after a patient cancels an appointment?"

**Architecture questions:**
- "Why do we use Redis + PostgreSQL for slot locking?"
- "What modules depend on the appointments module?"
- "What edge cases must appointment booking handle?"

## Agent Files

| File | Purpose |
|------|---------|
| **e-tady-dokotera-explorer.md** | Full agent definition with all instructions |
| **references/module-map.md** | Quick reference: module structure, file paths, dependencies |
| **references/query-examples.md** | 50+ example queries showing how to ask questions |

## When to Use This Agent

✓ **Use explorer BEFORE implementing:**
- New feature or module modification
- Bug fix that requires understanding flow
- Refactoring that spans multiple modules
- Any time you ask "where should this go?"

✗ **Don't use explorer for:**
- Direct code review (use react-code-reviewer or code-reviewer skills)
- Architecture design (use senior-architect-review skill)
- UI/design feedback (use design-reviewer skill)

## Quick Examples

### Example 1: Adding a Feature

```
User: I want to add a "reschedule appointment" feature. Where do I start?

Agent Response:
✓ Shows affected modules (appointments, scheduling, notifications)
✓ Lists files in domain/ → application/ → infrastructure/ → api/
✓ Shows the event pattern (RescheduleEvent)
✓ Links to relevant documentation with line numbers
✓ Shows edge cases to handle
✓ Recommends read order
```

### Example 2: Finding Documentation

```
User: Find docs on the refresh token strategy with line numbers

Agent Response:
✓ spec.md §2.2 "Authentication" (lines 120-180)
✓ roadmap.md Step 8 (lines 280-340)
✓ Code reference: auth.service.ts line 200+
✓ CLAUDE.md constraint: "Refresh token: Set-Cookie header only..."
```

### Example 3: Understanding a Flow

```
User: Show me the end-to-end flow when a patient books an appointment

Agent Response:
✓ Frontend component (AppointmentBookingPage.tsx)
✓ API endpoint (appointment.controller.ts line 45)
✓ Service validation (appointment.service.ts line 80)
✓ Slot locking (slot-locker.service.ts line 120)
✓ Database insert (appointment.repository.ts line 200)
✓ Event fire + listeners (notifications module)
✓ Edge cases and validation chain
```

## Module Quick Reference

Use `references/module-map.md` for instant lookup:

| Module | Purpose | File Paths |
|--------|---------|-----------|
| **auth** | JWT, OTP, password | auth.service.ts, jwt.strategy.ts |
| **doctors** | Profiles, search, pg_trgm | doctor-search.service.ts, doctor.repository.ts |
| **appointments** | Booking, slot locking | appointment.service.ts, slot-locker.service.ts |
| **scheduling** | Templates, exceptions, slots | scheduling.service.ts, slot-generator.service.ts |
| **notifications** | SMS/email, BullMQ, events | notification.service.ts, sms.queue.ts |
| **video** | Jitsi, consultations | video.service.ts, jitsi.adapter.ts |
| **analytics** | Read-only reporting | analytics.service.ts (uses $queryRaw) |

## Critical Patterns to Know

The agent will help you find these, but memorize them:

- **Slot locking:** Redis TTL (UX) + PostgreSQL unique constraint (safety)
- **Module communication:** Domain events only, no direct cross-schema DB writes
- **Authentication:** Access token in Zustand, refresh in HttpOnly cookie
- **Error handling:** @OnEvent handlers must have try/catch + Sentry
- **Money values:** Always Integer (Ariary), never Decimal/Float

## Tips for Best Results

1. **Be specific** — "Add SMS reminders" is better than "improve notifications"
2. **Ask before coding** — Always query the agent before touching files
3. **Read docs first** — Agent will point you to them; read the lines it suggests
4. **Follow the layer structure** — domain/ → application/ → infrastructure/ → api/
5. **Check edge cases** — Agent will list them; test them all

## Next Steps

### If You Haven't Used the Agent Yet:

1. Read `references/module-map.md` (2 min) — understand module structure
2. Skim `references/query-examples.md` (5 min) — see example queries
3. Ask the agent a simple question:
   ```
   "Show me the file structure for the appointments module"
   ```

### When Implementing a Feature:

1. Query: "I need to implement [feature]. Which modules?"
2. Query: "Show me the end-to-end flow for this feature"
3. Query: "Find docs on [topic] with line numbers"
4. Query: "What edge cases must I handle?"
5. Read files the agent pointed you to
6. Code, following the patterns you found

## Architecture Overview (TL;DR)

```
Backend: Modular Monolith (8 modules)
├── auth → doctors ↘
├─────────→ appointments ──→ scheduling ──→ notifications
│                  ↓
│               video
└─→ analytics (read-only)

All communicate via domain events, never direct DB writes.
Each module: domain/ → application/ → infrastructure/ → api/

Frontend: React + Zustand (client state) + Tailwind (design)
├── pages/ (lazy-loaded route components)
├── components/ (reusable UI)
├── hooks/ (custom logic)
└── stores/ (Zustand state)
```

## Troubleshooting

**Agent gives vague answers:**
- Ask more specifically: "Show me the exact file path and line number"

**Agent can't find a file:**
- Check your spelling, ask it to search for similar patterns
- It may not exist yet (you're creating it)

**Need something different:**
- Agent is for navigation + discovery
- Use **code-reviewer** for code feedback
- Use **react-code-reviewer** for component feedback
- Use **design-reviewer** for UI/design feedback
- Use **senior-architect-review** for major redesigns

## Creating Your Own Agents

This explorer agent is a template. You can create more:

- `api-flow-tracer` — Specialized in API endpoint flows
- `test-strategy-guide` — Recommends test locations and patterns
- `migration-guide` — Helps with database schema changes
- `security-checker` — Verifies security patterns are followed

See [Agent Documentation](https://claude.ai/code/docs) for how to create custom agents.

