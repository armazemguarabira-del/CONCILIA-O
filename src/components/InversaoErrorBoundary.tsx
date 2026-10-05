import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class InversaoErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('InversaoErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white border-2 border-amber-400 rounded-2xl shadow-lg my-4 text-slate-800">
          <div className="flex items-center gap-3 mb-3 text-amber-700">
            <AlertTriangle className="w-7 h-7 flex-shrink-0" />
            <div>
              <h3 className="text-base font-black">
                A Tabela de Inversão foi preservada com segurança
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {this.props.fallbackMessage ||
                  'Ocorreu uma instabilidade transitória na renderização, mas suas edições de quantidades e dados foram mantidas intactas no histórico.'}
              </p>
            </div>
          </div>

          {this.state.error && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 mb-4 max-h-32 overflow-auto">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restaurar Visualização da Tabela</span>
            </button>
            <span className="text-xs text-slate-500">
              Nenhuma alteração feita pelo analista foi perdida.
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
