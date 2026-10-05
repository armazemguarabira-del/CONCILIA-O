import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RootErrorBoundary extends React.Component<Props, State> {
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
    console.error('[RootErrorBoundary] Erro capturado na aplicação:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReload = () => {
    window.location.reload();
  };

  private handleCleanRecover = () => {
    try {
      // Clear transient caches that might have corrupt data while retaining critical user data
      const preservedKeys = ['gestao_estoque_v3_usuarios', 'gestao_estoque_v3_usuario_ativo'];
      const backup: Record<string, string | null> = {};
      preservedKeys.forEach(k => {
        backup[k] = localStorage.getItem(k);
      });

      // Clear potential corrupted caches
      localStorage.removeItem('gestao_estoque_v4_quebras');
      localStorage.removeItem('gestao_estoque_v3_quebras');
      localStorage.removeItem('gestao_estoque_v5_trocas_doc');
      localStorage.removeItem('gestao_estoque_v3_vales');
      localStorage.removeItem('gestao_estoque_v3_faltas');
      localStorage.removeItem('gestao_estoque_faturamento_semanal_v2');

      // Restore user sessions
      preservedKeys.forEach(k => {
        if (backup[k]) localStorage.setItem(k, backup[k]!);
      });

      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
          <div className="w-full max-w-xl bg-slate-850 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-700/60 text-amber-400">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <AlertOctagon className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">
                  Recuperação Automática de Interface
                </h1>
                <p className="text-xs text-slate-400">
                  CDD Pau Brasil • Plataforma de Gestão de Estoque Ambev
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="my-5 text-sm text-slate-300 space-y-2">
              <p>
                Foi interceptada uma falha temporária na renderização que evitou a tela branca. Seus dados e configurações permanecem protegidos.
              </p>
              {this.state.error && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-36">
                  {this.state.error.message || String(this.state.error)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer active:scale-98"
              >
                <Sparkles className="w-4 h-4" />
                <span>Restaurar Tela</span>
              </button>

              <button
                type="button"
                onClick={this.handleHardReload}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar</span>
              </button>

              <button
                type="button"
                onClick={this.handleCleanRecover}
                className="py-2.5 px-4 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-bold transition border border-rose-800/40 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                title="Limpar caches transitórios e reiniciar com dados higienizados"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Seguro</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
                Proteção ativa contra erros de runtime
              </span>
              <span>v5.2.0 • Ultra Rápida</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
