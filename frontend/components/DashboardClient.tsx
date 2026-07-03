'use client';

import { useCallback, useReducer, useRef, useState } from 'react';
import { ApiError, getPackage, scanPackage, type PackageDetail } from '@/lib/api';
import { WAREHOUSE_LOCATIONS } from '@/lib/locations';
import { Alert } from './Alert';
import { ScanForm } from './ScanForm';
import { PackageOverview } from './PackageOverview';
import { HistoryTimeline } from './HistoryTimeline';

/**
 * A dashboard adat-állapota explicit állapotgépként.
 * A diszkriminált unió kizárja a lehetetlen kombinációkat (pl. egyszerre
 * "loading" és "error"), így a renderelés kimerítő és típusbiztos.
 */
type DataState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'loaded'; readonly detail: PackageDetail; readonly notice: string | null };

type DataAction =
  | { readonly type: 'REQUEST_START' }
  | { readonly type: 'REQUEST_SUCCESS'; readonly detail: PackageDetail; readonly notice: string | null }
  | { readonly type: 'REQUEST_ERROR'; readonly message: string };

function dataReducer(_state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'REQUEST_START':
      return { kind: 'loading' };
    case 'REQUEST_SUCCESS':
      return { kind: 'loaded', detail: action.detail, notice: action.notice };
    case 'REQUEST_ERROR':
      return { kind: 'error', message: action.message };
    default:
      return _state;
  }
}

/** Domain- és váratlan hibák egységes, felhasználóbarát üzenetté fordítása. */
function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Váratlan hiba történt a művelet közben. Kérjük, próbálja újra.';
}

const INITIAL_STATE: DataState = { kind: 'idle' };

export function DashboardClient(): React.ReactElement {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [location, setLocation] = useState<string>(WAREHOUSE_LOCATIONS[0]);
  const [state, dispatch] = useReducer(dataReducer, INITIAL_STATE);

  // Race-condition védelem: csak a legutóbb indított kérés eredménye írhat
  // állapotot. Gyors, egymást követő szkennelésnél a korábbi (lassabb) válasz
  // nem írja felül a frisset. Ref, mert nem kell rerender a változásakor.
  const latestRequestId = useRef(0);
  const isSubmitting = state.kind === 'loading';

  const handleSubmit = useCallback(async () => {
    const trimmedTracking = trackingNumber.trim();
    const trimmedLocation = location.trim();

    // Kliensoldali első védvonal — a backend class-validator a második.
    if (trimmedTracking.length === 0 || trimmedLocation.length === 0) {
      dispatch({
        type: 'REQUEST_ERROR',
        message: 'A csomagszám és a helyszín megadása egyaránt kötelező.',
      });
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    dispatch({ type: 'REQUEST_START' });

    try {
      // 1) Szkennelés (állapotgép-léptetés a backenden).
      await scanPackage({ trackingNumber: trimmedTracking, location: trimmedLocation });
      // 2) A teljes, történettel együttes nézet újratöltése a GET végpontról.
      const detail = await getPackage(trimmedTracking);

      if (latestRequestId.current !== requestId) {
        return; // Elavult válasz — újabb kérés van folyamatban.
      }
      dispatch({
        type: 'REQUEST_SUCCESS',
        detail,
        notice: `Sikeres szkennelés: ${detail.package.trackingNumber} @ ${trimmedLocation}.`,
      });
    } catch (error) {
      if (latestRequestId.current !== requestId) {
        return;
      }
      dispatch({ type: 'REQUEST_ERROR', message: toUserMessage(error) });
    }
  }, [trackingNumber, location]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Csomag szkennelése
        </h2>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Adja meg a csomagszámot és a szkennelési helyszínt. A rendszer lépteti az állapotgépet,
          majd frissíti az alábbi nézetet a teljes mozgástörténettel.
        </p>
        <ScanForm
          trackingNumber={trackingNumber}
          location={location}
          isSubmitting={isSubmitting}
          onTrackingNumberChange={setTrackingNumber}
          onLocationChange={setLocation}
          onSubmit={handleSubmit}
        />
      </section>

      <DashboardResult state={state} />
    </div>
  );
}

interface DashboardResultProps {
  readonly state: DataState;
}

/**
 * Az eredmény-terület kimerítő állapotkezelése: loading / error / üres (idle) /
 * betöltött. A `never` ág garantálja, hogy új állapot bevezetésekor a fordító
 * kikényszeríti a kezelést.
 */
function DashboardResult({ state }: DashboardResultProps): React.ReactElement {
  switch (state.kind) {
    case 'idle':
      return (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-500">
            Még nincs megjelenítendő csomag. Végezzen el egy szkennelést a fenti űrlappal.
          </p>
        </section>
      );

    case 'loading':
      return <ResultSkeleton />;

    case 'error':
      return (
        <Alert variant="error" title="A művelet nem sikerült">
          <p>{state.message}</p>
        </Alert>
      );

    case 'loaded':
      return (
        <div className="space-y-6">
          {state.notice ? (
            <Alert variant="success" title="Szkennelés rögzítve">
              <p>{state.notice}</p>
            </Alert>
          ) : null}
          <PackageOverview pkg={state.detail.package} />
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Mozgástörténet
            </h2>
            <HistoryTimeline history={state.detail.history} />
          </section>
        </div>
      );

    default: {
      // Kimerítőség-ellenőrzés: ha új állapot kerül a unióba, itt fordítási hiba lesz.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/** Betöltési vázlat (skeleton) — layout-stabil, csökkenti a CLS-t. */
function ResultSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Betöltés folyamatban…</span>
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-48 rounded bg-slate-200" />
        <div className="mt-6 h-1.5 w-full rounded bg-slate-100" />
      </div>
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-5 space-y-4">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-5/6 rounded bg-slate-100" />
          <div className="h-4 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
