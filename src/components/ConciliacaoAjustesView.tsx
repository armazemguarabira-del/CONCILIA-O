import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Filter, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp,
  Download,
  Building2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Info,
  HelpCircle,
  Clock,
  ShieldCheck,
  Eye,
  FolderDown,
  Camera,
  Maximize2,
  PlusCircle
} from 'lucide-react';
import { 
  StockPositionItem, 
  DepositoId, 
  ProductMaster, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  ItemConciliacaoAjustada,
  ViewTab
} from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit, formatNumber } from '../utils/parsers';
import { calculateSkuDeviations } from '../utils/desviosUtils';
import { DEPOSITOS } from '../data/initialData';
import { ItemDesviosModal } from './ItemDesviosModal';
import { exportConciliacaoExcel } from '../utils/excelReconciliationExport';
import { RecontagemRankingsModal } from './RecontagemRankingsModal';
import { computeDashboardRankingItems } from '../utils/rankingUtils';

interface ConciliacaoAjustesViewProps {
  stockPositions: StockPositionItem[];
  quebras: QuebraItem[];
  vales: ValeItem[];
  trocas: TrocaItem[];
  faltasMapeadas: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  productsMap: Map<string, ProductMaster>;
  isRecountApplied: boolean;
  onNavigateTab: (tab: ViewTab) => void;
  onToggleSubTab?: (mode: 'padrao' | 'ajustes') => void;
  onOpenImportModal: (initialFile?: '020502' | '021101' | 'quebras' | 'vales' | 'trocas' | 'faltas') => void;
  onOpenSaveModal?: () => void;
  onOpenManualModal?: (type?: 'quebra' | 'vale' | 'troca' | 'falta') => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

type FilterStatusAjustado = 'ALL' | 'COM_DESVIOS' | 'FALTAS_RESIDUAIS' | 'SOBRAS_RESIDUAIS' | 'CONCILIADOS';

export const ConciliacaoAjustesView: React.FC<ConciliacaoAjustesViewProps> = ({
  stockPositions,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  selectedDeposito,
  setSelectedDeposito,
  productsMap,
  isRecountApplied,
  onNavigateTab,
  onToggleSubTab,
  onOpenImportModal,
  onOpenSaveModal,
  onOpenManualModal,
  weeklyBillingStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatusAjustado>('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'prejuizo' | 'sobra' | 'desvios' | 'produto' | 'descricao' | 'hl'>('prejuizo');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTooltipSku, setActiveTooltipSku] = useState<string | null>(null);
  const [selectedItemForOverview, setSelectedItemForOverview] = useState<ItemConciliacaoAjustada | null>(null);
  const [isRecontagemModalOpen, setIsRecontagemModalOpen] = useState(false);
  const [selectedRecountIds, setSelectedRecountIds] = useState<Set<string>>(new Set());

  const rankingItems = useMemo(() => {
    return computeDashboardRankingItems(
      stockPositions,
      quebras,
      vales,
      trocas,
      faltasMapeadas,
      'com_ajuste',
      selectedDeposito,
      weeklyBillingStatus
    );
  }, [stockPositions, quebras, vales, trocas, faltasMapeadas, selectedDeposito, weeklyBillingStatus]);

  const allRankingFaltas = useMemo(() => {
    return [...rankingItems]
      .filter(item => item.diferencaUnits < 0)
      .sort((a, b) => b.prejuizoFinanceiro - a.prejuizoFinanceiro);
  }, [rankingItems]);

  const allRankingSobras = useMemo(() => {
    return [...rankingItems]
      .filter(item => item.diferencaUnits > 0)
      .sort((a, b) => b.sobraFinanceira - a.sobraFinanceira);
  }, [rankingItems]);

  const handleToggleRecountId = (id: string) => {
    setSelectedRecountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 1. Build adjusted inventory items aggregating Quebras, Vales, Trocas and Faltas Mapeadas per SKU
  const adjustedItems = useMemo<ItemConciliacaoAjustada[]>(() => {
    return stockPositions.map(stockItem => {
      const dep = stockItem.deposito;
      const sku = String(stockItem.produto).trim();
      const fator = Math.max(1, stockItem.fatorSku || 1);

      // Cálculo unificado e coerente das origens dos desvios (Quebras em unidades, Trocas, Vales e Faltas)
      const dev = calculateSkuDeviations(
        sku,
        dep,
        fator,
        stockItem.valorUnitario,
        stockItem.valorCaixa,
        stockItem.fatorHl,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        weeklyBillingStatus
      );

      // Total de Desvios Congelados apurados
      const totalDesviosUnits = dev.total.units;
      const totalDesviosSkus = dev.total.skus;
      const desviosRaw = dev.total.raw;
      const valorDesvios = dev.total.valor;
      const hlDesvios = dev.total.volumeHl;

      // 3. Físico Apurado
      const fisicoUnits = stockItem.inventarioTotalUnits;
      const fisicoSkus = Math.floor(fisicoUnits / fator);
      const valorFisico = fisicoUnits * stockItem.valorUnitario;

      // 4. Disponível Final (Físico + Desvios Congelados)
      const finalTotalUnits = fisicoUnits + totalDesviosUnits;
      const finalSkus = Math.floor(finalTotalUnits / fator);
      const finalRaw = formatSkuUnit(finalTotalUnits, fator);
      const valorFinal = finalTotalUnits * stockItem.valorUnitario;

      // 5. Divergência entre Fiscal (02.05.02) e Soma do Físico com Desvios
      const fiscalUnits = stockItem.disponivelTotalUnits;
      const fiscalSkus = Math.floor(fiscalUnits / fator);
      const valorFiscal = fiscalUnits * stockItem.valorUnitario;

      let divergenciaUnits = finalTotalUnits - fiscalUnits;

      // Se saldo disponível original for negativo, zera como regra de negócio Ambev
      if (stockItem.saldoNegativoDesconsiderado || fiscalUnits < 0) {
        divergenciaUnits = 0;
      }

      const divergenciaSkus = divergenciaUnits / fator;
      const divergenciaRaw = formatSkuUnit(divergenciaUnits, fator);

      let statusAjustado: 'CONCILIADO' | 'FALTA_RESIDUAL' | 'SOBRA_RESIDUAL' = 'CONCILIADO';
      if (divergenciaUnits < 0) statusAjustado = 'FALTA_RESIDUAL';
      else if (divergenciaUnits > 0) statusAjustado = 'SOBRA_RESIDUAL';

      const impactoFinanceiroResidual = divergenciaUnits * stockItem.valorUnitario;
      const impactoHlResidual = (divergenciaUnits / fator) * stockItem.fatorHl;

      return {
        deposito: dep,
        produto: sku,
        descricao: stockItem.descricao,
        grupo: stockItem.grupo || 'GERAL',
        fatorSku: fator,
        fatorHl: stockItem.fatorHl,
        valorUnitario: stockItem.valorUnitario,
        valorCaixa: stockItem.valorCaixa,

        fiscalRaw: stockItem.disponivelRaw,
        fiscalSkus,
        fiscalUnits,
        fiscalTotalUnits: fiscalUnits,
        valorFiscal,

        desviosRaw,
        desviosSkus: totalDesviosSkus,
        desviosUnits: totalDesviosUnits,
        valorDesvios,
        hlDesvios,
        detalheDesvios: {
          quebrasSkus: dev.quebras.boxesInt,
          quebrasUnits: dev.quebras.units,
          quebrasValor: dev.quebras.valor,
          quebrasRaw: dev.quebras.raw,

          valesSkus: dev.vales.boxesInt,
          valesUnits: dev.vales.units,
          valesValor: dev.vales.valor,
          valesRaw: dev.vales.raw,

          trocasSkus: dev.trocas.boxesInt,
          trocasUnits: dev.trocas.units,
          trocasValor: dev.trocas.valor,
          trocasRaw: dev.trocas.raw,

          faltasSkus: dev.faltas.boxesInt,
          faltasUnits: dev.faltas.units,
          faltasValor: dev.faltas.valor,
          faltasRaw: dev.faltas.raw,
        },

        fisicoRaw: stockItem.inventarioRaw,
        fisicoSkus,
        fisicoUnits,
        fisicoTotalUnits: fisicoUnits,
        valorFisico,

        finalRaw,
        finalTotalUnits,
        finalSkus,
        valorFinal,

        divergenciaResidualUnits: divergenciaUnits,
        divergenciaResidualSkus: divergenciaSkus,
        divergenciaResidualRaw: divergenciaRaw,
        statusAjustado,

        impactoFinanceiroResidual,
        impactoHlResidual,
        recontado: stockItem.recontado,
      };
    });
  }, [stockPositions, quebras, vales, trocas, faltasMapeadas, selectedDeposito, weeklyBillingStatus]);

  // 2. Filter list
  const filteredList = useMemo(() => {
    return adjustedItems.filter(item => {
      // Deposito filter
      if (selectedDeposito !== 'ALL' && item.deposito !== selectedDeposito) {
        return false;
      }

      // Status filter
      if (statusFilter === 'COM_DESVIOS' && item.desviosUnits === 0) return false;
      if (statusFilter === 'FALTAS_RESIDUAIS' && item.statusAjustado !== 'FALTA_RESIDUAL') return false;
      if (statusFilter === 'SOBRAS_RESIDUAIS' && item.statusAjustado !== 'SOBRA_RESIDUAL') return false;
      if (statusFilter === 'CONCILIADOS' && item.statusAjustado !== 'CONCILIADO') return false;

      // Group filter
      if (groupFilter !== 'ALL' && item.grupo !== groupFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchSku = item.produto.toLowerCase().includes(term);
        const matchDesc = item.descricao.toLowerCase().includes(term);
        if (!matchSku && !matchDesc) return false;
      }

      return true;
    });
  }, [adjustedItems, selectedDeposito, statusFilter, groupFilter, searchTerm]);

  // 3. Sort list
  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let comp = 0;
      if (sortField === 'prejuizo') {
        // Most negative impact first
        comp = a.impactoFinanceiroResidual - b.impactoFinanceiroResidual;
      } else if (sortField === 'sobra') {
        // Most positive impact first
        comp = b.impactoFinanceiroResidual - a.impactoFinanceiroResidual;
      } else if (sortField === 'desvios') {
        comp = b.desviosUnits - a.desviosUnits;
      } else if (sortField === 'hl') {
        comp = Math.abs(b.impactoHlResidual) - Math.abs(a.impactoHlResidual);
      } else if (sortField === 'produto') {
        comp = parseInt(a.produto, 10) - parseInt(b.produto, 10);
      } else if (sortField === 'descricao') {
        comp = a.descricao.localeCompare(b.descricao);
      }
      return sortAsc ? -comp : comp;
    });
  }, [filteredList, sortField, sortAsc]);

