# Feature Spec / PRD — Staff Attendance (no-login clock)

> **Status:** Draft · **Last updated:** 2026-07-07
> **Related code:** `prisma/schema.prisma`, `app/api/attendance/*`, `app/(dashboard)/attendance/*`, `components/attendance/*`, `lib/permissions/definitions.ts` · **Flag:** `staffAttendance` (default OFF)

## 1. Overview & Problem

UMKM laundry owners need to track staff working hours + absences, but requiring each
staff to log in (email/password) on the shared counter device is friction they reject.
The device is already authenticated as the outlet account; staff should clock in/out by
**identifying themselves** (Name + PIN, or a personal QR) inside that session. No
hardware purchase (no RFID/face-rec) — pure browser, brand-fit. Owner trusts staff
(trust mode: no photo); the clock events are the audit trail. Multiple clock-in/out
pairs per day are allowed (morning + afternoon shifts, no lunch deduction).

## 2. Users & User Stories

- As an **owner**, I want staff to clock in/out by PIN/QR without each needing a login,
  so hours tracking doesn't add login friction.
- As a **staff**, I want to tap my name + PIN (or scan my QR) and see "Clocked in/out",
  so my hours are recorded in 2 seconds.
- As an **owner**, I want an attendance report (hours, days worked, no-shows) per period,
  so I can review attendance + pay accurately.
- As an **owner**, I want to set/reset each staff's PIN + generate a printable QR.

## 3. Scope

**In (MVP):** Name+PIN clock (toggle in/out, multi-pair/day) · optional QR scan ·
live "clocked-in now" · attendance report (hours, days worked, no-show) · PIN/QR
management · flag + RBAC · audit (the events) · PIN rate-limit · forgot-clock-out guard.
**Out (follow-ups):** camera snapshot / face-verify anti-titip (trust mode chosen) ·
scheduled shifts / overtime / late rules / payroll export · cross-branch scheduling ·
per-staff self-service portal.

## 4. Functional Requirements

- **FR-1** A staff with a `pinHash` can clock; others can't. Clock is self-service (no
  permission needed) inside the authenticated outlet session.
- **FR-2** Clock toggles: if the staff's last open event is `CLOCK_IN`, the next clock
  is `CLOCK_OUT`; otherwise `CLOCK_IN`. Multiple IN→OUT pairs per day allowed.
- **FR-3** QR path: a staff with a `qrToken` scans their printed QR (device camera +
  jsQR) → resolves to the user → same toggle (skips PIN).
- **FR-4** Wrong PIN: after 5 failed attempts, 60s cooldown (rate-limit) blocks further
  attempts for that user.
- **FR-5** Hours worked (a day/period) = sum of each `CLOCK_IN→CLOCK_OUT` pair's
  duration. Gaps (e.g., lunch) aren't counted (no pair = no hours).
