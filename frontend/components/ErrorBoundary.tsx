'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert } from './Alert';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly message: string | null;
}

/**
 * Kliensoldali Error Boundary.
 *
 * Elkapja a gyermek-fában dobott render-idejű kivételeket, hogy egyetlen
 * komponenshiba ne feketítse ki a teljes dashboardot ("white screen of death").
 * A hálózati/domain-hibákat NEM ez kezeli — azok az `ApiError`-on keresztül,
 * kontrollált állapotként folynak; ez a védőháló a váratlan render-hibákra.
 *
 * React 19-ben nincs függvénykomponens-ekvivalens a getDerivedStateFromError-ra,
 * ezért ez tudatosan class-komponens.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Ismeretlen kliensoldali hiba.';
    return { hasError: true, message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Éles rendszerben itt strukturált logolás / hibakövető (pl. Sentry) hívása.
    // eslint-disable-next-line no-console
    console.error('Dashboard ErrorBoundary elkapott egy hibát:', error, info.componentStack);
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="space-y-4">
          <Alert variant="error" title="A felület megjelenítése közben hiba történt">
            <p>{this.state.message}</p>
          </Alert>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Újrapróbálkozás
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
