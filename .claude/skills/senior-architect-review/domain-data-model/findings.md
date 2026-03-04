# Data Model Architecture Review — e-tady-dokotera

**Reviewer:** Senior Database Architect
**Date:** 2026-03-03
**Documents reviewed:** `docs/spec.md` (v1.2), `docs/roadmap.md` (v1.4)

**14 findings: 1 Critical, 4 High, 5 Medium, 4 Low**

---

## ISSUE-01 — CRITICAL

**Location:** Spec Section 5.1 — User entity (`last_login_at`, `created_at`, `updated_at`), Facility entity (`created_at`, `updated_at`)

**Problem — `TIMESTAMP` used where `TIMESTAMPTZ` is required:**

The User and Facility entity pseudo-code in Section 5.1 defines timestamps as bare `TIMESTAMP`. The Appointment entity in the same section correctly uses `TIMESTAMPTZ`. Section 19 (v1.1 summary) explicitly states: "Timestamps: TIMESTAMP → TIMESTAMPTZ — timezone-awareness required for GMT+3." CLAUDE.md mandates: "All timestamps: @db.Timestamptz."

The Prisma schema in Roadmap Step 4 correctly uses `@db.Timestamptz`. But a developer reading Section 5.1 as the authoritative reference will produce wrong column types.

**Fix:**
```
// User entity — corrected
last_login_at: TIMESTAMPTZ | NULL
created_at: TIMESTAMPTZ
updated_at: TIMESTAMPTZ

// Facility entity — corrected
created_at: TIMESTAMPTZ
updated_at: TIMESTAMPTZ
```

---

## ISSUE-02 — HIGH

**Location:** Spec Section 5.1 — `DoctorProfile.average_rating: NUMERIC(3,2)`; Section 2.2 module communication rules

**Problem — Sub-A:** Prisma does not support column-level precision on NUMERIC. `Decimal` generates `DECIMAL(65,30)` by default. Getting `NUMERIC(3,2)` requires overriding migration SQL by hand after every `prisma migrate dev`.

**Problem — Sub-B:** The spec states `average_rating` is "updated by analytics module, read-only for doctor module." Section 2.2 says "No direct cross-module database write access." No domain event bridges this. As specced, analytics would write directly to `doctors.profiles.average_rating` — a cross-module write violation.

**Fix A:** Store rating as `Integer` (0–500, representing 0.00–5.00):
```prisma
averageRating Int? @map("average_rating")
```

**Fix B:** Add `RatingRecalculated` domain event:
```
AppointmentCompleted → Analytics emits RatingRecalculated { doctorId, newAverageInt, totalReviews }
→ Doctors module @OnEvent handler updates its own table
```

---

## ISSUE-03 — HIGH

**Location:** `infra/docker/init-schemas.sql` (Roadmap Step 2); Prisma datasource schemas array (Roadmap Step 4)

**Problem:** `payments` schema is missing from `init-schemas.sql` and the Prisma datasource schemas list despite a full payments module being defined (Section 2.2) and implemented in Phase 10.

**Fix:**
```sql
-- Add to init-schemas.sql:
CREATE SCHEMA IF NOT EXISTS payments;
```
```prisma
schemas = ["auth", "doctors", "appointments", "scheduling",
           "notifications", "video", "analytics", "payments"]
```

---

## ISSUE-04 — HIGH

**Location:** Spec Section 5.1 — `WeeklyScheduleTemplate`; Section 5.2 — Indexes

**Problem — Sub-A:** No uniqueness constraint. A doctor can have multiple active templates for the same `(doctor_id, day_of_week, facility_id, appointment_type)`, producing duplicate slots and double-booking opportunities.

**Problem — Sub-B:** The existing index doesn't include `is_active`, causing full scans over historical templates.

**Fix:**
```sql
-- Uniqueness for active templates only:
CREATE UNIQUE INDEX weekly_template_active_unique_idx
  ON scheduling.weekly_templates(doctor_id, day_of_week, facility_id, appointment_type)
  WHERE is_active = true;

-- Replace existing index with partial:
CREATE INDEX schedule_template_doctor_day_active_idx
  ON scheduling.weekly_templates(doctor_id, day_of_week)
  WHERE is_active = true;
```
Note: partial unique indexes require raw migration SQL (not expressible in Prisma DSL).

---

## ISSUE-05 — HIGH

**Location:** Spec Section 5.1 (completeness audit)

**Problem:** 10+ tables referenced in spec and roadmap have no formal model in Section 5:

