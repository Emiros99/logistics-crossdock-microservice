import { DashboardClient } from '@/components/DashboardClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Az egyoldalas admin dashboard belépési pontja (Server Component).
 *
 * A statikus héj (fejléc, elrendezés) a szerveren renderelődik; az interaktív
 * rész a `DashboardClient` kliens-komponensbe van izolálva, amelyet
 * Error Boundary véd a váratlan render-hibáktól. Így a szerveren renderelt
 * váz akkor is megjelenik, ha a kliens-logika elszáll.
 */
export default function HomePage(): React.ReactElement {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white"
          >
            CD
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Cross-Docking — Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Átrakodó csomag-szkennelés és állapotkövetés
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <ErrorBoundary>
          <DashboardClient />
        </ErrorBoundary>
      </main>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
        Cross-Docking API PoC · A státusz kizárólag előre léphet
        (CREATED → RECEIVED_AT_CROSSDOCK → SORTED → DISPATCHED).
      </footer>
    </div>
  );
}
