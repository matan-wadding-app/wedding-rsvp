# Wedding RSVP - Full Testing Procedure (A to Z)

This document is the complete end-to-end test procedure for the wedding RSVP project.

Use it:
- Before major releases
- After any schema or UI changes
- After changing RSVP logic, admin dashboard, campaign logic, or security policies

---

## 1) Scope and Test Goals

Validate all critical areas:
- Guest-facing RSVP website
- Admin authentication and management flows
- Supabase database integrity and permissions
- Campaign state management (backend-based)
- Exports/backups
- Security and regression behavior

Success criteria:
- No blocking bug in guest RSVP or admin operations
- Correct DB writes and reads
- Correct side-based Bit link behavior
- Charts and counts are consistent with live data
- No accidental permission leaks for admin data tables

---

## 2) Environments

Test at least two environments:
- **Local** (developer smoke and fast iteration)
- **Production deployment** (real-world verification)

Suggested URLs:
- Guest page: `.../index.html` or deployed root
- Admin page: `.../MPadmin.html`

---

## 3) Prerequisites

Before starting:
- Supabase project is reachable
- Valid admin credentials available
- Browser with popup support (for WhatsApp open flows)
- Test data policy defined (real data vs sandbox guests)
- Latest SQL migrations applied

Optional but recommended:
- Backup export created before test run
- One dedicated test guest record for repeated checks

---

## 4) Test Data Matrix

Use a matrix of guest types:
- `invite_side`: `groom`, `bride`
- `rsvp_status`: `pending`, `coming`, `not_coming`
- `guests_count`: `0`, `1`, `8` (edge values)
- Phone field: empty, valid local format, malformed
- Token: valid, invalid format, non-existing token

This ensures logic is verified across edge cases and normal cases.

---

## 5) Pre-Flight Checks

1. Open deployed guest page and admin page.
2. Confirm static assets load (no missing CSS/JS).
3. Confirm Supabase config values are present and non-empty.
4. Confirm browser console has no fatal JS error on load.
5. Confirm network calls to Supabase return expected status codes.

Pass if:
- Pages render correctly
- No fatal client-side crash

---

## 6) Guest Page Functional Tests

## 6.1 Language / basic UI
- Switch available languages and verify visible text updates.
- Verify no layout break on mobile width and desktop width.

## 6.2 RSVP choice flow
- Click "coming" flow and verify guest count selector appears.
- Click "not coming" flow and verify submission still possible.
- Try submitting with missing required fields and verify validation message.

## 6.3 Guests count limit
- Open coming flow and verify dropdown max value is `8`.
- Attempt any manual tampering (if possible) and verify backend still enforces valid range.

## 6.4 Side-based Bit link routing
- Open with `?side=gro` and verify Bit link resolves to groom URL.
- Open with `?side=bri` and verify Bit link resolves to bride URL.
- Open without side parameter and verify default behavior.

## 6.5 Token-based guest retrieval
- Open with valid tokenized link and verify guest prefill behavior (if supported).
- Open with invalid token format and verify graceful handling (no crash, safe fallback).

## 6.6 Question / blessing submission
- Submit valid question and verify success feedback.
- Submit empty/short invalid question and verify validation failure.
- Submit blessing text and verify expected UX response.

---

## 7) Admin Authentication Tests

## 7.1 Login
- Valid credentials -> should enter admin dashboard.
- Invalid password -> should fail safely with clear message.
- Empty fields -> validation error.

## 7.2 Session behavior
- Refresh after login -> still authenticated (if intended).
- Logout -> session cleared; protected content inaccessible.
- Re-open admin page after logout -> should require login.

## 7.3 Reset password path
- Trigger reset flow and verify reset message UX.
- Verify no crash if reset link is expired or invalid.

---

## 8) Admin Dashboard and Data Visualization Tests

## 8.1 Rendering and responsiveness
- Verify dashboard loads summary/charts without JS errors.
- Verify layout on narrow/mobile and wide/desktop widths.

## 8.2 Chart correctness
- RSVP status pie values match actual DB counts.
- Invitation side pie values match actual DB counts.
- Percentages and labels are internally consistent.

## 8.3 Empty-state behavior
- If table has no data (or filtered no-data), verify charts and cards show safe empty states.

---

## 9) Guest Management (Live Table) Tests

## 9.1 Create guest
- Add guest with required fields.
- Verify row appears in table.
- Verify DB record created with expected defaults.

## 9.2 Edit guest inline
- Edit `full_name`, `phone`, `category`, `invite_side`, `guests_count`.
- Save row and confirm update persisted after refresh.

## 9.3 Validation / boundaries
- Set guests_count > 8 -> should be blocked or normalized.
- Invalid side value should not persist.
- Missing required fields should fail.

