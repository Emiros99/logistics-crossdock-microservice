# Cross-Docking API — Backend (NestJS)

E-commerce logisztikai átrakodó (cross-docking) mikroszerviz. A csomagok szkennelését,
státusz-léptetését (state machine) és a mozgástörténet lekérdezését szolgálja ki.

Ez a README a **futtatásról** szól.

## Stack

| Réteg | Technológia | Szerep |
|---|---|---|
| Keretrendszer | NestJS 11 (TypeScript strict) | moduláris felépítés, DI |
| SQL | PostgreSQL + Prisma 6 | csomag hiteles állapota (ACID, interaktív tranzakció) |
| NoSQL | MongoDB + Mongoose 8 | append-only mozgástörténet (fire-and-forget írás) |
| Cache + sor | Redis + BullMQ 5 | cache-aside olvasás + aszinkron futár-értesítés |
| Validáció | class-validator / class-transformer | DTO-validáció a HTTP határon |
| Rate limit | @nestjs/throttler | burst-védelem a scan végponton |

## Modulszerkezet (`src/`)

```
app.module.ts            kompozíciós gyökér (Config, Mongoose, BullMQ, Throttler, Prisma, Redis)
main.ts                  bootstrap: prefix /api, CORS :3000, globális ValidationPipe + exception filter
config/                  típusolt konfiguráció (env -> AppConfig)
prisma/                  PrismaModule (@Global) + PrismaService (életciklus)
redis/                   ioredis kliens (factory) + CacheService (cache-aside, graceful)
tracking-history/        Mongoose séma + service (fire-and-forget írás, időrendi olvasás)
notifications/           BullMQ producer (NotificationsService) + processor (WorkerHost)
packages/                domain mag: DTO-k, state machine, service (tranzakció), controller
health/                  GET /api/health liveness
common/                  egységes hibaformátum (AllExceptionsFilter)
```

## API végpontok

### `POST /api/packages/scan`
Body: `{ "trackingNumber": string, "location": string }` (egyik sem lehet üres).

- Ha a `trackingNumber` nem létezik: létrehozás `CREATED`-ben, majd léptetés `RECEIVED_AT_CROSSDOCK`-ra.
- Ha létezik: egy lépés előre a state machine szerint (`CREATED → RECEIVED_AT_CROSSDOCK → SORTED → DISPATCHED`).
- Válasz `200`: `{ id, trackingNumber, status, lastScanLocation, updatedAt }`.
- `400`: érvénytelen/üres body. `409`: `DISPATCHED` (végállapot) újraszkennelése.

Az olvasás → state machine validálás → írás egyetlen **Prisma interaktív tranzakcióban** fut (ACID).
A mellékhatások a válaszidőt nem terhelik: Mongo-írás fire-and-forget, cache `DEL`, BullMQ job.

### `GET /api/packages/:trackingNumber`
Válasz `200`: `{ package: { id, trackingNumber, status, lastScanLocation, updatedAt }, history: [ { timestamp, location, status } ] }`.
Cache-aside (`tracking:{trackingNumber}`, rövid TTL). `404`, ha nincs ilyen csomag.

## Futtatás

Előfeltétel: Node 20+, valamint futó PostgreSQL / MongoDB / Redis (a repo gyökér
`docker-compose.yml`-je biztosítja — azt a DevOps kolléga készíti).

```powershell
# 1) Függőségek
npm install

# 2) Env
Copy-Item .env.example .env

# 3) Prisma kliens generálása (a build és a runtime igényli)
npx prisma generate

# 4) Adatbázis-migráció alkalmazása (futó PostgreSQL kell hozzá)
npx prisma migrate deploy

# 5) Indítás
npm run start:dev        # fejlesztői (watch)
npm run start:prod       # dist/main (előtte: npm run build)
```

## Migráció

A séma: [`prisma/schema.prisma`](prisma/schema.prisma). A kész, `migrate deploy`-kompatibilis
migráció: [`prisma/migrations/20260101000000_init/migration.sql`](prisma/migrations/).

```powershell
npx prisma migrate deploy   # az összes függőben lévő migrációt alkalmazza (idempotens)
```

> A migráció `gen_random_uuid()`-t használ az UUID alapértelmezéshez (PostgreSQL 13+ beépített).

## Tesztelés

```powershell
npm run build       # TypeScript strict build (nest build)
npm run test:e2e    # E2E: POST /api/packages/scan — TELJESEN MOCKOLVA, élő DB nélkül fut
```

Az E2E teszt a PrismaService-t, a Mongoose modellt, a Redis klienst és a BullMQ queue-t
`overrideProvider`-rel mockolja — determinisztikus, gyors, CI-független. Esetek:
sikeres scan (státuszléptetés + queue-hívás + cache-invalidálás assertálva), üres body → 400,
`DISPATCHED` újraszkennelés → 409.

## Környezeti változók

Lásd [`.env.example`](.env.example). Kulcsok: `PORT`, `CORS_ORIGIN`, `DATABASE_URL`,
`MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `CACHE_TRACKING_TTL`, `NOTIFY_ATTEMPTS`, `NOTIFY_BACKOFF_MS`.
