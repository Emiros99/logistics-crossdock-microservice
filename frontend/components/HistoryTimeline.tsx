import type { HistoryEntry } from '@/lib/types';
import { resolveStatusMeta } from '@/lib/status';
import { formatTimestamp } from '@/lib/format';
import { StatusBadge } from './StatusBadge';

interface HistoryTimelineProps {
  readonly history: readonly HistoryEntry[];
}

/**
 * A csomag teljes mozgástörténete időrendi listaként.
 * A backend a történetet append-only naplóként adja; itt fordított
 * (legfrissebb elöl) sorrendben jelenítjük meg, a nyers tömb mutálása nélkül.
 * Üres történet esetén finom üres állapotot mutat.
 */
export function HistoryTimeline({ history }: HistoryTimelineProps): React.ReactElement {
  if (history.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Ehhez a csomaghoz még nincs rögzített mozgástörténeti esemény.
      </p>
    );
  }

  // Másolaton rendezünk (nem mutáljuk a propot). A backend timestamp ISO-8601,
  // így a leíró (csökkenő) rendezés lexikografikusan is helyes és stabil.
  const ordered = [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <ol className="relative space-y-6 pl-6">
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200"
      />
      {ordered.map((entry, index) => {
        const meta = resolveStatusMeta(entry.status);
        return (
          <li key={`${entry.timestamp}-${index}`} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${meta.dotClass}`}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{entry.location}</p>
                <time
                  dateTime={entry.timestamp}
                  className="text-xs tabular-nums text-slate-500"
                >
                  {formatTimestamp(entry.timestamp)}
                </time>
              </div>
              <StatusBadge status={entry.status} size="sm" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
