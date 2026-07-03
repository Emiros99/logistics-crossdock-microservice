import type { Package, PackageDetail, ScanRequest } from './types';

export type { Package, PackageDetail };

/**
 * Típusos API-kliens réteg a NestJS backendhez.
 *
 * Egyetlen felelőssége a HTTP-transport és a hibafordítás:
 * a nyers `fetch` hibákat és a backend státuszkódjait (400/404/409/5xx,
 * hálózati hiba) domain-szintű, magyar nyelvű `ApiError`-rá alakítja.
 * A React-komponensek soha nem látnak nyers Response-t.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** A hívó által megkülönböztethető hibakategóriák (diszkriminátor). */
export type ApiErrorKind =
  | 'validation' // 400
  | 'not_found' // 404
  | 'conflict' // 409
  | 'server' // 5xx
  | 'network' // fetch elszállt / nincs válasz
  | 'unknown';

/**
 * Domain-hiba egységes, felhasználóbarát magyar üzenettel.
 * A komponensek ezt kapják el, nem a nyers HTTP-t.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** HTTP-státuszkód → felhasználóbarát magyar üzenet és hibakategória. */
function mapHttpError(status: number, trackingNumber: string): ApiError {
  switch (status) {
    case 400:
      return new ApiError(
        'validation',
        'Érvénytelen adat. A csomagszám és a helyszín is kötelező.',
        status,
      );
    case 404:
      return new ApiError(
        'not_found',
        `Nincs ilyen csomag a rendszerben: „${trackingNumber}”.`,
        status,
      );
    case 409:
      return new ApiError(
        'conflict',
        'Ez a csomag már kiszállítva (DISPATCHED) állapotban van, több szkennelés nem lehetséges.',
        status,
      );
    default:
      if (status >= 500) {
        return new ApiError(
          'server',
          'A szolgáltatás átmenetileg nem elérhető. Kérjük, próbálja újra kicsivel később.',
          status,
        );
      }
      return new ApiError(
        'unknown',
        `Váratlan hiba történt (HTTP ${status}).`,
        status,
      );
  }
}

/**
 * Belső, alacsony szintű fetch-burkoló.
 *
 * @param path      A backend path (globális `api` prefix nélkül; a helper adja hozzá).
 * @param context   A hibafordításhoz használt csomagszám (a 404-üzenethez).
 * @param init      Opcionális `RequestInit` (metódus, body, headerök).
 */
async function request<TResponse>(
  path: string,
  context: string,
  init?: RequestInit,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      // A tracking-adat mindig friss legyen — nincs böngésző/Next cache.
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      ...init,
    });
  } catch {
    // A fetch csak hálózati/transport hibánál dob (nem HTTP-státuszra).
    throw new ApiError(
      'network',
      'Nem sikerült elérni a szervert. Ellenőrizze a hálózati kapcsolatot vagy a backend elérhetőségét.',
    );
  }

  if (!response.ok) {
    throw mapHttpError(response.status, context);
  }

  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new ApiError(
      'unknown',
      'A szerver válasza nem volt értelmezhető.',
      response.status,
    );
  }
}

/**
 * `POST /api/packages/scan` — csomag szkennelése (állapotgép-léptetés).
 * Nem létező trackingNumber esetén a backend CREATED állapotban létrehozza,
 * majd lépteti. A hívó a szkennelés után külön hívja a `getPackage`-et a
 * teljes (történettel együttes) nézet frissítéséhez.
 */
export async function scanPackage(payload: ScanRequest): Promise<Package> {
  return request<Package>('/packages/scan', payload.trackingNumber, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `GET /api/packages/:trackingNumber` — a csomag aktuális állapota és teljes
 * mozgástörténete. 404-nél `ApiError('not_found')` dobódik.
 */
export async function getPackage(trackingNumber: string): Promise<PackageDetail> {
  const encoded = encodeURIComponent(trackingNumber);
  return request<PackageDetail>(`/packages/${encoded}`, trackingNumber);
}
