# Smart Booking

Smart Booking is a multi-tenant appointment-scheduling API. A business signs up, opens a storefront, defines its working hours as bookable slots (daily or weekly, with a lunch break carved out), and its customers reserve those slots. It's built as a NestJS modular monolith on PostgreSQL, with Redis backing refresh-token storage, Google Maps for address geocoding, and Google Calendar/SMTP for notifications.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the module map, entity model, and API surface, and [`ROADMAP.md`](./ROADMAP.md) for the history of fixes applied to this codebase.

## Core concepts

- **Users** have a `role`: `client` (default, books appointments), `business` (owns a storefront), `employee` (works at one), or `admin`.
- **Business** is a storefront a `client` opens via `POST /business/open`, which promotes them to the `business` role. A business has one owner, any number of employees, a geocoded address, and a slot schedule.
- **Slot** is a bookable time window belonging to a business, generated in bulk (`POST /slots/daily` or `/weekly`) rather than created one at a time.
- **Booking** links a `client` to a `Slot` they've reserved. Reserving a slot is transactional and row-locked, so two customers can't book the same slot at once.

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
APP_PORT=3000

# Postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=smart_booking

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

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

All of the above are required at boot — a missing var fails startup immediately with a clear error instead of running with broken config.

### 2. Dependencies and infrastructure

```bash
npm install

# Starts Postgres and Redis
docker-compose up -d
```

### 3. Database schema

This project has no migration files yet (`synchronize` is intentionally `false` in `src/config/data-source.ts` to avoid accidental prod schema drift, and nothing has generated a baseline migration). To create the schema for local development, sync it directly from the compiled entities:

```bash
npm run build
npx typeorm schema:sync -d dist/config/data-source.js
```

Run this again any time an entity changes. Once real migrations exist, prefer `npm run migration:run` instead.

### 4. Run it

```bash
# development, with hot reload
npm run start:dev

# production build
npm run build
npm run start:prod
```

The API is served at `http://localhost:<APP_PORT>`, with interactive Swagger docs at `/docs`.

## API overview

| Area | Routes |
|---|---|
| Authentication | `POST /authentication/sign-up`, `/sign-in`, `/refresh-tokens` |
| Users | `GET /users`, `GET /users/:id`, `PATCH /users/:id` (admin only) |
| Business | `POST /business/open`, `GET /business`, `GET /business/:slug`, `PATCH /business/:slug` |
| Slot management | `POST /slots/daily`, `POST /slots/weekly`, `GET /slots`, `GET /slots/:date`, `PATCH /slots/:date`, `DELETE /slots/:date`, `POST /slots/report` |
| Booking | `POST /booking/:businessId`, `GET /booking/business/:businessId`, `GET /booking/slot/:id`, `DELETE /booking/slot/:id`, `GET /booking/slots` |

Auth is enforced globally by default; routes that don't need it opt out explicitly via `@Auth(AuthType.None)`. Business/slot-management endpoints additionally require the `business`, `employee`, or `admin` role, and are scoped so a business can only manage its own data.

## Testing

```bash
npm run test        # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # coverage
```

Note: this project currently has no unit test files under `src/`.

## Linting and formatting

```bash
npm run lint
npm run format
```
