import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center p-8">
            <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-lg">
              <p className="mb-2 text-3xl">⚠</p>
              <h2 className="mb-2 text-lg font-bold">Algo deu errado</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {this.state.error?.message || "Erro inesperado"}
              </p>
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Recarregar
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
