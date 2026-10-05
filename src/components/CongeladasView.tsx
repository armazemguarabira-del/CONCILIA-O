import React, { useState, useMemo } from 'react';
import { 
  FolderDown, 
  TrendingDown, 
  TrendingUp, 
  Sparkles, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  History, 
  Eye, 
  Save 
} from 'lucide-react';
import { 
  StockPositionItem, 
  ItemConciliacaoAjustada, 
  RankingItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId, 
  ProductMaster, 
  FrozenReconciliation, 
  ViewTab 
} from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit } from '../utils/parsers';
import { calculateSkuDeviations } from '../utils/desviosUtils';
import { buildReconciliationWorkbook, saveExcelWithFolderPicker } from '../utils/excelReconciliationExport';

interface CongeladasViewProps {
  stockPositions: StockPositionItem[];
  quebras: QuebraItem[];
  vales: ValeItem[];
  trocas: TrocaItem[];
  faltasMapeadas: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  productsMap: Map<string, ProductMaster>;
  frozenReconciliations: FrozenReconciliation[];
  onOpenSaveModal: () => void;
  onNavigateTab: (tab: ViewTab) => void;
}

export const CongeladasView: React.FC<CongeladasViewProps> = ({
  stockPositions,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  selectedDeposito,
  setSelectedDeposito,
  productsMap,
  frozenReconciliations,
  onOpenSaveModal,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'rankings_dia' | 'historico_congelados'>('rankings_dia');
  const [rankingMode, setRankingMode] = useState<'sem_ajustes' | 'com_ajustes'>('sem_ajustes');
  const [rankingFilterType, setRankingFilterType] = useState<'ALL' | 'FALTAS' | 'SOBRAS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFrozen, setSelectedFrozen] = useState<FrozenReconciliation | null>(null);

  // 1. Calcula itens ajustados da posição ativa
  const adjustedItems = useMemo<ItemConciliacaoAjustada[]>(() => {
    return stockPositions.map(stockItem => {
      const dep = stockItem.deposito;
      const sku = String(stockItem.produto).trim();
      const fator = Math.max(1, stockItem.fatorSku || 1);

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
        faltasMapeadas
      );

      const totalDesviosUnits = dev.total.units;
      const totalDesviosSkus = dev.total.skus;
      const desviosRaw = dev.total.raw;
      const valorDesvios = dev.total.valor;
      const hlDesvios = dev.total.volumeHl;

      const fisicoUnits = stockItem.inventarioTotalUnits;
      const fisicoSkus = Math.floor(fisicoUnits / fator);
      const valorFisico = fisicoUnits * stockItem.valorUnitario;

      const finalTotalUnits = fisicoUnits + totalDesviosUnits;
      const finalSkus = Math.floor(finalTotalUnits / fator);
      const finalRaw = formatSkuUnit(finalTotalUnits, fator);
      const valorFinal = finalTotalUnits * stockItem.valorUnitario;

      const fiscalUnits = stockItem.disponivelTotalUnits;
      const fiscalSkus = Math.floor(fiscalUnits / fator);
      const valorFiscal = fiscalUnits * stockItem.valorUnitario;

      let divergenciaUnits = finalTotalUnits - fiscalUnits;
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
          quebrasSkus: dev.quebras.skus,
          quebrasUnits: dev.quebras.units,
          quebrasValor: dev.quebras.valor,
          quebrasRaw: dev.quebras.raw,

          valesSkus: dev.vales.skus,
          valesUnits: dev.vales.units,
          valesValor: dev.vales.valor,
          valesRaw: dev.vales.raw,

          trocasSkus: dev.trocas.skus,
          trocasUnits: dev.trocas.units,
          trocasValor: dev.trocas.valor,
          trocasRaw: dev.trocas.raw,

          faltasSkus: dev.faltas.skus,
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
  }, [stockPositions, quebras, vales, trocas, faltasMapeadas]);

  // Rankings do Dia Sem Ajustes
  const rankingFaltasSemAjustes = useMemo<RankingItem[]>(() => {
    return stockPositions
      .filter(s => {
        if (selectedDeposito !== 'ALL' && s.deposito !== selectedDeposito) return false;
        return s.status === 'FALTA' && s.prejuizoFinanceiro > 0;
      })
      .sort((a, b) => b.prejuizoFinanceiro - a.prejuizoFinanceiro)
      .map((s, index) => ({
        posicao: index + 1,
        codigo: s.produto,
        descricao: s.descricao,
        grupo: s.grupo || 'GERAL',
        deposito: s.deposito,
        fatorSku: s.fatorSku,
        quantidadeUnidades: Math.abs(s.diferencaTotalUnits),
        quantidadeSkus: Math.abs(s.diferencaSkus),
        quantidadeRaw: s.diferencaRaw,
        impactoFinanceiro: -s.prejuizoFinanceiro,
        impactoHl: s.impactoHl,
        tipo: 'FALTA',
        comAjustes: false,
      }));
  }, [stockPositions, selectedDeposito]);

  const rankingSobrasSemAjustes = useMemo<RankingItem[]>(() => {
    return stockPositions
      .filter(s => {
        if (selectedDeposito !== 'ALL' && s.deposito !== selectedDeposito) return false;
        return s.status === 'SOBRA' && s.sobraFinanceira > 0;
      })
      .sort((a, b) => b.sobraFinanceira - a.sobraFinanceira)
      .map((s, index) => ({
        posicao: index + 1,
        codigo: s.produto,
        descricao: s.descricao,
        grupo: s.grupo || 'GERAL',
        deposito: s.deposito,
        fatorSku: s.fatorSku,
        quantidadeUnidades: s.diferencaTotalUnits,
        quantidadeSkus: s.diferencaSkus,
        quantidadeRaw: s.diferencaRaw,
        impactoFinanceiro: s.sobraFinanceira,
        impactoHl: s.impactoHl,
        tipo: 'SOBRA',
        comAjustes: false,
      }));
  }, [stockPositions, selectedDeposito]);

  // Rankings do Dia Com Ajustes
  const rankingFaltasComAjustes = useMemo<RankingItem[]>(() => {
    return adjustedItems
      .filter(item => {
        if (selectedDeposito !== 'ALL' && item.deposito !== selectedDeposito) return false;
        return item.statusAjustado === 'FALTA_RESIDUAL';
      })
      .sort((a, b) => Math.abs(b.impactoFinanceiroResidual) - Math.abs(a.impactoFinanceiroResidual))
      .map((item, index) => ({
        posicao: index + 1,
        codigo: item.produto,
        descricao: item.descricao,
        grupo: item.grupo,
        deposito: item.deposito,
        fatorSku: item.fatorSku,
        quantidadeUnidades: Math.abs(item.divergenciaResidualUnits),
        quantidadeSkus: Math.abs(item.divergenciaResidualSkus),
        quantidadeRaw: item.divergenciaResidualRaw,
        impactoFinanceiro: item.impactoFinanceiroResidual,
        impactoHl: item.impactoHlResidual,
        tipo: 'FALTA',
        comAjustes: true,
      }));
  }, [adjustedItems, selectedDeposito]);

  const rankingSobrasComAjustes = useMemo<RankingItem[]>(() => {
    return adjustedItems
      .filter(item => {
        if (selectedDeposito !== 'ALL' && item.deposito !== selectedDeposito) return false;
        return item.statusAjustado === 'SOBRA_RESIDUAL';
      })
      .sort((a, b) => b.impactoFinanceiroResidual - a.impactoFinanceiroResidual)
      .map((item, index) => ({
        posicao: index + 1,
        codigo: item.produto,
        descricao: item.descricao,
        grupo: item.grupo,
        deposito: item.deposito,
        fatorSku: item.fatorSku,
        quantidadeUnidades: item.divergenciaResidualUnits,
        quantidadeSkus: item.divergenciaResidualSkus,
        quantidadeRaw: item.divergenciaResidualRaw,
        impactoFinanceiro: item.impactoFinanceiroResidual,
        impactoHl: item.impactoHlResidual,
        tipo: 'SOBRA',
        comAjustes: true,
      }));
  }, [adjustedItems, selectedDeposito]);

  // Itens exibidos no ranking do dia
  const activeRankingList = useMemo(() => {
    let list: RankingItem[] = [];
    if (rankingMode === 'sem_ajustes') {
      if (rankingFilterType === 'FALTAS') list = rankingFaltasSemAjustes;
      else if (rankingFilterType === 'SOBRAS') list = rankingSobrasSemAjustes;
      else list = [...rankingFaltasSemAjustes, ...rankingSobrasSemAjustes];
    } else {
      if (rankingFilterType === 'FALTAS') list = rankingFaltasComAjustes;
      else if (rankingFilterType === 'SOBRAS') list = rankingSobrasComAjustes;
      else list = [...rankingFaltasComAjustes, ...rankingSobrasComAjustes];
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r => r.codigo.includes(term) || r.descricao.toLowerCase().includes(term));
    }

    return list;
  }, [
    rankingMode, 
    rankingFilterType, 
    rankingFaltasSemAjustes, 
    rankingSobrasSemAjustes, 
    rankingFaltasComAjustes, 
    rankingSobrasComAjustes, 
    searchTerm
  ]);

  // Função para reexportar conciliação congelada com seleção de pasta
  const handleExportFrozen = async (rec: FrozenReconciliation) => {
    const safeFilename = `${rec.nome.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.xlsx`;
    const wb = buildReconciliationWorkbook({
      stockPositions: rec.itensSemAjustes,
      adjustedItems: rec.itensComAjustes,
      rankingSobrasSemAjustes: rec.rankingSobrasSemAjustes,
      rankingFaltasSemAjustes: rec.rankingFaltasSemAjustes,
      rankingSobrasComAjustes: rec.rankingSobrasComAjustes,
      rankingFaltasComAjustes: rec.rankingFaltasComAjustes,
      quebras,
      vales,
      trocas,
      faltasMapeadas,
      selectedDeposito: rec.deposito,
      nomeConciliacao: rec.nome,
      usuario: rec.usuario,
      dataRef: rec.dataCongelamento
    });

    await saveExcelWithFolderPicker(wb, safeFilename);
  };

  return (
    <div className="space-y-5 pb-10">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center">
              <FolderDown className="w-3.5 h-3.5 mr-1" />
              Congelamento & Rankings de Estoque
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Analista de Dados Ambev
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Rankings de Sobras e Faltas & Conciliações Congeladas
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Visualize os rankings de sobras e faltas de todos os produtos do dia (com e sem ajustes). Ao salvar a conciliação, a guia 02.05.02 é zerada para receber a nova contagem física, preservando todas as trocas, vales, faltas e quebras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenSaveModal}
            disabled={stockPositions.length === 0}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Salvar a conciliação atual, escolher pasta no computador e zerar a guia 02.05.02"
          >
            <Save className="w-4 h-4" />
            <span>Salvar & Congelar Conciliação</span>
          </button>
        </div>
      </div>

      {/* Main Switcher: Rankings do Dia vs Histórico de Congelados */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('rankings_dia')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'rankings_dia'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Rankings do Dia (Com e Sem Ajustes)</span>
          </button>

          <button
            onClick={() => setActiveTab('historico_congelados')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'historico_congelados'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <History className="w-4 h-4 text-purple-400" />
            <span>Histórico de Conciliações Salvas ({frozenReconciliations.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Depósito:</span>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['ALL', '01', '02', '03', '05', '06'] as const).map(dep => (
              <button
                key={dep}
                onClick={() => setSelectedDeposito(dep)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  selectedDeposito === dep
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dep === 'ALL' ? 'Todos' : dep}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'rankings_dia' ? (
        <div className="space-y-4">
          {/* Controls Bar: Sem Ajustes vs Com Ajustes + Filtro Sobra/Falta + Busca */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Modelo de Ranking:</span>
              <button
                onClick={() => setRankingMode('sem_ajustes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  rankingMode === 'sem_ajustes'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Sem os Ajustes (02.05.02 Padrão)</span>
              </button>

              <button
                onClick={() => setRankingMode('com_ajustes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  rankingMode === 'com_ajustes'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span>Com os Ajustes (Equalizado c/ Desvios)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter: Faltas vs Sobras vs Todos */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={() => setRankingFilterType('ALL')}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    rankingFilterType === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setRankingFilterType('FALTAS')}
                  className={`px-2.5 py-1 rounded font-bold transition flex items-center gap-1 ${
                    rankingFilterType === 'FALTAS'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>Faltas</span>
                </button>
                <button
                  onClick={() => setRankingFilterType('SOBRAS')}
                  className={`px-2.5 py-1 rounded font-bold transition flex items-center gap-1 ${
                    rankingFilterType === 'SOBRAS'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Sobras</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar código ou descrição..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-xs">
                  {rankingMode === 'sem_ajustes' 
                    ? 'Ranking de Produtos do Dia - Sem os Ajustes (02.05.02 Padrão)' 
                    : 'Ranking de Produtos do Dia - Com os Ajustes (Físico + Desvios Congelados)'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({activeRankingList.length} itens listados)
                </span>
              </div>

              <div className="text-[11px] text-slate-500">
                Ordenado por maior impacto financeiro (R$)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Posição</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-4">Descrição do Produto</th>
                    <th className="py-2.5 px-3 text-center">Depósito</th>
                    <th className="py-2.5 px-3 text-center">Grupo</th>
                    <th className="py-2.5 px-3 text-right">Qtd Unidades</th>
                    <th className="py-2.5 px-3 text-right">Qtd Caixas</th>
                    <th className="py-2.5 px-4 text-right">Impacto Financeiro (R$)</th>
                    <th className="py-2.5 px-3 text-right">Volume (HL)</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {activeRankingList.map((r) => (
                    <tr 
                      key={`${r.tipo}-${r.codigo}-${r.deposito}`}
                      className={`hover:bg-slate-50/80 transition ${
                        r.tipo === 'FALTA' ? 'hover:bg-rose-50/30' : 'hover:bg-emerald-50/30'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.posicao <= 3 
                            ? (r.tipo === 'FALTA' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white')
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          #{r.posicao}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {r.codigo}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-800 max-w-xs truncate" title={r.descricao}>
                        {r.descricao}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          Dep {r.deposito}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans text-slate-600 text-[11px]">
                        {r.grupo}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {r.quantidadeUnidades} un
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {r.quantidadeRaw} cx
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold">
                        <span className={r.tipo === 'FALTA' ? 'text-rose-600' : 'text-emerald-600'}>
                          {r.tipo === 'FALTA' ? '-' : '+'}{formatCurrency(Math.abs(r.impactoFinanceiro))}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatHectoliters(Math.abs(r.impactoHl))} HL
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.tipo === 'FALTA'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {r.tipo === 'FALTA' ? 'FALTA' : 'SOBRA'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activeRankingList.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-sans italic">
                        Nenhum registro de falta ou sobra encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* HISTÓRICO DE CONCILIAÇÕES SALVAS */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Histórico de Conciliações Salvas & Congeladas
              </h3>
              <p className="text-xs text-slate-500">
                Cada salvamento gera a planilha oficial com todas as guias do dia separadas e permite baixar o arquivo novamente.
              </p>
            </div>

            <button
              onClick={onOpenSaveModal}
              disabled={stockPositions.length === 0}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Nova Conciliação</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {frozenReconciliations.map((rec) => (
              <div 
                key={rec.id} 
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-xs hover:shadow-md transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Depósito {rec.deposito}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                      {rec.nome}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(rec.dataCongelamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Sem Ajustes (Faltas)</span>
                    <span className="font-bold text-rose-600 font-mono">
                      {formatCurrency(rec.totalFaltasSemAjustesValor)}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Com Ajustes (Residual)</span>
                    <span className="font-bold text-teal-700 font-mono">
                      {formatCurrency(rec.totalFaltasComAjustesValor)}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Desvios Equalizados</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {formatCurrency(rec.totalDesviosValor)}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Total de SKUs</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {rec.totalSkus} produtos
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(rec.dataCongelamento).toLocaleDateString('pt-BR')}</span>
                  </span>

                  <button
                    onClick={() => handleExportFrozen(rec)}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                    title="Baixar planilha Excel com escolha de pasta no PC"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Baixar Excel</span>
                  </button>
                </div>
              </div>
            ))}

            {frozenReconciliations.length === 0 && (
              <div className="col-span-full p-12 bg-white border border-slate-200 rounded-xl text-center space-y-2">
                <History className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Nenhuma conciliação congelada ainda</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Clique no botão "Salvar & Congelar Conciliação" para congelar os rankings diários, exportar o Excel e zerar a guia 02.05.02.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
