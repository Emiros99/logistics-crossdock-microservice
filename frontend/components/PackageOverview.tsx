import type { Package } from '@/lib/types';
import { STATUS_META } from '@/lib/status';
import { formatTimestamp } from '@/lib/format';
import { StatusBadge } from './StatusBadge';

interface PackageOverviewProps {
  readonly pkg: Package;
}

/**
 * A csomag aktuális állapotát kiemelő fejléc-kártya: hangsúlyos státusz-badge,
 * a hozzá tartozó rövid leírás, az utolsó szkennelési helyszín és időbélyeg.
 * Alattuk vizuális állapotgép-előrehaladás (CREATED → DISPATCHED).
 */
export function PackageOverview({ pkg }: PackageOverviewProps): React.ReactElement {
  const meta = STATUS_META[pkg.status];

  return (
    <section
      aria-labelledby="package-overview-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Csomagszám</p>
          <h2
            id="package-overview-heading"
            className="mt-1 break-all font-mono text-xl font-semibold text-slate-900"
          >
            {pkg.trackingNumber}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{meta.description}</p>
        </div>
        <StatusBadge status={pkg.status} size="lg" />
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Utolsó szkennelés helye
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {pkg.lastScanLocation ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Utolsó frissítés
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {formatTimestamp(pkg.updatedAt)}
          </dd>
        </div>
      </dl>

      <ProgressTrack currentOrder={meta.order} />
    </section>
  );
}

interface ProgressTrackProps {
  readonly currentOrder: number;
}

/** Vízszintes állapotgép-előrehaladás jelző (nem interaktív, dekoratív). */
function ProgressTrack({ currentOrder }: ProgressTrackProps): React.ReactElement {
  const steps = Object.values(STATUS_META).sort((a, b) => a.order - b.order);

  return (
    <ol className="mt-6 flex items-center gap-1" aria-hidden="true">
      {steps.map((step) => {
        const reached = step.order <= currentOrder;
        return (
          <li key={step.label} className="flex flex-1 items-center gap-1">
            <span
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                reached ? step.dotClass : 'bg-slate-200'
              }`}
            />
          </li>
        );
      })}
    </ol>
  );
}
