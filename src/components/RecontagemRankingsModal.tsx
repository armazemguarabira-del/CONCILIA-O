import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  Printer, 
  ImageDown, 
  CheckSquare, 
  Square, 
  CheckCheck, 
  Share2, 
  Copy, 
  Download, 
  Check, 
  X, 
  ArrowDownRight, 
  ArrowUpRight, 
  FileText, 
  Sparkles,
  ClipboardList,
  Layers,
  AlertCircle,
  Table2,
  FileSpreadsheet
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { DepositoId } from '../types';
import { DEPOSITOS } from '../data/initialData';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { computeDashboardRankingItems } from '../utils/rankingUtils';
import { RecontagemExportSheet, getDivergenciaSkuFechado } from './RecontagemExportSheet';

export interface DashboardRankingItem {
  id: string;
  produto: string;
  descricao: string;
  fatorSku: number;
  fatorHl: number;
  valorUnitario: number;
  deposito: DepositoId;
  fisicoUnits: number;
  fisicoRaw: string;
  totalDesviosSkus: number;
  totalDesviosUnits: number;
  desviosRaw: string;
  quebrasSkus: number;
  valesSkus: number;
  trocasSkus: number;
  faltasSkus: number;
  finalUnits: number;
  finalRaw: string;
  fiscalUnits: number;
  fiscalRaw: string;
  diferencaUnits: number;
  diferencaRaw: string;
  diferencaSkus?: number;
  prejuizoFinanceiro: number;
  sobraFinanceira: number;
  impactoHl: number;
}

