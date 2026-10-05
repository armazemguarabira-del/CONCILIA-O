import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Scale, 
  Package, 
  Layers, 
  FileText, 
  Truck, 
  ArrowRight, 
  ShieldCheck, 
  ExternalLink,
  Info,
  Calendar,
  User,
  MapPin,
  ClipboardList
} from 'lucide-react';
import { 
  ItemConciliacaoAjustada, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId,
  ViewTab 
} from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit } from '../utils/parsers';
import { 
  isQuebraPendente, 
  isTrocaPendente, 
  isValePendente, 
  isFaltaPendente 
} from '../utils/desviosUtils';

interface ItemDesviosModalProps {
  item: ItemConciliacaoAjustada | null;
  isOpen: boolean;
  onClose: () => void;
  quebras: QuebraItem[];
  vales: ValeItem[];
  trocas: TrocaItem[];
  faltasMapeadas: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  onNavigateTab?: (tab: ViewTab) => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

type TabType = 'todos' | 'quebras' | 'trocas' | 'vales' | 'faltas';

export const ItemDesviosModal: React.FC<ItemDesviosModalProps> = ({
  item,
  isOpen,
  onClose,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  selectedDeposito,
  onNavigateTab,
  weeklyBillingStatus
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('todos');

  // Filtragem dos registros específicos das 4 guias para este produto
  const itemQuebras = useMemo(() => {
    if (!item) return [];
    const sku = String(item.produto).trim();
    return quebras.filter(q => 
      String(q.sku).trim() === sku && (selectedDeposito === 'ALL' || q.deposito === item.deposito)
    );
  }, [item, quebras, selectedDeposito]);

  const itemVales = useMemo(() => {
    if (!item) return [];
    const sku = String(item.produto).trim();
    return vales.filter(v => 
      String(v.codigo).trim() === sku && (selectedDeposito === 'ALL' || v.deposito === item.deposito)
    );
  }, [item, vales, selectedDeposito]);

  const itemTrocas = useMemo(() => {
    if (!item) return [];
    const sku = String(item.produto).trim();
    return trocas.filter(t => {
      const codes = (t.codigos || '').split(/[,;|\s]+/).map(c => c.trim()).filter(Boolean);
      return codes.includes(sku) && (selectedDeposito === 'ALL' || t.deposito === item.deposito);
    });
  }, [item, trocas, selectedDeposito]);

  const itemFaltas = useMemo(() => {
    if (!item) return [];
    const sku = String(item.produto).trim();
    return faltasMapeadas.filter(f => {
      const code = String(f.codigo || f.produto || '').trim();
      return code === sku && (selectedDeposito === 'ALL' || !f.deposito || f.deposito === item.deposito);
    });
  }, [item, faltasMapeadas, selectedDeposito]);

  if (!isOpen || !item) return null;

  const fator = Math.max(1, item.fatorSku || 1);
  const isFalta = item.statusAjustado === 'FALTA_RESIDUAL';
  const isSobra = item.statusAjustado === 'SOBRA_RESIDUAL';
  const isConciliado = item.statusAjustado === 'CONCILIADO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-start justify-between border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-mono font-bold">
                SKU {item.produto}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                Depósito {item.deposito}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-xs font-semibold">
                {item.grupo}
              </span>
              <span className="text-xs text-slate-400">
                Fator: <strong>{fator}</strong> un/cx • Unit: <strong>{formatCurrency(item.valorUnitario)}</strong>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
              {item.descricao}
            </h2>
            <p className="text-xs text-slate-400">
              Overview detalhado da composição do estoque: Físico, Fiscal e origens dos desvios congelados
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* EQUALIZATION EQUATION BANNER */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Equação de Equalização Física com Desvios Congelados</span>
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                isConciliado 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                  : isFalta 
                    ? 'bg-rose-50 text-rose-700 border-rose-300' 
                    : 'bg-teal-50 text-teal-700 border-teal-300'
              }`}>
                {isConciliado ? '✓ 100% Equalizado' : isFalta ? 'Falta Residual' : 'Sobra Residual'}
              </span>
            </div>

            {/* Grid with cards representing the equation */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {/* 1. Físico */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  1. Físico (02.11.01)
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-1">
                  {item.fisicoRaw} cx
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {item.fisicoTotalUnits.toLocaleString('pt-BR')} un
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  {formatCurrency(item.valorFisico)}
                </div>
              </div>

              {/* 2. Desvios */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                  (+) Desvios ({item.desviosSkus} cx)
                </div>
                <div className="text-base font-bold font-mono text-amber-700 mt-1">
                  +{item.desviosRaw} cx
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  +{item.desviosUnits.toLocaleString('pt-BR')} un
                </div>
                <div className="text-[10px] font-mono text-amber-700 mt-1">
                  +{formatCurrency(item.valorDesvios)}
                </div>
              </div>

              {/* 3. Físico + Desvios */}
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wide">
                  (=) Quantidade Final
                </div>
                <div className="text-base font-bold font-mono text-teal-700 mt-1">
                  {item.finalRaw} cx
                </div>
                <div className="text-[11px] text-teal-800 mt-0.5">
                  {item.finalTotalUnits.toLocaleString('pt-BR')} un
                </div>
                <div className="text-[10px] font-mono text-teal-700 mt-1">
                  {formatCurrency(item.valorFinal)}
                </div>
              </div>

              {/* 4. Fiscal */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                  vs Fiscal (02.05.02)
                </div>
                <div className="text-base font-bold font-mono text-blue-700 mt-1">
                  {item.fiscalRaw} cx
                </div>
                <div className="text-[11px] text-blue-800 mt-0.5">
                  {item.fiscalTotalUnits.toLocaleString('pt-BR')} un
                </div>
                <div className="text-[10px] font-mono text-blue-700 mt-1">
                  {formatCurrency(item.valorFiscal)}
                </div>
              </div>

              {/* 5. Divergência Residual */}
              <div className={`p-3 col-span-2 sm:col-span-1 rounded-xl border ${
                isConciliado 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : isFalta 
                    ? 'bg-rose-50 border-rose-200 text-rose-800' 
                    : 'bg-teal-50 border-teal-200 text-teal-800'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Divergência Residual
                </div>
                <div className={`text-base font-bold font-mono mt-1 ${
                  isConciliado ? 'text-emerald-700' : isFalta ? 'text-rose-600' : 'text-teal-700'
                }`}>
                  {isConciliado ? '0/00 cx' : `${item.divergenciaResidualRaw} cx`}
                </div>
                <div className="text-[11px] font-bold font-mono mt-0.5">
                  {isConciliado ? 'R$ 0,00' : (
                    isFalta 
                      ? `-${formatCurrency(Math.abs(item.impactoFinanceiroResidual))}` 
                      : `+${formatCurrency(item.impactoFinanceiroResidual)}`
                  )}
                </div>
                <div className="text-[10px] font-mono opacity-80 mt-1">
                  {formatHectoliters(item.impactoHlResidual)}
                </div>
              </div>
            </div>
          </div>

          {/* OVERVIEW: AS 4 ORIGENS DOS DESVIOS (QUEBRAS, TROCAS, VALES, FALTAS) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Origens dos Desvios Congelados (+{item.desviosRaw} cx / {item.desviosUnits} un)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Veja exatamente de onde estão sendo puxadas as quantidades que amortizam o estoque físico
                </p>
              </div>

              {/* Filter Tabs between the 4 deviation types */}
              <div className="flex items-center p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('todos')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas as Guias
                </button>
                <button
                  onClick={() => setActiveTab('quebras')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                    activeTab === 'quebras' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Quebras</span>
                  <span className="text-[10px] px-1 bg-amber-700/50 rounded font-mono">
                    {item.detalheDesvios.quebrasRaw}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('trocas')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                    activeTab === 'trocas' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Trocas</span>
                  <span className="text-[10px] px-1 bg-purple-700/50 rounded font-mono">
                    {item.detalheDesvios.trocasRaw}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('vales')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                    activeTab === 'vales' ? 'bg-yellow-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Vales</span>
                  <span className="text-[10px] px-1 bg-yellow-700/50 rounded font-mono">
                    {item.detalheDesvios.valesRaw}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('faltas')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                    activeTab === 'faltas' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Faltas Doca</span>
                  <span className="text-[10px] px-1 bg-rose-700/50 rounded font-mono">
                    {item.detalheDesvios.faltasRaw}
                  </span>
                </button>
              </div>
            </div>

            {/* Deviation Breakdown Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {/* 1. Quebras */}
              <div 
                onClick={() => setActiveTab('quebras')}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  activeTab === 'quebras' 
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20' 
                    : 'bg-white border-slate-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">1. Quebras Internas</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    {itemQuebras.length} reg.
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                  +{item.detalheDesvios.quebrasRaw} cx
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.detalheDesvios.quebrasUnits} un • {formatCurrency(item.detalheDesvios.quebrasValor)}
                </div>
              </div>

              {/* 2. Trocas e Reposições */}
              <div 
                onClick={() => setActiveTab('trocas')}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  activeTab === 'trocas' 
                    ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/20' 
                    : 'bg-white border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-800">2. Trocas & Reposições</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                    {itemTrocas.length} reg.
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-purple-700 mt-1">
                  +{item.detalheDesvios.trocasRaw} cx
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.detalheDesvios.trocasUnits} un • {formatCurrency(item.detalheDesvios.trocasValor)}
                </div>
              </div>

              {/* 3. Vales de Rota */}
              <div 
                onClick={() => setActiveTab('vales')}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  activeTab === 'vales' 
                    ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400/20' 
                    : 'bg-white border-slate-200 hover:border-yellow-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-yellow-800">3. Vales de Rota</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold">
                    {itemVales.length} reg.
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-yellow-700 mt-1">
                  +{item.detalheDesvios.valesRaw} cx
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.detalheDesvios.valesUnits} un • {formatCurrency(item.detalheDesvios.valesValor)}
                </div>
              </div>