| Table | Schema | Missing from |
|---|---|---|
| `sessions` (refresh token store) | auth | Section 5.1 |
| `otp_codes` | auth | Section 5.1 |
| `notification_log` | notifications | Section 5.1 |
| `preferences` | notifications | Section 5.1 |
| `device_tokens` | notifications | Section 5.1 |
| `doctor_facilities` | doctors | Section 5.1 |
| `sessions` (video) | video | Section 5.1 |
| `consent_records` | video | Section 5.1 |
| `waitlist` | appointments | Section 5.1 |
| `events`/`aggregates` | analytics | Section 5.1 |

Most dangerous gap: `auth.sessions` for refresh token server-side storage. Without it, logout cannot truly invalidate the refresh token.

Minimum `auth.sessions` schema:
```
sessions {
  id: UUID (PK)
  user_id: UUID (FK → auth.users, ON DELETE CASCADE)
  token_hash: STRING  -- hashed, never raw JWT
  expires_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ
  revoked_at: TIMESTAMPTZ | NULL
  user_agent: STRING | NULL
  ip_address: INET | NULL
}
```

`notifications.device_tokens`:
```
device_tokens {
  id: UUID (PK)
  user_id: UUID (FK → auth.users, ON DELETE CASCADE)
  token: STRING
  platform: ENUM('ios', 'android', 'web')
  updated_at: TIMESTAMPTZ
  UNIQUE(user_id, platform)
}
```

---

## ISSUE-06 — MEDIUM

**Location:** Spec Section 3.1.3 — Concurrency & Locking note

**Problem:** Section 3.1.3 still says "Booking confirmation: PostgreSQL SELECT FOR UPDATE on the target slot row." Roadmap Step 19 correctly replaced this with `INSERT ... ON CONFLICT DO NOTHING`. The spec text was never updated after the v1.1 fix.

**Fix:** Update Section 3.1.3:
> "Booking confirmation: PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` against `appointments.slot_locks` (UNIQUE(doctor_id, slot_time)). `SELECT FOR UPDATE` is explicitly not used — it serializes all bookings for a doctor, creating a bottleneck."

---

## ISSUE-07 — MEDIUM

**Location:** Spec Section 5.2 — Database Indexes (5 missing)

```sql
-- Slot lock expiry scan:
CREATE INDEX slot_lock_expires_at_idx ON appointments.slot_locks(expires_at);

-- Notification log by appointment:
CREATE INDEX notification_log_appointment_idx
  ON notifications.notification_log(appointment_id) WHERE appointment_id IS NOT NULL;

-- Sessions expiry cleanup:
CREATE INDEX sessions_expires_at_idx ON auth.sessions(expires_at) WHERE revoked_at IS NULL;

-- Doctor profile search ordering (is_profile_live + rating):
CREATE INDEX doctors_profile_live_rating_idx
  ON doctors.profiles(average_rating DESC NULLS LAST)
  WHERE is_profile_live = true;

-- booking_reference (already UNIQUE — should be listed explicitly in Section 5.2):
-- The UNIQUE constraint creates an implicit index; document it for clarity.
```

---

## ISSUE-08 — MEDIUM

**Location:** Spec Section 5.1; Roadmap Step 13 SQL

**Problem:** `DoctorFacility` join table is referenced in search SQL (`LEFT JOIN doctors.doctor_facilities df`) and listed in Section 2.2 domain entities but never formally modeled in Section 5.1.

**Fix:**
```
DoctorFacility {
  id: UUID (PK)
  doctor_id: UUID (FK → doctors.profiles.user_id, ON DELETE CASCADE)
  facility_id: UUID (FK → doctors.facilities.id, ON DELETE CASCADE)
  is_primary: BOOLEAN DEFAULT false
  consultation_fee_override_mga: INTEGER | NULL
  created_at: TIMESTAMPTZ
  UNIQUE(doctor_id, facility_id)
}
```

---

## ISSUE-09 — MEDIUM

**Location:** Roadmap Step 4 (Prisma model) vs Step 19 (raw SQL)

**Problem:** `@default(uuid())` maps to `uuid_generate_v4()` (requires uuid-ossp). Raw SQL uses `gen_random_uuid()` (native PG 13+). Inconsistency causes failures if uuid-ossp is missing.

**Fix:** Standardize on `gen_random_uuid()`:
```prisma
id String @id @default(dbgenerated("gen_random_uuid()"))
```

---

## ISSUE-10 — MEDIUM

**Location:** `init-schemas.sql`; Prisma datasource extensions