export interface RecontagemRankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDeposito: DepositoId | 'ALL';
  rankingAdjustmentMode?: 'sem_ajuste' | 'com_ajuste';
  initialAdjustmentMode?: 'sem_ajuste' | 'com_ajuste';
  onToggleAdjustmentMode?: (mode: 'sem_ajuste' | 'com_ajuste') => void;
  allRankingFaltas: DashboardRankingItem[];
  allRankingSobras: DashboardRankingItem[];
  initialSelectedIds?: Set<string>;
  selectedRecountIds?: Set<string>;
  onSelectRecountItem?: (id: string) => void;
  onNavigateTab?: (tab: any) => void;
  stockPositions?: any[];
  quebras?: any[];
  vales?: any[];
  trocas?: any[];
  faltasMapeadas?: any[];
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const RecontagemRankingsModal: React.FC<RecontagemRankingsModalProps> = ({
  isOpen,
  onClose,
  selectedDeposito,
  rankingAdjustmentMode,
  initialAdjustmentMode,
  onToggleAdjustmentMode,
  allRankingFaltas,
  allRankingSobras,
  initialSelectedIds,
  selectedRecountIds,
  onSelectRecountItem,
  onNavigateTab,
  stockPositions,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  weeklyBillingStatus,
}) => {
  const [currentMode, setCurrentMode] = useState<'sem_ajuste' | 'com_ajuste'>(
    rankingAdjustmentMode || initialAdjustmentMode || 'sem_ajuste'
  );
  const [limit, setLimit] = useState<number | 'ALL'>(30);
  const [viewFormat, setViewFormat] = useState<'planilha' | 'cards'>('planilha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    selectedRecountIds || initialSelectedIds || new Set()
  );
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const recountCardRef = useRef<HTMLDivElement>(null);

  // Synchronize when external props change
  useEffect(() => {
    if (rankingAdjustmentMode) {
      setCurrentMode(rankingAdjustmentMode);
    }
  }, [rankingAdjustmentMode]);

  useEffect(() => {
    if (selectedRecountIds) {
      setSelectedIds(new Set(selectedRecountIds));
    }
  }, [selectedRecountIds]);

  const handleSetMode = (mode: 'sem_ajuste' | 'com_ajuste') => {
    setCurrentMode(mode);
    if (typeof onToggleAdjustmentMode === 'function') {
      onToggleAdjustmentMode(mode);
    }
  };

  // Recompute rankings dynamically if stockPositions is available and mode changes
  const { currentFaltas, currentSobras } = useMemo(() => {
    if (stockPositions && stockPositions.length > 0) {
      const items = computeDashboardRankingItems(
        stockPositions,
        quebras || [],
        vales || [],
        trocas || [],
        faltasMapeadas || [],
        currentMode,
        selectedDeposito,
        weeklyBillingStatus
      );
      const faltas = [...items]
        .filter(item => item.diferencaUnits < 0)
        .sort((a, b) => b.prejuizoFinanceiro - a.prejuizoFinanceiro);
      const sobras = [...items]
        .filter(item => item.diferencaUnits > 0)
        .sort((a, b) => b.sobraFinanceira - a.sobraFinanceira);
      return { currentFaltas: faltas, currentSobras: sobras };
    }

    return {
      currentFaltas: allRankingFaltas || [],
      currentSobras: allRankingSobras || []
    };
  }, [
    stockPositions,
    quebras,
    vales,
    trocas,
    faltasMapeadas,
    currentMode,
    selectedDeposito,
    weeklyBillingStatus,
    allRankingFaltas,
    allRankingSobras
  ]);

  // Filter and limit items
  const visibleFaltas = useMemo(() => {
    return limit === 'ALL' ? currentFaltas : currentFaltas.slice(0, limit);
  }, [currentFaltas, limit]);

  const visibleSobras = useMemo(() => {
    return limit === 'ALL' ? currentSobras : currentSobras.slice(0, limit);
  }, [currentSobras, limit]);

  const currentDepositoName = useMemo(() => {
    if (selectedDeposito === 'ALL') return 'Todos os Depósitos';
    const dep = DEPOSITOS.find(d => d.id === selectedDeposito);
    return dep ? `${dep.nome} (Depósito ${dep.id})` : `Depósito ${selectedDeposito}`;
  }, [selectedDeposito]);

  // Handle selection toggling
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (typeof onSelectRecountItem === 'function') {
      onSelectRecountItem(id);
    }
  };

  const handleSelectTopFaltas = (count: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentFaltas.slice(0, count).forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleSelectTopSobras = (count: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentSobras.slice(0, count).forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleSelectTopBoth = (count: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentFaltas.slice(0, count).forEach(item => next.add(item.id));
      currentSobras.slice(0, count).forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      visibleFaltas.forEach(f => next.add(f.id));
      visibleSobras.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Totais Gerais para cálculo rigoroso do percentual de impacto Pareto
  const totalGeralPrejuizoFaltas = useMemo(() => {
    return currentFaltas.reduce((acc, it) => acc + (it.prejuizoFinanceiro || 0), 0);
  }, [currentFaltas]);

  const totalGeralValorSobras = useMemo(() => {
    return currentSobras.reduce((acc, it) => acc + (it.sobraFinanceira || 0), 0);
  }, [currentSobras]);

  const totalGeralSkusFaltas = useMemo(() => {
    return currentFaltas.reduce((acc, it) => acc + getDivergenciaSkuFechado(it, false), 0);
  }, [currentFaltas]);

  const totalGeralSkusSobras = useMemo(() => {
    return currentSobras.reduce((acc, it) => acc + getDivergenciaSkuFechado(it, true), 0);
  }, [currentSobras]);

  const saldoFinalGeral = useMemo(() => {
    return totalGeralValorSobras - totalGeralPrejuizoFaltas;
  }, [totalGeralValorSobras, totalGeralPrejuizoFaltas]);

  const saldoFinalSkusGeral = useMemo(() => {
    return Math.abs(totalGeralSkusFaltas - totalGeralSkusSobras);
  }, [totalGeralSkusFaltas, totalGeralSkusSobras]);

  const getPercentualImpactoFalta = (prejuizo: number) => {
    if (!totalGeralPrejuizoFaltas || totalGeralPrejuizoFaltas <= 0) return '0,0%';
    const pct = (prejuizo / totalGeralPrejuizoFaltas) * 100;
    return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const getPercentualImpactoSobra = (sobra: number) => {
    if (!totalGeralValorSobras || totalGeralValorSobras <= 0) return '0,0%';
    const pct = (sobra / totalGeralValorSobras) * 100;
    return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  // Estilo exato da coluna PESO conforme a planilha de referência
  const getPesoStyle = (pct: number, isSobra = false) => {
    if (pct >= 10) return 'bg-[#f87171] text-black font-bold';
    if (pct >= 7) return 'bg-[#fb923c] text-black font-semibold';
    if (pct >= 5) return 'bg-[#fdba74] text-black font-medium';
    if (pct >= 4) return 'bg-[#fed7aa] text-black';
    if (pct >= 3) return 'bg-[#ffedd5] text-black';
    if (pct >= 2) return 'bg-[#fef08a] text-black';
    if (pct >= 1) return 'bg-[#fef9c3] text-black';
    if (isSobra && pct === 0) return 'bg-[#86efac] text-black';
    return 'bg-[#dcfce7] text-black';
  };

  // Itens para a exportação da imagem lado a lado (Faltas na esquerda, Sobras na direita)
  const exportFaltas = useMemo(() => {
    if (selectedIds.size > 0) {
      const selected = currentFaltas.filter(it => selectedIds.has(it.id));
      if (selected.length > 0) return selected;
    }
    return visibleFaltas;
  }, [selectedIds, currentFaltas, visibleFaltas]);

  const exportSobras = useMemo(() => {
    if (selectedIds.size > 0) {
      const selected = currentSobras.filter(it => selectedIds.has(it.id));
      if (selected.length > 0) return selected;
    }
    return visibleSobras;
  }, [selectedIds, currentSobras, visibleSobras]);

  const totalDisplayFaltas = useMemo(() => {
    return exportFaltas.reduce((acc, f) => acc + (f.prejuizoFinanceiro || 0), 0);
  }, [exportFaltas]);

  const totalDisplaySobras = useMemo(() => {
    return exportSobras.reduce((acc, s) => acc + (s.sobraFinanceira || 0), 0);
  }, [exportSobras]);

  const saldoFinalDisplay = useMemo(() => {
    return totalDisplaySobras - totalDisplayFaltas;
  }, [totalDisplaySobras, totalDisplayFaltas]);

  // Export Recontagem PNG Image safely using offscreen rendered element
  const handleExportRecontagemImage = async () => {
    if (!recountCardRef.current) return;
    setIsExportingImage(true);

    try {
      const element = recountCardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // High DPI for crisp text
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1680,
      });

      const imgData = canvas.toDataURL('image/png');
      setExportedImageUrl(imgData);

      // Auto trigger file download
      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.download = `ficha_recontagem_top_itens_${selectedDeposito}_${dateStr}.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem de recontagem:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Copy Image to Clipboard with safety
  const handleCopyImageToClipboard = async () => {
    if (!exportedImageUrl) return;
    try {
      const res = await fetch(exportedImageUrl);
      const blob = await res.blob();
      if (navigator && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } else {
        throw new Error('Clipboard write indisponível');
      }
    } catch (err) {
      console.warn('Falha ao copiar imagem diretamente:', err);
      setCopyNotice('A imagem já foi salva no seu computador! Abra o arquivo PNG baixado para copiar e colar no WhatsApp.');
      setTimeout(() => setCopyNotice(null), 6000);
    }
  };

  // Standard Print Trigger
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const totalImpactoFaltas = visibleFaltas.reduce((acc, f) => acc + f.prejuizoFinanceiro, 0);
  const totalImpactoSobras = visibleSobras.reduce((acc, s) => acc + s.sobraFinanceira, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static">
      
      {/* Container Principal Maximizado */}
      <div 
        ref={printAreaRef}
        className="w-full max-w-7xl bg-slate-50 border border-slate-300/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto print:border-none print:shadow-none print:my-0 print:w-full print:max-w-none print:rounded-none"
      >
        
        {/* Top Control Bar (Oculto na Impressão) */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-md">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Rankings de Divergências & Recontagem
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  {currentDepositoName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualização expandida até o Top 20+ com seleção de itens e ficha de recontagem para o armazém.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Alternador de Formato de Visualização */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewFormat('planilha')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  viewFormat === 'planilha'
                    ? 'bg-amber-400 text-black shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Formato exato de tabela/planilha com Faltas e Sobras lado a lado e resumo de Saldo Final à direita"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Planilha (Foto)</span>
              </button>
              <button
                onClick={() => setViewFormat('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  viewFormat === 'cards'
                    ? 'bg-slate-700 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em fichas individuais com linhas de anotação de recontagem física"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Fichas Detalhadas</span>
              </button>
            </div>

            {/* Seletor de Modo (Sem Ajuste / Com Ajuste) */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => handleSetMode('sem_ajuste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentMode === 'sem_ajuste'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sem Ajuste
              </button>
              <button
                onClick={() => handleSetMode('com_ajuste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  currentMode === 'com_ajuste'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Com Ajustes
              </button>
            </div>

            {/* Seletor de Profundidade */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 px-2">Itens:</span>
              {([10, 20, 30, 50, 'ALL'] as const).map((opt) => (
                <button
                  key={String(opt)}
                  onClick={() => setLimit(opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    limit === opt
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt === 'ALL' ? 'Todos' : `Top ${opt}`}
                </button>
              ))}
            </div>

            {/* Botão Exportar Imagem (PNG) */}
            <button
              onClick={handleExportRecontagemImage}
              disabled={isExportingImage}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Gera uma imagem exatamente no formato da foto com Faltas, Sobras e Saldo Final à direita (sem botões)"
            >
              <ImageDown className="w-4 h-4" />
              <span>{isExportingImage ? 'Gerando Imagem...' : 'Exportar Imagem (PNG)'}</span>
            </button>

            {/* Botão Imprimir / PDF */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              title="Imprimir visualização em tela ou salvar como PDF"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Imprimir</span>
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 border border-slate-700 transition cursor-pointer"
              title="Fechar tela maximizada"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Ações Rápidas de Seleção para Recontagem */}
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">
              {selectedIds.size === 0 ? (
                <span>Nenhum item marcado manualmente (a imagem incluirá todos os <strong>{visibleFaltas.length + visibleSobras.length} itens</strong> do Top {limit === 'ALL' ? 'Geral' : limit})</span>
              ) : (
                <span className="text-rose-700 font-bold">
                  {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'} para recontar
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Seleção Rápida:</span>
            <button
              onClick={() => handleSelectTopBoth(30)}
              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold transition cursor-pointer"
              title="Marca exatamente os 30 itens de Faltas e 30 de Sobras como no padrão da foto"
            >
              Top 30 Ambos (Padrão da Foto)
            </button>
            <button
              onClick={() => handleSelectTopFaltas(20)}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition cursor-pointer"
            >
              Top 20 Faltas
            </button>
            <button
              onClick={() => handleSelectTopFaltas(30)}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition cursor-pointer"
            >
              Top 30 Faltas
            </button>
            <button
              onClick={() => handleSelectTopSobras(20)}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition cursor-pointer"
            >
              Top 20 Sobras
            </button>
            <button
              onClick={() => handleSelectTopSobras(30)}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition cursor-pointer"
            >
              Top 30 Sobras
            </button>
            <button
              onClick={handleSelectAllVisible}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
            >
              Marcar Todos
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-800 font-semibold transition cursor-pointer ml-1"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Cabeçalho Oficial de Impressão (Aparece apenas na impressão) */}
        <div className="hidden print:block p-4 border-b border-slate-300 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 uppercase">
                Relatório de Divergências de Estoque (Top {limit === 'ALL' ? 'Geral' : limit})
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Depósito: <strong>{currentDepositoName}</strong> | Modo: <strong>{currentMode === 'com_ajuste' ? 'COM AJUSTES' : 'SEM AJUSTE (BRUTO)'}</strong> | Data de Emissão: <strong>{new Date().toLocaleString('pt-BR')}</strong>
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <div>Total Faltas: <strong>-{formatCurrency(totalGeralPrejuizoFaltas)}</strong></div>
              <div>Total Sobras: <strong>+{formatCurrency(totalGeralValorSobras)}</strong></div>
              <div>Saldo Final (Residual): <strong>{saldoFinalGeral < 0 ? '-' : '+'}{formatCurrency(Math.abs(saldoFinalGeral))}</strong></div>
            </div>
          </div>
        </div>

        {viewFormat === 'planilha' ? (
          <div className="overflow-y-auto max-h-[calc(100vh-180px)] print:max-h-none print:overflow-visible p-2 sm:p-4 bg-slate-100/50">
            <RecontagemExportSheet
              exportFaltas={exportFaltas}
              exportSobras={exportSobras}
              totalDisplayFaltas={totalDisplayFaltas}
              totalDisplaySobras={totalDisplaySobras}
              saldoFinalDisplay={saldoFinalDisplay}
              totalGeralPrejuizoFaltas={totalGeralPrejuizoFaltas}
              totalGeralValorSobras={totalGeralValorSobras}
              totalGeralSkusFaltas={totalGeralSkusFaltas}
              totalGeralSkusSobras={totalGeralSkusSobras}
              saldoFinalGeral={saldoFinalGeral}
              saldoFinalSkusGeral={saldoFinalSkusGeral}
              currentDepositoName={currentDepositoName}
              currentMode={currentMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              isExportTarget={false}
            />
          </div>
        ) : (
          /* Conteúdo das Duas Colunas Expandidas (Sem cortes de scroll) */
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(100vh-180px)] print:max-h-none print:overflow-visible print:p-2">
          
          {/* Coluna 1: Top Faltas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between print:border-slate-300">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold text-xs">
                    ↓
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Ranking de Faltas {limit === 'ALL' ? '(Todos os Itens)' : `(Top ${limit})`}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                        currentMode === 'com_ajuste'
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {currentMode === 'com_ajuste' ? 'COM AJUSTE' : 'SEM AJUSTE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {currentMode === 'com_ajuste'
                        ? 'Faltas residuais após equalização de desvios'
                        : 'Maior perda financeira identificada na conciliação física bruta'}
                    </p>
                  </div>
                </div>
                
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab(currentMode === 'com_ajuste' ? 'conciliacao_ajustes' : 'conciliacao');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold print:hidden"
                  >
                    Abrir na Tabela
                  </button>
                )}
              </div>

              {/* Lista Completa de Faltas (sem corte de 500px) */}
              <div className="mt-3 space-y-2">
                {visibleFaltas.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100 p-4">
                    Nenhuma falta registrada no depósito selecionado.
                  </div>
                ) : (
                  visibleFaltas.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleSelect(item.id)}
                        className={`p-2.5 rounded-lg border transition text-xs flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-rose-100/70 border-rose-300 shadow-2xs'
                            : 'bg-rose-50/40 hover:bg-rose-50/80 border-rose-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(item.id);
                            }}
                            className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer print:hidden"
                          />
                          <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate" title={item.descricao}>
                              {item.descricao}
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span>SKU: <strong className="text-slate-700">{item.produto}</strong></span>
                              <span>•</span>
                              <span>Fator: {item.fatorSku}</span>
                              <span>•</span>
                              <span className="text-rose-600 font-mono font-semibold">
                                {currentMode === 'com_ajuste' ? 'Falta Residual:' : 'Falta:'} -{item.diferencaRaw} cx
                              </span>
                            </div>
                            {currentMode === 'com_ajuste' && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded border border-rose-200/60 print:border-none">
                                <span>Físico: <strong>{item.fisicoRaw}</strong> cx</span>
                                <span>+</span>
                                <span className="text-teal-700">Desvios: <strong>+{item.desviosRaw}</strong> cx</span>
                                <span>=</span>
                                <span>Final: <strong>{item.finalRaw}</strong> cx</span>
                                <span className="text-slate-400">|</span>
                                <span>Fiscal: <strong>{item.fiscalRaw}</strong> cx</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-2 flex flex-col items-end justify-center">
                          <div className="inline-flex items-center gap-1 mb-1">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                              {getPercentualImpactoFalta(item.prejuizoFinanceiro)} das faltas
                            </span>
                          </div>
                          <div className="text-sm font-bold font-mono text-rose-600">
                            -{formatCurrency(item.prejuizoFinanceiro)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            -{formatHectoliters(Math.abs(item.impactoHl))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium">
              <div className="flex items-center space-x-2">
                <span>Impacto Acumulado no {limit === 'ALL' ? 'Total' : `Top ${limit}`}:</span>
                {totalGeralPrejuizoFaltas > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {((totalImpactoFaltas / totalGeralPrejuizoFaltas) * 100).toFixed(1)}% do prejuízo geral
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-rose-600 text-sm">
                -{formatCurrency(totalImpactoFaltas)}
              </span>
            </div>
          </div>

          {/* Coluna 2: Top Sobras */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between print:border-slate-300">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                    ↑
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Ranking de Sobras {limit === 'ALL' ? '(Todos os Itens)' : `(Top ${limit})`}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                        currentMode === 'com_ajuste'
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {currentMode === 'com_ajuste' ? 'COM AJUSTE' : 'SEM AJUSTE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {currentMode === 'com_ajuste'
                        ? 'Sobras físicas residuais após equalização de desvios'
                        : 'Produtos físicos excedentes em relação ao WMS'}
                    </p>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab(currentMode === 'com_ajuste' ? 'conciliacao_ajustes' : 'conciliacao');
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold print:hidden"
                  >
                    Abrir na Tabela
                  </button>
                )}
              </div>

              {/* Lista Completa de Sobras */}
              <div className="mt-3 space-y-2">
                {visibleSobras.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100 p-4">
                    Nenhuma sobra registrada no depósito selecionado.
                  </div>
                ) : (
                  visibleSobras.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleSelect(item.id)}
                        className={`p-2.5 rounded-lg border transition text-xs flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-100/70 border-emerald-300 shadow-2xs'
                            : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(item.id);
                            }}
                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer print:hidden"
                          />
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate" title={item.descricao}>
                              {item.descricao}
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span>SKU: <strong className="text-slate-700">{item.produto}</strong></span>
                              <span>•</span>
                              <span>Fator: {item.fatorSku}</span>
                              <span>•</span>
                              <span className="text-emerald-600 font-mono font-semibold">
                                {currentMode === 'com_ajuste' ? 'Sobra Residual:' : 'Sobra:'} +{item.diferencaRaw} cx
                              </span>
                            </div>
                            {currentMode === 'com_ajuste' && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded border border-emerald-200/60 print:border-none">
                                <span>Físico: <strong>{item.fisicoRaw}</strong> cx</span>
                                <span>+</span>
                                <span className="text-teal-700">Desvios: <strong>+{item.desviosRaw}</strong> cx</span>
                                <span>=</span>
                                <span>Final: <strong>{item.finalRaw}</strong> cx</span>
                                <span className="text-slate-400">|</span>
                                <span>Fiscal: <strong>{item.fiscalRaw}</strong> cx</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-2 flex flex-col items-end justify-center">
                          <div className="inline-flex items-center gap-1 mb-1">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                              {getPercentualImpactoSobra(item.sobraFinanceira)} das sobras
                            </span>
                          </div>
                          <div className="text-sm font-bold font-mono text-emerald-600">
                            +{formatCurrency(item.sobraFinanceira)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            +{formatHectoliters(item.impactoHl)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium">
              <div className="flex items-center space-x-2">
                <span>Valor Sobras Acumulado no {limit === 'ALL' ? 'Total' : `Top ${limit}`}:</span>
                {totalGeralValorSobras > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {((totalImpactoSobras / totalGeralValorSobras) * 100).toFixed(1)}% das sobras gerais
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                +{formatCurrency(totalImpactoSobras)}
              </span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ELEMENTO ESPECÍFICO RENDERIZADO PARA A IMAGEM PNG NO FORMATO DA FOTO      */}
      {/* (FALTAS, SOBRAS E SALDO FINAL LADO A LADO, SEM OS BOTÕES CONGELAR/SALVAR) */}
      {/* ========================================================================= */}
      <div
        ref={recountCardRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '1680px',
          backgroundColor: '#ffffff',
          zIndex: -999,
          pointerEvents: 'none'
        }}
      >
        <RecontagemExportSheet
          exportFaltas={exportFaltas}
          exportSobras={exportSobras}
          totalDisplayFaltas={totalDisplayFaltas}
          totalDisplaySobras={totalDisplaySobras}
          saldoFinalDisplay={saldoFinalDisplay}
          totalGeralPrejuizoFaltas={totalGeralPrejuizoFaltas}
          totalGeralValorSobras={totalGeralValorSobras}
          totalGeralSkusFaltas={totalGeralSkusFaltas}
          totalGeralSkusSobras={totalGeralSkusSobras}
          saldoFinalGeral={saldoFinalGeral}
          saldoFinalSkusGeral={saldoFinalSkusGeral}
          currentDepositoName={currentDepositoName}
          currentMode={currentMode}
          selectedIds={selectedIds}
          isExportTarget={true}
        />
      </div>

      {/* Modal de Prévia da Imagem Exportada */}
      {exportedImageUrl && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Imagem de Recontagem Gerada com Sucesso!
                </h3>
              </div>
              <button
                onClick={() => setExportedImageUrl(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              O download iniciou automaticamente. Você também pode copiar a imagem diretamente para colar no WhatsApp ou imprimir.
            </p>

            {copyNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{copyNotice}</span>
              </div>
            )}

            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-slate-50 p-2 flex justify-center">
              <img 
                src={exportedImageUrl} 
                alt="Ficha de Recontagem" 
                className="max-w-full h-auto shadow-md rounded border border-slate-300"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                {exportFaltas.length} faltas e {exportSobras.length} sobras na imagem lado a lado
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyImageToClipboard}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  {copySuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copySuccess ? 'Copiado para Área de Transferência!' : 'Copiar Imagem (p/ WhatsApp)'}</span>
                </button>

                <a
                  href={exportedImageUrl}
                  download={`ficha_recontagem_${Date.now()}.png`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Novamente</span>
                </a>

                <button
                  onClick={() => setExportedImageUrl(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