              {/* 4. Faltas Mapeadas */}
              <div 
                onClick={() => setActiveTab('faltas')}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  activeTab === 'faltas' 
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20' 
                    : 'bg-white border-slate-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800">4. Faltas Mapeadas (Doca)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    {itemFaltas.length} reg.
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-rose-700 mt-1">
                  +{item.detalheDesvios.faltasRaw} cx
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.detalheDesvios.faltasUnits} un • {formatCurrency(item.detalheDesvios.faltasValor)}
                </div>
              </div>
            </div>

            {/* DETAILED LISTS OF ITEMS FROM THE SELECTED TAB */}
            <div className="space-y-4">
              {/* SECTION: QUEBRAS */}
              {(activeTab === 'todos' || activeTab === 'quebras') && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-amber-50/80 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold text-amber-900">
                        Lançamentos na Guia de Quebras ({itemQuebras.length} itens • Total: +{item.detalheDesvios.quebrasRaw} cx / {item.detalheDesvios.quebrasUnits} un)
                      </h4>
                    </div>
                    {onNavigateTab && (
                      <button
                        onClick={() => { onClose(); onNavigateTab('quebras'); }}
                        className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Abrir Guia de Quebras</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {itemQuebras.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhuma quebra registrada para o SKU {item.produto} neste depósito.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Área / Turno</th>
                            <th className="py-2 px-3">Motivo / Causa</th>
                            <th className="py-2 px-3">Colaborador</th>
                            <th className="py-2 px-3 text-center">Impacto no Estoque</th>
                            <th className="py-2 px-3 text-right">Qtd (un)</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemQuebras.map(q => {
                            const isPendente = isQuebraPendente(q, weeklyBillingStatus);
                            return (
                              <tr key={q.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono text-slate-600">{q.data || '-'}</td>
                                <td className="py-2 px-3">{q.area} • {q.turno}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">{q.motivo || q.codQuebra}</td>
                                <td className="py-2 px-3 text-slate-600">{q.colaborador || '-'}</td>
                                <td className="py-2 px-3 text-center">
                                  {isPendente ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Amortiza Divergência
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      Faturado (Já Baixado)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">+{q.quantidade} un</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{formatCurrency(q.valorTotal || (q.quantidade * item.valorUnitario))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: TROCAS & REPOSIÇÕES */}
              {(activeTab === 'todos' || activeTab === 'trocas') && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-purple-50/80 px-4 py-2.5 border-b border-purple-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <h4 className="text-xs font-bold text-purple-900">
                        Lançamentos na Guia de Trocas & Reposições ({itemTrocas.length} itens • Total: +{item.detalheDesvios.trocasRaw} cx / {item.detalheDesvios.trocasUnits} un)
                      </h4>
                    </div>
                    {onNavigateTab && (
                      <button
                        onClick={() => { onClose(); onNavigateTab('trocas'); }}
                        className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Abrir Guia de Trocas</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {itemTrocas.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhuma troca ou reposição registrada para o SKU {item.produto}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Rota / Setor</th>
                            <th className="py-2 px-3">Cliente / Motorista</th>
                            <th className="py-2 px-3">Tipo / Motivo</th>
                            <th className="py-2 px-3">Nota Fiscal</th>
                            <th className="py-2 px-3 text-center">Impacto no Estoque</th>
                            <th className="py-2 px-3 text-right">Qtd</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemTrocas.map(t => {
                            const isBox = ['CX', 'CAIXA', 'CAIXAS', 'SKU', 'SKUS', 'FD', 'FARDO'].includes(String(t.unidadeMedida || '').trim().toUpperCase());
                            const precoRef = isBox ? item.valorCaixa : item.valorUnitario;
                            const isPendente = isTrocaPendente(t, weeklyBillingStatus);
                            return (
                              <tr key={t.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono text-slate-600">{t.data || '-'}</td>
                                <td className="py-2 px-3 font-mono">{t.setorRota || '-'}</td>
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-800">{t.cliente || '-'}</div>
                                  <div className="text-[10px] text-slate-500">Motorista: {t.motorista || '-'}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-medium text-slate-700">{t.tipoProcesso}</span>
                                  <div className="text-[10px] text-slate-500">{t.motivoDeclarado || '-'}</div>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">{t.notaFiscal || '-'}</td>
                                <td className="py-2 px-3 text-center">
                                  {isPendente ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Amortiza Divergência
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      Baixado (Já Liquidado)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">+{t.quantidade} {t.unidadeMedida || 'und'}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{formatCurrency(t.valorTotal || (t.quantidade * precoRef))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: VALES DE ROTA */}
              {(activeTab === 'todos' || activeTab === 'vales') && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-yellow-50/80 px-4 py-2.5 border-b border-yellow-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <h4 className="text-xs font-bold text-yellow-900">
                        Lançamentos na Guia de Vales de Rota ({itemVales.length} itens • Total: +{item.detalheDesvios.valesRaw} cx / {item.detalheDesvios.valesUnits} un)
                      </h4>
                    </div>
                    {onNavigateTab && (
                      <button
                        onClick={() => { onClose(); onNavigateTab('vales'); }}
                        className="text-xs text-yellow-700 hover:text-yellow-900 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Abrir Guia de Vales</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {itemVales.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum vale emitido para o SKU {item.produto}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Rota / Setor</th>
                            <th className="py-2 px-3">Motorista / Equipe</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-center">Impacto no Estoque</th>
                            <th className="py-2 px-3">Nota / Mapa</th>
                            <th className="py-2 px-3 text-right">Qtd (cx)</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemVales.map(v => {
                            const isPendente = isValePendente(v, weeklyBillingStatus);
                            return (
                              <tr key={v.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono text-slate-600">{v.data || '-'}</td>
                                <td className="py-2 px-3 font-mono">{v.rotaSetor || '-'}</td>
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-800">{v.motorista || '-'}</div>
                                  <div className="text-[10px] text-slate-500">{v.equipeCompleta || '-'}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold text-[10px]">
                                    {v.statusVale || 'Pendente'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isPendente ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Amortiza Divergência
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      Baixado (Já Liquidado)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600">{v.notaFiscal || v.mapa || '-'}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-yellow-700">+{v.quantidade} cx</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{formatCurrency(v.valorTotal || (v.quantidade * item.valorCaixa))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: FALTAS MAPEADAS NA DOCA */}
              {(activeTab === 'todos' || activeTab === 'faltas') && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-rose-50/80 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <h4 className="text-xs font-bold text-rose-900">
                        Lançamentos na Guia de Faltas Mapeadas (Doca) ({itemFaltas.length} itens • Total: +{item.detalheDesvios.faltasRaw} cx / {item.detalheDesvios.faltasUnits} un)
                      </h4>
                    </div>
                    {onNavigateTab && (
                      <button
                        onClick={() => { onClose(); onNavigateTab('faltas'); }}
                        className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Abrir Guia de Faltas</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {itemFaltas.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhuma falta mapeada na doca para o SKU {item.produto}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Responsável</th>
                            <th className="py-2 px-3">Justificativa / Motivo</th>
                            <th className="py-2 px-3">Origem</th>
                            <th className="py-2 px-3 text-center">Impacto no Estoque</th>
                            <th className="py-2 px-3 text-right">Qtd (cx)</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemFaltas.map(f => {
                            const qtd = f.quantidade || f.quantidadeSkus || 0;
                            const isPendente = isFaltaPendente(f, weeklyBillingStatus);
                            return (
                              <tr key={f.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono text-slate-600">{f.data || '-'}</td>
                                <td className="py-2 px-3 text-slate-700">{f.responsavel || '-'}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {f.observacao || f.motivo || 'Falta física identificada no carregamento'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
                                    {f.origem || 'DOCA'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isPendente ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Amortiza Divergência
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      Baixado (Já Liquidado)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">+{qtd} cx</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">{formatCurrency(f.valorTotal || (qtd * item.valorCaixa))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
            <span>
              A soma de todos os desvios congela e equaliza os desvios operacionais com a contagem física do depósito.
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Fechar Overview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
