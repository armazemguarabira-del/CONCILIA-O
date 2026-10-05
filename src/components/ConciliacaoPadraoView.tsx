import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp,
  Download,
  Sparkles,
  Edit3,
  Check,
  X,
  FolderDown,
  Camera,
  Maximize2
} from 'lucide-react';
import { StockPositionItem, DepositoId, ProductMaster, QuebraItem, ValeItem, TrocaItem, FaltaMapeadaItem, ViewTab } from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit, parseSkuUnitFormat } from '../utils/parsers';
import { DEPOSITOS } from '../data/initialData';
import { exportConciliacaoExcel } from '../utils/excelReconciliationExport';
import { RecontagemRankingsModal } from './RecontagemRankingsModal';
import { computeDashboardRankingItems } from '../utils/rankingUtils';

export interface ConciliacaoPadraoViewProps {
  stockPositions: StockPositionItem[];
  setStockPositions: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  onOpenImportModal: (initialFile?: '020502' | '021101' | 'cadastro' | 'quebras' | 'vales' | 'trocas' | 'faltas') => void;
  onClearStockPositions?: () => void;
  productsMap: Map<string, ProductMaster>;
  isRecountApplied: boolean;
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  subTab: 'padrao' | 'ajustes';
  onToggleSubTab: (tab: 'padrao' | 'ajustes') => void;
  onNavigateTab?: (tab: ViewTab) => void;
  onOpenSaveModal?: () => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

type FilterDivergence = 'ALL' | 'DIVERGENT' | 'FALTAS' | 'SOBRAS' | 'OK' | 'RECOUNTED';

export const ConciliacaoPadraoView: React.FC<ConciliacaoPadraoViewProps> = ({
  stockPositions,
  setStockPositions,
  selectedDeposito,
  setSelectedDeposito,
  onOpenImportModal,
  productsMap,
  isRecountApplied,
  quebras = [],
  vales = [],
  trocas = [],
  faltasMapeadas = [],
  subTab,
  onToggleSubTab,
  onNavigateTab,
  onOpenSaveModal,
  weeklyBillingStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [divergenceFilter, setDivergenceFilter] = useState<FilterDivergence>('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'prejuizo' | 'sobra' | 'hl' | 'produto' | 'descricao'>('prejuizo');
  const [sortAsc, setSortAsc] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSkuInput, setEditSkuInput] = useState('');
  const [isRecontagemModalOpen, setIsRecontagemModalOpen] = useState(false);
  const [selectedRecountIds, setSelectedRecountIds] = useState<Set<string>>(new Set());

  const rankingItems = useMemo(() => {
    return computeDashboardRankingItems(
      stockPositions,
      quebras,
      vales,
      trocas,
      faltasMapeadas,
      'sem_ajuste',
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

  // Filter stock
  const filteredStock = useMemo(() => {
    return stockPositions.filter(item => {
      // Deposito filter
      if (selectedDeposito !== 'ALL' && item.deposito !== selectedDeposito) {
        return false;
      }
      // Divergence filter
      if (divergenceFilter === 'DIVERGENT' && item.status === 'OK') return false;
      if (divergenceFilter === 'FALTAS' && item.status !== 'FALTA') return false;
      if (divergenceFilter === 'SOBRAS' && item.status !== 'SOBRA') return false;
      if (divergenceFilter === 'OK' && item.status !== 'OK') return false;
      if (divergenceFilter === 'RECOUNTED' && !item.recontado) return false;

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
  }, [stockPositions, selectedDeposito, divergenceFilter, groupFilter, searchTerm]);

  // Sort stock
  const sortedStock = useMemo(() => {
    return [...filteredStock].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'prejuizo') {
        comparison = b.prejuizoFinanceiro - a.prejuizoFinanceiro;
      } else if (sortField === 'sobra') {
        comparison = b.sobraFinanceira - a.sobraFinanceira;
      } else if (sortField === 'hl') {
        comparison = Math.abs(b.impactoHl) - Math.abs(a.impactoHl);
      } else if (sortField === 'produto') {
        comparison = parseInt(a.produto, 10) - parseInt(b.produto, 10);
      } else if (sortField === 'descricao') {
        comparison = a.descricao.localeCompare(b.descricao);
      }
      return sortAsc ? -comparison : comparison;
    });
  }, [filteredStock, sortField, sortAsc]);

  // Distinct groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    stockPositions.forEach(s => {
      if (s.grupo) set.add(s.grupo);
    });
    return Array.from(set).sort();
  }, [stockPositions]);

