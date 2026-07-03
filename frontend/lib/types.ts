/**
 * A backend publikus szerződésének (contract) kliensoldali típusleképezése.
 *
 * Ez a fájl az egyetlen forrás a csomag-domain típusaira a frontenden.
 * A mezőnevek és a státusz-enum szándékosan 1:1-ben követik a NestJS API
 * válaszát (közös műszaki kontraktum), így egy
 * backend-oldali breaking change fordítási hibaként jelenik meg nálunk is.
 */

/**
 * Csomag-státusz állapotgép. Irányított gráf: az érték csak előre léphet,
 * a `DISPATCHED` végállapot. A backend PostgreSQL enumból származik.
 */
export const PACKAGE_STATUSES = [
  'CREATED',
  'RECEIVED_AT_CROSSDOCK',
  'SORTED',
  'DISPATCHED',
] as const;

export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

/** A csomag aktuális, hiteles állapota (PostgreSQL — source of truth). */
export interface Package {
  readonly id: string;
  readonly trackingNumber: string;
  readonly status: PackageStatus;
  /** A backend szerint nullable (még nem szkennelt csomagnál `null`). */
  readonly lastScanLocation: string | null;
  /** ISO 8601 időbélyeg. */
  readonly updatedAt: string;
}

/** Egyetlen mozgástörténeti esemény (MongoDB — append-only napló). */
export interface HistoryEntry {
  /** ISO 8601 időbélyeg. */
  readonly timestamp: string;
  readonly location: string;
  readonly status: PackageStatus;
}

/** A `GET /api/packages/:trackingNumber` teljes válasza. */
export interface PackageDetail {
  readonly package: Package;
  readonly history: readonly HistoryEntry[];
}

/** A `POST /api/packages/scan` kérés törzse. */
export interface ScanRequest {
  readonly trackingNumber: string;
  readonly location: string;
}

/**
 * Type guard: futásidőben ellenőrzi, hogy egy tetszőleges string a
 * `PackageStatus` unió tagja-e. Így az ismeretlen backend-értékek nem
 * szivárognak be tipizálatlanul a nézetbe.
 */
export function isPackageStatus(value: string): value is PackageStatus {
  return (PACKAGE_STATUSES as readonly string[]).includes(value);
}
