import { isPackageStatus, type PackageStatus } from './types';

/**
 * Státusz-metaadatok egyetlen, központi helyen (DRY).
 * A badge-színek, magyar címkék és a lépéssorrend innen származnak —
 * a komponensek nem tartalmaznak hardkódolt státusz-logikát.
 *
 * A színosztályok statikus, teljes Tailwind class-stringek, hogy a
 * JIT-fordító biztosan felismerje őket (nem dinamikusan összefűzöttek).
 */
interface StatusMeta {
  /** Felhasználónak megjelenített magyar címke. */
  readonly label: string;
  /** Rövid, kontextusadó leírás. */
  readonly description: string;
  /** A hangsúlyos badge Tailwind osztályai (háttér + szöveg + keret). */
  readonly badgeClass: string;
  /** Az idővonal pont (dot) színosztálya. */
  readonly dotClass: string;
  /** Az állapotgépben elfoglalt sorszám (0-tól). */
  readonly order: number;
}

export const STATUS_META: Readonly<Record<PackageStatus, StatusMeta>> = {
  CREATED: {
    label: 'Létrehozva',
    description: 'A csomag rögzítve, még nem érkezett be az átrakodóba.',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
    dotClass: 'bg-slate-400',
    order: 0,
  },
  RECEIVED_AT_CROSSDOCK: {
    label: 'Beérkezett (átrakodó)',
    description: 'A csomagot átvettük az átrakodó ponton.',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    dotClass: 'bg-blue-500',
    order: 1,
  },
  SORTED: {
    label: 'Szortírozva',
    description: 'A csomag a kimenő járathoz rendezve.',
    badgeClass: 'bg-amber-50 text-amber-800 ring-amber-200',
    dotClass: 'bg-amber-500',
    order: 2,
  },
  DISPATCHED: {
    label: 'Kiszállítva',
    description: 'A csomag felkerült a kimenő járműre — végállapot.',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dotClass: 'bg-emerald-500',
    order: 3,
  },
};

/**
 * Semleges (szürke) fallback ismeretlen backend-státuszhoz. A `label` a nyers
 * stringet őrzi, így a mozgástörténet teljes marad, az `order` -1 (a vizuális
 * előrehaladásban egyik lépést sem jelöli meghaladottnak).
 */
const UNKNOWN_STATUS_META: StatusMeta = {
  label: '',
  description: 'Ismeretlen státusz.',
  badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
  dotClass: 'bg-slate-400',
  order: -1,
};

/**
 * A státusz metaadatainak biztonságos feloldása. A history státusz a
 * backendről tipizálatlan stringként érkezik; az {@link isPackageStatus}
 * guard-dal védjük az indexelést, így ismeretlen érték nem dob TypeError-t,
 * hanem semleges badge-et kap a nyers érték címkéjével (az elemet nem ejtjük ki).
 */
export function resolveStatusMeta(status: string): StatusMeta {
  if (isPackageStatus(status)) {
    return STATUS_META[status];
  }
  return { ...UNKNOWN_STATUS_META, label: status };
}

/** A státuszhoz tartozó magyar címke, biztonságos visszaeséssel. */
export function statusLabel(status: string): string {
  return resolveStatusMeta(status).label;
}
