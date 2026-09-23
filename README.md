# Smart Booking

Smart Booking is a multi-tenant appointment-scheduling API. A business signs up, opens a storefront, defines its working hours as bookable slots (daily or weekly, with a lunch break carved out), and its customers reserve those slots. It's built as a NestJS modular monolith on PostgreSQL, with Redis backing refresh-token storage, Google Maps for address geocoding, and Google Calendar/SMTP for notifications.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the module map, entity model, and API surface, and [`ROADMAP.md`](./ROADMAP.md) for the history of fixes applied to this codebase.

## Core concepts

- **Users** have a `role`: `client` (default, books appointments), `business` (owns a storefront), `employee` (works at one), or `admin`.
- **Business** is a storefront a `client` opens via `POST /business/open`, which promotes them to the `business` role. A business has one owner, any number of employees, a geocoded address, and an IANA **timezone** (required, e.g. `Europe/Berlin`).
- **Slot** is a bookable time window belonging to one **staff member** (the owner or an employee) of a business. Slots are generated in bulk (`POST /slots/daily` or `/weekly`) from working hours given in the business's local time, with a lunch break carved out. They are stored as UTC instants, so daylight-saving days are handled correctly. Status is `available`, `booked` or `break`.
- **Booking** links a `client` to a `Slot`. Clients can pick a staff member (`staffId`) or take whoever is free. Times without an offset (`2030-01-07T09:00`) are read as local business time. Reserving is transactional and row-locked, so two customers can't book the same slot.

### Who can manage slots

| Caller | Can manage |
|---|---|
| Owner | Every staff member's slots in their business (`staffId` selects whose; default: their own) |
| Employee | Only their own slots, and sees only their own |
| Admin | Only a business they own; no implicit access to others (admin tools are on the roadmap) |

## Tech stack

| Concern | Choice |
|---|---|
| Framework | NestJS 11 (Express) |
| Language | TypeScript |
| Database | PostgreSQL via TypeORM |
| Ephemeral store | Redis (refresh-token storage) |
| Auth | JWT access + refresh tokens, bcrypt password hashing |
| Validation | class-validator / class-transformer |
| API docs | Swagger, served at `/docs` |
| External APIs | Google Maps Geocoding, Google Calendar, SMTP (nodemailer) |

## Setup

### 1. Environment

Create a `.env` file at the project root:

```bash
# App
NODE_ENV=development          # development | production | test
APP_PORT=3000
CORS_ORIGINS=                 # comma-separated; unset = any origin in dev, none in production
SWAGGER_ENABLED=              # defaults to on outside production

# Postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=smart_booking

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=               # optional
REDIS_DB=0                    # e2e tests use 1

# Rate limiting (per client IP)
THROTTLE_TTL_SECONDS=60
THROTTLE_LIMIT=120            # all routes
AUTH_THROTTLE_LIMIT=10        # /authentication/* (brute-force protection)
TRUST_PROXY=                  # e.g. 1 behind one load balancer, so limits key on the real client IP

# JWT
JWT_SECRET=
JWT_AUDIENCE=
JWT_TOKEN_ISSUER=
JWT_ACCESS_TTL=3600
JWT_REFRESH_TTL=86400

# Google Maps Geocoding (used when a business address is created/updated)
GOOGLE_API_KEY=

# Gmail OAuth2 (used to send booking/reservation emails) — see https://developers.google.com/oauthplayground/
SMTP_USER=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

Required variables are validated at boot; a missing one fails startup immediately with a clear error.

### 2. Dependencies and infrastructure

```bash
npm install

# Postgres and Redis (data persists in named volumes)
docker compose up -d db redis
```

### 3. Database schema

The schema is managed by TypeORM migrations in `src/migrations` (`synchronize` is off).

```bash
npm run migration:run                         # build + apply pending migrations
npm run migration:generate --name=AddSomething  # diff entities vs DB into src/migrations
npm run migration:create --name=Backfill        # empty migration for hand-written SQL
npm run migration:revert                      # undo the last migration
```

After changing an entity, generate a migration and commit it together with the entity change.

### 4. Run it

```bash
# development, with hot reload
npm run start:dev

# production build
npm run build
npm run start:prod
```

The API is served at `http://localhost:<APP_PORT>`, with Swagger docs at `/docs` (outside production) and a health check at `/health` (Postgres + Redis).

### Creating an admin

There is no admin API yet (roadmap F3). Use the Nest REPL against your configured database:

```bash
npm run repl
> await get("UsersRepository").update({ email: "you@example.com" }, { role: "admin" })
```

The REPL boots the whole app, including the email queue worker.

### Running everything in Docker

```bash
docker compose --profile app up --build
```

The app container applies pending migrations on start, then runs as a non-root user. `POSTGRES_HOST`/`REDIS_HOST` are pointed at the compose services automatically.

## API overview

| Area | Routes |
|---|---|
| Authentication | `POST /authentication/sign-up`, `/sign-in`, `/refresh-tokens`, `/logout` |
| Users | `GET /users`, `GET /users/:id`, `PATCH /users/:id` (admin only) |
| Business | `POST /business/open`, `GET /business`, `GET /business/:slug`, `PATCH /business/:slug` |
| Slot management | `POST /slots/daily`, `POST /slots/weekly`, `GET /slots`, `GET /slots/:date`, `PATCH /slots/:date`, `DELETE /slots/:date`, `POST /slots/report` |
| Booking | `POST /booking/:businessId`, `GET /booking/business/:businessId`, `GET /booking/slot/:id`, `DELETE /booking/slot/:id`, `GET /booking/slots` |
| Health | `GET /health` |

Auth is enforced globally by default; routes that don't need it opt out explicitly via `@Auth(AuthType.None)`. Role checks use the user's current role from the database, so a role change applies immediately without signing in again. Each sign-in is its own refresh-token session (several devices at once); `/logout` ends one.

List endpoints take `?limit=` (default 50, max 100) and `?offset=`. Responses are shaped by explicit response DTOs (`@Serialize`), so entity fields never leak by accident. Emails go through a BullMQ queue on Redis and are retried with backoff; a failing provider never affects the request. Business/slot-management endpoints additionally require the `business`, `employee`, or `admin` role, and are scoped so a business can only manage its own data.

## Testing

```bash
npm test             # unit tests (src/**/*.spec.ts), no infrastructure needed
npm run test:e2e     # end-to-end tests against real Postgres + Redis
npm run test:cov     # unit test coverage
```

The e2e suite needs `docker compose up -d db redis`. It always uses a separate `smart_booking_test` database (override with `POSTGRES_TEST_DB`), rebuilt from migrations on every run, so your development data is never touched. Google Maps and SMTP are stubbed. Set `DEBUG_SQL=1` to log SQL during a run.

CI (`.github/workflows/ci.yml`) runs lint, build, unit and e2e tests on every PR, and checks that the Docker image builds.

## Linting and formatting

```bash
npm run lint         # with --fix
npm run lint:check   # CI mode, no fixes
npm run format
```
