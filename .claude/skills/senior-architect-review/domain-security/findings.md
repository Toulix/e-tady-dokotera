# Security Review Findings — e-tady-dokotera

**Reviewer:** Senior Application Security Engineer
**Date:** 2026-03-03
**Documents reviewed:** `docs/spec.md` (v1.2), `docs/roadmap.md` (v1.4)

---

## CRITICAL Findings

### CRIT-01 — Self-Registration Privilege Escalation via `user_type` Field

**Severity:** Critical
**Location:** `spec.md` Section 6.2, `POST /api/v1/auth/register`; `roadmap.md` Step 8

**Problem:**
The registration endpoint body includes `user_type` as a client-supplied field:

```
POST /api/v1/auth/register
Body: { phone_number, password, first_name, last_name, user_type }
```

The `User` entity in `spec.md` Section 5.1 defines `user_type` as `ENUM('patient', 'doctor', 'admin', 'support')`. There is no documented server-side validation restricting which values a self-registering caller may supply. A malicious actor can POST `{ "user_type": "admin" }` and receive a JWT with admin-level claims, gaining full platform access — including verifying doctors, reading all patient data, and accessing every admin route.

**Fix:**

```typescript
// modules/auth/api/dto/register.dto.ts
import { IsIn } from 'class-validator';

export class RegisterDto {
  @IsIn(['patient'])  // ONLY 'patient' allowed via public self-registration
  user_type: 'patient';
}
```

Doctor accounts must go through an admin-initiated invite flow. Admin and support accounts must only be created via internal tooling — never through any public endpoint.

---

### CRIT-02 — OTP Brute-Force: Rate Limiting Per-IP Only, Not Per Phone Number

**Severity:** Critical
**Location:** `roadmap.md` Step 33 (Rate Limiting), `POST /api/v1/auth/verify-otp`

**Problem:**
The `@Throttle()` decorator uses IP address as the default throttle key. A 6-digit OTP has 900,000 values. With a 10-minute TTL, an attacker controlling 900 IPs can distribute attempts and exhaust the OTP space without triggering any single-IP limit.

**Fix — Redis-backed per-phone attempt counter in `OtpService.verify()`:**

```typescript
async verify(phone: string, code: string): Promise<boolean> {
  const attemptsKey = `otp_attempts:${phone}`;
  const attempts = await this.redis.incr(attemptsKey);
  if (attempts === 1) await this.redis.expire(attemptsKey, 600);

  if (attempts > 5) {
    throw new HttpException(
      { code: 'OTP_MAX_ATTEMPTS', message: 'Too many attempts. Request a new code.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const hash = await this.redis.get(`otp:${phone}`);
  if (!hash) return false;
  const valid = await bcrypt.compare(code, hash);
  if (valid) {
    await this.redis.del(`otp:${phone}`);
    await this.redis.del(attemptsKey);
  }
  return valid;
}
```

This fix must go into Phase 1 (Step 8) — not Phase 8.

---

### CRIT-03 — Bull Board Admin UI: No HTTPS Enforcement, No IP Allowlist at Application Layer

**Severity:** Critical
**Location:** `roadmap.md` Step 3 (`main.ts`), `/admin/queues`

**Problem:**
Bull Board is protected by `express-basic-auth`. HTTP Basic Auth encodes credentials as `base64(user:pass)` — not encryption. If traffic reaches port 3000 directly (see HIGH-01), credentials are transmitted in plaintext. The Step 34 checklist mentions "Admin routes behind IP allowlist in Nginx" as a checkbox — never implemented anywhere.

**Fix — IP allowlist middleware before `basicAuth`:**

```typescript
app.use('/admin/queues', (req, res, next) => {
  const allowedIps = (process.env.ADMIN_ALLOWED_IPS ?? '').split(',').filter(Boolean);
  if (process.env.NODE_ENV === 'production' && allowedIps.length > 0) {
    const clientIp = req.ip ?? req.socket.remoteAddress;
    if (!allowedIps.includes(clientIp)) return res.status(403).json({ message: 'Forbidden' });
  }
  next();
});
app.use('/admin/queues', basicAuth({ ... }), serverAdapter.getRouter());
```

---

## HIGH Findings

### HIGH-01 — Port 3000 Exposed on `0.0.0.0`: Nginx Bypass Possible

**Severity:** High
**Location:** `roadmap.md` Step 28 (`docker-compose.prod.yml`)

**Problem:**
`docker-compose.prod.yml` has `ports: ["3000:3000"]`, binding NestJS to `0.0.0.0:3000`. This exposes the raw HTTP server to the public internet, bypassing Nginx, Cloudflare WAF, and HTTPS termination. The Terraform config provisions no `digitalocean_firewall` resource.

**Fix:**
1. In `docker-compose.prod.yml`: `"127.0.0.1:3000:3000"` (loopback-only binding)
2. Add Terraform `digitalocean_firewall` resource allowing only ports 22, 80, 443 inbound
3. Add `ufw` setup to Droplet bootstrap script

---

### HIGH-02 — Jitsi JWT Expires in 2h: No Refresh for Long Consultations

**Severity:** High
**Location:** `roadmap.md` Step 31 (`signJitsiToken()`)

**Problem:**
`jwt.sign({ ... }, secret, { expiresIn: '2h' })` — when the JWT expires mid-consultation, Jitsi disconnects the participant. No refresh endpoint exists. No `token_expires_at` in `video.sessions`.

**Fix:** Increase to `'4h'` as default. Add `GET /api/v1/consultations/:appointmentId/token-refresh` for active sessions.

---

### HIGH-03 — Admin IP Allowlist: Documented as Checklist Item, Never Implemented

