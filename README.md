# Cross-Docking API — PoC

E-commerce logisztikai **átrakodó (cross-docking) mikroszerviz** proof-of-concept.
A beérkező árut tárolás nélkül, futószalag-tempóban szkenneljük és rakjuk át a kimenő
járművekre. A rendszer a csomag **hiteles állapotát** (PostgreSQL), a **teljes
mozgástörténetét** (MongoDB) és a **cache + aszinkron értesítéseket** (Redis/BullMQ)
külön, célra optimalizált tárolókban kezeli.

---

## Architektúra

```mermaid
flowchart TD
    subgraph Client["Böngésző"]
        UI["Next.js Admin Dashboard<br/>:3000"]
    end

    subgraph API["NestJS Backend :3001 (prefix /api)"]
        PKG["PackagesModule"]
        PKG --- PRISMA["Prisma"]
        PKG --- MONGOOSE["Mongoose"]
        PKG --- BULL["BullMQ + Cache"]
    end

    PG[("PostgreSQL :5432<br/>STÁTUSZ (ACID)")]
    MG[("MongoDB :27017<br/>TÖRTÉNET (append)")]
    RD[("Redis :6379<br/>(host: :6380)<br/>CACHE + SOR")]

    UI -- "HTTP REST/JSON" --> PKG
    PRISMA --> PG
    MONGOOSE --> MG
    BULL --> RD
```

**Felelősség-megosztás:**

| Komponens | Szerep |
|---|---|
| **PostgreSQL** (Prisma) | a csomag aktuális, hiteles állapota — egyetlen source of truth |
| **MongoDB** (Mongoose) | teljes mozgástörténet — append-only eseménynapló |
| **Redis** | olvasási cache + BullMQ üzenetsor-backend (`notifications` sor) |
| **NestJS** | REST API, üzleti state machine, mellékhatás-vezérlés |
| **Next.js** | admin dashboard (szkennelés, csomagkövetés) |

**Csomag-státusz state machine** (csak előre léphet):

```
CREATED → RECEIVED_AT_CROSSDOCK → SORTED → DISPATCHED   (DISPATCHED után minden scan → 409)
```

---

## Indítás egyetlen paranccsal

Előfeltétel: **Docker Desktop** (Compose v2). Semmilyen manuális `npm install` vagy
adatbázis-telepítés nem szükséges.

```bash
docker compose up --build
```

Ez sorban:

1. elindítja a **postgres / mongo / redis** szolgáltatásokat és megvárja a healthcheckjüket,
2. a **backend** konténer előbb lefuttatja a `prisma migrate deploy`-t (séma naprakész),
   majd elindítja a NestJS appot,
3. elindítja a **frontend** Next.js appot.

Leállítás: `Ctrl+C`, majd takarítás (adatokkal együtt):

```bash
docker compose down -v
```

> **Ha a 3000-es host-port foglalt** (pl. egy másik `next dev` fut a gépen), a frontend
> host-portja env-ből átírható — a backend CORS-engedélye automatikusan követi:
>
> ```powershell
> $env:FRONTEND_PORT = "3010"; docker compose up --build
> ```
>
> A dashboard ekkor a http://localhost:3010 címen érhető el. (Ugyanígy: a Redis host-portja
> alapból 6380, hogy ne ütközzön egy lokálisan futó 6379-es Redisszel.)

---

## Elérési pontok

| Szolgáltatás | URL |
|---|---|
| Frontend (admin dashboard) | http://localhost:3000 |
| Backend API (prefix `/api`) | http://localhost:3001/api |
| PostgreSQL | `localhost:5432` (db: `crossdock`, user/pass: `postgres`) |
| MongoDB | `localhost:27017` (db: `crossdock_tracking`) |
| Redis | `localhost:6380` (host-mappelés; konténeren belül `redis:6379`) |

**Fő végpontok:**

- `POST /api/packages/scan` — body: `{ "trackingNumber": string, "location": string }`.
  Ismeretlen `trackingNumber` esetén létrehozza `CREATED` állapotban, majd léptet.
  Hibák: `400` (validáció), `409` (DISPATCHED újraszkennelése).
- `GET /api/packages/:trackingNumber` — a csomag aktuális állapota + teljes története.
  `404`, ha nincs ilyen csomag.

---

## Lokális fejlesztői mód (Docker nélkül)

Ha csak az alkalmazáskódon dolgozol, futtathatod natívan is — de a három adattárnak
akkor is futnia kell. A legegyszerűbb: csak az infra-szolgáltatásokat indítsd Dockerrel,
az appokat pedig natívan.

**1. Csak az adattárak Dockerrel:**

```bash
docker compose up -d postgres mongo redis
```

**2. Backend natívan** (`backend/` mappában):

```bash
cd backend
npm install
npx prisma migrate deploy      # vagy: npx prisma migrate dev (fejlesztéshez)
npm run start:dev              # watch mód, :3001
```

Env (lokálisan a `localhost` a hostnév — nem a service-név):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crossdock
MONGO_URI=mongodb://localhost:27017/crossdock_tracking
REDIS_HOST=localhost
REDIS_PORT=6380   # a compose a Redist a host 6380-as portjára mappeli
PORT=3001
```

**3. Frontend natívan** (`frontend/` mappában):

```bash
cd frontend
npm install
npm run dev                    # :3000
```

Env:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Környezeti változók összefoglaló

| Változó | Docker (konténerhálózat) | Lokális dev |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/crossdock` | `...@localhost:5432/...` |
| `MONGO_URI` | `mongodb://mongo:27017/crossdock_tracking` | `mongodb://localhost:27017/...` |
| `REDIS_HOST` | `redis` | `localhost` |
| `REDIS_PORT` | `6379` (service-en belüli port) | `6380` (host-mappelés) |
| `PORT` (backend) | `3001` | `3001` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` (a böngésző hívja!) | `http://localhost:3001` |

> **Miért `localhost` a `NEXT_PUBLIC_API_URL` Dockerben is?** Mert ezt az URL-t a
> felhasználó **böngészője** hívja (a bundle-be sült érték), nem a frontend konténer.
> A böngésző szempontjából az API a host `localhost:3001` portján érhető el.

---

## Projektstruktúra

```
.
├── backend/            # NestJS API (Prisma, Mongoose, BullMQ)
│   ├── Dockerfile      # multi-stage: deps → build → runner (non-root)
│   └── .dockerignore
├── frontend/           # Next.js admin dashboard
│   ├── Dockerfile      # multi-stage Next.js build (non-root)
│   └── .dockerignore
├── docker-compose.yml  # a teljes stack egy paranccsal
└── README.md
```