  // Live KPI Summary for current filter
  const summary = useMemo(() => {
    let totalDispSkus = 0;
    let totalInvSkus = 0;
    let totalDispUnits = 0;
    let totalInvUnits = 0;
    let totalPrejuizo = 0;
    let totalSobra = 0;
    let totalHl = 0;
    let countFaltas = 0;
    let countSobras = 0;
    let countOk = 0;
    let valorTotalEstoqueFisico = 0;
    let valorTotalEstoqueDisponivel = 0;

    filteredStock.forEach(item => {
      const dispSkus = Math.floor(item.disponivelTotalUnits / (item.fatorSku || 1));
      const invSkus = Math.floor(item.inventarioTotalUnits / (item.fatorSku || 1));
      totalDispSkus += dispSkus;
      totalInvSkus += invSkus;
      totalDispUnits += item.disponivelTotalUnits;
      totalInvUnits += item.inventarioTotalUnits;

      // Valoração total
      valorTotalEstoqueFisico += item.inventarioTotalUnits * item.valorUnitario;
      valorTotalEstoqueDisponivel += item.disponivelTotalUnits * item.valorUnitario;

      if (item.status === 'FALTA') {
        totalPrejuizo += item.prejuizoFinanceiro;
        countFaltas++;
      } else if (item.status === 'SOBRA') {
        totalSobra += item.sobraFinanceira;
        countSobras++;
      } else {
        countOk++;
      }
      totalHl += item.impactoHl;
    });

    return {
      totalDispSkus,
      totalInvSkus,
      totalDispUnits,
      totalInvUnits,
      valorTotalEstoqueFisico,
      valorTotalEstoqueDisponivel,
      totalPrejuizo,
      totalSobra,
      saldoLiquido: totalSobra - totalPrejuizo,
      totalHl,
      countFaltas,
      countSobras,
      countOk,
      totalItems: filteredStock.length,
    };
  }, [filteredStock]);

  const handleStartEdit = (item: StockPositionItem) => {
    setEditingItemId(item.id);
    setEditSkuInput(item.inventarioRaw);
  };

  const handleSaveEdit = (item: StockPositionItem) => {
    const parsed = parseSkuUnitFormat(editSkuInput, item.fatorSku);
    const newTotalUnits = parsed.totalUnits;
    const newSkus = parsed.skus;
    const newLoose = parsed.looseUnits;
    const newRaw = formatSkuUnit(newTotalUnits, item.fatorSku);

    const isSaldoNegativo = item.disponivelTotalUnits < 0;

    let difUnits = newTotalUnits - item.disponivelTotalUnits;
    let difSkus = difUnits / item.fatorSku;
    let difRaw = formatSkuUnit(difUnits, item.fatorSku);
    let status: 'OK' | 'SOBRA' | 'FALTA' = 
      difUnits === 0 ? 'OK' : difUnits > 0 ? 'SOBRA' : 'FALTA';

    let impactoFinanceiro = difUnits * item.valorUnitario;
    let prejuizoFinanceiro = difUnits < 0 ? Math.abs(difUnits * item.valorUnitario) : 0;
    let sobraFinanceira = difUnits > 0 ? difUnits * item.valorUnitario : 0;
    let impactoHl = (difUnits / item.fatorSku) * item.fatorHl;

    // Regra de Negócio: se o saldo estiver negativo do disponível não conte, deixe zerado as diferenças
    if (isSaldoNegativo) {
      difUnits = 0;
      difSkus = 0;
      difRaw = '0';
      status = 'OK';
      impactoFinanceiro = 0;
      prejuizoFinanceiro = 0;
      sobraFinanceira = 0;
      impactoHl = 0;
    }

    setStockPositions(prev => prev.map(p => {
      if (p.id !== item.id) return p;
      return {
        ...p,
        inventarioRaw: newRaw,
        inventarioSkus: newSkus,
        inventarioLooseUnits: newLoose,
        inventarioTotalUnits: newTotalUnits,
        diferencaTotalUnits: difUnits,
        diferencaSkus: difSkus,
        diferencaRaw: difRaw,
        status,
        impactoFinanceiro,
        prejuizoFinanceiro,
        sobraFinanceira,
        impactoHl,
        recontado: true,
        saldoNegativoDesconsiderado: isSaldoNegativo,
      };
    }));

    setEditingItemId(null);
  };

