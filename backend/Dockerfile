# syntax=docker/dockerfile:1
# =============================================================================
# Cross-Docking API — NestJS backend
# Multi-stage build:  deps -> build -> runner
# Base: node:20-alpine (kicsi, gyors; Prisma miatt openssl + libc6-compat kell)
# =============================================================================

# -----------------------------------------------------------------------------
# 1) deps — csak a függőségek telepítése (jól cache-elhető réteg)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
# A Prisma engine (linux-musl) OpenSSL-t és glibc-kompatibilitást igényel Alpine-on
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Csak a manifest(ek) másolása -> ha a package.json nem változik, ez a réteg cache-elt
COPY package.json package-lock.json* ./
# Nincs garantált lockfile a repóban -> ha van, ci; ha nincs, install.
# (Determinisztikusabb build érdekében a csapat commitolhat package-lock.json-t,
#  és akkor ez automatikusan `npm ci`-re vált.)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# -----------------------------------------------------------------------------
# 2) build — Prisma client generálás + Nest fordítás (dist)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# node_modules a deps stage-ből
COPY --from=deps /app/node_modules ./node_modules
# Teljes forrás (a .dockerignore szűri a szükségteleneket)
COPY . .

# Prisma client generálása MÉG a build fázisban, Alpine (linux-musl) engine-nel.
# A prisma/schema.prisma-t a backend csapat szállítja; ha nincs, ez a lépés hibázik
# (szándékosan: nem akarunk schema nélkül image-et építeni).
RUN npx prisma generate

# NestJS -> dist/main.js
RUN npm run build

# -----------------------------------------------------------------------------
# 3) runner — minimális futtató image (csak prod deps + dist + prisma)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Prod-only függőségek külön, tiszta telepítéssel (a dev deps NEM kerül az image-be).
# A `prisma` CLI devDependency, de a `migrate deploy`-hoz futásidőben KELL -> külön,
# explicit prod-függőségként telepítjük (a @nestjs/cli és a teljes dev toolchain nélkül).
# A verziót a package-lock.json-ban lockolt @prisma/client-hez PONTOSAN pinneljük
# (6.19.3), hogy a CLI és a generált @prisma/client engine-verziója determinisztikusan
# egyezzen -> nincs "engine version mismatch" a `migrate deploy`-nál.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm install --no-save prisma@6.19.3 \
    && npm cache clean --force

# A build kimenete + a build fázisban generált Prisma client.
#  - dist/            : lefordított alkalmazás
#  - prisma/          : schema + migrations -> `prisma migrate deploy`-hoz futásidőben
#  - generated client : node_modules/.prisma és node_modules/@prisma (Alpine engine)
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Non-root futtatás: a node:alpine hozza a `node` (uid 1000) usert.
# A /app tulajdonjogát átadjuk, hogy a prisma esetleges cache-írása se bukjon el.
RUN chown -R node:node /app
USER node

EXPOSE 3001

# A migráció (migrate deploy) a compose command-láncban fut az indulás előtt,
# hogy a Postgres healthcheck már zöld legyen. Alap indítás: a lefordított app.
CMD ["node", "dist/main.js"]