**Problem:** If ISSUE-09 fix is applied, `uuid-ossp` extension is no longer needed. Leaving it creates false dependency.

**Fix:** After standardizing on `gen_random_uuid()`, remove `uuid-ossp` from both `init-schemas.sql` and Prisma datasource extensions. Document in `decisions.md`.

---

## ISSUE-11 — LOW

**Location:** Spec Section 5.1; Section 3.2.4 (EHR Lite)

**Problem:** Section 3.2.4 requires SOAP notes, ICD-10 codes, procedure codes. `Appointment.notes: TEXT` cannot store structured data. No `VisitNote` entity exists.

**Fix (if MVP-scope):**
```
VisitNote {
  id: UUID (PK)
  appointment_id: UUID (FK → appointments.appointments.id, UNIQUE)
  subjective: TEXT | NULL
  objective: TEXT | NULL
  assessment: TEXT | NULL
  plan: TEXT | NULL
  icd10_codes: TEXT[] | NULL  -- GIN indexed
  procedure_codes: TEXT[] | NULL
  is_private: BOOLEAN DEFAULT true
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

---

## ISSUE-12 — LOW

**Location:** Spec Section 5.2 — `appt_status_time_idx`

**Problem:** `ANY()` queries may not use this partial index. Queries must use explicit `IN()` to guarantee index use.

**Fix:** Add a comment documenting the planner constraint.

---

## ISSUE-13 — LOW

**Location:** Spec Section 5.1 — `ScheduleException`

**Problem:** Missing `updated_at` field — impossible to track when an exception was last modified.

**Fix:** Add `updated_at: TIMESTAMPTZ` to the `ScheduleException` entity.

---

## ISSUE-14 — LOW

**Location:** Spec Section 5.2 — `facilities_geolocation_gist_idx`

**Problem:** GIST index includes NULL rows. Minor efficiency issue.

**Fix:**
```sql
CREATE INDEX facilities_geolocation_gist_idx
  ON doctors.facilities USING GIST(geolocation)
  WHERE geolocation IS NOT NULL;
```

---

## What Is Correctly Designed

1. WeeklyScheduleTemplate + ScheduleException split — correct calendar pattern
2. Two-layer slot locking (Redis NX + INSERT ON CONFLICT) — correct and atomic
3. All money as INTEGER (Ariary) — no float bugs
4. All Appointment timestamps as TIMESTAMPTZ — critical for GMT+3
5. `booking_reference` as human-readable unique string
6. `prescription_storage_key` not `prescription_url` — security correct
7. `geolocation Unsupported("geometry(Point, 4326)")` with $queryRaw in FacilityRepository
8. Schema-per-module PostgreSQL layout — enforces module ownership at DDL level
9. GIST on `facilities.geolocation`, GIN on `profiles.specialties` — correct index types
10. Partial unique index on `email WHERE email IS NOT NULL` — correct nullable unique pattern
11. `appt_patient_time_idx` DESC and `appt_doctor_time_idx` — correct sort directions
12. `ScheduleException.exception_date: DATE` — semantically correct for all-day events

---

## Summary Table

| # | Severity | Issue |
|---|---|---|
| 01 | Critical | Spec 5.1 User/Facility: `TIMESTAMP` instead of `TIMESTAMPTZ` |
| 02 | High | DoctorProfile: `NUMERIC(3,2)` not Prisma-expressible; cross-module write violation for rating updates |
| 03 | High | `payments` schema missing from init-schemas.sql and Prisma datasource |
| 04 | High | WeeklyScheduleTemplate: no uniqueness constraint; index missing `is_active` filter |
| 05 | High | 10+ tables in spec/roadmap with no formal model in Section 5 |
| 06 | Medium | Spec 3.1.3 still says SELECT FOR UPDATE (roadmap correctly fixed to INSERT ON CONFLICT) |
| 07 | Medium | 5 missing indexes on hot paths |
| 08 | Medium | DoctorFacility join table referenced in SQL but never formally modeled |
| 09 | Medium | `@default(uuid())` vs `gen_random_uuid()` inconsistency |
| 10 | Medium | uuid-ossp redundant if standardizing on gen_random_uuid() |
| 11 | Low | No VisitNote entity for SOAP/ICD-10 notes |
| 12 | Low | `appt_status_time_idx` partial index needs planner behavior comment |
| 13 | Low | ScheduleException missing `updated_at` |
| 14 | Low | GIST index on nullable geolocation includes NULLs unnecessarily |