  const handleExportExcel = async () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `Conciliacao_Estoque_Ambev_Dep_${selectedDeposito}_${dateStr}_${timeStr}.xlsx`;

      await exportConciliacaoExcel({
        stockPositions,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        selectedDeposito,
        filename
      });
    } catch (err) {
      console.error('Erro ao exportar planilha Excel:', err);
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
              onClick={() => onToggleSubTab('padrao')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                subTab === 'padrao'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Sem Ajustes (Padrão 02.05.02 vs Físico)</span>
            </button>

            <button
              onClick={() => onToggleSubTab('ajustes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                subTab === 'ajustes'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Com Ajustes (Físico + Desvios Equalizados)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Depósito:</span>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['ALL', '01', '02', '03', '05', '06', '31'] as const).map(dep => (
              <button
                key={dep}
                onClick={() => setSelectedDeposito(dep)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  selectedDeposito === dep
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dep === 'ALL' ? 'Todos' : dep === '31' ? '31 (PNC)' : dep}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Banner & File Upload CTA */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Guia de Conciliação Multi-Depósito
            </span>
            {isRecountApplied && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Base de Recontagem 02.11.01 Aplicada
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Conciliação do Disponível (02.05.02) x Inventário Físico
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Identifique as diferenças de estoque calculando automaticamente o impacto financeiro (R$) e em hectolitros (HL) com base no Fator SKU (<code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 font-mono">5/02 = 5 caixas + 2 un</code>). Saldos com disponível negativo têm a divergência zerada automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSaveModal && (
            <button
              onClick={onOpenSaveModal}
              className="px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              title="Salvar a conciliação do dia, calcular rankings de sobras e faltas e exportar Excel"
            >
              <FolderDown className="w-4 h-4 text-indigo-100" />
              <span>Salvar & Congelar Conciliação</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('congeladas')}
              className="px-3.5 py-2 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
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
            <span>Ficha de Recontagem (Top 20)</span>
            {selectedRecountIds.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                {selectedRecountIds.size}
              </span>
            )}
          </button>

          <button
            onClick={() => onOpenImportModal('020502')}
            className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
            title="Importar novo arquivo 02.05.02 para atualizar posição de estoque"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar 02.05.02 (Posição)</span>
          </button>

          <button
            onClick={() => onOpenImportModal('021101')}
            className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            title="Atualizar itens recontados com a base 02.11.01"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Importar 02.11.01 (Recontagem)</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 border border-emerald-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Exportar Planilha Excel Oficial (Guia Sem Ajustes e Com Ajustes)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Live Financial & Volume Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">Itens Filtrados</span>
          <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
            {summary.totalItems} <span className="text-xs text-slate-400 font-normal">produtos</span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-emerald-700 font-semibold">Valor Físico Inventariado</span>
          <div className="text-base font-bold font-mono text-emerald-800 mt-0.5 truncate" title={formatCurrency(summary.valorTotalEstoqueFisico)}>
            {formatCurrency(summary.valorTotalEstoqueFisico)}
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-blue-50/20 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-blue-700 font-semibold">Sistêmico (02.05.02)</span>
          <div className="text-base font-bold font-mono text-blue-800 mt-0.5 truncate" title={formatCurrency(summary.valorTotalEstoqueDisponivel)}>
            {formatCurrency(summary.valorTotalEstoqueDisponivel)}
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-rose-600 font-medium">Prejuízo Bruto (Faltas)</span>
          <div className="text-lg font-bold font-mono text-rose-600 mt-0.5">
            -{formatCurrency(summary.totalPrejuizo)}
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-emerald-600 font-medium">Sobras Físicas</span>
          <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
            +{formatCurrency(summary.totalSobra)}
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-amber-700 font-medium">Volume Diferença</span>
          <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
            {formatHectoliters(Math.abs(summary.totalHl))}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código de SKU ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>

          {/* Depósito Quick Toggle */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedDeposito('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                selectedDeposito === 'ALL'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            {DEPOSITOS.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDeposito(d.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedDeposito === d.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d.nome.replace('Depósito ', 'Dep. ')}
              </button>
            ))}
          </div>
        </div>

        {/* Divergence Status Filter Tabs & Sorting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-200 pt-3 gap-2">
          
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setDivergenceFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                divergenceFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({stockPositions.length})
            </button>

            <button
              onClick={() => setDivergenceFilter('DIVERGENT')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition cursor-pointer ${
                divergenceFilter === 'DIVERGENT'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-amber-600" />
              <span>Divergências</span>
            </button>

            <button
              onClick={() => setDivergenceFilter('FALTAS')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition cursor-pointer ${
                divergenceFilter === 'FALTAS'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <TrendingDown className="w-3 h-3 text-rose-600" />
              <span>Apenas Faltas (Prejuízo)</span>
            </button>

            <button
              onClick={() => setDivergenceFilter('SOBRAS')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition cursor-pointer ${
                divergenceFilter === 'SOBRAS'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span>Apenas Sobras</span>
            </button>

            <button
              onClick={() => setDivergenceFilter('OK')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition cursor-pointer ${
                divergenceFilter === 'OK'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-blue-600" />
              <span>100% Conciliados</span>
            </button>

            <button
              onClick={() => setDivergenceFilter('RECOUNTED')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1 transition cursor-pointer ${
                divergenceFilter === 'RECOUNTED'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Recontados (02.11.01)</span>
            </button>
          </div>

          {/* Group dropdown & Sort select */}
          <div className="flex items-center space-x-2 text-xs">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="bg-slate-50 text-slate-700 px-2 py-1 rounded-md border border-slate-300 text-xs focus:outline-none"
            >
              <option value="ALL">Todos os Grupos</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <div className="flex items-center space-x-1 bg-slate-50 rounded-md p-0.5 border border-slate-300">
              <span className="text-[11px] text-slate-500 ml-1.5">Ordenar:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent text-slate-700 text-xs font-medium focus:outline-none py-0.5 px-1 cursor-pointer"
              >
                <option value="prejuizo">Maior Prejuízo</option>
                <option value="sobra">Maior Sobra</option>
                <option value="hl">Impacto em HL</option>
                <option value="produto">Cód. SKU</option>
                <option value="descricao">Descrição</option>
              </select>
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title={sortAsc ? 'Ordem Crescente' : 'Ordem Decrescente'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Main Reconciliation Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Dep.</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3 min-w-[220px]">Descrição do Produto</th>
                <th className="py-3 px-2 text-center">Fator SKU</th>
                <th className="py-3 px-3 text-right">Disponível (SKU)</th>
                <th className="py-3 px-3 text-right">Inventário Físico (SKU)</th>
                <th className="py-3 px-3 text-right">Diferença (SKU)</th>
                <th className="py-3 px-3 text-right">Impacto Financeiro (R$)</th>
                <th className="py-3 px-3 text-right">Impacto (HL)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Ajuste / Recontagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedStock.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-600">Nenhum produto conciliado nesta base.</p>
                      <p className="text-[11px] text-slate-400">Clique no botão acima para importar o arquivo 02.05.02 do seu armazém.</p>
                      <button
                        onClick={() => onOpenImportModal('020502')}
                        className="mt-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        Importar 02.05.02 Agora
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedStock.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const isFalta = item.status === 'FALTA';
                  const isSobra = item.status === 'SOBRA';

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50 transition ${
                        isFalta ? 'bg-rose-50/20' : isSobra ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Depósito */}
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                          {item.deposito}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {item.produto}
                      </td>

                      {/* Descrição & Grupo */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 truncate max-w-xs" title={item.descricao}>
                          {item.descricao}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                          <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] uppercase border border-slate-200">
                            {item.grupo}
                          </span>
                          <span>•</span>
                          <span>Unitário: {formatCurrency(item.valorUnitario)}</span>
                          {item.recontado && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 font-semibold flex items-center">
                                <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Recontado
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Fator SKU */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                        {item.fatorSku}
                      </td>

                      {/* Disponível Sistema (SKU) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-semibold text-blue-700">
                          {item.disponivelRaw}
                        </div>
                        {(item.saldoNegativoDesconsiderado || item.disponivelTotalUnits < 0) && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded mt-0.5 inline-block" title="Saldo negativo do disponível desconsiderado">
                            Saldo Negativo
                          </span>
                        )}
                      </td>

                      {/* Inventário Físico (SKU) */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="text"
                              value={editSkuInput}
                              onChange={(e) => setEditSkuInput(e.target.value)}
                              placeholder="ex: 5/02"
                              className="w-20 bg-white text-right px-1.5 py-0.5 rounded border border-emerald-500 text-xs font-mono text-slate-900 focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(item)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                              title="Confirmar Contagem"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-mono font-semibold text-emerald-700">
                              {item.inventarioRaw}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Diferença SKU */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {(item.saldoNegativoDesconsiderado || item.disponivelTotalUnits < 0) ? (
                          <span className="text-slate-400 font-normal text-xs" title="Saldo disponível negativo - divergência zerada">
                            0 <span className="text-[9px] text-amber-700 font-semibold">(Zerado)</span>
                          </span>
                        ) : (
                          <span className={isFalta ? 'text-rose-600' : isSobra ? 'text-emerald-600' : 'text-slate-400'}>
                            {item.diferencaRaw}
                          </span>
                        )}
                      </td>

                      {/* Impacto Financeiro R$ */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {(item.saldoNegativoDesconsiderado || item.disponivelTotalUnits < 0) ? (
                          <span className="text-slate-400 font-normal text-xs">R$ 0,00</span>
                        ) : (
                          <span className={isFalta ? 'text-rose-600' : isSobra ? 'text-emerald-600' : 'text-slate-400'}>
                            {isFalta ? `-${formatCurrency(item.prejuizoFinanceiro)}` : isSobra ? `+${formatCurrency(item.sobraFinanceira)}` : 'R$ 0,00'}
                          </span>
                        )}
                      </td>

                      {/* Impacto HL */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 text-[11px]">
                        {(item.saldoNegativoDesconsiderado || item.disponivelTotalUnits < 0) ? (
                          <span className="text-slate-400">0,000 HL</span>
                        ) : item.impactoHl !== 0 ? (
                          <span>{item.impactoHl > 0 ? '+' : ''}{formatHectoliters(item.impactoHl)}</span>
                        ) : (
                          <span className="text-slate-400">0,000 HL</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        {(item.saldoNegativoDesconsiderado || item.disponivelTotalUnits < 0) ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            ZERADO (DISP &lt; 0)
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isFalta 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isSobra 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center">
                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            title="Digitar Recontagem Físico (Formato X/YY)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Exibindo <strong className="text-slate-800">{sortedStock.length}</strong> de <strong className="text-slate-800">{stockPositions.length}</strong> itens no depósito
          </span>
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
            <span>Falta = Prejuízo Financeiro</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2" />
            <span>Sobra = Excedente Físico</span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ml-2" />
            <span>OK = 100% Conciliado</span>
          </div>
        </div>

      </div>

      {/* Modal Maximizado de Recontagem / Impressão / Exportar Imagem */}
      <RecontagemRankingsModal
        isOpen={isRecontagemModalOpen}
        onClose={() => setIsRecontagemModalOpen(false)}
        allRankingFaltas={allRankingFaltas}
        allRankingSobras={allRankingSobras}
        selectedDeposito={selectedDeposito}
        rankingAdjustmentMode="sem_ajuste"
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