## 9.4 Delete/cleanup behavior (if supported)
- Verify delete action behavior and data consistency.
- Confirm no orphaned UI state after delete.

---

## 10) Messaging and Campaign Flow Tests

## 10.1 Template blocks
- Verify month-before and days-before templates render and are copyable.
- Verify placeholders and token examples are clear and intact.

## 10.2 Campaign initialization
- Start invite campaign; confirm campaign and items created in backend tables.
- Start gift reminder mode; verify filter logic (confirmed-only behavior if intended).

## 10.3 Campaign progression
- Resume active campaign and verify it continues correctly.
- Mark item status transitions correctly (`queued`, `sent`, etc. as implemented).
- Verify state persistence across page refresh/browser reopen.

## 10.4 Campaign export/report
- Export campaign report and verify file structure and data correctness.

## 10.5 Campaign reset
- Clear/reset campaign and verify active state cleared from backend.

---

## 11) Export / Backup Tests

1. Trigger CSV export.
2. Verify file downloads successfully.
3. Verify filename includes relevant stem/date as expected.
4. Open CSV and validate:
   - Header columns are correct
   - UTF-8/Hebrew text integrity
   - `invite_side` and RSVP fields match DB
5. Cross-check random rows against DB records.

---

## 12) Supabase Database Validation

Run DB checks after functional tests:

- Confirm required tables exist:
  - `public.guests`
  - `public.questions`
  - `public.message_campaigns`
  - `public.message_campaign_items`
- Confirm critical columns exist and type is correct:
  - `invite_side`, `guests_count`, `token`, `rsvp_status`
- Confirm constraints:
  - `guests_count` bounded correctly
  - `invite_side` values restricted to expected set
- Confirm rows written by tests appear correctly.

---

## 13) Security Verification

## 13.1 RLS and policies
- Ensure admin tables are not open with permissive `using (true)` for all authenticated users.
- Verify admin access is restricted to intended admin identity rules.

## 13.2 Function privileges
- Verify public RSVP RPCs have least-privilege grants intended by architecture.
- Confirm no unintended execute grants for sensitive routines.

## 13.3 Input hardening
- Invalid token format does not crash and does not expose data.
- Invalid status values are rejected safely.
- Over-limit guests_count is blocked/clamped by DB rules.

## 13.4 Supabase advisor checks
- Run security and performance advisors.
- Record warnings, classify as:
  - intentional
  - needs fix now
  - needs later hardening

---

## 14) Browser and Device Coverage

Minimum matrix:
- Chrome (desktop)
- Edge (desktop)
- Mobile viewport simulation

Checks:
- Critical flows operate
- No severe layout break
- Popups/WhatsApp link behavior acceptable per browser policy

---

## 15) Performance and Stability

Basic stability checks:
- Reload guest/admin pages multiple times (5-10)
- Run repeated RSVP submits on test records
- Run repeated chart refresh and campaign resume actions

Watch for:
- UI freezes
- duplicate writes
- stale state rendering
- console error accumulation

---

## 16) Regression Checklist (Quick Run)

Use this fast checklist before any push:

- [ ] Guest page loads
- [ ] RSVP submit works
- [ ] Max guests is 8
- [ ] `?side=gro` Bit link correct
- [ ] `?side=bri` Bit link correct
- [ ] Admin login works
- [ ] Guest table add/edit works
- [ ] Charts render correctly
- [ ] Export CSV works
- [ ] Campaign start/resume works
- [ ] No fatal console/network errors

---

## 17) Defect Triage Rules

Severity guide:
- **P0**: blocks RSVP/admin login/data writes (release blocker)
- **P1**: major feature broken or wrong data persisted
- **P2**: non-blocking logic/UI issue
- **P3**: cosmetic or low-impact issue

Each bug report should include:
- environment
- exact steps
- expected vs actual
- screenshot/error
- related DB row identifiers (if relevant)

---

## 18) Release Sign-Off Template

Use this for final approval:

- Build/Deploy target: `________`
- Date/time tested: `________`
- Tester: `________`
- Environment(s): `________`
- Test scope completed: `Full / Partial`
- Open defects: `0 / list`
- Security review status: `Pass / Needs Follow-up`
- Final decision: `Approved / Blocked`
- Notes: `________`

---

## 19) Recommended Test Order (Practical)

1. Pre-flight
2. Guest core flow
3. Admin auth
4. Admin guest management
5. Charts/data accuracy
6. Campaign flow
7. Export/backup
8. DB + security checks
9. Regression checklist
10. Sign-off

---

## 20) Maintenance Notes

Update this file whenever any of these change:
- DB schema/migrations
- RSVP flow rules
- Campaign status model
- dashboard charts/cards
- admin auth/RLS model

Keep this procedure versioned with code changes.

