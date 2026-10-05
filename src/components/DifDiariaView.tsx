import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Search, 
  Download, 
  FolderDown, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Calendar,
  Layers,
  ArrowRight,
  History,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  StockPositionItem, 
  ProductMaster, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId, 
  FrozenReconciliation,
  ViewTab 
} from '../types';
import { DEPOSITOS } from '../data/initialData';
import { INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026 } from '../data/initialFrozenData';
import { roundSkuDown, formatSkuInteger } from './DifMensalView';

interface DifDiariaViewProps {
  stockPositions: StockPositionItem[];
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  productsMap: Map<string, ProductMaster>;
  frozenReconciliations: FrozenReconciliation[];
  onOpenSaveModal: () => void;
  onNavigateTab?: (tab: ViewTab) => void;
}

interface DiariaRow {
  sku: string;
  descricao: string;
  grupo: string;
  fatorSku: number;
  fatorHl: number;
  valorCaixa: number;
  valorUnitario: number;
  
  // Dif Congelada (Inteiro arredondado para baixo)
  congeladaQtd: number;
  congeladaValor: number;
  rawCongeladaQtd: number;

  // Dia Atual (Inteiro arredondado para baixo)
  diaAtualQtd: number;
  diaAtualValor: number;
  rawDiaAtualQtd: number;

  // Diferença (Variação do Dia)
  diferencaQtd: number;
  diferencaValor: number;
  rawDiferencaQtd: number;

  // Status das bolinhas solicitado pelo usuário:
  // - Verde: Diferença permaneceu igual
  // - Vermelho: Houve uma falta maior
  // - Azul: Variação de sobra em relação à dif congelada
  statusColor: 'verde' | 'vermelho' | 'azul';
}