**Severity:** High
**Location:** `roadmap.md` Step 34, `spec.md` Section 4.3

**Problem:** Step 34 lists "Admin routes behind IP allowlist in Nginx" as a checkbox. No `allow`/`deny` Nginx directives appear in the roadmap's Nginx config.

**Fix:**
```nginx
location /api/v1/admin/ {
  allow YOUR_OFFICE_IP;
  allow YOUR_VPN_CIDR;
  deny all;
  proxy_pass http://127.0.0.1:3000;
}
```

---

### HIGH-04 — JWT Role Claims Not Re-Validated Against DB: No Access Token Revocation

**Severity:** High
**Location:** `roadmap.md` Step 9 (`RolesGuard`)

**Problem:** `RolesGuard` reads `user.userType` from the decoded JWT payload. During the 15-minute access token window, if a doctor's account is suspended, the JWT remains valid. Logout only invalidates the refresh token.

**Fix — Redis-backed token denylist:**
```typescript
// On account suspension:
await this.redis.set(`token_denylist:${userId}`, Date.now(), 'EX', 15 * 60);

// In JwtStrategy.validate():
const revoked = await this.redis.get(`token_denylist:${payload.sub}`);
if (revoked && Number(revoked) > payload.iat * 1000) {
  throw new UnauthorizedException('Token has been revoked');
}
```

---

## MEDIUM Findings

### MED-01 — Surviving HIPAA Language in Section 3.2.3
**Location:** `spec.md` Section 3.2.3: "Add private notes (HIPAA/confidential)"
**Fix:** Replace with "Add private notes (Medical record — restricted access, audit logged)"

### MED-02 — OTP Rate Limiting Deferred to Phase 8, Not Applied at Phase 1
**Problem:** Auth endpoints are live from Phase 6 (week 7) with no rate limiting until Phase 8 (week 9-10).
**Fix:** Move `@Throttle()` decorators to Step 8 where auth endpoints are first implemented.

### MED-03 — Search Query Layer Combination: Parameter Offset Risk
**Location:** `roadmap.md` Step 13
**Fix:** Enforce `Prisma.sql` tagged template composition. Add integration tests for each layer combination.

### MED-04 — SMS STOP/Opt-Out Handler Missing
**Problem:** SMS templates include "Répondre STOP" but no inbound webhook, no `sms_opt_outs` table, and no pre-send check exist anywhere.
**Fix:** Add `POST /api/v1/webhooks/sms/inbound/:provider`. Add opt-out check in `NotificationService.send()`.

### MED-05 — WebSocket Gateway CORS Uses `process.env` Directly
**Location:** `roadmap.md` Step 18b
**Problem:** `cors: { origin: process.env.FRONTEND_URL }` — if undefined, Socket.io treats it as `'*'`.
**Fix:** Read `FRONTEND_URL` via `ConfigService` in `afterInit()` and throw if undefined.

---

## LOW Findings

- **LOW-01:** MockSmsProvider should throw if `NODE_ENV` is not `development` or `test`
- **LOW-02:** Add `GET /api/v1/appointments/:id/prescription-url` with explicit access control
- **LOW-03:** Refresh cookie should use `__Host-` prefix for subdomain isolation
- **LOW-04:** Auto-logout timer must call `POST /auth/logout` (not just clear Zustand state)

---

## What Is Correctly Implemented

1. HttpOnly Refresh Token Cookie — Never in response body, flags correct
2. Access Token in Zustand Memory Only — No localStorage, no sessionStorage
3. OTP bcrypt Hash in Redis with TTL + Delete on Use — Prevents plaintext and replay
4. Two-Layer Slot Locking with TOCTOU Fix — Correctly specified
5. Redis `noeviction` Policy Everywhere — Dev, test, CI, production
6. Parameterized PostGIS Queries in Repository Classes — Tagged template literals
7. Pre-Signed URLs for Object Storage — Key not URL stored, 15-min expiry
8. CORS with `credentials: true` — Correct origin restriction + cookie forwarding
9. Helmet Middleware — Applied before all routes
10. Firebase Service Account via Base64 Env Var — No credential files in git
11. Adapter Pattern for All External Services — SMS, video, payments
12. bcrypt for Password Hashing — Cost factor 10

---

## Summary Table

| ID | Severity | Issue |
|---|---|---|
| CRIT-01 | Critical | Self-registration as admin via `user_type` — no allowlist |
| CRIT-02 | Critical | OTP brute-force — rate limit per-IP only, not per-phone |
| CRIT-03 | Critical | Bull Board HTTP exposure — no IP allowlist at app layer |
| HIGH-01 | High | Port 3000 on `0.0.0.0` — Nginx bypass, no firewall rule |
| HIGH-02 | High | Jitsi JWT 2h expiry — no mid-consultation refresh mechanism |
| HIGH-03 | High | Admin IP allowlist is a checklist item, never implemented |
| HIGH-04 | High | JWT role claims not re-validated — no access token revocation |
| MED-01 | Medium | HIPAA language survives in Section 3.2.3 |
| MED-02 | Medium | OTP rate limiting deferred to Phase 8, not applied at Phase 1 |
| MED-03 | Medium | Search query layer combination — parameter offset risk |
| MED-04 | Medium | SMS STOP handler missing — opt-out compliance unimplemented |
| MED-05 | Medium | WebSocket CORS via `process.env` — undefined opens all origins |
| LOW-01 | Low | MockSmsProvider logs OTP codes — risk in staging |
| LOW-02 | Low | Pre-signed URL endpoint undefined — no access control spec |
| LOW-03 | Low | Refresh cookie lacks `__Host-` prefix |
| LOW-04 | Low | Auto-logout timer not implemented in roadmap |
