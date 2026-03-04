# Cross-Document Consistency Review — e-tady-dokotera

**Reviewer:** Senior Technical Writer & Architect
**Date:** 2026-03-03
**Documents compared:** `docs/spec.md` (header v1.2, footer v1.3), `docs/roadmap.md` (v1.4)

**11 findings: 3 Critical, 5 High, 2 Medium, 1 Low**

---

## FINDING-1 — CRITICAL: Spec Version Number Is Self-Contradictory

**Spec reference:** Header line 5 ("Version: 1.2") vs footer section 22 ("v1.3 Changes")
**Roadmap reference:** Footer line 2798 ("Derived from Technical Specification v1.3")

The spec header says v1.2. The spec footer documents "v1.3 Changes" with 24 items. The roadmap correctly says "Derived from Technical Specification v1.3." Any developer reading the spec header sees v1.2 and may search for a missing v1.3 document.

**Resolution:** Update the spec header from v1.2 to v1.3. Update any stale review notes referencing old roadmap versions.

---

## FINDING-2 — CRITICAL: Spec Says SELECT FOR UPDATE for Slot Locking; Roadmap Uses INSERT ON CONFLICT

**Spec reference:** Section 3.1.3 (Concurrency & Locking); Section 2.2 module comment (`# DB, pessimistic locking via SELECT FOR UPDATE`); Section 19 change log (still lists "Two-layer slot locking (Redis TTL + PostgreSQL FOR UPDATE) — correct")
**Roadmap reference:** Step 19 v1.1 bug fix (explicitly replaces SELECT FOR UPDATE with INSERT ... ON CONFLICT DO NOTHING)

The spec's Section 3.1.3 architect note praises "Two-layer locking (Redis TTL + PostgreSQL FOR UPDATE) is the correct pattern here." The roadmap's v1.1 fix explicitly contradicts this: "critical bug fix — SELECT FOR UPDATE on wrong table." The roadmap is correct. The spec was not updated. Any engineer reading only the spec will implement the wrong pattern.

**Resolution:** Update spec in three places:
1. Section 3.1.3 — replace "SELECT FOR UPDATE" with "INSERT ... ON CONFLICT DO NOTHING against appointments.slot_locks"
2. Section 2.2 module comment line 172 — update infrastructure comment
3. Section 19 change log — update the retained item to reference the correct pattern

---

## FINDING-3 — CRITICAL: Spec User and Facility Entities Show TIMESTAMP After v1.1 Mandated TIMESTAMPTZ

**Spec reference:** Section 5.1 User entity (last_login_at, created_at, updated_at); Facility entity (created_at, updated_at); Section 19 change log ("Timestamps: TIMESTAMP → TIMESTAMPTZ")
**Roadmap reference:** Step 4 Prisma schema (correctly uses @db.Timestamptz for all fields)

Section 19 documents the change. The Appointment entity in Section 5.1 uses TIMESTAMPTZ correctly. But User and Facility entities still show plain TIMESTAMP. A developer following Section 5.1 as the authoritative reference will create wrong column types.

**Resolution:** Update User entity: last_login_at → TIMESTAMPTZ, created_at → TIMESTAMPTZ, updated_at → TIMESTAMPTZ. Update Facility entity: same.

---

## FINDING-4 — HIGH: SMS Provider Hierarchy: Spec Lists 4 Providers, Roadmap Implements 2