export const DifDiariaView: React.FC<DifDiariaViewProps> = ({
  stockPositions,
  selectedDeposito,
  setSelectedDeposito,
  productsMap,
  frozenReconciliations,
  onOpenSaveModal,
  onNavigateTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'variation' | 'faltas' | 'sobras'>('all');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('latest');

  // Seleciona a reconciliação congelada de referência
  const referenceFrozen = useMemo(() => {
    if (frozenReconciliations.length === 0) return null;
    if (selectedSnapshotId === 'latest') return frozenReconciliations[0];
    return frozenReconciliations.find(f => f.id === selectedSnapshotId) || frozenReconciliations[0];
  }, [frozenReconciliations, selectedSnapshotId]);

  // Mapa de itens congelados para consulta rápida
  const frozenItemsMap = useMemo(() => {
    const map = new Map<string, { qtd: number; valor: number }>();

    if (referenceFrozen) {
      if (referenceFrozen.itensComAjustes && referenceFrozen.itensComAjustes.length > 0) {
        referenceFrozen.itensComAjustes.forEach(item => {
          map.set(String(item.produto), {
            qtd: item.divergenciaResidualSkus || 0,
            valor: item.impactoFinanceiroResidual || 0
          });
        });
      } else if (referenceFrozen.itensSemAjustes && referenceFrozen.itensSemAjustes.length > 0) {
        referenceFrozen.itensSemAjustes.forEach(item => {
          map.set(String(item.produto), {
            qtd: item.diferencaSkus || 0,
            valor: item.impactoFinanceiro || 0
          });
        });
      }
    } else {
      // Fallback para os dados pré-carregados caso ainda não haja reconciliação congelada
      INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.forEach(item => {
        const qtdDia16 = item.dias[16] ?? item.fechamento;
        map.set(item.sku, {
          qtd: qtdDia16,
          valor: qtdDia16 * item.valorCaixa
        });
      });
    }

    return map;
  }, [referenceFrozen]);

  // Verifica se há arquivo 02.05.02 carregado atualmente na plataforma (conciliação)
  const hasCurrent020502 = Boolean(stockPositions && stockPositions.length > 0);

  // Mapa de divergência do dia atual (a partir das posições ativas da 02.05.02 na conciliação)
  const diaAtualMap = useMemo(() => {
    const map = new Map<string, { qtd: number; valor: number }>();

    // REGRA DE NEGÓCIO: Não pode haver dif atual se não há nenhum arquivo 02.05.02 na conciliação
    if (!hasCurrent020502) {
      return map;
    }

    const filteredPositions = selectedDeposito === 'ALL'
      ? stockPositions
      : stockPositions.filter(s => s.deposito === selectedDeposito);

    filteredPositions.forEach(s => {
      const existing = map.get(s.produto);
      const qtd = s.diferencaSkus || 0;
      const val = s.impactoFinanceiro || 0;
      if (existing) {
        existing.qtd += qtd;
        existing.valor += val;
      } else {
        map.set(s.produto, { qtd, valor: val });
      }
    });

    return map;
  }, [stockPositions, selectedDeposito, hasCurrent020502]);

  // Constrói todas as linhas comparativas combinando SKUs conhecidos
  const rows: DiariaRow[] = useMemo(() => {
    // Reúne todos os SKUs relevantes
    const skusSet = new Set<string>();

    frozenItemsMap.forEach((_, sku) => skusSet.add(sku));
    if (hasCurrent020502) {
      diaAtualMap.forEach((_, sku) => skusSet.add(sku));
    }
    INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.forEach(i => skusSet.add(i.sku));

    // Se tiver produtos no cadastro, inclui os com movimentação
    productsMap.forEach((_, sku) => {
      if (frozenItemsMap.has(sku) || (hasCurrent020502 && diaAtualMap.has(sku))) {
        skusSet.add(sku);
      }
    });

    const list: DiariaRow[] = [];

    skusSet.forEach(sku => {
      const prod = productsMap.get(sku);
      const initialItem = INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.find(i => i.sku === sku);

      const descricao = prod?.descricao || initialItem?.descricao || `PRODUTO ${sku}`;
      const grupo = prod?.grupo || initialItem?.grupo || 'GERAL';
      const fatorSku = prod?.fatorSku || initialItem?.fatorSku || 12;
      const fatorHl = prod?.fatorHl || initialItem?.fatorHl || 0.04;
      const valorCaixa = prod?.valorCaixa || prod?.valor || initialItem?.valorCaixa || 30.00;
      const valorUnitario = prod?.valorUnitario || prod?.valorUnit || initialItem?.valorUnitario || (valorCaixa / fatorSku);

      // Congelado (último congelamento)
      const frozenData = frozenItemsMap.get(sku);
      const rawCongeladaQtd = frozenData ? frozenData.qtd : (initialItem?.dias[16] ?? initialItem?.fechamento ?? 0);
      const congeladaQtd = roundSkuDown(rawCongeladaQtd);
      const congeladaValor = frozenData ? frozenData.valor : (congeladaQtd * valorCaixa);

      // Dia Atual / Dif Atual:
      // "não pode haver dif atual se não há nenhum arquivo 02.05.02 na conciliação, a dif congelada nesta guia,
      // foi a difernça de estoque salva e congelada do dia anterior, e a dif atual é a diferença da 02.05.02 que ainda não foi salva e está atualmente na plataforma,
      // por tanto se não há nenhum arquivo de 02.05.02 na plataforma atualmente na guia de conciliação, não deve haver, nenhuma quantidade na coluna dif atual."
      let rawDiaAtualQtd = 0;
      let diaAtualValor = 0;

      if (hasCurrent020502) {
        const atualData = diaAtualMap.get(sku);
        if (atualData) {
          rawDiaAtualQtd = atualData.qtd;
          diaAtualValor = atualData.valor;
        }
      }

      const diaAtualQtd = roundSkuDown(rawDiaAtualQtd);

      // Diferença = Dif Atual - Congelada (quando há 02.05.02 carregada)
      // Se não há arquivo 02.05.02 carregado, a variação do dia permanece zerada e o status permanece neutro/verde
      let diferencaQtd = 0;
      let diferencaValor = 0;
      let rawDiferencaQtd = 0;
      let statusColor: 'verde' | 'vermelho' | 'azul' = 'verde';

      if (hasCurrent020502) {
        diferencaQtd = diaAtualQtd - congeladaQtd;
        diferencaValor = diaAtualValor - congeladaValor;
        rawDiferencaQtd = rawDiaAtualQtd - rawCongeladaQtd;

        // Regra das Bolinhas (Status solicitado pelo usuário):
        // 1. "se a diferença permaneceu igual a bola fica verde"
        // 2. "se houve uma falta maior ela fica vermelha"
        // 3. "se ela teve um variação de sobra em relação a dif congelada que é a última diferença congelada, em relação a diferença diária ele fique azul"
        if (diferencaQtd < 0) {
          statusColor = 'vermelho';
        } else if (diferencaQtd > 0) {
          statusColor = 'azul';
        } else {
          // Quando a diferença inteira arredondada é zero, avalia se houve variação fracionária/financeira
          if (rawDiferencaQtd < -0.01 || diferencaValor < -0.05) {
            statusColor = 'vermelho';
          } else if (rawDiferencaQtd > 0.01 || diferencaValor > 0.05) {
            statusColor = 'azul';
          } else {
            statusColor = 'verde';
          }
        }
      }

      list.push({
        sku,
        descricao,
        grupo,
        fatorSku,
        fatorHl,
        valorCaixa,
        valorUnitario,
        congeladaQtd,
        congeladaValor,
        rawCongeladaQtd,
        diaAtualQtd,
        diaAtualValor,
        rawDiaAtualQtd,
        diferencaQtd,
        diferencaValor,
        rawDiferencaQtd,
        statusColor
      });
    });

    // Ordenação: primeiro itens com variação do dia (vermelhos e azuis), depois por código
    return list.sort((a, b) => {
      const aHasVar = a.statusColor !== 'verde';
      const bHasVar = b.statusColor !== 'verde';
      if (aHasVar && !bHasVar) return -1;
      if (!aHasVar && bHasVar) return 1;
      return Number(a.sku) - Number(b.sku);
    });
  }, [frozenItemsMap, diaAtualMap, productsMap, hasCurrent020502]);

  // Filtros aplicados
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = row.sku.toLowerCase().includes(term) || row.descricao.toLowerCase().includes(term);
        if (!matches) return false;
      }

      if (filterMode === 'variation') {
        return row.statusColor !== 'verde' || row.diferencaQtd !== 0;
      }
      if (filterMode === 'faltas') {
        return row.statusColor === 'vermelho';
      }
      if (filterMode === 'sobras') {
        return row.statusColor === 'azul';
      }

      return true;
    });
  }, [rows, searchTerm, filterMode]);

  // Totais agregados
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.congeladaQtd += r.congeladaQtd;
        acc.congeladaValor += r.congeladaValor;
        acc.diaAtualQtd += r.diaAtualQtd;
        acc.diaAtualValor += r.diaAtualValor;
        acc.diferencaQtd += r.diferencaQtd;
        acc.diferencaValor += r.diferencaValor;
        if (r.statusColor !== 'verde') acc.itemsWithDiff++;
        return acc;
      },
      {
        congeladaQtd: 0,
        congeladaValor: 0,
        diaAtualQtd: 0,
        diaAtualValor: 0,
        diferencaQtd: 0,
        diferencaValor: 0,
        itemsWithDiff: 0
      }
    );
  }, [filteredRows]);

  // Formatação de moeda BRL idêntica à planilha Ambev (R$ 0,00 ou R$ -)
  const formatBrlExcel = (val: number) => {
    if (Math.abs(val) < 0.001) return 'R$ -';
    const isNeg = val < 0;
    const formatted = Math.abs(val).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isNeg ? `-R$ ${formatted}` : `R$ ${formatted}`;
  };

  // Exportação Excel oficial
  const handleExportExcel = () => {
    const exportData = filteredRows.map(r => ({
      'CÓD': r.sku,
      'DESCRIÇÃO PRODUTO': r.descricao,
      'DIF CONGELADA (QTD)': r.congeladaQtd,
      'DIF CONGELADA (VALOR)': r.congeladaValor,
      'DIF ATUAL (QTDE)': r.diaAtualQtd,
      'DIF ATUAL (VALOR)': r.diaAtualValor,
      'DIFERENÇA (QTD)': r.diferencaQtd,
      'DIFERENÇA (VALOR)': r.diferencaValor
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DIF DIÁRIA');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Ambev_Diferenca_Diaria_Dep_${selectedDeposito}_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Top Header & Context Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Left Title & Status */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <CalendarDays className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
                  <span>DIF DIÁRIA</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Depósito: {selectedDeposito === 'ALL' ? 'Todos' : selectedDeposito}
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Comparativo entre a <strong className="text-slate-700">Diferença Congelada Anterior</strong> e o <strong className="text-slate-700">Dia Atual</strong> para identificação instantânea de variações
                </p>
              </div>
            </div>

            {/* Status Pill */}
            <div className="pt-1 flex items-center gap-3">
              {!hasCurrent020502 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>Nenhum arquivo 02.05.02 na conciliação — Coluna Dif Atual zerada</span>
                </div>
              ) : totals.itemsWithDiff === 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Todos os Produtos estão OK! Nenhuma variação entre congelado e a 02.05.02 atual</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>{totals.itemsWithDiff} produto(s) com variação diária entre o congelado e a 02.05.02 atual</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Top Comparison Cards & Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
            
            {/* Card 1: Última Diferença Congelada */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between min-w-[175px]">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <History className="w-3 h-3 text-amber-400" />
                  Última Diferença
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 font-mono">
                  Congelada
                </span>
              </div>
              <div className="text-lg font-black tracking-tight text-white mt-1">
                {formatBrlExcel(totals.congeladaValor)}
              </div>
              <div className="text-[11px] font-semibold text-slate-300 font-mono mt-0.5 flex items-center justify-between">
                <span>{totals.congeladaQtd} cx</span>
                <span className="text-[10px] text-slate-400 font-sans">Último Fechamento</span>
              </div>
            </div>

            {/* Card 2: Diferença Atual (02.05.02 da conciliação) */}
            <div className="bg-slate-800 text-white p-3.5 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between min-w-[175px]">
              <div className="flex items-center justify-between text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  Diferença Atual
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {hasCurrent020502 ? '02.05.02 Ativa' : 'Sem 02.05.02'}
                </span>
              </div>
              <div className="text-lg font-black tracking-tight text-white mt-1">
                {formatBrlExcel(totals.diaAtualValor)}
              </div>
              <div className="text-[11px] font-semibold text-cyan-200 font-mono mt-0.5 flex items-center justify-between">
                <span>{totals.diaAtualQtd} cx</span>
                <span className="text-[10px] text-slate-400 font-sans">
                  {hasCurrent020502 ? `${stockPositions.length} itens ativos` : '02.05.02 não carregada'}
                </span>
              </div>
            </div>

            {/* Card 3: Floating KPI Card */}
            <div className="bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 p-3.5 rounded-xl shadow-md border border-amber-300 min-w-[190px] flex flex-col justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-950/80">
                VARIAÇÃO DO DIA
              </span>
              <span className="text-2xl font-black tracking-tight mt-0.5">
                {formatBrlExcel(totals.diferencaValor)}
              </span>
              <span className="text-[10px] font-bold text-amber-900 mt-0.5 flex items-center justify-between">
                <span>{totals.diferencaQtd > 0 ? `+${totals.diferencaQtd}` : totals.diferencaQtd} cx</span>
                <span>{hasCurrent020502 ? 'Variação Líquida' : 'Aguardando 02.05.02'}</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-1.5">
              <button
                onClick={onOpenSaveModal}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                title="Salvar e congelar conciliação do dia"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Salvar & Congelar</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar Excel</span>
              </button>

              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('dif_mensal')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ver Dif Mensal</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código SKU ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({rows.length})
            </button>
            <button
              onClick={() => setFilterMode('variation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                filterMode === 'variation'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Com Variação ({rows.filter(r => r.statusColor !== 'verde').length})</span>
            </button>
            <button
              onClick={() => setFilterMode('faltas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterMode === 'faltas'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Faltas ({rows.filter(r => r.statusColor === 'vermelho').length})</span>
            </button>
            <button
              onClick={() => setFilterMode('sobras')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterMode === 'sobras'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Sobras ({rows.filter(r => r.statusColor === 'azul').length})</span>
            </button>
          </div>

          {/* Snapshot selector */}
          {frozenReconciliations.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Congelamento:</label>
              <select
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
                className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-300 bg-white"
              >
                <option value="latest">Último Salvo (Mais Recente)</option>
                {frozenReconciliations.map((f, idx) => (
                  <option key={f.id} value={f.id}>
                    {new Date(f.dataCongelamento).toLocaleDateString('pt-BR')} - {f.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>

        {/* Legenda Explicativa das Bolinhas solicitada pelo usuário */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50/80 rounded-lg p-2.5">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Regra de Status Diário:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
            <span className="text-slate-700">Verde: Diferença permaneceu igual ao congelado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200 animate-pulse"></span>
            <span className="text-rose-700 font-bold">Vermelho: Houve falta maior em relação à congelada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-200"></span>
            <span className="text-blue-700 font-bold">Azul: Variação de sobra em relação à congelada</span>
          </div>
        </div>
      </div>

      {/* Main Table: Exact Columns and Groupings from Image 1 */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Header Row 1: Groups */}
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 uppercase tracking-wider font-bold text-[11px] border-b border-slate-300">
              <tr>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-300 w-12 text-center bg-slate-200">
                  Status
                </th>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-300 w-24 bg-slate-200">
                  COD
                </th>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-300 min-w-[320px] bg-slate-200">
                  DESCRIÇÃO PRODUTO
                </th>
                
                {/* Group 1: DIF CONGELADA */}
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-300 bg-amber-200 text-amber-950 font-black">
                  DIF CONGELADA
                </th>

                {/* Group 2: DIF ATUAL */}
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-300 bg-amber-300 text-amber-950 font-black">
                  DIF ATUAL
                </th>

                {/* Group 3: DIFERENÇA */}
                <th colSpan={2} className="py-2 px-3 text-center bg-amber-400 text-amber-950 font-black">
                  DIFERENÇA
                </th>
              </tr>

              {/* Header Row 2: Subcolumns */}
              <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold text-[10px]">
                {/* DIF CONGELADA */}
                <th className="py-1.5 px-3 text-right border-r border-slate-300 bg-amber-100/70">
                  QTD
                </th>
                <th className="py-1.5 px-3 text-right border-r border-slate-300 bg-amber-100/70">
                  VALOR
                </th>

                {/* DIF ATUAL */}
                <th className="py-1.5 px-3 text-right border-r border-slate-300 bg-amber-200/70">
                  QTDE
                </th>
                <th className="py-1.5 px-3 text-right border-r border-slate-300 bg-amber-200/70">
                  VALOR
                </th>

                {/* DIFERENÇA */}
                <th className="py-1.5 px-3 text-right border-r border-slate-300 bg-amber-300/70">
                  QTD
                </th>
                <th className="py-1.5 px-3 text-right bg-amber-300/70">
                  VALOR
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum produto encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const hasVar = row.statusColor !== 'verde';

                  return (
                    <tr 
                      key={row.sku} 
                      className={`transition-colors hover:bg-slate-50/80 ${
                        hasVar ? 'bg-amber-50/30 font-medium' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Status indicator: Bolinha Verde, Vermelha ou Azul conforme regra estrita do usuário */}
                      <td className="py-2 px-3 text-center border-r border-slate-200">
                        {row.statusColor === 'verde' ? (
                          <span 
                            className="inline-block w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs ring-2 ring-emerald-200" 
                            title="Diferença permaneceu igual ao congelado"
                          />
                        ) : row.statusColor === 'vermelho' ? (
                          <span 
                            className="inline-block w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs ring-2 ring-rose-200 animate-pulse" 
                            title="Houve uma falta maior em relação à diferença congelada"
                          />
                        ) : (
                          <span 
                            className="inline-block w-3.5 h-3.5 rounded-full bg-blue-500 shadow-xs ring-2 ring-blue-200" 
                            title="Variação de sobra em relação à diferença congelada"
                          />
                        )}
                      </td>

                      {/* COD */}
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">
                        {row.sku}
                      </td>

                      {/* DESCRIÇÃO PRODUTO */}
                      <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200">
                        <div className="truncate max-w-md" title={row.descricao}>
                          {row.descricao}
                        </div>
                      </td>

                      {/* DIF CONGELADA QTD (Arredondado para baixo sem decimais) */}
                      <td className={`py-2 px-3 text-right font-mono border-r border-slate-200 font-bold ${
                        row.congeladaQtd < 0 ? 'text-rose-600' : row.congeladaQtd > 0 ? 'text-blue-600' : 'text-slate-600'
                      }`}>
                        {formatSkuInteger(row.congeladaQtd)}
                      </td>

                      {/* DIF CONGELADA VALOR */}
                      <td className={`py-2 px-3 text-right font-mono border-r border-slate-200 ${
                        row.congeladaValor < 0 ? 'text-rose-600 font-bold' : row.congeladaValor > 0 ? 'text-blue-600 font-bold' : 'text-slate-500'
                      }`}>
                        {formatBrlExcel(row.congeladaValor)}
                      </td>

                      {/* DIA ATUAL QTDE (Arredondado para baixo sem decimais) */}
                      <td className={`py-2 px-3 text-right font-mono border-r border-slate-200 font-bold ${
                        row.diaAtualQtd < 0 ? 'text-rose-600' : row.diaAtualQtd > 0 ? 'text-blue-600' : 'text-slate-600'
                      }`}>
                        {formatSkuInteger(row.diaAtualQtd)}
                      </td>

                      {/* DIA ATUAL VALOR */}
                      <td className={`py-2 px-3 text-right font-mono border-r border-slate-200 ${
                        row.diaAtualValor < 0 ? 'text-rose-600 font-bold' : row.diaAtualValor > 0 ? 'text-blue-600 font-bold' : 'text-slate-500'
                      }`}>
                        {formatBrlExcel(row.diaAtualValor)}
                      </td>

                      {/* DIFERENÇA QTD (Arredondado para baixo sem decimais) */}
                      <td className={`py-2 px-3 text-right font-mono border-r border-slate-200 ${
                        row.statusColor === 'vermelho'
                          ? 'bg-rose-100 text-rose-800 font-black' 
                          : row.statusColor === 'azul'
                            ? 'bg-blue-100 text-blue-800 font-black'
                            : 'text-slate-500 font-medium'
                      }`}>
                        {row.diferencaQtd > 0 ? `+${formatSkuInteger(row.diferencaQtd)}` : formatSkuInteger(row.diferencaQtd)}
                      </td>

                      {/* DIFERENÇA VALOR */}
                      <td className={`py-2 px-3 text-right font-mono ${
                        row.statusColor === 'vermelho'
                          ? 'bg-rose-100 text-rose-800 font-black' 
                          : row.statusColor === 'azul'
                            ? 'bg-blue-100 text-blue-800 font-black'
                            : 'text-slate-500 font-medium'
                      }`}>
                        {formatBrlExcel(row.diferencaValor)}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Summary Row */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-800">
              <tr>
                <td colSpan={3} className="py-3 px-4 uppercase tracking-wider text-right border-r border-slate-800">
                  Total Geral ({filteredRows.length} SKUs):
                </td>

                {/* DIF CONGELADA TOTAL */}
                <td className="py-3 px-3 text-right font-mono border-r border-slate-800 text-amber-300 font-bold">
                  {formatSkuInteger(totals.congeladaQtd)}
                </td>
                <td className="py-3 px-3 text-right font-mono border-r border-slate-800 text-amber-300">
                  {formatBrlExcel(totals.congeladaValor)}
                </td>

                {/* DIA ATUAL TOTAL */}
                <td className="py-3 px-3 text-right font-mono border-r border-slate-800 text-amber-300 font-bold">
                  {formatSkuInteger(totals.diaAtualQtd)}
                </td>
                <td className="py-3 px-3 text-right font-mono border-r border-slate-800 text-amber-300">
                  {formatBrlExcel(totals.diaAtualValor)}
                </td>

                {/* DIFERENÇA TOTAL */}
                <td className={`py-3 px-3 text-right font-mono border-r border-slate-800 font-bold ${
                  totals.diferencaQtd < 0 ? 'text-rose-400 font-black' : totals.diferencaQtd > 0 ? 'text-emerald-400 font-black' : 'text-slate-300'
                }`}>
                  {totals.diferencaQtd > 0 ? `+${formatSkuInteger(totals.diferencaQtd)}` : formatSkuInteger(totals.diferencaQtd)}
                </td>
                <td className={`py-3 px-3 text-right font-mono ${
                  totals.diferencaValor < 0 ? 'text-rose-400 font-black' : totals.diferencaValor > 0 ? 'text-emerald-400 font-black' : 'text-slate-300'
                }`}>
                  {formatBrlExcel(totals.diferencaValor)}
                </td>
              </tr>
            </tfoot>

          </table>
        </div>
      </div>

    </div>
  );
};
