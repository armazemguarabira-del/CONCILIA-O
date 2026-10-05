import React, { useState, useMemo } from 'react';
import { 
  CalendarRange, 
  Search, 
  Download, 
  Filter, 
  Layers, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Boxes,
  Sparkles,
  CalendarCheck2,
  LineChart as ChartIcon,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  StockPositionItem, 
  ProductMaster, 
  DepositoId, 
  FrozenReconciliation,
  ViewTab 
} from '../types';
import { INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026, SkuDailyDifference } from '../data/initialFrozenData';
import { SkuVariationChartModal } from './SkuVariationChartModal';

interface DifMensalViewProps {
  stockPositions?: StockPositionItem[];
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  productsMap: Map<string, ProductMaster>;
  frozenReconciliations: FrozenReconciliation[];
  onNavigateTab?: (tab: ViewTab) => void;
}

// Converte qualquer valor de diferença (ex: '05/02', 5.16, etc.) para inteiro arredondado para baixo
export const roundSkuDown = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.trunc(val);
  }
  const str = String(val).trim();
  if (str.includes('/')) {
    // Exemplo Ambev: '05/02' -> 5; '-05/02' -> -5; '12/03' -> 12
    const parts = str.split('/');
    const n = parseInt(parts[0], 10);
    return isNaN(n) ? 0 : n;
  }
  const cleanStr = str.replace(',', '.');
  const n = parseFloat(cleanStr);
  if (isNaN(n)) return 0;
  return Math.trunc(n);
};

// Formatação para exibição: estritamente número inteiro, sem casas decimais nem unidades fracionárias
export const formatSkuInteger = (val: any): string => {
  if (val === null || val === undefined || val === '') return '-';
  const intVal = roundSkuDown(val);
  return String(intVal);
};

const MESES = [
  { id: 1, nome: 'Janeiro', abrev: 'JAN' },
  { id: 2, nome: 'Fevereiro', abrev: 'FEV' },
  { id: 3, nome: 'Março', abrev: 'MAR' },
  { id: 4, nome: 'Abril', abrev: 'ABR' },
  { id: 5, nome: 'Maio', abrev: 'MAI' },
  { id: 6, nome: 'Junho', abrev: 'JUN' },
  { id: 7, nome: 'Julho', abrev: 'JUL' },
  { id: 8, nome: 'Agosto', abrev: 'AGO' },
  { id: 9, nome: 'Setembro', abrev: 'SET' },
  { id: 10, nome: 'Outubro', abrev: 'OUT' },
  { id: 11, nome: 'Novembro', abrev: 'NOV' },
  { id: 12, nome: 'Dezembro', abrev: 'DEZ' },
];