  // 4. KPI Totals
  const kpis = useMemo(() => {
    let totalFiscalValor = 0;
    let totalFisicoValor = 0;
    let totalDesviosValor = 0;
    let totalFinalValor = 0;
    let totalPrejuizoResidual = 0;
    let totalSobraResidual = 0;
    let totalHlResidual = 0;
    let countConciliados = 0;
    let countFaltas = 0;
    let countSobras = 0;
    let countComDesvios = 0;

    let totalFiscalUnits = 0;
    let totalFinalUnits = 0;
    let totalDesviosUnits = 0;

    filteredList.forEach(item => {
      totalFiscalValor += item.valorFiscal;
      totalFisicoValor += item.valorFisico;
      totalDesviosValor += item.valorDesvios;
      totalFinalValor += item.valorFinal;

      totalFiscalUnits += item.fiscalTotalUnits;
      totalFinalUnits += item.finalTotalUnits;
      totalDesviosUnits += item.desviosUnits;

      if (item.desviosUnits > 0) countComDesvios++;

      if (item.statusAjustado === 'FALTA_RESIDUAL') {
        totalPrejuizoResidual += Math.abs(item.impactoFinanceiroResidual);
        countFaltas++;
      } else if (item.statusAjustado === 'SOBRA_RESIDUAL') {
        totalSobraResidual += item.impactoFinanceiroResidual;
        countSobras++;
      } else {
        countConciliados++;
      }

      totalHlResidual += item.impactoHlResidual;
    });

    const acuracidadeAjustada = totalFiscalUnits > 0 
      ? Math.min(100, (totalFinalUnits / totalFiscalUnits) * 100) 
      : 100;

    return {
      totalItens: filteredList.length,
      totalFiscalValor,
      totalFisicoValor,
      totalDesviosValor,
      totalDesviosUnits,
      totalFinalValor,
      totalPrejuizoResidual,
      totalSobraResidual,
      saldoLiquidoResidual: totalSobraResidual - totalPrejuizoResidual,
      totalHlResidual,
      countConciliados,
      countFaltas,
      countSobras,
      countComDesvios,
      acuracidadeAjustada,
    };
  }, [filteredList]);

