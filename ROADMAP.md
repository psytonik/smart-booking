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

- [ ] **`findReservedSlotById` throws at runtime**
  Query builder parameter mismatch: `.where('booking.id = :booking_id', { bookingId: id })` — placeholder is `:booking_id`, bound key is `bookingId`. Breaks `GET /booking/slot/:id` and, transitively, `DELETE /booking/slot/:id`.
  Files: `src/booking/booking.service.ts`

- [ ] **Mass-assignment via `ValidationPipe`**
  Global pipe has no `whitelist`/`forbidNonWhitelisted`, so unknown body fields aren't stripped. `openBusiness` spreads the raw DTO into `.create()`, so `POST /business/open` with `{"featured": true, ...}` sets `featured` even though it's not on `CreateBusinessDto`.
  Fix: `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
  Files: `src/main.ts`, `src/business/business.service.ts`

## Phase 3 — Medium

- [ ] **Module boundaries not respected**
  `BookingModule`, `SlotManagementModule`, and `IamModule` each register their own `TypeOrmModule.forFeature` for entities they don't own (`Business`, `Users`, `Slot`) instead of depending on the owning module's exported service. Concretely causes duplicated user-lookup logic between `AuthenticationService` and `UsersService`.
  Fix: each entity has exactly one owning module; other modules import that module and use its service.
  Files: `src/booking/booking.module.ts`, `src/slot-management/slot-management.module.ts`, `src/iam/iam.module.ts`

- [ ] **Redis connection hardcoded**
  `new Redis({ host: 'localhost', port: 6379 })` ignores `ConfigService`/env vars — will silently fail to connect outside local dev.
  Files: `src/iam/authentication/storage/refresh-token-ids.storage.ts`

- [ ] **Errors swallowed/mismapped**
  - Bootstrap wraps startup in try/catch and only `console.log`s failures without exiting non-zero, so orchestrators can't detect a failed boot.
  - `openBusiness` catches all errors (DB, geocoding API, etc.) and rethrows as `BadRequestException`, masking real failure classes (e.g. an upstream API outage reported as a 400).
  Files: `src/main.ts`, `src/business/business.service.ts`

- [ ] **Entity modeling bugs**
  - `Booking.id` is `@PrimaryGeneratedColumn('uuid')` but typed `number`.
  - `Location.business_id` is typed `string` but decorated as a `@OneToOne` relation — should be `business: Business`.
  - `Slot.booking_by`'s inverse-side callback points at `booking.id` instead of a real relation property on `Booking`.
  Files: `src/booking/entities/booking.entity.ts`, `src/business/entities/location.entity.ts`, `src/slot-management/entities/slot.entity.ts`

- [ ] **No config validation schema**
  A missing env var (e.g. `POSTGRES_PORT`) silently becomes `NaN` instead of failing fast at boot. Also `NotificationsModule` redundantly calls `ConfigModule.forRoot({ isGlobal: true })` a second time.
  Files: `src/app.module.ts`, `src/config/data-source.ts`, `src/notifications/notifications.module.ts`

- [ ] **No unique/composite DB constraints backing slot booking**
  Nothing at the DB layer prevents a `Slot` from being linked to more than one `Booking`, or duplicate slots for the same business/time — protection lives entirely in application code.
  Files: `src/slot-management/entities/slot.entity.ts`, `src/booking/entities/booking.entity.ts`

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
