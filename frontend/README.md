# Cross-Docking — Admin Dashboard (Frontend)

Egyoldalas admin felület a Cross-Docking API PoC-hoz: csomag-szkennelés,
hangsúlyos állapot-badge és teljes mozgástörténet. **Next.js (App Router) +
TypeScript + Tailwind CSS.**

## Előfeltételek

- Node.js 20+ (fejlesztve: 24.x), npm 10+
- Futó backend a `http://localhost:3001` címen, `api` globális prefixszel

## Környezeti változó

Egyetlen változó, a backend alap-URL-je:

```bash
cp .env.example .env.local   # majd szükség szerint módosítsd
```

| Változó | Alapérték | Leírás |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | A NestJS backend alap-URL-je (a böngészőbe kerül). |

> A kliens minden hívást a `${NEXT_PUBLIC_API_URL}/api/...` alá küld, ezért a
> változóban **ne** add meg az `/api` prefixet.

## Parancsok

```bash
npm install      # függőségek telepítése
npm run dev      # fejlesztői szerver — http://localhost:3000
npm run build    # produkciós build (standalone kimenet)
npm run start    # a lefordított build futtatása a 3000-es porton
npm run lint     # ESLint (next/core-web-vitals + typescript)
npm run type-check  # tsc --noEmit, futtatás nélküli típusellenőrzés
```

## Használat

1. Add meg a **csomagszámot** (pl. `PKG-2026-000123`).
2. Válassz **szkennelési helyszínt** a listából (pl. `BUD-HUB-01 / Kapu 4`).
3. Kattints a **Szkennelés** gombra. A dashboard:
   - `POST /api/packages/scan` — állapotgép-léptetés (ismeretlen csomagot létrehoz),
   - majd `GET /api/packages/:trackingNumber` — a nézet frissítése a teljes történettel.

A hibák felhasználóbarát magyar üzenetként jelennek meg:
`400` (hiányzó adat), `404` (ismeretlen csomag), `409` (már kiszállított csomag
újraszkennelése), `5xx` és hálózati hiba.

## Felépítés

```
frontend/
├── app/
│   ├── layout.tsx        # gyökér-layout, self-hosted Inter font, metaadatok
│   ├── page.tsx          # Server Component héj + ErrorBoundary
│   └── globals.css       # Tailwind belépő + alapstílusok
├── components/           # kliens- és prezentációs komponensek
│   ├── DashboardClient.tsx   # állapotgép (useReducer), scan→get orkesztráció
│   ├── ScanForm.tsx          # vezérelt szkennelő űrlap
│   ├── PackageOverview.tsx   # aktuális állapot kártya + előrehaladásjelző
│   ├── HistoryTimeline.tsx   # mozgástörténet idővonal
│   ├── StatusBadge.tsx       # státusz-badge (központi színforrásból)
│   ├── Alert.tsx             # egységes visszajelző sáv (hiba/siker/info)
│   └── ErrorBoundary.tsx     # kliensoldali render-hiba védőháló
└── lib/                  # keret-független logika
    ├── types.ts          # a backend szerződés kliens-típusai
    ├── api.ts            # típusos API-kliens + hibafordítás (ApiError)
    ├── status.ts        # státusz-metaadatok (címke/szín/sorrend) — DRY
    ├── locations.ts     # raktári helyszínek
    └── format.ts        # hu-HU dátumformázás
```

### Architekturális megjegyzések

- **Réteges felelősség:** a `lib/` keret-független (transport + domain-típusok +
  formázás); a `components/` prezentáció + interakció. A komponensek soha nem
  látnak nyers `Response`-t, csak `ApiError`-t.
- **Állapotkezelés:** a `DashboardClient` egy diszkriminált unió állapotgépet
  vezet (`idle | loading | error | loaded`) `useReducer`-rel — a lehetetlen
  állapotok fordítási időben kizárva.
- **Race-condition védelem:** gyors, egymást követő szkennelésnél csak a legutóbbi
  kérés eredménye írhat állapotot (kérés-sorszám `ref`).
- **Szigorú TypeScript:** `strict`, `noUncheckedIndexedAccess`, tiltott `any`.