  // Distinct groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    stockPositions.forEach(s => { if (s.grupo) set.add(s.grupo); });
    return Array.from(set).sort();
  }, [stockPositions]);

  // Exportação oficial em Excel com guia Sem Ajustes e Com Ajustes
  const handleExportExcel = async () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `Conciliacao_Estoque_Ambev_Com_Ajustes_Dep_${selectedDeposito}_${dateStr}_${timeStr}.xlsx`;

      await exportConciliacaoExcel({
        stockPositions,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        adjustedItems,
        selectedDeposito,
        filename
      });
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Ocorreu um erro ao gerar a planilha Excel da conciliação.');
    }
  };

  return (
    <div className="space-y-5 pb-8">

      {/* Seletor Unificado de Modo: Sem Ajustes vs Com Ajustes */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Visão:</span>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                if (onToggleSubTab) onToggleSubTab('padrao');
                else onNavigateTab('conciliacao');
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Sem Ajustes (Padrão 02.05.02 vs Físico)</span>
            </button>

            <button
              className="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-teal-600 text-white shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-teal-100" />
              <span>Com Ajustes (Físico + Desvios Equalizados)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Depósito Ativo:</span>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['ALL', '01', '02', '03', '05', '06', '31'] as const).map(dep => (
              <button
                key={dep}
                onClick={() => setSelectedDeposito(dep)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  selectedDeposito === dep
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dep === 'ALL' ? 'Todos' : dep === '31' ? '31 (PNC)' : dep}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-600" />
              Guia: Conciliação com Ajustes Equalizada
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              {kpis.totalItens} SKUs Analisados
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Conciliação do Fiscal (02.05.02) x Soma do Físico com Desvios Congelados
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1">
            Nesta visão com ajustes, somamos ao <strong>Inventário Físico</strong> todas as quantidades congeladas em <strong>Quebras</strong>, <strong>Vales de Rota</strong>, <strong>Trocas e Reposições</strong> e <strong>Faltas Mapeadas de Doca</strong>, obtendo a <strong>Quantidade Final Real</strong> e apurando a verdadeira <strong>Divergência Residual</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenManualModal && (
            <button
              onClick={() => onOpenManualModal('quebra')}
              className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              title="Inserir lançamento manual de Quebra, Vale, Troca ou Falta"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>+ Inserção Manual</span>
            </button>
          )}

          {onOpenSaveModal && (
            <button
              onClick={onOpenSaveModal}
              className="px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              title="Salvar e congelar conciliação do dia, calcular rankings de sobras/faltas e exportar Excel"
            >
              <FolderDown className="w-4 h-4 text-indigo-100" />
              <span>Salvar & Congelar Conciliação</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('congeladas')}
              className="px-3.5 py-2 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition flex items-center space-x-1.5"
              title="Visualizar Rankings de Sobras e Faltas (com e sem ajustes) e conciliações salvas"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Rankings & Congeladas</span>
            </button>
          )}

          <button
            onClick={() => setIsRecontagemModalOpen(true)}
            className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Maximizar Rankings Top 20 de Faltas/Sobras e Exportar Imagem de Recontagem"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Top 20 / Recontagem</span>
            {selectedRecountIds.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                {selectedRecountIds.size}
              </span>
            )}
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold shadow-xs transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            title="Exportar Planilha Excel com Guia Sem Ajustes e Com Ajustes (Código, Descrição, Qtd Fiscal, Qtd Física e Diferença)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Card 1: Fiscal Sistêmico */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            1. Quantidade Fiscal
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-1 truncate">
            {formatCurrency(kpis.totalFiscalValor)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Posição 02.05.02</span>
            <span className="font-mono text-slate-700 font-semibold">{formatNumber(kpis.totalFiscalValor > 0 ? (filteredList.reduce((acc, i) => acc + i.fiscalSkus, 0)) : 0, 0)} cx</span>
          </div>
        </div>

        {/* Card 2: Físico Contado */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            2. Físico Contado
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-700 font-mono mt-1 truncate">
            {formatCurrency(kpis.totalFisicoValor)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Inventário Físico</span>
            <span className="font-mono text-slate-700 font-semibold">{formatNumber(filteredList.reduce((acc, i) => acc + i.fisicoSkus, 0), 0)} cx</span>
          </div>
        </div>

        {/* Card 3: Desvios Congelados */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>3. (+) Desvios Congelados</span>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-1 rounded">{kpis.countComDesvios} SKUs</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-amber-700 font-mono mt-1 truncate">
            +{formatCurrency(kpis.totalDesviosValor)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
            <span>Quebras + Vales + Trocas + Doca</span>
            <span className="font-mono font-bold text-amber-800">+{formatNumber(filteredList.reduce((acc, i) => acc + i.desviosSkus, 0), 0)} cx</span>
          </div>
        </div>

        {/* Card 4: Físico + Desvios (Quantidade Final) */}
        <div className="bg-teal-50/60 border-2 border-teal-400 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
            4. (=) Físico + Desvios
          </div>
          <div className="text-base sm:text-lg font-bold text-teal-800 font-mono mt-1 truncate">
            {formatCurrency(kpis.totalFinalValor)}
          </div>
          <div className="text-[11px] text-teal-900 mt-1 flex justify-between font-semibold">
            <span>Estoque Total Apurado</span>
            <span className="font-mono">{formatNumber(filteredList.reduce((acc, i) => acc + i.finalSkus, 0), 0)} cx</span>
          </div>
        </div>

        {/* Card 5: Divergência Residual */}
        <div className={`border rounded-xl p-3.5 shadow-xs ${
          kpis.totalPrejuizoResidual > 0 
            ? 'bg-purple-50/60 border-purple-300' 
            : 'bg-emerald-50 border-emerald-300'
        }`}>
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>5. Divergência Residual</span>
            <span className="text-[10px] font-mono px-1 rounded bg-purple-100 text-purple-800">
              {kpis.countFaltas} com falta
            </span>
          </div>
          <div className={`text-base sm:text-lg font-bold font-mono mt-1 truncate ${
            kpis.totalPrejuizoResidual > 0 ? 'text-purple-900' : 'text-emerald-700'
          }`}>
            -{formatCurrency(kpis.totalPrejuizoResidual)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
            <span>Diferença Real em Aberto</span>
            <span className="font-mono font-bold text-purple-900">{formatHectoliters(kpis.totalHlResidual)}</span>
          </div>
        </div>

        {/* Card 6: Acuracidade Equalizada */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>6. Acuracidade Equalizada</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-700 font-mono mt-1 truncate">
            {formatNumber(kpis.acuracidadeAjustada, 1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Equalizados:</span>
            <span className="font-mono font-bold text-emerald-700">{kpis.countConciliados} SKUs</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Todos ({adjustedItems.length})
          </button>

          <button
            onClick={() => setStatusFilter('COM_DESVIOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              statusFilter === 'COM_DESVIOS'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
            }`}
          >
            <span>Com Desvios Congelados</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-mono">
              {adjustedItems.filter(i => i.desviosUnits > 0).length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('FALTAS_RESIDUAIS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              statusFilter === 'FALTAS_RESIDUAIS'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
          >
            <span>Faltas Residuais</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-900 font-mono">
              {adjustedItems.filter(i => i.statusAjustado === 'FALTA_RESIDUAL').length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('SOBRAS_RESIDUAIS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              statusFilter === 'SOBRAS_RESIDUAIS'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span>Sobras Residuais</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-mono">
              {adjustedItems.filter(i => i.statusAjustado === 'SOBRA_RESIDUAL').length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('CONCILIADOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
              statusFilter === 'CONCILIADOS'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            <span>100% Equalizados</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200 text-blue-900 font-mono">
              {adjustedItems.filter(i => i.statusAjustado === 'CONCILIADO').length}
            </span>
          </button>
        </div>

        {/* Search and Group dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Todos os Grupos</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar SKU ou Descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500 placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Main Table: Resumo com Ajustes */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 select-none">
                <th className="py-3 px-3 w-12 text-center">Dep.</th>
                <th 
                  onClick={() => {
                    if (sortField === 'produto') setSortAsc(!sortAsc);
                    else { setSortField('produto'); setSortAsc(false); }
                  }}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Código</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => {
                    if (sortField === 'descricao') setSortAsc(!sortAsc);
                    else { setSortField('descricao'); setSortAsc(false); }
                  }}
                  className="py-3 px-4 min-w-[260px] cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Descrição do Produto</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-right">
                  <span>Qtd Fiscal (02.05.02)</span>
                </th>
                <th 
                  onClick={() => {
                    if (sortField === 'desvios') setSortAsc(!sortAsc);
                    else { setSortField('desvios'); setSortAsc(false); }
                  }}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-amber-100/50 bg-amber-50/40 text-amber-800 transition"
                  title="Soma de Quebras + Vales + Trocas + Faltas Mapeadas em formato 01/00"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>(+) Desvios Congelados</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-600" />
                  </div>
                </th>
                <th className="py-3 px-3 text-right">
                  <span>Conciliação Física</span>
                </th>
                <th className="py-3 px-3 text-right bg-teal-50/40 text-teal-800 font-semibold" title="Soma do Físico com os Desvios Congelados">
                  <span>(=) Físico + Desvios</span>
                </th>
                <th 
                  onClick={() => {
                    if (sortField === 'prejuizo') setSortAsc(!sortAsc);
                    else { setSortField('prejuizo'); setSortAsc(false); }
                  }}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition"
                  title="Divergência entre o fiscal e a soma do físico com os desvios"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Divergência Residual</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-right">
                  <span>Valoração (R$)</span>
                </th>
                <th 
                  onClick={() => {
                    if (sortField === 'hl') setSortAsc(!sortAsc);
                    else { setSortField('hl'); setSortAsc(false); }
                  }}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Valoração (HL)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center w-24">Overview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum produto localizado com estes filtros</p>
                    <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou o depósito selecionado</p>
                  </td>
                </tr>
              ) : (
                sortedList.map(item => {
                  const hasDesvios = item.desviosUnits > 0;
                  const isFalta = item.statusAjustado === 'FALTA_RESIDUAL';
                  const isSobra = item.statusAjustado === 'SOBRA_RESIDUAL';
                  const isOk = item.statusAjustado === 'CONCILIADO';

                  return (
                    <tr 
                      key={`${item.deposito}-${item.produto}`}
                      onClick={() => setSelectedItemForOverview(item)}
                      className="hover:bg-teal-50/40 transition-colors cursor-pointer group"
                      title="Clique na linha para abrir o pop-up com o overview detalhado (Físico, Fiscal, Quebras, Vales, Trocas e Faltas)"
                    >
                      {/* Depósito */}
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600 bg-slate-50/50">
                        {item.deposito}
                      </td>

                      {/* Código SKU */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {item.produto}
                      </td>

                      {/* Descrição & Metadados */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 line-clamp-1" title={item.descricao}>
                          {item.descricao}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="bg-slate-100 px-1.5 py-0.2 rounded font-medium text-slate-600">
                            {item.grupo}
                          </span>
                          <span>• Fator: <strong>{item.fatorSku}</strong> un/cx</span>
                          <span>• Unit: <strong>{formatCurrency(item.valorUnitario)}</strong></span>
                        </div>
                      </td>

                      {/* Quantidade Fiscal (02.05.02) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-blue-700">
                          {item.fiscalRaw}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.fiscalTotalUnits.toLocaleString('pt-BR')} un
                        </div>
                      </td>

                      {/* Soma dos Desvios Congelados (01/00) */}
                      <td className={`py-3 px-3 text-right font-mono relative ${hasDesvios ? 'bg-amber-50/50' : ''}`}>
                        {hasDesvios ? (
                          <div 
                            className="cursor-pointer group inline-block"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemForOverview(item);
                            }}
                            title="Clique para abrir o pop-up com o overview completo das origens dos desvios"
                          >
                            <div className="font-bold text-amber-700 flex items-center justify-end space-x-1">
                              <span>+{item.desviosRaw}</span>
                              <Info className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100" />
                            </div>
                            <div className="text-[10px] text-amber-800 font-semibold">
                              +{formatCurrency(item.valorDesvios)}
                            </div>

                            {/* Breakdown badge tags */}
                            <div className="text-[9px] text-slate-500 mt-0.5 space-x-1">
                              {item.detalheDesvios.quebrasUnits > 0 && <span className="text-amber-700 font-medium" title={`Quebras: ${item.detalheDesvios.quebrasUnits} un (${item.detalheDesvios.quebrasRaw} cx) • ${formatCurrency(item.detalheDesvios.quebrasValor)}`}>Q:{item.detalheDesvios.quebrasRaw}</span>}
                              {item.detalheDesvios.valesUnits > 0 && <span className="text-yellow-800 font-medium" title={`Vales: ${item.detalheDesvios.valesUnits} un (${item.detalheDesvios.valesRaw} cx) • ${formatCurrency(item.detalheDesvios.valesValor)}`}>V:{item.detalheDesvios.valesRaw}</span>}
                              {item.detalheDesvios.trocasUnits > 0 && <span className="text-purple-700 font-medium" title={`Trocas: ${item.detalheDesvios.trocasUnits} un (${item.detalheDesvios.trocasRaw} cx) • ${formatCurrency(item.detalheDesvios.trocasValor)}`}>T:{item.detalheDesvios.trocasRaw}</span>}
                              {item.detalheDesvios.faltasUnits > 0 && <span className="text-rose-700 font-medium" title={`Faltas: ${item.detalheDesvios.faltasUnits} un (${item.detalheDesvios.faltasRaw} cx) • ${formatCurrency(item.detalheDesvios.faltasValor)}`}>F:{item.detalheDesvios.faltasRaw}</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            <span>0/00</span>
                            <div className="text-[10px] text-slate-400">Sem desvio</div>
                          </div>
                        )}
                      </td>

                      {/* Conciliação Física */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-slate-800">
                          {item.fisicoRaw}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.fisicoTotalUnits.toLocaleString('pt-BR')} un
                        </div>
                      </td>

                      {/* Disponível Final: Físico + Desvios */}
                      <td className="py-3 px-3 text-right font-mono bg-teal-50/30">
                        <div className="font-bold text-teal-800">
                          {item.finalRaw}
                        </div>
                        <div className="text-[10px] text-teal-700 font-medium">
                          {item.finalTotalUnits.toLocaleString('pt-BR')} un
                        </div>
                      </td>

                      {/* Divergência Residual (Fiscal vs Soma) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className={`font-bold ${
                          isFalta ? 'text-rose-600' : isSobra ? 'text-emerald-700' : 'text-slate-500'
                        }`}>
                          {item.divergenciaResidualRaw}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.divergenciaResidualUnits > 0 ? `+${item.divergenciaResidualUnits}` : item.divergenciaResidualUnits} un
                        </div>
                      </td>

                      {/* Valoração em Reais */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className={`font-bold ${
                          isFalta ? 'text-rose-600' : isSobra ? 'text-emerald-700' : 'text-slate-500'
                        }`}>
                          {isFalta ? `-${formatCurrency(Math.abs(item.impactoFinanceiroResidual))}` : isSobra ? `+${formatCurrency(item.impactoFinanceiroResidual)}` : 'R$ 0,00'}
                        </div>
                      </td>

                      {/* Valoração em Hectolitros */}
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-600">
                        {formatHectoliters(item.impactoHlResidual)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isOk && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                            ✓ CONCILIADO
                          </span>
                        )}
                        {isFalta && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
                            FALTA RESIDUAL
                          </span>
                        )}
                        {isSobra && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap">
                            SOBRA RESIDUAL
                          </span>
                        )}
                      </td>

                      {/* Overview Button */}
                      <td className="py-3 px-3 text-center" onClick={(e) => { e.stopPropagation(); setSelectedItemForOverview(item); }}>
                        <button
                          type="button"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 group-hover:bg-teal-600 group-hover:text-white text-slate-700 border border-slate-200 group-hover:border-teal-600 text-[11px] font-semibold shadow-2xs transition cursor-pointer"
                          title="Clique para ver o overview completo deste produto"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div>
            Exibindo <strong>{sortedList.length}</strong> de <strong>{adjustedItems.length}</strong> produtos cadastrados.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>Total Fiscal: <strong className="font-mono text-slate-800">{formatCurrency(kpis.totalFiscalValor)}</strong></span>
            <span>(+) Desvios: <strong className="font-mono text-amber-700">+{formatCurrency(kpis.totalDesviosValor)}</strong></span>
            <span>(=) Físico + Desvios: <strong className="font-mono text-teal-800">{formatCurrency(kpis.totalFinalValor)}</strong></span>
            <span>Residual Líquido: <strong className="font-mono text-rose-600">-{formatCurrency(kpis.totalPrejuizoResidual)}</strong></span>
          </div>
        </div>
      </div>

      {/* Pop-up Modal com Overview Completo das Origens e Quantidades */}
      <ItemDesviosModal
        item={selectedItemForOverview}
        isOpen={!!selectedItemForOverview}
        onClose={() => setSelectedItemForOverview(null)}
        quebras={quebras}
        vales={vales}
        trocas={trocas}
        faltasMapeadas={faltasMapeadas}
        selectedDeposito={selectedDeposito}
        onNavigateTab={onNavigateTab}
        weeklyBillingStatus={weeklyBillingStatus}
      />

      {/* Modal Maximizado de Recontagem / Impressão / Exportar Imagem */}
      <RecontagemRankingsModal
        isOpen={isRecontagemModalOpen}
        onClose={() => setIsRecontagemModalOpen(false)}
        allRankingFaltas={allRankingFaltas}
        allRankingSobras={allRankingSobras}
        selectedDeposito={selectedDeposito}
        rankingAdjustmentMode="com_ajuste"
        onSelectRecountItem={(id) => handleToggleRecountId(id)}
        selectedRecountIds={selectedRecountIds}
        stockPositions={stockPositions}
        quebras={quebras}
        vales={vales}
        trocas={trocas}
        faltasMapeadas={faltasMapeadas}
        weeklyBillingStatus={weeklyBillingStatus}
      />
    </div>
  );
};