- **FR-6** Forgot-clock-out: an open `CLOCK_IN` at branch-midnight is auto-closed
  (or closed on the staff's next clock) and flagged for owner review.
- **FR-7** Absence (no-show): a `Branch.workDays` day (default Mon-Sat) in the report
  range where the staff has 0 worked hours.
- **FR-8** Owner/Manager sets/resets PIN + generates/rotates QR per staff in `/users`.
- **FR-9** Feature gated behind `staffAttendance` flag; UI hidden when OFF.

## 5. Non-Functional Requirements

- **Flag:** `staffAttendance`, default OFF, per-tenant override.
- **i18n:** `attendance.*` keys in BOTH en+id (rule #4), no interpolation.
- **Security:** PIN bcrypt-hashed (never returned); QR token opaque random (rotate on
  reset); clock tenant-scoped (`ctx.tenantId`); branch from session.
- **Schema change** → `db:push` + rebuild BOTH Docker images (#10).

## 6. Data Model

- `User.pinHash String?` (bcrypt) + `User.qrToken String? @unique` (opaque).
- `ClockEvent { id, userId, tenantId, branchId, type: ClockType, timestamp, createdAt }`
  with indexes `[userId, timestamp]`, `[tenantId, branchId, timestamp]`.
- `enum ClockType { CLOCK_IN CLOCK_OUT }`.
- `Branch.workDays Int[]?` (1=Mon…7=Sun, default `[1,2,3,4,5,6]`).
- Back-relations on User/Tenant/Branch.

## 7. API Surface

- `POST /api/attendance/clock` — `{ userId, pin } | { qrToken }` → toggled `ClockEvent`.
- `GET /api/attendance/status` — currently-clocked-in staff for the branch.
- `GET /api/reports/attendance?from&to` — per-staff hours/days/no-show (`attendance:read`).
- `PATCH /api/users/[id]/pin` — set/reset PIN + rotate QR (`attendance:manage`).

## 8. Acceptance Criteria

- **AC-1 (PIN clock-in)** — *Given* flag ON + a staff has a PIN, *When* the staff taps
  their name + PIN on the clock widget, *Then* a `CLOCK_IN` event is created + "Clocked
  in" shows with the time.
- **AC-2 (toggle + multi-pair)** — *Given* clocked in, *When* the staff clocks again,
  *Then* it's a `CLOCK_OUT`; a second IN/OUT pair the same day sums both (4h+4h=8h).
- **AC-3 (QR)** — *Given* a staff has a `qrToken`, *When* they scan their QR, *Then*
  they clock without a PIN.
- **AC-4 (rate-limit)** — *Given* 5 wrong PINs, *When* a 6th is tried within 60s, *Then*
  it's rejected with a cooldown message.
- **AC-5 (no-show)** — *Given* a Mon-Sat work-day with 0 hours for a staff, *Then* the
  attendance report counts it as a no-show.
- **AC-6 (forgot clock-out)** — *Given* an open CLOCK_IN past midnight, *Then* it's
  auto-closed + flagged.
- **AC-7 (PIN mgmt)** — *Given* Owner, *When* they reset a staff's PIN / rotate QR in
  `/users`, *Then* the old QR is invalidated + the new PIN works.
- **AC-8 (flag gate)** — *Given* flag OFF, *Then* the clock widget + report are hidden.
- **AC-9 (tenancy)** — *Given* tenant A, *When* clocking, *Then* no tenant-B data is
  touched.

## 9. Relations to other functions

| Function | Relation | Touchpoint |
|---|---|---|
| `User` model | mutates (pinHash, qrToken) | `prisma/schema.prisma` |
| `Branch` model | mutates (workDays) | `prisma/schema.prisma` |
| Feature flags | adds `staffAttendance` | `lib/feature-flags.ts`, `prisma/seed-flags.ts` |
| RBAC | adds `attendance` resource | `lib/permissions/definitions.ts`, `lib/permissions/defaults.ts` |
| Reports | extends (attendance tab) | `app/(dashboard)/reporting/*`, `/api/reports/*` |
| Users mgmt | extends (PIN/QR actions) | `app/(dashboard)/users/*` |
| Sidebar | gates the clock entry | `components/layout/app-sidebar.tsx` |
| bcrypt | reuses (PIN hash) | `prisma/seed.ts` pattern |

## 10. Test Plan / QA Gate

- **Unit:** clock-toggle logic (last-event → next type), hours-from-pairs sum,
  no-show heuristic, PIN verify + rate-limit, QR resolve + rotate.
- **E2E (Playwright):** AC-1…AC-4 (set PIN → clock → toggle → QR → rate-limit) +
  AC-5 (report) + AC-8 (flag gate).
- **Manual:** db:push + rebuild images + flag ON; clock 2 pairs; check report sums;
  force a wrong-PIN storm; leave an open clock-in overnight.
- **QA gate:** tsc → build → test (green) → code-review → manual. AC-1…AC-9 ARE the
  pass/fail.

## 11. Rollout & Rollback

- Flag default OFF; enable per-tenant for dogfooding. Schema change → `db:push` +
  rebuild BOTH images (`app` + `init-db`). Rollback: flag OFF (clock UI hidden); the
  schema additions are additive (no data loss).

## 12-14. Metrics / Risks / Follow-ups

- **Risk:** titip absen (buddy punching) — accepted in trust mode; mitigated by the
  audit trail + report review. Strict tier (photo/face) deferred (§3).
- **Risk:** PIN brute-force — rate-limited (FR-4).
- **Follow-ups:** scheduled shifts/overtime/payroll; camera-snapshot strict tier;
  per-staff self-service portal.