export const DifMensalView: React.FC<DifMensalViewProps> = ({
  selectedDeposito,
  setSelectedDeposito,
  productsMap,
  frozenReconciliations,
  onNavigateTab
}) => {
  // Mês e Ano selecionados (Default para Setembro/2026 para sincronizar com os dados Ambev)
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 9 = Setembro
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [modoAjusteMensal, setModoAjusteMensal] = useState<'com_ajuste' | 'sem_ajuste'>('com_ajuste');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_diff' | 'negative' | 'positive'>('all');
  const [selectedSkuForChart, setSelectedSkuForChart] = useState<string | null>(null);

  // Quantidade de dias no mês selecionado
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // Agrega dados mensais a partir do histórico de congeladas + dados padrão da planilha
  const monthlyData: SkuDailyDifference[] = useMemo(() => {
    // Mapa base inicial de SKUs
    const skuMap = new Map<string, SkuDailyDifference>();

    // Se for Setembro/2026, carrega a matriz inicial fiel da planilha da imagem 2
    if (selectedMonth === 9 && selectedYear === 2026) {
      INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.forEach(item => {
        const roundedDias: Record<number, number> = {};
        Object.entries(item.dias).forEach(([d, v]) => {
          roundedDias[Number(d)] = roundSkuDown(v);
        });

        skuMap.set(item.sku, {
          ...item,
          fechamento: roundSkuDown(item.fechamento),
          dias: roundedDias
        });
      });
    }

    // Processa o histórico de reconciliações congeladas salvas pelo usuário
    frozenReconciliations.forEach(rec => {
      if (selectedDeposito !== 'ALL' && rec.deposito !== selectedDeposito && rec.deposito !== 'ALL') {
        return;
      }

      let recYear: number, recMonth: number, recDay: number;
      if (rec.dataReferencia && rec.dataReferencia.includes('-')) {
        const parts = rec.dataReferencia.split('-').map(Number);
        recYear = parts[0];
        recMonth = parts[1];
        recDay = parts[2];
      } else {
        const date = new Date(rec.dataCongelamento);
        recMonth = date.getMonth() + 1;
        recYear = date.getFullYear();
        recDay = date.getDate();
      }

      if (recMonth === selectedMonth && recYear === selectedYear) {
        // Itera itens salvos conforme o modo selecionado: 'com_ajuste' ou 'sem_ajuste'
        const items = modoAjusteMensal === 'com_ajuste'
          ? (rec.itensComAjustes && rec.itensComAjustes.length > 0 ? rec.itensComAjustes : (rec.itensSemAjustes || []))
          : (rec.itensSemAjustes && rec.itensSemAjustes.length > 0 ? rec.itensSemAjustes : (rec.itensComAjustes || []));

        items.forEach((it: any) => {
          const sku = String(it.produto);
          const rawDiff = modoAjusteMensal === 'com_ajuste'
            ? (it.divergenciaResidualSkus !== undefined ? it.divergenciaResidualSkus : (it.diferencaSkus || 0))
            : (it.diferencaSkus !== undefined ? it.diferencaSkus : (it.divergenciaResidualSkus || 0));
          const diffSkus = roundSkuDown(rawDiff);

          let entry = skuMap.get(sku);
          if (!entry) {
            const prod = productsMap.get(sku);
            entry = {
              sku,
              descricao: it.descricao || prod?.descricao || `PRODUTO ${sku}`,
              fatorHl: it.fatorHl || prod?.fatorHl || 0.04,
              fatorSku: it.fatorSku || prod?.fatorSku || 12,
              valorUnitario: it.valorUnitario || prod?.valorUnitario || prod?.valorUnit || 3.0,
              valorCaixa: it.valorCaixa || prod?.valorCaixa || prod?.valor || 36.0,
              grupo: it.grupo || prod?.grupo || 'GERAL',
              fechamento: 0,
              dias: {}
            };
            skuMap.set(sku, entry);
          }

          entry.dias[recDay] = diffSkus;
        });
      }
    });

    // Recalcula o saldo de fechamento do mês para cada SKU
    // (último dia registrado do mês ou soma acumulada)
    const list = Array.from(skuMap.values()).map(item => {
      const daysWithRecords = Object.keys(item.dias).map(Number).sort((a, b) => a - b);
      let fechamento = item.fechamento;
      if (daysWithRecords.length > 0) {
        const lastDay = daysWithRecords[daysWithRecords.length - 1];
        fechamento = item.dias[lastDay];
      }
      return {
        ...item,
        fechamento: roundSkuDown(fechamento)
      };
    });

    // Ordenação: primeiro itens com divergência expressiva no fechamento, depois por código
    return list.sort((a, b) => {
      if (Math.abs(b.fechamento) !== Math.abs(a.fechamento)) {
        return Math.abs(b.fechamento) - Math.abs(a.fechamento);
      }
      return Number(a.sku) - Number(b.sku);
    });
  }, [selectedMonth, selectedYear, frozenReconciliations, selectedDeposito, productsMap, modoAjusteMensal]);

  // Filtros aplicados
  const filteredData = useMemo(() => {
    return monthlyData.filter(row => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = row.sku.toLowerCase().includes(term) || row.descricao.toLowerCase().includes(term);
        if (!matches) return false;
      }

      if (filterMode === 'with_diff') {
        return row.fechamento !== 0 || Object.keys(row.dias).length > 0;
      }
      if (filterMode === 'negative') {
        return row.fechamento < 0;
      }
      if (filterMode === 'positive') {
        return row.fechamento > 0;
      }

      return true;
    });
  }, [monthlyData, searchTerm, filterMode]);

  // Totais agregados
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, r) => {
        acc.totalFechamentoCx += r.fechamento;
        acc.totalFechamentoValor += r.fechamento * r.valorCaixa;
        acc.totalFechamentoHl += r.fechamento * r.fatorHl;
        if (r.fechamento < 0) acc.totalFaltasCx += Math.abs(r.fechamento);
        if (r.fechamento > 0) acc.totalSobrasCx += r.fechamento;
        return acc;
      },
      {
        totalFechamentoCx: 0,
        totalFechamentoValor: 0,
        totalFechamentoHl: 0,
        totalFaltasCx: 0,
        totalSobrasCx: 0
      }
    );
  }, [filteredData]);

  // Formatação de Hecto HL ex: 0,06
  const formatHl = (n: number) => {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Exportação para Excel da Matriz Completa do Mês
  const handleExportExcel = () => {
    const exportData = filteredData.map(r => {
      const rowObj: Record<string, any> = {
        'Cod': r.sku,
        'Desc Produto': r.descricao,
        'Fator HL': r.fatorHl,
        'Fechamento': roundSkuDown(r.fechamento)
      };

      daysArray.forEach(d => {
        rowObj[`Dia ${d}`] = r.dias[d] !== undefined ? roundSkuDown(r.dias[d]) : '';
      });

      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const monthName = MESES.find(m => m.id === selectedMonth)?.nome || 'Mes';
    XLSX.utils.book_append_sheet(wb, ws, `DIF MENSAL ${selectedMonth}-${selectedYear}`);
    XLSX.writeFile(wb, `Ambev_Diferenca_Mensal_${monthName}_${selectedYear}_Dep_${selectedDeposito}.xlsx`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Top Header com Estilo Ambev & Identificação */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {/* Ambev Logo / Icon Badge */}
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black tracking-tighter text-lg shadow-xs">
                amb
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
                  <span>DIF MENSAL</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Estratificação Diária do Mês
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Diferenças diárias de todos os produtos congelados por dia do mês para acompanhamento contínuo da variação de estoque
                </p>
              </div>
            </div>

            {/* Quick action to navigate to daily view */}
            {onNavigateTab && (
              <div className="pt-1">
                <button
                  onClick={() => onNavigateTab('dif_diaria')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 transition"
                >
                  <span>Ir para Comparativo Diário (Dif Diária)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons, Mode Toggle & Year Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Seletor Com Ajuste / Sem Ajuste na Dif Mensal */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setModoAjusteMensal('com_ajuste')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  modoAjusteMensal === 'com_ajuste'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibe a divergência residual apurada com compensação dos desvios (quebras, trocas, vales e faltas)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Com Ajuste</span>
              </button>
              <button
                type="button"
                onClick={() => setModoAjusteMensal('sem_ajuste')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  modoAjusteMensal === 'sem_ajuste'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibe a divergência física bruta apurada na contagem sem deduções de desvios"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sem Ajuste</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <label className="text-xs font-bold text-slate-600">Ano:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Matriz Mensal (.xlsx)</span>
            </button>
          </div>

        </div>

        {/* Month Selector Tabs (Estratificação por todos os meses do ano) */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CalendarCheck2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Selecione o Mês a Estratificar:</span>
            </span>
            <span className="text-xs font-bold text-amber-900 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-300">
              {MESES.find(m => m.id === selectedMonth)?.nome} / {selectedYear} ({daysInMonth} dias)
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
            {MESES.map((m) => {
              const isSelected = m.id === selectedMonth;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMonth(m.id)}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400 font-black'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span className="text-[11px] tracking-tight">{m.nome}</span>
                  <span className={`text-[9px] uppercase ${isSelected ? 'text-amber-950 font-black' : 'text-slate-400'}`}>
                    {m.abrev}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* KPIs Summary Cards */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Saldo Fechamento Líquido
            </span>
            <span className={`text-lg font-black tracking-tight ${
              totals.totalFechamentoCx < 0 ? 'text-rose-600' : totals.totalFechamentoCx > 0 ? 'text-blue-600' : 'text-slate-800'
            }`}>
              {formatSkuInteger(totals.totalFechamentoCx)} cx
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Impacto Financeiro Fechamento
            </span>
            <span className={`text-lg font-black tracking-tight ${
              totals.totalFechamentoValor < 0 ? 'text-rose-600' : totals.totalFechamentoValor > 0 ? 'text-blue-600' : 'text-slate-800'
            }`}>
              {totals.totalFechamentoValor < 0 ? `-R$ ${Math.abs(totals.totalFechamentoValor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `R$ ${totals.totalFechamentoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Volume Fechamento (HL)
            </span>
            <span className="text-lg font-black tracking-tight text-slate-800">
              {formatHl(totals.totalFechamentoHl)} HL
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              SKUs Monitorados no Mês
            </span>
            <span className="text-lg font-black tracking-tight text-amber-700">
              {filteredData.length} SKUs
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                filterMode === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({monthlyData.length})
            </button>
            <button
              onClick={() => setFilterMode('with_diff')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                filterMode === 'with_diff' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              Com Movimentação ({monthlyData.filter(d => d.fechamento !== 0 || Object.keys(d.dias).length > 0).length})
            </button>
            <button
              onClick={() => setFilterMode('negative')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                filterMode === 'negative' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              Faltas ({monthlyData.filter(d => d.fechamento < 0).length})
            </button>
            <button
              onClick={() => setFilterMode('positive')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                filterMode === 'positive' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              Sobras ({monthlyData.filter(d => d.fechamento > 0).length})
            </button>
          </div>
        </div>

      </div>

      {/* Interactive Helper Banner */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs text-amber-900 shadow-xs flex-wrap">
        <div className="flex items-center gap-2">
          <ChartIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Gráfico de Oscilação:</strong> Clique no código ou na descrição de qualquer SKU para visualizar o gráfico de variação diária das contagens com a linha tracejada de meta.
          </span>
        </div>
        <span className="text-[11px] font-bold bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-md font-mono">
          Arredondado p/ cx fechadas (sem quebrados)
        </span>
      </div>

      {/* Main Matrix Table: Exact Columns and Color Logic from Image 2 */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[660px]">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Table Header */}
            <thead className="sticky top-0 z-30 bg-[#2D3748] text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-700">
              <tr>
                {/* Sticky Left Column 1: Cod */}
                <th className="py-2.5 px-3 border-r border-slate-600 sticky left-0 z-40 bg-[#2D3748] w-20 text-center shadow-xs">
                  Cod
                </th>
                
                {/* Sticky Left Column 2: Desc Produto */}
                <th className="py-2.5 px-3 border-r border-slate-600 sticky left-20 z-40 bg-[#2D3748] min-w-[280px] shadow-xs">
                  Desc Produto
                </th>

                {/* Sticky Left Column 3: Fator HL */}
                <th className="py-2.5 px-2.5 border-r border-slate-600 sticky left-[360px] z-40 bg-[#2D3748] w-20 text-right shadow-xs">
                  Fator HL
                </th>

                {/* Sticky Left Column 4: Fechamento */}
                <th className="py-2.5 px-3 border-r-2 border-slate-900 sticky left-[440px] z-40 bg-amber-500 text-slate-950 font-black w-24 text-right shadow-sm">
                  Fechamento
                </th>

                {/* Daily Stratification Columns: 1 to 31 */}
                {daysArray.map((day) => (
                  <th 
                    key={day} 
                    className="py-2.5 px-2 text-center border-r border-slate-700 min-w-[42px] font-bold text-[10px] bg-[#3B4758]"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4 + daysArray.length} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum produto com movimentação registrado para o mês de {MESES.find(m => m.id === selectedMonth)?.nome} de {selectedYear}.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const isNegativeFechamento = row.fechamento < 0;
                  const isPositiveFechamento = row.fechamento > 0;

                  return (
                    <tr 
                      key={row.sku} 
                      className={`hover:bg-amber-50/40 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Sticky 1: Cod (Clickable to open chart) */}
                      <td className="py-1.5 px-2 font-mono font-bold text-slate-900 border-r border-slate-200 sticky left-0 z-20 bg-inherit text-center shadow-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedSkuForChart(row.sku)}
                          className="w-full text-amber-700 hover:text-amber-950 font-black flex items-center justify-center gap-1 cursor-pointer transition hover:underline group py-0.5"
                          title="Clique para ver o gráfico de oscilação da divergência"
                        >
                          <span>{row.sku}</span>
                          <ChartIcon className="w-3 h-3 opacity-40 group-hover:opacity-100 text-amber-600 flex-shrink-0" />
                        </button>
                      </td>

                      {/* Sticky 2: Desc Produto (Clickable to open chart) */}
                      <td className="py-1.5 px-3 font-sans font-medium text-slate-800 border-r border-slate-200 sticky left-20 z-20 bg-inherit shadow-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedSkuForChart(row.sku)}
                          className="text-left hover:text-amber-700 hover:underline cursor-pointer transition block w-full truncate max-w-[260px]"
                          title={`Clique para ver o gráfico de oscilação de ${row.descricao}`}
                        >
                          {row.descricao}
                        </button>
                      </td>

                      {/* Sticky 3: Fator HL */}
                      <td className="py-1.5 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200 sticky left-[360px] z-20 bg-inherit shadow-xs">
                        {formatHl(row.fatorHl)}
                      </td>

                      {/* Sticky 4: Fechamento (Arredondado para baixo, número inteiro) */}
                      <td className={`py-1.5 px-3 text-right font-mono font-black border-r-2 border-slate-300 sticky left-[440px] z-20 shadow-sm ${
                        isNegativeFechamento
                          ? 'bg-rose-100 text-rose-800'
                          : isPositiveFechamento
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {formatSkuInteger(row.fechamento)}
                      </td>

                      {/* Day Columns 1 to 31 */}
                      {daysArray.map((day) => {
                        const rawVal = row.dias[day];
                        const hasVal = rawVal !== undefined;
                        const val = hasVal ? roundSkuDown(rawVal) : undefined;
                        const isNeg = hasVal && val! < 0;
                        const isPos = hasVal && val! > 0;

                        return (
                          <td 
                            key={day} 
                            className={`py-1.5 px-1 text-center font-mono text-[11px] border-r border-slate-200 transition-colors ${
                              !hasVal
                                ? 'text-slate-300'
                                : isNeg
                                  ? 'bg-rose-100/90 text-rose-800 font-bold border-y border-rose-200' // Coral/rose background
                                  : isPos
                                    ? 'bg-amber-100/90 text-amber-900 font-bold border-y border-amber-200' // Yellow/warm amber background
                                    : 'bg-emerald-50/60 text-emerald-800 font-medium' // Soft green for 0
                            }`}
                            title={hasVal ? `Dia ${day}: ${val} cx (${val! < 0 ? 'Falta' : val! > 0 ? 'Sobra' : 'OK'})` : `Sem contagem no dia ${day}`}
                          >
                            {hasVal ? val : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Row com Totais */}
            <tfoot className="sticky bottom-0 z-30 bg-[#2D3748] text-white text-xs font-bold border-t-2 border-slate-700 font-mono">
              <tr>
                <td colSpan={3} className="py-2.5 px-4 uppercase tracking-wider text-right border-r border-slate-600 sticky left-0 z-40 bg-[#2D3748]">
                  Total Fechamento ({filteredData.length} SKUs):
                </td>

                <td className={`py-2.5 px-3 text-right font-black border-r-2 border-slate-900 sticky left-[440px] z-40 ${
                  totals.totalFechamentoCx < 0 ? 'bg-rose-600 text-white' : totals.totalFechamentoCx > 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-white'
                }`}>
                  {formatSkuInteger(totals.totalFechamentoCx)}
                </td>

                {/* Day column totals */}
                {daysArray.map((day) => {
                  const daySum = filteredData.reduce((acc, r) => {
                    const v = r.dias[day];
                    return acc + (v !== undefined ? roundSkuDown(v) : 0);
                  }, 0);

                  return (
                    <td key={day} className="py-2.5 px-1 text-center font-bold text-[10px] border-r border-slate-700 bg-[#3B4758]">
                      {daySum !== 0 ? Math.trunc(daySum) : '-'}
                    </td>
                  );
                })}
              </tr>
            </tfoot>

          </table>
        </div>
      </div>

      {/* Modal de Gráfico de Oscilação de Divergência por SKU */}
      {selectedSkuForChart && (
        <SkuVariationChartModal
          sku={selectedSkuForChart}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          productsMap={productsMap}
          frozenReconciliations={frozenReconciliations}
          monthlyData={monthlyData}
          onClose={() => setSelectedSkuForChart(null)}
        />
      )}

    </div>
  );
};