**Spec reference:** Section 8.1 (4 providers: Orange, Telma, Airtel, Africa's Talking); Section 2.4 line 344
**Roadmap reference:** Step 23 (only OrangeMadagascarProvider and AfricasTalkingProvider)

The spec defines a 4-tier hierarchy. The roadmap implements only Orange and Africa's Talking, skipping Telma and Airtel entirely. Neither document notes this as a conscious deferral.

**Resolution:** Either add Telma and Airtel provider stubs to Step 23, or add an explicit deferral note: "Telma SMS and Airtel SMS adapters deferred to Phase 2."

---

## FINDING-5 — HIGH: Payments Schema Missing from init-schemas.sql

**Spec reference:** Section 2.2 (payments module defined); Section 2.3 (schema-per-module pattern)
**Roadmap reference:** Step 2 init-schemas.sql (7 schemas, no payments); Phase 10 Steps 41–42 (full payments implementation)

The spec defines payments as a first-class module. The schema-per-module pattern requires its own PostgreSQL schema. Phase 10 implements it. But init-schemas.sql creates only 7 schemas. Phase 10 implementers will need a separate migration. The Day 1 checklist says "7 schemas + 3 extensions" — confirming payments is forgotten.

**Resolution:** Add `CREATE SCHEMA IF NOT EXISTS payments; -- Phase 2` to init-schemas.sql. Update Day 1 checklist.

---

## FINDING-6 — HIGH: HIPAA Language Not Removed Despite Architect's Own Correction

**Spec reference:** Section 3.2.3 line 603 ("Add private notes (HIPAA/confidential)"); Section 11 architect note (HIPAA is US law, not applicable to Madagascar)
**Roadmap reference:** N/A (spec-internal contradiction)

Section 11 explicitly says to stop using HIPAA framing. The correction was documented but not applied to Section 3.2.3.

**Resolution:** Replace "Add private notes (HIPAA/confidential)" with "Add private notes (confidential — medical data per Madagascar Law No. 2014-038)".

---

## FINDING-7 — HIGH: notification_log, device_tokens, VideoSession, ConsentRecord — Roadmap Implements, Spec Never Defines

**Spec reference:** Section 5.1 (no formal definitions for these entities)
**Roadmap reference:** Step 4 line 684 ("Translate every entity from the spec... Key models: NotificationLog, VideoSession, ConsentRecord"); Step 26 (notification_log); Step 40 (device_tokens)

Step 4 instructs developers to translate spec Section 5 entities into Prisma models, listing NotificationLog, VideoSession, ConsentRecord specifically — but none have field-level definitions in Section 5.1. DeviceTokens is not in the spec at all.

**Resolution:** Add full entity definitions to spec Section 5.1 for: NotificationLog, DeviceToken, VideoSession, ConsentRecord.

---

## FINDING-8 — HIGH: Jitsi and Firebase Environment Variables Used in Roadmap, Missing from .env.example

**Spec reference:** N/A (spec does not enumerate env vars)
**Roadmap reference:** Step 31 (JITSI_APP_ID, JITSI_APP_SECRET, JITSI_DOMAIN); Step 36 (VITE_SENTRY_DSN); Step 40 (FIREBASE_SERVICE_ACCOUNT_BASE64); Step 2 .env.example

The following variables appear in later roadmap steps but are completely absent from .env.example:
- `JITSI_APP_ID`, `JITSI_APP_SECRET`, `JITSI_DOMAIN` (Step 31)
- `VITE_SENTRY_DSN` (Step 36)
- `FIREBASE_SERVICE_ACCOUNT_BASE64` (Step 40)

A developer setting up Phase 7 or Phase 9 will hit runtime failures with no hint about what's missing.

**Resolution:** Update .env.example in the roadmap's Step 2 (and the committed file) to include all missing variables with placeholder values.

---

## FINDING-9 — MEDIUM: Spec Section 6.2 API Endpoints Missing MVP-Scope Scheduling and Admin Endpoints

**Spec reference:** Section 6.2 (only covers Auth, Doctor Search, Appointments, Slot Locking, Video)
**Roadmap reference:** Step 15 (scheduling templates/exceptions endpoints); Step 37 (admin doctor endpoints); Step 40 (device-token endpoint)

MVP-scope endpoints absent from spec Section 6.2:
- `POST/GET/DELETE /api/v1/scheduling/templates`
- `POST/GET/DELETE /api/v1/scheduling/exceptions`
- `GET /api/v1/admin/doctors/pending`
- `POST /api/v1/admin/doctors/:id/verify`
- `POST /api/v1/admin/doctors/:id/reject`
- `POST /api/v1/notifications/device-token`

**Resolution:** Add these endpoints to spec Section 6.2 with proper access control annotations.

---

## FINDING-10 — MEDIUM: Domain Event Name Inconsistency — Spec Has VideoSessionStarted, Roadmap Only Publishes VideoSessionCompleted

**Spec reference:** Section 2.2 domain events ("VideoSessionStarted → Analytics (record)")
**Roadmap reference:** Step 31 ("VideoSessionCompleted → Analytics (record) + Notifications (prescription prompt)")

The spec captures session start. The roadmap captures session end. Neither document captures both. VideoSessionStarted is never published in the roadmap. VideoSessionCompleted is never defined in the spec.

**Resolution:** Add `VideoSessionCompleted` to spec Section 2.2. Add `VideoSessionStarted` emission to roadmap Step 31's `POST /consultations/:id/start` handler.

---

## FINDING-11 — LOW: Waitlist Feature Defined in Spec, Completely Absent from Roadmap

**Spec reference:** Section 2.3 schema comment (`appointments` schema: "appointments, slot_locks, waitlist"); Section 3.2.3 (Waitlist System: full feature description)
**Roadmap reference:** No mention in any step

Section 3.2.3 defines a Waitlist System as a functional requirement: add patients, auto-notify when slot opens, priority system. `waitlist` appears in the schema comment. The roadmap has no step, no Prisma model, no endpoint, no domain event.

**Resolution:** Either add a roadmap step for the waitlist (between Steps 22 and 23) or explicitly defer to a named phase in both documents.

---

## Summary Table

| # | Severity | Spec Ref | Roadmap Ref | Conflict |
|---|----------|----------|-------------|---------|
| 1 | Critical | Header "v1.2" vs footer "v1.3 Changes" | Footer "Derived from v1.3" | Spec version internally contradictory |
| 2 | Critical | Sec 3.1.3 + Sec 2.2 + Sec 19: SELECT FOR UPDATE | Step 19: INSERT ON CONFLICT (v1.1 bug fix) | Spec endorses the pattern the roadmap marks a critical bug |
| 3 | Critical | Sec 5.1 User/Facility: TIMESTAMP | Step 4 Prisma: @db.Timestamptz | v1.1 mandated TIMESTAMPTZ but Section 5.1 entities never updated |
| 4 | High | Sec 8.1: 4 SMS providers | Step 23: 2 providers (Orange, Africa's Talking) | Telma and Airtel missing from implementation with no deferral note |
| 5 | High | Sec 2.2: payments module | Step 2 init-schemas.sql: 7 schemas | payments schema absent from init-schemas.sql |
| 6 | High | Sec 3.2.3: "HIPAA/confidential" | Sec 11 architect note: HIPAA doesn't apply | Spec contradicts its own correction |
| 7 | High | Sec 5.1: no definitions for 4 entities | Step 4 + Step 26 + Step 40: implement them | NotificationLog, DeviceToken, VideoSession, ConsentRecord have no spec entity definitions |
| 8 | High | N/A | Step 31/36/40 + Step 2 .env.example | Jitsi, Firebase, Sentry DSN env vars used but absent from .env.example |
| 9 | Medium | Sec 6.2: incomplete endpoint list | Step 15/37/40: scheduling + admin + device-token | MVP endpoints missing from spec API section |
| 10 | Medium | Sec 2.2: VideoSessionStarted | Step 31: VideoSessionCompleted | Different lifecycle events; each document covers one, neither covers both |
| 11 | Low | Sec 3.2.3: Waitlist System | No roadmap step | Full feature in spec with no roadmap implementation or deferral note |
