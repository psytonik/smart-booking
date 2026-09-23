# Roadmap

> **Product requirements (PRD):** [Smart Booking — PRD](https://claude.ai/code/artifact/704c3a45-d934-41c6-8c59-d8b09a5f3ab9): what the product is, roles, key flows, requirements FR1–FR20 with status, monetization, release stages, risks and open questions. Start there for the *what and why*; this file is the engineering *how and when*. (The doc is private until shared from its Share menu.)

Open work lives in the **2026-09-23 architecture review** section directly below. Everything after it is the closed history of the 2026-08-26 backend + architecture code review, kept for reference. Ordered by priority; work top to bottom within each phase.

## Framework upgrade: NestJS 11 → 12 (ESM) — ✅ Done 2026-09-23

Done out of priority order, at the owner's request ("do it now, before it's a bigger job"). NestJS 12 ships no CommonJS build, so this was a full CommonJS → ESM migration for the whole project, not a version bump: `package.json` `"type": "module"`, `tsconfig.json` `module`/`moduleResolution: "nodenext"`, every relative import given an explicit `.js` extension, and the TypeORM CLI's `data-source.ts` rewritten off `__dirname` (doesn't exist under ESM) onto `import.meta.url`.

Found and fixed along the way — see `ARCHITECTURE.md` → "Key design decisions" → **ESM** for the details and the reasoning behind each fix:
- Wrote our own `RedisThrottlerStorage` (same Lua-script algorithm as `@nest-lab/throttler-storage-redis`) since that package's peer range caps at Nest 11.
- Circular entity relations (`Business` ↔ `Location`/`Users`/`Booking`) crashed at boot (`ReferenceError: Cannot access 'X' before initialization`) — fixed by typing every relation property `Relation<T>` (TypeORM's own type, sidesteps the crashing `emitDecoratorMetadata` reference).
- Two class fields whose initializers read a constructor parameter (`AuthenticationService.dummyHash`, `AuthenticationGuard.authTypeGuardMap`) broke under ES2022's field-initializer-before-parameter-property ordering — moved into the constructor body.
- `joi`, `compression`, `supertest` need a default import under real ESM (`import * as X` doesn't reliably work for CJS interop); `ioredis` needs a *named* import (`import { Redis }`, not the default) due to a TS/NodeNext resolution bug.
- `isolatedModules: true` (required for ts-jest under ESM) surfaced several missing `import type` annotations (`ActiveUserData`, `ConfigType`, `Relation`, `ThrottlerStorageRecord`) that only crashed at test time, not at `nest build` time.
- Jest bumped to v30: `@nestjs/throttler` (and other still-CommonJS Nest ecosystem packages) `require()` `@nestjs/common` internally, which needs Jest's own `require(esm)` support (added in v30) — plus a `preload-esm.ts` `setupFiles` entry to avoid a known false-positive cycle ([nestjs/nest#17583](https://github.com/nestjs/nest/issues/17583)). **Jest 30's `require(esm)` itself needs Node ≥ 24.9** (older Node falls back to the pre-v30 hard refusal) — CI's `test` job bumped from Node 22 to 24 for this. Docker's runtime image stays on `node:22-slim`: the compiled app boots fine there (verified), since it uses Node's own module loader directly, never Jest's.
- `jest.fn()` etc. now come from `import { jest } from '@jest/globals'` — the global isn't reliably injected into real ESM module scope.
- `.eslintrc.js` → `.eslintrc.cjs` (a plain `.js` file is loaded as ESM once `package.json` says `"type": "module"`, and `module.exports` isn't valid there).
- `joi` bumped 17→18 (implements the new `StandardSchemaV1` interface `@nestjs/config@12`'s `validationSchema` option now requires).
- `@nestjs/schematics`'s TypeScript 12.x peer (`>=6.0.0`) is skipped with `--legacy-peer-deps`: it's dev-only tooling we never invoke (`nest generate`), and bumping TypeScript itself was deliberately kept out of scope.

Verified: 51 unit + 37 e2e tests, three consecutive e2e runs (no flakiness in the concurrent-booking test), both suites again under `TZ=Pacific/Auckland`, `nest build` + `tsc --noEmit` + lint all clean, Docker image builds and boots (`/health` ok, `/docs` 404 in production), a live sign-up request round-tripped end to end.

**Not done, deliberately out of scope:** TypeScript 5.9 → 6/7 (a separate migration with its own unaudited breaking changes); the nodemailer 9→10 security-fix bump `npm audit` flagged (pre-existing, unrelated to this migration — see Phase D or file a fresh item).

---

# 2026-09-23 architecture review — open

Full read of `src/`, infra and docs after the 2026-08-26 roadmap was closed. Product decisions taken during the review:

- **International platform** → every business has its own timezone; all times stored as UTC (`timestamptz`).
- **Employees** → finish the feature (not remove it).
- **Google Calendar** → planned integration (keep the dependency, build it later).
- **Nearby search, business-side cancellation, admin tools, booking limits** → wanted, but **scope and rules are still to be discussed** before implementation (see Phase F).

## Product direction (from the product owner, 2026-09-23)

What the product is, as stated by its owner. This overrides earlier assumptions in this document.

- **Booking platform for service businesses** (barbers, salons, clinics, tutors, …). Every master works their own way.
- **Clients book a service with a master**, not a bare time slot. Services have their own durations (a haircut and a beard trim take different time), and they can differ per master.
- **Masters control their own day.** Breaks are the master's decision, not something the system carves out. A master may decide to work through lunch if clients want that hour.
- **Clients never pay in the app.** The platform earns from **business subscriptions**; the plans and billing model are still to be designed.
- **Surfaces:** a **mobile app (iOS/Android) for clients**, **web for businesses** (a business app may follow).
- **Notifications:** email first; **WhatsApp / Telegram** (and push for the mobile app) later.
- **"Smart"** refers to future intelligent features in the client app (e.g. suggestions, reminders).
- **Every business gets an exclusive, AI-generated design for its page.**

### What this changes technically

1. **Scheduling model: switch from pre-generated slots to working hours + computed availability.** Today a day is cut into fixed-length slot rows in advance. That can't represent services of different lengths on the same master's day, and a 30-min slot grid can't host a 45-min service. The standard model for this domain:
   - **Working hours** per master: a weekly template plus per-date overrides (day off, different hours).
   - **Blocked time** the master adds or removes themselves (break, errand), any time.
   - **Appointments**: master + service + start, with end = start + duration.
   - **Availability** is *computed*: working hours − blocked time − appointments, stepped for the requested service's duration.

   What M3 built carries over: UTC/`timestamptz`, per-business timezone and DST handling, the staff model and access rules, and row locking on booking. The `slot` table and the auto-lunch logic get replaced. Double-booking protection moves to a Postgres exclusion constraint on `(staff, tstzrange(start, end))`, which rejects overlapping appointments of any length at the database level.
2. **New central entity: Service**, meaning name, duration and price shown to clients (informational; clients don't pay), offered by specific masters with optional per-master duration/price.
3. **Remove the automatic lunch break** (`lunchDuration`). Breaks become blocked time the master manages.
4. **Notification channels**: turn `NotificationsService` into a channel-agnostic dispatcher (email now; WhatsApp, Telegram and mobile push as later adapters) with per-user contact details and preferences. The queue already fits this.
5. **Mobile-ready API**: versioned routes (`/v1`), because shipped apps can't be force-updated; device tokens for push; stable error format.
6. **AI-designed business pages**: the AI produces a **design spec (JSON)**, not HTML: palette, typography, layout variant, section styles, copy, image references. Web and the mobile apps render it with their own components. Reasons: one spec renders natively on iOS/Android and web; no third-party HTML/JS (no XSS, no broken layouts); the spec can be validated before publishing (contrast, required blocks like the booking button); owners can pick between variants and tweak them; versions allow rollback. Generation runs as a background job on the existing queue; images need object storage (GCS).
7. **Subscriptions**: `Plan` / `Subscription` per business (e.g. limits on staff count), billing provider TBD (likely Stripe Billing), feature gating. Design first.

## Priority plan (RICE, 2026-09-23)

> **Superseded in part by the product direction above:** milestones 1–4 are done; the next milestone is **M6 — Services & flexible scheduling** (below), ahead of the M5 features.

The Phases below group work by *type*. This plan orders it by *execution*: RICE score first, then adjusted for dependencies and launch-blocking risk. Work milestone by milestone.

**How it was scored.** `RICE = Reach × Impact × Confidence / Effort`.
- **Reach**: % of users/flows affected (0–100). The product is pre-launch, so this is exposure, not measured traffic.
- **Impact**: massive 3 · high 2 · medium 1 · low 0.5 · minimal 0.25.
- **Confidence**: high 100% · medium 80% · low 50%. Features whose rules are still under discussion get low confidence on purpose.
- **Effort**: relative points. xs=1 (≤½ day) · s=3 (1–2 days) · m=5 (3–5 days) · l=8 (1–2 weeks) · xl=13.

RICE ignores dependencies and treats a security hole like any other item, so four manual overrides are marked ⬆/⬇ below.

### Milestone 1 — Security hotfix (launch blocker, ~1 week)

| # | Task | RICE | Note |
|---|---|---|---|
| 1 | A1 Refresh token accepted as access token | **300** | Do first: impersonation |
| 2 | A2 Resolve caller by `sub`, not email | 66.7 | Ship together with A1 (same root cause) |
| 3 | A3 `weeksAhead` bug in weekly slots | 120 | |
| 4 | A5 `DELETE /slots/:date` async + global admin wipe | 80 | |
| 5 | A4 Slot input validation (DoS) | 66.7 | |
| 6 | A6 `business/open` repeatable + non-unique slug | 26.7 | ⬆ Pulled up: data integrity, small |

Exit criteria: every item has a regression test (the start of B5). **✅ Done 2026-09-23**, 22 unit tests (`npm test`); the e2e harness follows in B5a.

### Milestone 2 — Deployable foundation

| # | Task | RICE | Note |
|---|---|---|---|
| 7 | B3 Baseline migration, scripts moved to `src/migrations` | 66.7 | **Blocks** B1, B2, C4, F2 (they all change the schema) |
| 8 | B4 Dockerfile + compose + CI | 40 | CI runs the M1 regression tests |
| 9 | B8 HTTP surface (CORS, helmet, Swagger off in prod, `/health`, shutdown hooks) | 33.3 | |
| 10 | B6 Booking validation / invariants | 26.7 | |
| 11 | B5a Test harness + tenant-isolation and concurrent-booking tests | 20 | ⬆ Split out of B5 and pulled up: M3 needs a safety net |

**✅ Done 2026-09-23.** C7 (config single source) was pulled in as well. Also: `GeocodingService` extracted from `BusinessService` (stubbable), `@types/nodemailer` moved to devDependencies.

### Milestone 3 — Scheduling core rework

**Decision gate first:** settle the E1 question *"do slots belong to the business or to a specific employee?"* before starting. The answer changes the `Slot` model that B1 and B2 rewrite.
**Decided 2026-09-23: slots belong to a staff member** (owner or employee).

| # | Task | RICE | Note |
|---|---|---|---|
| 12 | B1 UTC storage + per-business timezone | 30 | Biggest bet; needs a data migration |
| 13 | B2 Split `SlotStatus` (available/booked/break/closed) | 20 | Same migration window as B1 |
| 14 | C2 Split `SlotManagementService` (pure calculator + command/query) | 2.4 | ⬆ RICE is low, but it's the same code as B1/B2. Doing it separately means rewriting twice |
| 15 | B5b Unit tests for the slot calculator (DST, odd durations, breaks) | — | Part of B5 |

**✅ Done 2026-09-23.** Migration `StaffSlotsTimezones` converts existing data (status mapping, owner as staff, `timestamptz` assuming a UTC server); verified up → down → up with seeded old-shape rows and no drift. Also delivered the staff half of E1 (see there). Tests: 42 unit, 21 e2e.

### Milestone 4 — Hardening before public launch

| # | Task | RICE | Note |
|---|---|---|---|
| 16 | B7 Auth hardening (throttling, logout, per-session refresh with TTL, generic sign-in error) | 20 | |
| 17 | C1 Response DTOs + `ClassSerializerInterceptor` | 20 | |
| 18 | C5 Notifications queue (BullMQ) | 12.8 | **Blocks** E2 (Calendar sync goes through the queue) |
| 19 | C6 Pagination | 8.3 | |
| 20 | C4 Entity model cleanup | 4 | Do the booking-side FK part together with F2 |

**✅ Done 2026-09-23** (C4's FK move is deferred to F2 as planned). Tests: 45 unit, 33 e2e.

### Milestone 5 — Product features (after rules are agreed)

Each feature needs its Phase E/F questions answered first. The order follows RICE; low confidence is what holds most of them back, so agreeing the rules is what moves them up.

| # | Task | RICE | Depends on |
|---|---|---|---|
| 21 | F2 Business-side cancellation + booking history | 22.4 | B3, C4 |
| 22 | F4 Booking limits | 10 | Rules agreed |
| 23 | F1 Nearby search | 8.75 | Decide PostGIS or plain lat/lng |
| 24 | E1 Employees | 6.25 | M3 decision gate |
| 25 | E2 Google Calendar | 2.5 | C5, E1 |
| 26 | F3 Admin tools | 0.8 | ⬇ Few users, but admin **seeding** (not the full UI) may need to move up to launch |

### Continuous — about 20% of capacity, alongside the milestones

C7 config single source (5) · C9 update `ARCHITECTURE.md` (5, do it after M3) · C8 TS strictness per module (3) · C3 admin branches (2.5; fixed for free inside C2) · D cleanup bundle (1.25).

**✅ All done 2026-09-23** (C7 in M2, C3 in M3, C8/C9/D in the cleanup pass).

### Sensitivity check

- If B1 (timezones) turns out 2× bigger (l → xl), its RICE drops to about 18. It still belongs in M3, because every day of real bookings stored in server-local time makes the migration harder.
- If F2's rules are agreed quickly (confidence medium → high), its RICE rises to 28 and it can move up into M4.
- Nothing in M1 changes rank under a 2× estimate error.

## Phase A — Critical (security / data integrity)

- [x] **Refresh token is accepted as an access token → wrong-user impersonation**
  **Done (M1).** Reproduced first: a client's refresh token on `GET /booking/slots` returned the admin's bookings. Tokens now carry `type: access|refresh` (`TokenType`); `AccessTokenGuard` verifies with explicit secret/audience/issuer and rejects anything that isn't `access`; `/refresh-tokens` rejects anything that isn't `refresh`. Tokens issued before the fix have no `type` and are rejected, so users must sign in again once. Verified live: refresh token as Bearer → 401, access token on refresh endpoint → 401, normal rotation → 200. Tests: `access-token.guard.spec.ts`.
  Access and refresh tokens are signed with the same secret/audience/issuer, and `AccessTokenGuard` verifies with `this.jwtConfiguration` without checking what kind of token it got. A refresh token (`{ sub, refreshTokenId }`, 24h TTL) passes the guard, so `request.user.email` is `undefined`. Every service then resolves the caller with `usersService.findByEmail(user.email)` → `findOneBy({ email: undefined })`. TypeORM 0.3 drops `undefined` where-conditions, so the query returns **the first row of `users`**, which may be the admin. Endpoints without `@Roles` (`POST /booking/:businessId`, `GET /booking/slots`, `POST /business/open`, …) then run as that user.
  Fix: add a `type: 'access' | 'refresh'` claim (or separate secrets) and reject refresh tokens in `AccessTokenGuard`. Resolve the caller by `sub` (the user id), never by email (see next item). Add an e2e test that sends a refresh token as a Bearer token.
  Files: `src/iam/authentication/guards/access-token.guard.ts`, `src/iam/authentication/authentication.service.ts`

- [x] **Caller identity resolved by email instead of `sub`, and a missing user isn't handled**
  **Done (M1).** `UsersService.findActiveUser(sub)` replaces `findByEmail` everywhere; a missing id is never queried and a deleted user gets 401. Dead `if (!user)` branches and the unused `findByEmail`/`save` removed. Tests: `users.service.spec.ts`.
  `findByEmail(user.email)` appears in business, slot and booking services. Email is mutable and not the JWT subject. `strictNullChecks: false` hides the `null` case: a deleted user reaches `user.role` and gets a 500. Add `UsersService.findByIdOrFail(sub)` and use it everywhere, or load the user once in a guard/interceptor.
  Files: `src/business/business.service.ts`, `src/slot-management/slot-management.service.ts`, `src/booking/booking.service.ts`

- [x] **`POST /slots/weekly` ignores `weeksAhead` → duplicate slots / 500**
  **Done (M1).** Days are generated as `firstDay + offset` over `weeksAhead * 7` days and filtered by work days. `setWorkDays` is validated with `@IsIn`, `weeksAhead` is `@IsInt @Min(1) @Max(12)`. `setHolidays` now means **specific ISO dates to skip** (`yyyy-mm-dd`). It was previously accepted and ignored, so clients sending day names now get 400. A day is scheduled as a whole: a request touching a day that already has slots returns 409 listing those dates (one query for the whole range, replacing one query per slot). All slots are saved in one transaction. Verified live: 3 weeks Mon/Wed with one holiday → 5 distinct days, 10 slots.
  The `i` loop never shifts the date by `i * 7` days. Every "week" generates the same dates, and `@Unique(['business','start_time'])` turns any `weeksAhead > 1` into a 500. `setWorkDays` isn't validated either (an unknown day gives `indexOf = -1` and a nonsense date), `setHolidays` is accepted but ignored, and `weeksAhead` has no upper bound.
  Fix: `addWeeks(date, i)`; `@IsIn(DAYS, { each: true })`; `@Min(1) @Max(12)` (or a similar limit) on `weeksAhead`; implement `setHolidays` or remove it; run `checkExistingSlotsForDay` as the daily path does. Do the whole batch in one transaction.
  Files: `src/slot-management/slot-management.service.ts`, `src/slot-management/dto/weeklySlots.dto.ts`

- [x] **Slot-generation input is unvalidated → DoS and silently wrong schedules**
  **Done (M1).** DTOs validate `HH:mm` and `N min` with `@Matches`; the formats are unchanged, so existing clients keep working. The new `buildSchedule()` works in minutes (half-hours supported), requires 5–480 min per client, closing after opening, and lunch shorter than the day, and floors the slot count so no slot runs past closing. `PATCH /slots/:date` validates *before* deleting existing slots. Verified live: `0 min` → 400, `09:30`–`17:00` at 45 min → 10 slots ending 17:00. Tests: `slot-management.service.spec.ts`.
  - `timePerClient: "0 min"` gives `totalSlots = Infinity`, and the loop in `createSlots` never ends (memory/CPU DoS by any business user).
  - `parseTime` keeps only the hour: `"09:30"` becomes 9:00, so opening/closing on half-hours is impossible.
  - A duration that doesn't divide the day (e.g. 45 min over 8h) gives a fractional `totalSlots`, so the last slot runs past closing time.
  - `closingHours <= openingHours` or `lunchDuration > workday` isn't rejected.
  Fix: DTOs take `HH:mm` (`@Matches`) and integer minutes (`@IsInt @Min(5) @Max(480)`); validate the relations between them in the service; `Math.floor` the slot count.
  Files: `src/slot-management/dto/*.ts`, `src/slot-management/slot-management.service.ts`

- [x] **`DELETE /slots/:date` deletes asynchronously and, for admins, globally**
  **Done (M1).** One awaited `DELETE … WHERE business = own AND status = AVAILABLE AND day`, always scoped to the caller's own business (admins included; an explicit admin override belongs to C3). Invalid date → 400. Verified live with two businesses: an admin without a business deletes nothing, and an owner deletes only their own free slots.
  `datesToDelete.filter(async …)` fires `remove()` calls without awaiting them. The endpoint returns 204 before anything is deleted, and errors become unhandled rejections. Also, for `admin`, `getOpenedSlotByDay` returns **every business's** slots for that date, so an admin call wipes the whole platform's free slots for that day.
  Fix: one `DELETE … WHERE business = :id AND status = AVAILABLE AND start_time BETWEEN …`, awaited; an admin must pass an explicit `businessId`.
  Files: `src/slot-management/slot-management.service.ts`

- [x] **`POST /business/open` can be repeated and demotes admins**
  **Done (M1).** A second business → 409; employees → 403; admins keep their role. `slug` is `UNIQUE`, with `-2`, `-3` suffixes on collision (on create and on rename). Location, business and user are saved in one transaction; geocoding no longer writes a `Location` before the business exists. Not verified live: the local Google API key returns 403. Covered by `business.service.spec.ts`.
  No check that the user already owns a business: a second call creates a new business and overwrites `users.businessId`, leaving the first one orphaned. Any role can call it, and it sets `role = business`, so an admin (or employee) who opens a business loses their role. `slug` has no unique constraint, so two businesses with the same name get the same slug and `GET /business/:slug` returns an arbitrary one (rename via `PATCH` has the same problem).
  Fix: reject if the user already owns a business; don't downgrade admins; `@Unique` on `slug` plus a suffix on collision; wrap location + business + user updates in one transaction.
  Files: `src/business/business.service.ts`, `src/business/entities/business.entity.ts`

## Phase B — High (correctness / production readiness)

- [x] **Timezones: move to UTC storage with a per-business timezone** *(decided: international platform)*
  **Done (M3).** `Business.timezone` (IANA, `@IsTimeZone`, required on create; not editable yet, since existing slots would shift). `slot.start_time/end_time` and `booking.book_slot` are `timestamptz`. Slot generation, day ranges, "not in the past" checks and reports all work in the business timezone via `@date-fns/tz`, with per-slot wall-clock times so openings stay local on DST days. `reserveSlot` without an offset is local business time; with an offset it's absolute. Emails format times in the business timezone. Verified server-TZ independent: unit and e2e suites pass with `TZ=Pacific/Auckland`.
  Slots are `timestamp without time zone` and are generated with `setHours` in the **server's** local TZ. `new Date('2026-09-25')` parses as UTC midnight, then `setHours` applies local time, so the result depends on where the server runs. Notification emails print `Date.toString()` in server time.
  Fix: `Business.timezone` (IANA, e.g. `Europe/Berlin`); all columns become `timestamptz`; generate slots with `date-fns-tz` (`fromZonedTime`) in the business TZ, which also handles DST days; API accepts/returns ISO-8601 with offset; emails format in the business TZ. Needs a data migration.
  Files: `src/slot-management/**`, `src/booking/**`, `src/business/entities/business.entity.ts`

- [x] **One `UNAVAILABLE` status means both "booked" and "lunch break"**
  **Done (M3).** `SlotStatus` = `available | booked | break` (string enum). PATCH keeps `booked` slots, regenerates free slots and breaks around them, all in one transaction. DELETE (close day) removes free slots and breaks and leaves bookings. `closed` was left out until something needs it.
  `checkSlotsExistenceByDate` uses "any UNAVAILABLE slot exists" as "this day is already scheduled", which only works because every generated day contains lunch slots. `updateDailySlots` keeps *all* UNAVAILABLE slots, so the old lunch break stays forever when hours change and a new one is added. Reports can't tell breaks from bookings either. The enum is numeric (`0/1`) and stored in a PG enum as `'0'/'1'`, which is fragile.
  Fix: `SlotStatus` becomes string values `available | booked | break | closed`; on update, drop old `break` slots and keep only `booked` ones; add a migration.
  Files: `src/slot-management/enums/slotStatus.enum.ts`, `src/slot-management/slot-management.service.ts`

- [x] **No migrations, and migration scripts write into `dist/`**
  **Done (M2).** Migrations live in `src/migrations`; baseline `Init` generated from an empty DB. Verified run → revert → run, and a re-diff shows no drift. Scripts: `migration:run` / `:revert` / `:generate --name=` / `:create --name=`, plus `migration:run:prod` (no build) for containers. The Docker image applies pending migrations on start. Existing local DBs created with `schema:sync` must be recreated once.
  `migration:generate`/`create` output to `./dist/migrations`, which `nest build` wipes and git ignores. The only way to create the schema is `schema:sync`. You can't deploy safely like this.
  Fix: move to `src/migrations`; generate a baseline migration from the current entities; `migrationsRun` in deploy/CI; update the README.
  Files: `package.json`, `src/config/data-source.ts`, `README.md`

- [x] **Deployment infrastructure is a placeholder**
  **Done (M2).** Multi-stage `node:22-slim` Dockerfile (prod deps only, non-root `node` user, migrations then start) + `.dockerignore`. Compose: pg with `POSTGRES_DB`, named volumes, healthchecks, `redis:7-alpine` with optional `REDIS_PASSWORD`, and an `app` service behind the `app` profile. `.github/workflows/ci.yml`: lint → build → unit → e2e (pg + redis services) + docker build. Verified locally: image builds, container migrates, `/health` ok.
  `Dockerfile` is `ubuntu:latest` + `top -b` (the IDE default). `docker-compose.yml` has no app service, no `POSTGRES_DB`, no volumes (data is lost when the container is removed), and runs `redis` unpinned without a password. No CI at all.
  Fix: multi-stage Node Dockerfile (build, then a slim runtime, non-root user); compose with app + pg + redis, volumes and healthchecks; GitHub Actions running lint → build → unit → e2e (with pg/redis services).

- [ ] **Tests: effectively zero**
  **Partly done (M1 + M2, B5a).** 22 unit tests (auth guard, caller resolution, slot generation/validation, business/open). e2e harness (`test/utils`) boots the real `AppModule` against a dedicated `smart_booking_test` DB rebuilt from migrations, with Google/SMTP stubbed. 12 e2e tests: refresh-token misuse, rotation/reuse, health, tenant isolation (read/delete/edit/second business), concurrent booking (5 parallel → exactly one 201), cancel frees slot, owner self-booking, malformed time. The e2e run caught a regression in the M1 `business/open` change that the mocked unit test missed: `create()` deep-copies nested entities, so `coordsId` was never set. Fixed, and a regression assertion added. **Remaining (B5b, M3):** slot calculator tests for DST/timezones.
  No `*.spec.ts` under `src/`. The only e2e test calls `GET /` expecting `Hello World!`, a route that doesn't exist, so it's broken.
  Priority coverage: slot generation math (pure functions once extracted, see Phase C); tenant isolation (owner A vs B on every slot/business endpoint); concurrent `reserveSlot` (two parallel requests → exactly one 201); refresh-token rotation/reuse; the Phase A regressions.
  Files: `test/app.e2e-spec.ts`, new specs

- [x] **Booking input validation and invariants**
  **Done (M2).** `reserveSlot` is `@IsISO8601({ strict: true })`; the owner can't book their own business (403); cancel releases the slot and deletes the booking in one transaction; `@MinDate(new Date())` is replaced by a per-request `@IsNotInPast()` (today allowed). **Deferred to E1:** blocking *employees* from booking their workplace (the employee feature doesn't exist yet).
  - `ReserveSlotDto.reserveSlot` is `@IsString()` but typed `Date`. `"garbage"` becomes `Invalid Date`, the past check passes (`NaN < now` is false), and the query receives an invalid date. Use `@IsISO8601()` plus a transform.
  - The business owner (or its employees) can book their own slots.
  - `cancelReservation` releases the slot and deletes the booking in two separate writes without a transaction.
  - `DailySlotsDto`/`WeeklySlotsDto` `@MinDate(new Date())` is evaluated **once at module load**, so the "not in the past" check goes stale the longer the process runs. Check in the service (or with a custom validator) instead.
  Files: `src/booking/**`, `src/slot-management/dto/*.ts`

- [x] **Auth hardening**
  **Done (M4).** `@nestjs/throttler` with Redis storage: global limit plus a stricter `auth` limit on `/authentication/*` (`THROTTLE_*`, `AUTH_THROTTLE_LIMIT`, `TRUST_PROXY`). Sign-in returns one message for unknown email and wrong password, and runs a bcrypt compare in both cases. Refresh sessions are keyed `refresh:<user>:<tokenId>` with `EX = refreshTtl`, so several devices work at once and keys expire. `POST /authentication/logout` ends one session. `RolesGuard` reads the current role from the DB, which fixes the stale-JWT-role problem. e2e: generic error, two-device logout, role change without re-login, 429 after the auth limit.
  - No rate limiting on `/authentication/*`, so sign-in can be brute-forced. Add `@nestjs/throttler`, backed by Redis storage.
  - Sign-in reveals whether an email exists (`User does not exists` vs `Password does not match`). Return one generic message.
  - Refresh-token Redis key is `user-${id}` with no TTL: one session per user (logging in on phone logs out laptop) and keys never expire. Use key `user-${id}:${tokenId}` with `EX = refreshTtl`.
  - No logout endpoint (refresh-token revocation).
  - The JWT role goes stale for up to 1h after `open business` or a role change. (Also bites employees once E1 lets owners add them.) Either re-issue tokens on role change or read the role from the DB in `RolesGuard`.
  Files: `src/iam/**`

- [x] **HTTP surface for production**
  **Done (M2).** `helmet` (CSP relaxed only while Swagger is on); CORS from `CORS_ORIGINS` (unset: any origin in dev, none in production); Swagger only outside production unless `SWAGGER_ENABLED=true`; `enableShutdownHooks()`; `/health` via `@nestjs/terminus`; port read from the app's `ConfigService`. Redis moved into a shared global `RedisModule` (`REDIS_CLIENT`), used by refresh-token storage and health, and ready for throttling/queues. Verified in the container: docs 404, security headers present, no CORS header for a foreign origin.
  `enableCors()` allows every origin; Swagger `/docs` is public in production; no `helmet`; `enableShutdownHooks()` isn't called, so `RefreshTokenIdsStorage.onApplicationShutdown` (Redis `quit`) never runs; no `/health` endpoint (`@nestjs/terminus`: pg + redis).
  `main.ts` builds a `new ConfigService()` at module scope to read `APP_PORT`. It only works because importing `data-source.ts` calls `dotenv.config()` first, and the Joi default `3000` never applies. Use `app.get(ConfigService)`.
  Files: `src/main.ts`

## Phase C — Medium (architecture / maintainability)

- [x] **Response DTOs instead of raw entities**
  **Done (M4).** `@Serialize(Dto)` (interceptor + `@ApiOkResponse`) on every endpoint returning data, with `excludeExtraneousValues`: users, businesses (public fields; owner only on open), slots (staff view with client email; public view with `staffId` only), bookings (id + time; details add business summary and slot), report. e2e asserts exact key sets and that no `password`/`information` appears in slot listings.
  Controllers return TypeORM entities (`Booking` with `user` and `business`, `Slot` with `booking.user`, the `openBusiness` response with the full owner). The only thing keeping the password hash out is `select: false`; the next `addSelect` or relation leaks it again. Add `ClassSerializerInterceptor` globally plus per-endpoint response DTOs (`@Expose` whitelist), and document them in Swagger (`@ApiOkResponse({ type })`).

- [x] **Split `SlotManagementService` (377 lines, 32 imports)**
  **Done (M3).** `slot-schedule.ts` (pure calculator, 19 tests incl. DST) · `SlotAccessService` (who manages which business and which staff) · `SlotCommandService` (create/update/close, transactional) · `SlotQueryService` (reads, report, public availability). The old service is removed.
  - `SlotScheduleCalculator`: pure, framework-free (hours, breaks, TZ → slot intervals). Unit-testable without a DB.
  - `SlotCommandService`: create/update/close in transactions.
  - `SlotQueryService`: reads, reports, public availability.
  - Put the repeated `findUser` → `getBusinessByOwner` preamble (present in almost every method) in one place: a guard/decorator that resolves `BusinessContext { user, business, isAdmin }`.

- [x] **Admin branches are inconsistent**
  **Done (M3, inside C2).** One rule: admins get no implicit access to other businesses' slots; they manage only a business they own. Global admin views come back deliberately with F3.
  `findAllSlots` calls `getBusinessByOwner` *before* the admin check, so an admin without a business gets 400 and the admin branch is unreachable. Elsewhere admins get global access implicitly. Pick one model: admin endpoints take an explicit `businessId`.
  Files: `src/slot-management/slot-management.service.ts`

- [x] **Entity model cleanup**
  **Done (M6):** the remaining slot↔booking FK question is moot; the `slot` table is gone and bookings hold their own time range.
  **Mostly done (M4).** `Business.bookings` inverse added (`Booking.business` no longer points at `slots`); `users.role` is a Postgres enum (migration `UserRoleEnum`, values preserved); an address change replaces the `Location` and deletes the old one in one transaction, and an unresolvable address now returns 400 like on create. The `book_slot`/`business` duplication is kept on purpose as a history snapshot (documented on the entity). **Remaining, with F2:** move the slot↔booking FK to the booking side.
  - `Booking.business` has its inverse set to `business.slots` (a `Slot[]`). It needs `Business.bookings: Booking[]`.
  - `Booking.book_slot` and `Booking.business` duplicate `slot.start_time` and `slot.business`. Keep them only if intentional (history snapshot), otherwise derive them.
  - The FK sits on the slot side (`slot.booking_byId`). With cancellation history (Phase F) it's better on the booking side (`booking.slotId`, with a partial unique index `WHERE status = 'active'`).
  - `Users.role` is `@Column({ enum })` without `type: 'enum'`, so it's stored as plain varchar with no DB constraint.
  - Updating a business address creates a new `Location` and leaves the old one orphaned. A geocoding failure on update is only `console.error`'d and the request returns 200 without changing the address (create returns 400 in the same case).

- [x] **Notifications: move out of the request path**
  **Done (M4).** `@nestjs/bullmq` (v11, CJS) queue `notifications`: `NotificationsService.send` enqueues, and `NotificationsProcessor` sends through `EmailSender` with 6 attempts and exponential backoff (30s…). Booking only enqueues; a queue failure is logged, never a 500. Verified live: booking answered in ~10ms, worker logged attempt 1/6 with the local invalid OAuth creds and kept the job for retry. Not done: a DB outbox (a crash between commit and enqueue loses that email). Add one if email delivery becomes critical.
  Two emails go out sequentially inside `reserveSlot`: they add latency, a failure is only logged, and there's no retry. Redis is already in the stack, so a queue (BullMQ via `@nestjs/bullmq`) with retries and an outbox record would fix this. This is also where cancellation emails and the future Google Calendar sync belong.

- [x] **Pagination and filters**
  **Done (M4).** `PaginationQueryDto` (`limit` 1–100, default 50; `offset`) on `GET /users`, `GET /business`, `GET /slots`, `GET /booking/slots`, `POST /slots/report` (report `totalSlots` is now the full count, not the page length). Public availability is bounded to 7-day pages with `page` 1–52.
  `GET /users`, `GET /slots` (admin: every slot on the platform), `GET /business` and `POST /slots/report` return everything. Add `limit`/`cursor` and a max page size. `GET /booking/business/:id?page=` has no upper bound and doesn't 404 on an unknown business.

- [x] **Config: one source of truth**
  **Done (M2, pulled forward: the e2e harness needed it).** The app uses `TypeOrmModule.forRootAsync` with the validated `ConfigService` and `autoLoadEntities`; `data-source.ts` is CLI-only. SQL logging only in `development` (or `DEBUG_SQL=1`).
  `data-source.ts` reads `process.env` + `dotenv` directly, bypassing the Joi-validated `ConfigService`. Use `TypeOrmModule.forRootAsync({ inject: [ConfigService] })` for the app; keep a thin `data-source.ts` for the CLI only.

- [x] **TypeScript strictness**
  **Done.** `"strict": true` project-wide (instead of per module: only 23 errors once measured), with `strictPropertyInitialization` off because TypeORM/class-transformer populate entities and DTOs. Added `@types/compression` and `@types/pg`, plus an `errorMessage()` helper for `unknown` catch values.
  `strictNullChecks: false` and `noImplicitAny: false` hide exactly the class of bugs found above (null users, untyped `reportDate`, `currentUser`, `day`, `id`). Enable them step by step (per module).

- [x] **Update `ARCHITECTURE.md`**
  **Done.** Rewritten for the current code: modules and ownership, data model (staff, timezone, statuses), design decisions (time, tenancy, auth, consistency, output), booking flow with the queue, and testing.
  It still describes the pre-fix state: dashed "reaches into" arrows, `eager: true` on `Business`, a booking flow with no transaction, and a "Known issues" section that is closed. Sync it with the code.

## Phase D — Low (cleanup)

- [x] Dead code: `CreateUserDto` (empty), `NotifyEmailDto` (unused). Keep `repl.ts` but document it (it's currently the only way to create an admin).
  **Done.** Both removed. `repl.ts` is documented and runnable via `npm run repl`. The documented command was broken (`UserRepository` → the real token is `UsersRepository`, verified).
- [x] `@types/nodemailer` is in `dependencies`; move it to `devDependencies`.
  **Done (M2).**
- [x] `closeOpenedSlotsByDate` calls `findUser` twice (directly and inside `getOpenedSlotByDay`).
  **Done (M1/M3)**, replaced by `closeDay`.
- [x] `setDailySlots`: `new Date(x) || startOfToday()`. A `Date` object is always truthy, so the fallback is dead code.
  **Done (M1)**, removed.
- [x] Error messages use informal wording ("It is not your business dude", "Dude you can update past dates !"; the latter also says the opposite of what it means). Use neutral, consistent messages.
  **Done.** No informal messages left; wording made consistent.
- [x] String literal `user.role == 'admin'` → `Role.Admin`; `==` → `===`.
  **Done (M3)**, the code is gone.
- [x] `RolesGuard` crashes if a route has `@Roles` together with `@Auth(AuthType.None)` (`user` is undefined). Guard against it.
  **Done (M4)**, returns 401.

## Phase E — Features to finish (decided)

- [ ] **Employees** *(decided: finish)*
  **Partly done (M3):** slots belong to a staff member (`Slot.staff`, unique `(staff, start_time)`); owners manage any staff's slots via `staffId`; employees resolve to their workplace and manage/see only their own; clients can book a chosen staff member or anyone free; staff can't book their own business. **Remaining:** owner endpoints to invite/add/remove employees (the e2e tests assign employees via SQL for now), and staff display names for the public availability API.
  Currently: the `Employee` role, `Users.workplace` and `Business.employees` exist, and `/slots` lists `Role.Employee`. But there's no way to add an employee, and `getBusinessByOwner` returns 400 for them.
  To do: owner endpoints to invite/add/remove employees (invite by email, or attach an existing user); resolve an employee's business through `workplace`; define what an employee may do (manage slots: yes; edit business / manage staff: no).
  **To discuss:** whether slots belong to the business or to a specific employee (per-staff calendars: "book with Anna at 14:00"). That changes the `Slot` model (`staffId`, unique `(staff, start_time)`), so decide it before building.

- [ ] **Google Calendar integration** *(decided: planned)*
  `@googleapis/calendar` is installed but unused.
  To do: OAuth connection per business (and optionally per employee); create/update/delete a calendar event when a booking is created or cancelled (through the notification queue from Phase C); store tokens encrypted.
  **To discuss:** one-way push or two-way sync (block slots that are busy in Google Calendar); whether clients also get an event / `.ics` attachment.

## Phase G — Product model (from the 2026-09-23 product direction)

### Milestone 6 — Services & flexible scheduling ✅ Done 2026-09-23

- [x] **G1 Service catalog.** `Service` (business, name, duration, price for display, active) plus `StaffService` (which masters offer it, optional per-master duration/price). CRUD for owners; public list per business.
  **Done (M6).** `Service` + `StaffService` (per-staff duration/buffer/price overrides); owner CRUD at `/services` (delete = deactivate, history kept), `PUT /services/:id/staff`; public `GET /business/:slug/services`. `Business.currency` (ISO 4217, required on create).
- [x] **G2 Working hours.** Weekly template per master plus date overrides (day off, custom hours), in the business timezone. Replaces `POST /slots/daily|weekly`.
  **Done (M6).** `WorkingHours` (weekly template, split shifts) + `ScheduleOverride` (per-date hours or day off) at `/schedule/working-hours` and `/schedule/overrides/:date`; overlapping or inverted intervals → 400. The `/slots/*` endpoints are gone.
- [x] **G3 Blocked time.** The master adds or removes breaks and blocks themselves at any time. Replaces the automatic lunch break.
  **Done (M6).** `TimeBlock` at `/schedule/blocks`; a block over a confirmed booking → 409. The automatic lunch break is removed.
- [x] **G4 Computed availability.** `GET /businesses/:id/availability?serviceId&staffId?&date` returns free start times from hours − blocks − appointments, stepped by service duration. Pure function, unit-tested like `slot-schedule.ts` (DST included).
  **Done (M6).** Pure `availability.ts` (15-min local grid, duration must fit in working hours, buffer must stay clear of bookings/blocks, split shifts, DST) with 12 unit tests; `GET /booking/business/:id/availability?serviceId&staffId&from&days` (≤14 days) returns `{start, end, staffId, price_minor}`.
- [x] **G5 Appointments.** Booking becomes master + service + start, with end derived. A Postgres exclusion constraint on `(staff, tstzrange(start, end))` prevents overlaps; the existing transactional flow stays. Folds in F2's booking statuses/history and C4's FK question, since the slot table goes away.
  **Done (M6).** `POST /booking/:businessId {serviceId, start, staffId?}` re-validates against availability and inserts under a per-staff advisory lock. The Postgres exclusion constraint `booking_no_overlap` is the guarantee (an e2e test inserts directly and gets `23P01`). Bookings snapshot duration/price/currency; status `confirmed | cancelled_by_client | cancelled_by_business`; client cancel keeps the record. e2e: 5 concurrent requests → exactly one 201. Found while testing: without the lock, concurrent overlapping inserts deadlock (`40P01`) during the constraint check.
- [x] **G6 Migration.** Convert existing slots/bookings (bookings become appointments with a default service), then drop `slot`.
  **Done (M6).** `ServicesAndFlexibleScheduling`: bookings keep time and staff (from their slot, or `book_slot` + owner as fallback) and point to an inactive per-business "Appointment" service; slot schedules aren't converted (pre-launch); `slot` dropped. Verified up → down → up on dev data, no drift.

**Decided 2026-09-23:** start times on a fixed **15-minute** grid (local time); a **buffer** after each appointment (set on the service, overridable per master like duration and price); **price is shown** to clients, in the business's currency (`Business.currency`, ISO 4217, stored as integer minor units).

### Later

- [ ] **G7 Notification channels.** Channel-agnostic dispatcher; user contact details and preferences; WhatsApp, Telegram, mobile push adapters (email adapter = today's `EmailSender`).
- [ ] **G8 Mobile-ready API.** `/v1` prefix, device-token registration for push, documented error format.
- [ ] **G9 Subscriptions.** Plans, per-business subscription, limits (staff count, …), billing provider. Needs a product decision on plans first.
- [ ] **G11 AI-designed business pages.**
  - `BusinessDesign` (versioned JSON spec, validated against a schema; status draft/published); `DesignGeneration` job on the queue.
  - Inputs: business type, name, description, owner's style wishes, uploaded logo/photos.
  - Endpoints: generate N variants → preview → publish → tweak → roll back. The public business endpoint returns the published spec.
  - Automatic checks before publishing: schema validity, colour contrast (WCAG AA), required blocks present, copy moderation.
  - Object storage (GCS) for logos, photos and generated images.
  - **To agree:** does the design also apply to the business screen in the client mobile app (recommended: yes, same spec)? Pick-from-variants vs one result + regenerate? AI-generated imagery or only the owner's photos? Is this a paid-plan feature (ties into G9)?
- [ ] **G10 "Smart" client features.** Future: suggestions, reminders, rebooking. Out of scope until the core is live.
- [ ] **G12 Business QR code.** Each business gets a generated QR code (its public page / booking link) that clients can scan to add the business to favorites in the client app.
  - **To agree:** what the QR encodes (slug URL vs a deep link); static per business or regenerable; where it's surfaced (owner dashboard, printable asset, business page).
- [ ] **G13 Public visibility as a paid tier.** By default a business is reachable only via its direct link/QR code (G12) — not in search, nearby search (F1), or any public directory. Public discoverability (search, directory, nearby) is a **paid upsell**, tied into subscriptions (G9). The platform doesn't ask why a business stays on the QR-only tier and doesn't distinguish based on registration/tax status — it's a plain visibility/pricing feature open to any business, which incidentally also suits low-profile operators (e.g. home-based) without the platform targeting or vetting that segment.
  - **To agree:** which plan tier(s) include public visibility vs QR-only-by-default; whether reviews/ratings still show pre-upgrade; pricing; how this is worded in ToS/marketing (frame as a privacy/visibility feature, not aimed at unregistered businesses).

## Phase F — Product features: wanted, rules to be discussed

These are confirmed as wanted, but **requirements have to be agreed before implementation**. Each item lists the questions to settle first.

- [ ] **Nearby business search.** Coordinates are geocoded and stored in `Location` but never used.
  Discuss: search radius and sorting, filters (category, availability today), whether to switch to PostGIS (`geography(Point)` + GiST index) or keep lat/lng with a bounding-box query, and categories/tags for businesses.

- [ ] **Business-side cancellation plus booking history.** Today only the client can cancel, and cancelling hard-deletes the booking (the report loses it).
  **Partly done (M6):** bookings now have statuses and are never deleted (client cancel → `cancelled_by_client`, history kept). **Still to agree:** business-side cancellation rules (reason, client notification) and the client cancellation window.
  Discuss: `Booking.status` (`active | cancelled_by_client | cancelled_by_business | completed | no_show`) instead of delete; required reason; client notification; cancellation window/policy for clients (e.g. not later than N hours before).

- [ ] **Admin tools.** An admin can only be created through the REPL, and `Business.featured` has no write path.
  Discuss: admin seeding (env/CLI), endpoints (manage users/roles, block a business, set featured), audit log of admin actions.

- [ ] **Booking limits.** One client can currently book every slot of a business.
  Discuss: maximum active bookings per client (per business / globally), minimum lead time before a slot, how far ahead booking is allowed, whether owners configure these per business.

## Phase 1 — Critical (exploitable now)

- [x] **Password hashes leak in API responses**
  `Users.password` has no `{ select: false }`, and `Business.owner` / `Business.employees` are `eager: true`. `GET /slots`, slot-creation responses, and booking lookups return bcrypt hashes for business owners, employees, and customers to any authenticated caller.
  Fix: added `{ select: false }` to `password` (login path updated to explicitly `addSelect` it) and dropped the eager relations on `Business`. Raw entities are still returned from some endpoints — explicit response DTOs are a separate follow-up, not required to close the leak since the password column is now never fetched by default.
  Files: `src/users/entities/user.entity.ts`, `src/business/entities/business.entity.ts`, `src/iam/authentication/authentication.service.ts`, `src/slot-management/slot-management.service.ts`

- [x] **Slot double-booking race condition**
  `reserveSlot` reads slot availability, then writes the booking and the slot as two separate, unlocked saves — no transaction, no row lock. Concurrent requests can both pass the availability check and book the same slot.
  Fix: wrapped the read + both writes in a single transaction, locking the target slot row with `pessimistic_write` so concurrent reservations for the same slot serialize instead of both passing the availability check.
  Files: `src/booking/booking.service.ts`

## Phase 2 — High

- [x] **`findReservedSlotById` throws at runtime**
  Query builder parameter mismatch: `.where('booking.id = :booking_id', { bookingId: id })` — placeholder is `:booking_id`, bound key is `bookingId`. Breaks `GET /booking/slot/:id` and, transitively, `DELETE /booking/slot/:id`.
  Fix: matched the placeholder name to the bound key (`:bookingId`). Verified locally: a malformed id now returns a proper `404`/validation error instead of a TypeORM "missing parameter" 500.
  Files: `src/booking/booking.service.ts`

- [x] **Mass-assignment via `ValidationPipe`**
  Global pipe has no `whitelist`/`forbidNonWhitelisted`, so unknown body fields aren't stripped. `openBusiness` spreads the raw DTO into `.create()`, so `POST /business/open` with `{"featured": true, ...}` sets `featured` even though it's not on `CreateBusinessDto`.
  Fix: `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Verified locally: the same `featured: true` payload is now rejected with `400 property featured should not exist`.
  Files: `src/main.ts`

## Phase 3 — Medium

- [x] **Module boundaries not respected**
  `BookingModule`, `SlotManagementModule`, and `IamModule` each register their own `TypeOrmModule.forFeature` for entities they don't own (`Business`, `Users`, `Slot`) instead of depending on the owning module's exported service. Concretely causes duplicated user-lookup logic between `AuthenticationService` and `UsersService`.
  Fix: `UsersService` and `BusinessService` gained the methods other modules actually needed (`findByEmail`/`save` on `UsersService`; `findById`/`findByOwnerId` on `BusinessService`), and `SlotManagementService` gained `findAvailableSlots`/`findSlotByBooking`/`releaseSlot`. `BookingModule` and `SlotManagementModule` now import `UsersModule`/`BusinessModule` and go through those services instead of holding their own repos for foreign entities — each of `Users`, `Business`, `Slot`, `Booking` now has exactly one module with `TypeOrmModule.forFeature` for it.
  **Deliberate, scoped exception:** `IamModule` still holds its own `Users` repository. Auth needs to select the `password` column (`select: false` since Phase 1 excludes it by default) and construct a new user with a hash — that's auth-domain logic on the `Users` entity, not something `UsersService` should expose to the rest of the app. Routing it through a shared service would mean either leaking password-column access more broadly or duplicating the auth-specific queries anyway.
  Verified locally end-to-end: sign-up → open business → create slots → reserve → view → cancel all work through the refactored services.
  Files: `src/users/users.service.ts`, `src/users/users.module.ts`, `src/business/business.service.ts`, `src/business/business.module.ts`, `src/slot-management/slot-management.service.ts`, `src/slot-management/slot-management.module.ts`, `src/booking/booking.service.ts`, `src/booking/booking.module.ts`

- [x] **Redis connection hardcoded**
  `new Redis({ host: 'localhost', port: 6379 })` ignores `ConfigService`/env vars — will silently fail to connect outside local dev.
  Fix: reads `REDIS_HOST`/`REDIS_PORT` from `ConfigService`, defaulting to `localhost`/`6379` for local dev.
  Files: `src/iam/authentication/storage/refresh-token-ids.storage.ts`

- [x] **Errors swallowed/mismapped**
  - Bootstrap wrapped startup in try/catch and only `console.log`'d failures without exiting non-zero, so orchestrators couldn't detect a failed boot. Fix: removed the swallowing try/catch; `bootstrap().catch()` now logs the real error and calls `process.exit(1)`. Verified locally: a missing required env var now fails fast with a clear message instead of continuing to serve.
  - `openBusiness` caught all errors (DB, geocoding API, etc.) and rethrew as `BadRequestException`, masking real failure classes. Fix: narrowed the try/catch to wrap only the geocoding call (a genuinely client-correctable "bad address" case); DB/unexpected errors now propagate to Nest's default exception handling instead of being flattened into a misleading 400.
  Files: `src/main.ts`, `src/business/business.service.ts`

- [x] **Entity modeling bugs**
  - `Booking.id` is `@PrimaryGeneratedColumn('uuid')` but was typed `number` — now typed `string`.
  - `Location.business_id` was typed `string` but decorated as a `@OneToOne` relation — now `business: Business`, and `Business.coords`'s inverse-side reference updated to match.
  - `Slot.booking_by`'s inverse-side callback pointed at `booking.id` instead of a real relation property on `Booking` — now points at `booking.slot`.
  Files: `src/booking/entities/booking.entity.ts`, `src/business/entities/location.entity.ts`, `src/business/entities/business.entity.ts`, `src/slot-management/entities/slot.entity.ts`

- [x] **No config validation schema**
  A missing env var (e.g. `POSTGRES_PORT`) silently became `NaN` instead of failing fast at boot. Also `NotificationsModule` redundantly called `ConfigModule.forRoot({ isGlobal: true })` a second time.
  Fix: added a Joi `validationSchema` to `ConfigModule.forRoot` in `AppModule` covering every env var the app reads; removed the redundant `ConfigModule.forRoot` call in `NotificationsModule` (it's already global). Verified locally: removing a required var now fails startup with `Config validation error: "POSTGRES_PORT" is required` instead of silently continuing.
  Files: `src/app.module.ts`, `src/notifications/notifications.module.ts`, `package.json` (added `joi`)

- [x] **No unique/composite DB constraints backing slot booking**
  Nothing at the DB layer prevented duplicate slots for the same business/time. (A `Slot` being linked to more than one `Booking` was already prevented — `Slot.booking_by`'s `@JoinColumn` gives that FK column a DB-level `UNIQUE` constraint, confirmed in the schema-sync output.)
  Fix: added `@Unique(['business', 'start_time'])` on `Slot`.
  Files: `src/slot-management/entities/slot.entity.ts`

## QA sweep (2026-08-26) — endpoint-by-endpoint testing with multiple tenants

Found by manually exercising every endpoint against a live local stack with 2 businesses, 2 owners, multiple clients, and an admin.

- [x] **Critical — any business owner could read/delete any other business's slots**
  `getOpenedSlotByDay`, `closeOpenedSlotsByDate` (`DELETE /slots/:date`), and `updateDailySlots` filtered by `business: user.business`, but that relation is never loaded by `UsersService.findByEmail`, so the filter silently became `undefined` and matched every business. Confirmed by exploit: `owner1` deleted all of `owner2`'s slots via `DELETE /slots/<owner2's date>`.
  Fix: all three now use `getBusinessByOwner(user)` (the pattern already correctly used elsewhere in this file) and filter by `business: { id: business.id }`. `getOpenedSlotByDay` also gained an explicit admin branch (matching the existing pattern in `findAllSlots`) so admins keep legitimate global visibility instead of losing access now that the accidental global-match bug is closed.
  Verified locally: cross-tenant read now returns `[]`, cross-tenant delete destroys nothing, and both owners' and admin's legitimate access still work.
  Files: `src/slot-management/slot-management.service.ts`

- [x] **Critical — IDOR on `PATCH /business/:slug`, any business owner could edit any business**
  The endpoint only checked `@Roles(Role.Business, Role.Admin)`, never that the caller owned *that specific* business. Confirmed by exploit: `owner2` changed `owner1`'s business description.
  Fix: `updateExistingBusiness` now takes the requesting user and, unless they're `Admin`, verifies the target business is the one they actually own before applying any changes.
  Verified locally: cross-tenant edit now `403`s; own-business edit and admin override both still work.
  Files: `src/business/business.controller.ts`, `src/business/business.service.ts`

- [x] **High — `PATCH /users/:id` was completely non-functional**
  `CreateUserDto`/`UpdateUserDto` were empty classes with zero fields, so any body was rejected by the whitelist (`property X should not exist`), and an empty body `{}` threw a `500` (`UsersService.update()` called TypeORM `.update()` with no values to set, and passed a full user object as the criteria instead of the id).
  Fix: `UpdateUserDto` now declares `information` (the one field with no other write path) with real validation; `UsersService.update()` calls `.update(id, dto)` correctly and skips the DB call entirely when there's nothing to update instead of crashing.
  Verified locally: valid update works, empty-body update is a safe no-op, and disallowed fields (e.g. `role`) are still rejected.
  Files: `src/users/dto/update-user.dto.ts`, `src/users/users.service.ts`

- [x] **High — `POST /slots/report` was completely broken**
  Query builder referenced `slot.bookingBy`/`slot.startTime`, neither of which are real column or property names (actual property names are `booking_by`/`start_time`) — every call returned `500`.
  Fix: corrected both references.
  Verified locally: returns `200` with the correct booked-slot data.
  Files: `src/slot-management/slot-management.service.ts`

- [x] **Medium — slot-creation conflict check isn't scoped to the business**
  `checkExistingSlotsForDay` queried `{ start_time, end_time }` with no `business` filter, so any business creating slots at a time another business already uses got a false `409 Conflict`.
  Fix: scoped the query by `business: { id: slot.business.id }` too.
  Verified locally: two different businesses can now create slots at the same day/hours; a true same-business duplicate is still correctly rejected with `409`.
  Files: `src/slot-management/slot-management.service.ts`

- [x] **Medium — a successful booking can still return `500` to the client**
  `reserveSlot`'s notification-send calls weren't isolated from the response; if the (already-committed) booking succeeded but the confirmation email failed, the client saw `500` for a request that actually succeeded.
  Fix: wrapped the notification sends in a try/catch that logs the failure (`Logger.error`) instead of letting it propagate as the request's error.
  Verified locally: booking now returns `201` even when the notification send fails, and the failure is still logged.
  Files: `src/booking/booking.service.ts`

- [x] **Medium — `GET /business/:slug` returns `200` with an empty body for a nonexistent slug instead of `404`**
  Fix: controller now throws `NotFoundException` when the service returns null.
  Verified locally: returns `404 Business not found`.
  Files: `src/business/business.controller.ts`

- [x] **Low — `WeeklySlotsDto.setHolidays` is required but unused**
  Fix: added `@IsOptional()`.
  Verified locally: `POST /slots/weekly` succeeds without `setHolidays` in the body.
  Files: `src/slot-management/dto/weeklySlots.dto.ts`

## Phase 4 — Low

- [x] Dead code: unreachable `else` branch in refresh-token validation (`refresh-token-ids.storage.ts` already throws before returning `false`, so the `if (isValid) {...} else {...}` at the call site can't take that branch).
  Fix: `validate()` now returns `void` (it only ever throws or succeeds); the call site just calls it and invalidates, no dead branch.
  Verified locally: refresh rotation and reuse-detection (`401 Access denied`) still both work.
  Files: `src/iam/authentication/authentication.service.ts`, `src/iam/authentication/storage/refresh-token-ids.storage.ts`

- [x] `POST /booking/:businessId` never returns the new booking's `id` — only `book_slot` has `@Expose()` on the `Booking` entity, so the client has no way to reference the reservation it just created.
  Fix: added `@Expose()` to `Booking.id`.
  Verified locally: response now includes `id`.
  Files: `src/booking/entities/booking.entity.ts`

- [x] `logging: true` on the TypeORM datasource logs full SQL + params — should be env-gated (e.g. only in development).
  Fix: `logging: process.env.NODE_ENV !== 'production'`.
  Files: `src/config/data-source.ts`

- [x] **Stale `owner.role` in `openBusiness` response**
  Found while smoke-testing locally: `POST /business/open` correctly persists the owner's role as `business` in the database, but the HTTP response body still showed `owner.role: "client"`. `businessRepo.create({ owner: foundUser, ... })` doesn't keep a reference to the same `foundUser` object, so the later `foundUser.role = Role.Business` mutation wasn't reflected in the `newBusiness.owner` that gets returned.
  Fix: copy the updated role onto `newBusiness.owner` before returning. (Naively assigning `foundUser` itself instead would create a circular reference — `foundUser.business` now points back at `newBusiness` — that breaks JSON serialization; caught and fixed during verification.)
  Verified locally: response now shows `owner.role: "business"` immediately.
  Files: `src/business/business.service.ts`

## Already solid (no action needed)

- Global `AuthenticationGuard` + `RolesGuard` via `APP_GUARD`, with consistent `@Auth`/`@Roles` decorators across controllers.
- Passwords hashed with bcrypt + generated salt; most write DTOs have real `class-validator` decorators.
- No circular module dependencies; `synchronize: false` with real migrations — safe schema-change discipline.
