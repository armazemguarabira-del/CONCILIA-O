import React, { useMemo, useEffect } from 'react';
import { 
  X, 
  TrendingDown, 
  TrendingUp, 
  Minus, 
  Calendar, 
  Boxes, 
  FileSpreadsheet, 
  HelpCircle,
  BarChart3,
  CalendarCheck2,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { ProductMaster, FrozenReconciliation } from '../types';
import { SkuDailyDifference } from '../data/initialFrozenData';

interface SkuVariationChartModalProps {
  sku: string | null;
  selectedMonth: number;
  selectedYear: number;
  productsMap: Map<string, ProductMaster>;
  frozenReconciliations: FrozenReconciliation[];
  monthlyData: SkuDailyDifference[];
  onClose: () => void;
}

const NOME_MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const SkuVariationChartModal: React.FC<SkuVariationChartModalProps> = ({
  sku,
  selectedMonth,
  selectedYear,
  productsMap,
  frozenReconciliations,
  monthlyData,
  onClose
}) => {
  // Fecha modal com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Se não houver SKU selecionado, não renderiza
  if (!sku) return null;

  // Busca o item nos dados mensais ou produtos
  const skuData = useMemo(() => {
    return monthlyData.find(m => m.sku === sku);
  }, [monthlyData, sku]);

  const prodMaster = useMemo(() => {
    return productsMap.get(sku);
  }, [productsMap, sku]);

  const descricao = skuData?.descricao || prodMaster?.descricao || `PRODUTO ${sku}`;
  const fatorSku = skuData?.fatorSku || prodMaster?.fatorSku || 12;
  const fatorHl = skuData?.fatorHl || prodMaster?.fatorHl || 0.04;
  const valorCaixa = skuData?.valorCaixa || prodMaster?.valorCaixa || prodMaster?.valor || 30.00;
  const grupo = skuData?.grupo || prodMaster?.grupo || 'GERAL';

  // Monta o histórico consolidado de todos os dias que tiveram contagem / conciliação salva
  const chartPoints = useMemo(() => {
    const dailyMap: Record<number, number> = {};

    // 1. Dados base do mês (matriz do mês)
    if (skuData && skuData.dias) {
      Object.entries(skuData.dias).forEach(([dStr, val]) => {
        const d = Number(dStr);
        // Trata notação '05/02' ou decimais: arredonda para baixo (descarta unidades avulsas)
        const intVal = typeof val === 'string' && (val as string).includes('/')
          ? parseInt((val as string).split('/')[0], 10)
          : Math.trunc(Number(val));
        dailyMap[d] = isNaN(intVal) ? 0 : intVal;
      });
    }

    // 2. Mescla com os congelamentos salvos pelo usuário para o mês e ano selecionados
    frozenReconciliations.forEach(rec => {
      const recDate = new Date(rec.dataCongelamento);
      if (recDate.getMonth() + 1 === selectedMonth && recDate.getFullYear() === selectedYear) {
        const day = recDate.getDate();
        const items = rec.itensComAjustes && rec.itensComAjustes.length > 0
          ? rec.itensComAjustes
          : rec.itensSemAjustes || [];

        const found = items.find((it: any) => String(it.produto).trim() === sku);
        if (found) {
          const rawVal = (found as any).divergenciaResidualSkus !== undefined
            ? (found as any).divergenciaResidualSkus
            : ((found as any).diferencaSkus || 0);

          const intVal = typeof rawVal === 'string' && (rawVal as string).includes('/')
            ? parseInt((rawVal as string).split('/')[0], 10)
            : Math.trunc(Number(rawVal));

          dailyMap[day] = isNaN(intVal) ? 0 : intVal;
        }
      }
    });

    // Ordena os dias cronologicamente
    const sortedDays = Object.keys(dailyMap).map(Number).sort((a, b) => a - b);

    let prevDiferenca: number | null = null;

    return sortedDays.map((dia) => {
      const diferenca = dailyMap[dia];
      const variacao = prevDiferenca !== null ? diferenca - prevDiferenca : 0;
      prevDiferenca = diferenca;

      return {
        dia,
        diaLabel: `Dia ${dia}`,
        diferenca, // Diferença congelada apurada
        esperado: 0, // O que deveria ter no dia (sem divergência)
        variacao, // Oscilação em relação ao dia anterior
        valor: diferenca * valorCaixa,
        situacao: diferenca < 0 ? 'Falta' : diferenca > 0 ? 'Sobra' : 'Sem Divergência'
      };
    });
  }, [sku, skuData, frozenReconciliations, selectedMonth, selectedYear, valorCaixa]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    if (chartPoints.length === 0) {
      return {
        totalDias: 0,
        fechamento: 0,
        maiorSobra: 0,
        maiorFalta: 0,
        maiorDiaSobra: null,
        maiorDiaFalta: null,
        amplitude: 0
      };
    }

    let maiorSobra = 0;
    let maiorDiaSobra: number | null = null;
    let maiorFalta = 0;
    let maiorDiaFalta: number | null = null;

    chartPoints.forEach(p => {
      if (p.diferenca > maiorSobra) {
        maiorSobra = p.diferenca;
        maiorDiaSobra = p.dia;
      }
      if (p.diferenca < maiorFalta) {
        maiorFalta = p.diferenca;
        maiorDiaFalta = p.dia;
      }
    });

    const ultimoPonto = chartPoints[chartPoints.length - 1];
    const fechamento = ultimoPonto.diferenca;
    const amplitude = maiorSobra - maiorFalta;

    return {
      totalDias: chartPoints.length,
      fechamento,
      maiorSobra,
      maiorFalta,
      maiorDiaSobra,
      maiorDiaFalta,
      amplitude
    };
  }, [chartPoints]);

  // Custom Tooltip para o Gráfico
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isFalta = data.diferenca < 0;
      const isSobra = data.diferenca > 0;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold">
            <span className="text-amber-400">{data.diaLabel} / {NOME_MESES[selectedMonth]}</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
              isFalta ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
              isSobra ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {data.situacao}
            </span>
          </div>

          <div className="space-y-1 pt-1 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Divergência Apurada:</span>
              <span className={`font-bold ${isFalta ? 'text-rose-400' : isSobra ? 'text-amber-300' : 'text-emerald-400'}`}>
                {data.diferenca > 0 ? `+${data.diferenca}` : data.diferenca} cx
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>O que deveria ter (Meta):</span>
              <span className="font-semibold text-slate-300">0 cx</span>
            </div>

            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>Oscilação vs Dia Anterior:</span>
              <span className={`font-semibold ${data.variacao < 0 ? 'text-rose-400' : data.variacao > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {data.variacao > 0 ? `+${data.variacao}` : data.variacao} cx
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-800">
              <span>Impacto Financeiro:</span>
              <span className="font-bold text-white">
                {data.valor < 0 ? `-R$ ${Math.abs(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-md font-mono">
                SKU {sku}
              </span>
              <span className="bg-slate-800 text-slate-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-700 uppercase tracking-wider">
                {grupo}
              </span>
              <span className="bg-slate-800 text-amber-400 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{NOME_MESES[selectedMonth]} / {selectedYear}</span>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
              {descricao}
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
              <span>Fator SKU: <strong className="text-white font-mono">{fatorSku} un/cx</strong></span>
              <span>•</span>
              <span>Fator HL: <strong className="text-white font-mono">{fatorHl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              <span>•</span>
              <span>Valor da Caixa: <strong className="text-white font-mono">R$ {valorCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Fechamento Atual */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Fechamento do Mês
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  stats.fechamento < 0 ? 'text-rose-600' : stats.fechamento > 0 ? 'text-amber-600' : 'text-slate-800'
                }`}>
                  {stats.fechamento > 0 ? `+${stats.fechamento}` : stats.fechamento}
                </span>
                <span className="text-xs text-slate-500 font-bold">cx</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Arredondado p/ cx fechadas
              </span>
            </div>

            {/* Dias com Contagem Salva */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Dias c/ Contagem Salva
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-indigo-600 tracking-tight">
                  {stats.totalDias}
                </span>
                <span className="text-xs text-slate-500 font-bold">dias</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Conciliações registradas no mês
              </span>
            </div>

            {/* Maior Sobra */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Pico de Sobra (+)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-blue-600 tracking-tight">
                  {stats.maiorSobra > 0 ? `+${stats.maiorSobra}` : '0'}
                </span>
                <span className="text-xs text-slate-500 font-bold">cx</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                {stats.maiorDiaSobra ? `Registrado no Dia ${stats.maiorDiaSobra}` : 'Sem pico positivo'}
              </span>
            </div>

            {/* Maior Falta */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Pico de Falta (-)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-rose-600 tracking-tight">
                  {stats.maiorFalta < 0 ? `${stats.maiorFalta}` : '0'}
                </span>
                <span className="text-xs text-slate-500 font-bold">cx</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                {stats.maiorDiaFalta ? `Registrado no Dia ${stats.maiorDiaFalta}` : 'Sem falta registrada'}
              </span>
            </div>

          </div>

          {/* Recharts Line Chart Container */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  <span>Gráfico de Oscilação Diária das Divergências</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Evolução diária das contagens salvas com linha tracejada indicando o que deveria ter (meta zero)
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-amber-600"></span>
                  <span className="font-semibold text-slate-700">Divergência Apurada (cx)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-500 inline-block"></span>
                  <span className="font-semibold text-slate-500">O que deveria ter (0 cx)</span>
                </div>
              </div>
            </div>

            {chartPoints.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Nenhum registro de conciliação salva encontrado para este SKU em {NOME_MESES[selectedMonth]} de {selectedYear}.
              </div>
            ) : (
              <div className="w-full h-72 sm:h-80 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartPoints}
                    margin={{ top: 15, right: 25, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    
                    <XAxis 
                      dataKey="diaLabel" 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false}
                      dy={8}
                    />

                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false}
                      dx={-5}
                      tickFormatter={(val) => `${val} cx`}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    {/* Linha Tracejada informando o que deveria ter no dia (Meta Zero Divergência) */}
                    <ReferenceLine 
                      y={0} 
                      stroke="#475569" 
                      strokeDasharray="6 6" 
                      strokeWidth={1.5}
                      label={{ 
                        value: 'O que deveria ter: 0 cx', 
                        fill: '#475569', 
                        fontSize: 10, 
                        position: 'insideBottomRight' 
                      }} 
                    />

                    {/* Linha do que deveria ter (para legenda e referência explícita) */}
                    <Line
                      type="monotone"
                      dataKey="esperado"
                      name="O que deveria ter no dia"
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                    />

                    {/* Linha principal de oscilação da divergência com pontos nos dias apurados */}
                    <Line
                      type="monotone"
                      dataKey="diferenca"
                      name="Divergência Congelada (cx)"
                      stroke="#d97706"
                      strokeWidth={2.5}
                      dot={{
                        r: 5,
                        fill: '#f59e0b',
                        stroke: '#b45309',
                        strokeWidth: 2
                      }}
                      activeDot={{
                        r: 7,
                        fill: '#d97706',
                        stroke: '#fff',
                        strokeWidth: 2
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                <strong>Critério de Arredondamento Aplicado:</strong> Todas as diferenças foram arredondadas para baixo para números inteiros de SKUs (caixas fechadas). Qualquer valor quebrado ou em unidades avulsas (como <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold">05/02</code>) é considerado estritamente como <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold">5</code> caixas, sem números decimais ou fracionários.
              </p>
            </div>

          </div>

          {/* Table Breakdown of Counted Days */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Histórico Diário Estratificado das Contagens Salvas</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {chartPoints.length} registros no mês
              </span>
            </div>

            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Dia</th>
                    <th className="py-2 px-3 text-right">Divergência Congelada</th>
                    <th className="py-2 px-3 text-center">Situação</th>
                    <th className="py-2 px-3 text-right">O Que Deveria Ter</th>
                    <th className="py-2 px-3 text-right">Oscilação vs Anterior</th>
                    <th className="py-2 px-3 text-right">Impacto Financeiro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {chartPoints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        Sem contagens salvas.
                      </td>
                    </tr>
                  ) : (
                    chartPoints.map((row, idx) => {
                      const isFalta = row.diferenca < 0;
                      const isSobra = row.diferenca > 0;

                      return (
                        <tr key={row.dia} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            Dia {String(row.dia).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}
                          </td>
                          
                          <td className={`py-2 px-3 text-right font-black ${
                            isFalta ? 'text-rose-600 bg-rose-50/40' : isSobra ? 'text-amber-600 bg-amber-50/40' : 'text-slate-600'
                          }`}>
                            {row.diferenca > 0 ? `+${row.diferenca}` : row.diferenca} cx
                          </td>

                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isFalta ? 'bg-rose-100 text-rose-800' : isSobra ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {row.situacao}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-right text-slate-500">
                            0 cx
                          </td>

                          <td className={`py-2 px-3 text-right font-bold ${
                            row.variacao < 0 ? 'text-rose-600' : row.variacao > 0 ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {row.variacao > 0 ? `+${row.variacao} cx` : row.variacao < 0 ? `${row.variacao} cx` : '-'}
                          </td>

                          <td className={`py-2 px-3 text-right font-medium ${
                            row.valor < 0 ? 'text-rose-600' : row.valor > 0 ? 'text-blue-600' : 'text-slate-500'
                          }`}>
                            {row.valor < 0 
                              ? `-R$ ${Math.abs(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                              : `R$ ${row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            }
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Pressione <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[11px] font-bold">ESC</kbd> ou clique no botão para fechar
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Fechar Gráfico
          </button>
        </div>

      </div>
    </div>
  );
};
