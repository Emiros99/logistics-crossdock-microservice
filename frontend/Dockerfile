# syntax=docker/dockerfile:1
# =============================================================================
# Cross-Docking Admin Dashboard — Next.js 15 frontend
# Multi-stage build:  deps -> build -> runner
# Base: node:20-alpine
#
# Megjegyzés a stratégiáról:
#   A next.config.ts `output: 'standalone'`-t használ, ezért a végső image a
#   .next/standalone kimenetre épül és `node server.js` indítja. Így a runnerben
#   NINCS szükség sem a `next` CLI-re, sem a `typescript` csomagra (a next start
#   a TS config betöltéséhez futásidőben npm install-t futtatna, ha hiányzik a
#   typescript — hálózatfüggő, nem determinisztikus indulás). A standalone út
#   determinisztikus, offline is indul, és lényegesen kisebb image-et ad.
# =============================================================================

# -----------------------------------------------------------------------------
# 1) deps — függőségek
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# -----------------------------------------------------------------------------
# 2) build — next build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app

# A NEXT_PUBLIC_* változók BUILD IDŐBEN sülnek a JS bundle-be -> build ARG-ként kell.
# Alap: http://localhost:3001, mert a böngésző (nem a konténer) hívja az API-t.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# A telemetria kikapcsolása determinisztikusabb, csendesebb buildet ad.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
# A public/ mappa létét garantáljuk, hogy a runner COPY lépése akkor se bukjon,
# ha a frontend csapat nem hozott létre statikus mappát.
RUN mkdir -p public

# -----------------------------------------------------------------------------
# 3) runner — prod futtatás (standalone: node server.js)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# A standalone server.js a PORT/HOSTNAME env-ekből olvassa, hol figyeljen.
# 0.0.0.0 kell, hogy a konténeren kívülről (port-mapping) is elérhető legyen.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone kimenet: server.js + tree-shaken node_modules + minimál package.json.
# Nem kell sem npm install, sem next.config olvasás futásidőben.
#  - .next/standalone : a futtatható alkalmazás (server.js + függőségei)
#  - .next/static     : a build statikus asset-jei (a standalone NEM tartalmazza)
#  - public/          : statikus fájlok (a standalone NEM tartalmazza)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Non-root: a node:alpine beépített `node` (uid 1000) usere.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Determinisztikus, hálózatfüggetlen indulás — se npm, se next CLI nem kell.
CMD ["node", "server.js"]
