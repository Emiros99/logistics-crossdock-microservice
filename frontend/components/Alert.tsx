type AlertVariant = 'error' | 'success' | 'info';

interface AlertProps {
  readonly variant: AlertVariant;
  readonly title: string;
  readonly children?: React.ReactNode;
}

const VARIANT_CLASS: Readonly<Record<AlertVariant, string>> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

const VARIANT_ICON: Readonly<Record<AlertVariant, string>> = {
  error: '!',
  success: '✓',
  info: 'i',
};

/**
 * Egységes, akadálymentes visszajelző sáv (hiba / siker / információ).
 * A `role="alert"` a hibáknál felolvastatja a képernyőolvasóval a változást.
 */
export function Alert({ variant, title, children }: AlertProps): React.ReactElement {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASS[variant]}`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-current text-xs font-bold"
      >
        {VARIANT_ICON[variant]}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-0.5 text-current/90">{children}</div> : null}
      </div>
    </div>
  );
}
