# Roadmap

Tracking issues from the 2026-08-26 backend + architecture code review. Ordered by priority; work top to bottom within each phase.

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

## Phase 4 — Low

- [ ] Dead code: unreachable `else` branch in refresh-token validation (`refresh-token-ids.storage.ts` already throws before returning `false`, so the `if (isValid) {...} else {...}` at the call site can't take that branch).
  Files: `src/iam/authentication/authentication.service.ts`, `src/iam/authentication/storage/refresh-token-ids.storage.ts`

- [ ] `POST /booking/:businessId` never returns the new booking's `id` — only `book_slot` has `@Expose()` on the `Booking` entity, so the client has no way to reference the reservation it just created.
  Files: `src/booking/entities/booking.entity.ts`, `src/booking/booking.service.ts`

- [ ] `logging: true` on the TypeORM datasource logs full SQL + params — should be env-gated (e.g. only in development).
  Files: `src/config/data-source.ts`

## Already solid (no action needed)

- Global `AuthenticationGuard` + `RolesGuard` via `APP_GUARD`, with consistent `@Auth`/`@Roles` decorators across controllers.
- Passwords hashed with bcrypt + generated salt; most write DTOs have real `class-validator` decorators.
- No circular module dependencies; `synchronize: false` with real migrations — safe schema-change discipline.
