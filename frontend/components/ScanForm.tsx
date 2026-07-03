'use client';

import { useId } from 'react';
import { WAREHOUSE_LOCATIONS } from '@/lib/locations';

interface ScanFormProps {
  readonly trackingNumber: string;
  readonly location: string;
  readonly isSubmitting: boolean;
  readonly onTrackingNumberChange: (value: string) => void;
  readonly onLocationChange: (value: string) => void;
  readonly onSubmit: () => void;
}

/**
 * Vezérelt szkennelő űrlap. Tisztán prezentációs/vezérelt: az állapotot a
 * szülő (DashboardClient) birtokolja, ez a komponens csak eseményeket emel fel.
 * A gomb a beviteli mezők ürességekor tiltott (kliensoldali első védvonal a
 * felesleges 400-as kérések ellen — a backend validáció a második).
 */
export function ScanForm({
  trackingNumber,
  location,
  isSubmitting,
  onTrackingNumberChange,
  onLocationChange,
  onSubmit,
}: ScanFormProps): React.ReactElement {
  const trackingInputId = useId();
  const locationSelectId = useId();

  const canSubmit = trackingNumber.trim().length > 0 && location.trim().length > 0 && !isSubmitting;

  return (
    <form
      className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          onSubmit();
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={trackingInputId} className="text-sm font-medium text-slate-700">
          Csomagszám
        </label>
        <input
          id={trackingInputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="pl. PKG-2026-000123"
          value={trackingNumber}
          disabled={isSubmitting}
          onChange={(event) => onTrackingNumberChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={locationSelectId} className="text-sm font-medium text-slate-700">
          Szkennelési helyszín
        </label>
        <select
          id={locationSelectId}
          value={location}
          disabled={isSubmitting}
          onChange={(event) => onLocationChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          {WAREHOUSE_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? (
          <>
            <Spinner />
            Szkennelés…
          </>
        ) : (
          'Szkennelés'
        )}
      </button>
    </form>
  );
}

function Spinner(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}
