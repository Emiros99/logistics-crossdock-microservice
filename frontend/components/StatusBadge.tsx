import { resolveStatusMeta } from '@/lib/status';

interface StatusBadgeProps {
  /** Nyers backend-státusz; ismeretlen értéket a resolver semlegesen kezel. */
  readonly status: string;
  /** `lg`: hangsúlyos, kártyafejléc-méret; `sm`: idővonal-inline méret. */
  readonly size?: 'sm' | 'lg';
}

/**
 * Státusz-badge — a színt és a magyar címkét a központi STATUS_META adja (DRY).
 * Tisztán prezentációs, mémozás nélkül is olcsó (nincs prop-instabilitás).
 */
export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps): React.ReactElement {
  const meta = resolveStatusMeta(status);
  const sizeClass = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset ${meta.badgeClass} ${sizeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
