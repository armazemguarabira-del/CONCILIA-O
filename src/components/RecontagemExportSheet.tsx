import React from 'react';
import { DashboardRankingItem } from './RecontagemRankingsModal';
import { formatCurrency } from '../utils/parsers';

interface RecontagemExportSheetProps {
  exportFaltas: DashboardRankingItem[];
  exportSobras: DashboardRankingItem[];
  totalDisplayFaltas: number;
  totalDisplaySobras: number;
  saldoFinalDisplay: number;
  totalGeralPrejuizoFaltas: number;
  totalGeralValorSobras: number;
  totalGeralSkusFaltas?: number;
  totalGeralSkusSobras?: number;
  saldoFinalGeral?: number;
  saldoFinalSkusGeral?: number;
  currentDepositoName: string;
  currentMode: 'sem_ajuste' | 'com_ajuste';
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  isExportTarget?: boolean;
}

export const getPesoStyle = (pct: number, isSobra = false) => {
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

/**
 * Retorna a quantidade de divergência em SKU Fechado (caixas/fardos inteiros).
 * Garante a integridade operacional com e sem ajustes ao alternar o filtro.
 */
export const getDivergenciaSkuFechado = (
  item: DashboardRankingItem,
  isSobra: boolean = false
): number => {
  if (typeof item.diferencaSkus === 'number') {
    return item.diferencaSkus;
  }
  if (item.diferencaRaw && item.diferencaRaw.includes('/')) {
    const rawSkus = item.diferencaRaw.split('/')[0].replace(/[^0-9]/g, '');
    const parsed = parseInt(rawSkus, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const units = isSobra ? Math.max(0, item.diferencaUnits || 0) : Math.abs(item.diferencaUnits || 0);
  const factor = Math.max(1, item.fatorSku || 1);
  return Math.floor(units / factor);
};

export const RecontagemExportSheet: React.FC<RecontagemExportSheetProps> = ({
  exportFaltas,
  exportSobras,
  totalDisplayFaltas,
  totalDisplaySobras,
  saldoFinalDisplay,
  totalGeralPrejuizoFaltas,
  totalGeralValorSobras,
  totalGeralSkusFaltas,
  totalGeralSkusSobras,
  saldoFinalGeral,
  saldoFinalSkusGeral,
  currentDepositoName,
  currentMode,
  selectedIds,
  onToggleSelect,
  isExportTarget = false,
}) => {
  // Garantir simetria de linhas entre Faltas e Sobras para alinhamento estético de planilha
  const maxRows = Math.max(exportFaltas.length, exportSobras.length, 1);

  // Saldo Oficial Geral do Inventário (Equalizado centavo a centavo com o Dashboard)
  const finalSaldoGeral = typeof saldoFinalGeral === 'number' 
    ? saldoFinalGeral 
    : (totalGeralValorSobras - totalGeralPrejuizoFaltas);

  return (
    <div
      className={`font-sans text-slate-900 bg-white ${
        isExportTarget ? 'p-5 w-[1680px]' : 'p-4 sm:p-6 w-full overflow-x-auto'
      }`}
    >
      <div className={`grid ${isExportTarget ? 'grid-cols-[1fr_1fr_370px]' : 'grid-cols-1 xl:grid-cols-[1fr_1fr_360px]'} gap-4 items-start min-w-[1100px]`}>
        
        {/* ================================================================= */}
        {/* COLUNA 1: TABELA RANKING DE FALTAS                                */}
        {/* ================================================================= */}
        <div className="flex flex-col">
          <div className="bg-[#ffc000] text-black font-black text-sm uppercase py-2 text-center tracking-wider border border-slate-400 shadow-2xs">
            RANKING DE FALTAS
          </div>
          <table className="w-full text-xs border-collapse border border-slate-400 mt-1 shadow-2xs">
            <thead>
              <tr className="bg-[#2f3640] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="border border-slate-400 p-1.5 text-center w-9">#</th>
                <th className="border border-slate-400 p-1.5 text-center w-16">COD</th>
                <th className="border border-slate-400 p-1.5 text-left pl-2.5">DESCRIÇÃO</th>
                <th className="border border-slate-400 p-1.5 text-center w-14" title="Quantidade de divergência em SKU Fechado (caixas/fardos inteiros)">QTDE</th>
                <th className="border border-slate-400 p-1.5 text-right pr-2.5 w-28">VALOR R$</th>
                <th className="border border-slate-400 p-1.5 text-center w-14">PESO</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, idx) => {
                const item = exportFaltas[idx];
                if (!item) {
                  return (
                    <tr key={`empty-falta-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                      <td className="border border-slate-300 p-1 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                    </tr>
                  );
                }

                const pct =
                  totalGeralPrejuizoFaltas > 0
                    ? Math.round((item.prejuizoFinanceiro / totalGeralPrejuizoFaltas) * 100)
                    : 0;
                const pesoClass = getPesoStyle(pct, false);
                const isSelected = selectedIds?.has(item.id);

                return (
                  <tr
                    key={`falta-row-${item.id}`}
                    onClick={() => onToggleSelect && onToggleSelect(item.id)}
                    className={`transition ${
                      isSelected
                        ? 'bg-amber-100/70 font-semibold'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-[#f9fafb] hover:bg-slate-50'
                    } ${onToggleSelect ? 'cursor-pointer' : ''}`}
                    title={onToggleSelect ? 'Clique para marcar/desmarcar item para recontagem' : undefined}
                  >
                    <td className="border border-slate-300 p-1.5 text-center text-slate-700 text-[11px] font-mono">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-900 text-[11px]">
                      {item.produto}
                    </td>
                    <td
                      className="border border-slate-300 p-1.5 pl-2.5 font-medium text-slate-900 text-[11px] truncate max-w-[260px]"
                      title={item.descricao}
                    >
                      {item.descricao}
                    </td>
                    <td
                      className="border border-slate-300 p-1.5 text-center font-bold text-slate-900 text-[11px]"
                      title={`${getDivergenciaSkuFechado(item, false)} cx fechadas (${item.diferencaRaw || '0/00'})`}
                    >
                      {getDivergenciaSkuFechado(item, false).toLocaleString('pt-BR')}
                    </td>
                    <td className="border border-slate-300 p-1.5 pr-2.5 text-right font-mono text-[11px] text-slate-900">
                      <div className="flex justify-between items-center w-full px-1">
                        <span className="text-slate-500 font-sans text-[10px]">R$</span>
                        <span>
                          {item.prejuizoFinanceiro.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </td>
                    <td className={`border border-slate-300 p-1.5 text-center text-[11px] ${pesoClass}`}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ================================================================= */}
        {/* COLUNA 2: TABELA RANKING DE SOBRAS                                */}
        {/* ================================================================= */}
        <div className="flex flex-col">
          <div className="bg-[#ffc000] text-black font-black text-sm uppercase py-2 text-center tracking-wider border border-slate-400 shadow-2xs">
            RANKING DE SOBRAS
          </div>
          <table className="w-full text-xs border-collapse border border-slate-400 mt-1 shadow-2xs">
            <thead>
              <tr className="bg-[#2f3640] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="border border-slate-400 p-1.5 text-center w-9">#</th>
                <th className="border border-slate-400 p-1.5 text-center w-16">COD</th>
                <th className="border border-slate-400 p-1.5 text-left pl-2.5">DESCRIÇÃO</th>
                <th className="border border-slate-400 p-1.5 text-center w-14" title="Quantidade de divergência em SKU Fechado (caixas/fardos inteiros)">QTDE</th>
                <th className="border border-slate-400 p-1.5 text-right pr-2.5 w-28">VALOR R$</th>
                <th className="border border-slate-400 p-1.5 text-center w-14">PESO</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, idx) => {
                const item = exportSobras[idx];
                if (!item) {
                  return (
                    <tr key={`empty-sobra-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                      <td className="border border-slate-300 p-1 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                      <td className="border border-slate-300 p-1"></td>
                    </tr>
                  );
                }

                const pct =
                  totalGeralValorSobras > 0
                    ? Math.round((item.sobraFinanceira / totalGeralValorSobras) * 100)
                    : 0;
                const pesoClass = getPesoStyle(pct, true);
                const isSelected = selectedIds?.has(item.id);

                return (
                  <tr
                    key={`sobra-row-${item.id}`}
                    onClick={() => onToggleSelect && onToggleSelect(item.id)}
                    className={`transition ${
                      isSelected
                        ? 'bg-amber-100/70 font-semibold'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-[#f9fafb] hover:bg-slate-50'
                    } ${onToggleSelect ? 'cursor-pointer' : ''}`}
                    title={onToggleSelect ? 'Clique para marcar/desmarcar item para recontagem' : undefined}
                  >
                    <td className="border border-slate-300 p-1.5 text-center text-slate-700 text-[11px] font-mono">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-slate-900 text-[11px]">
                      {item.produto}
                    </td>
                    <td
                      className="border border-slate-300 p-1.5 pl-2.5 font-medium text-slate-900 text-[11px] truncate max-w-[260px]"
                      title={item.descricao}
                    >
                      {item.descricao}
                    </td>
                    <td
                      className="border border-slate-300 p-1.5 text-center font-bold text-slate-900 text-[11px]"
                      title={`${getDivergenciaSkuFechado(item, true)} cx fechadas (${item.diferencaRaw || '0/00'})`}
                    >
                      {getDivergenciaSkuFechado(item, true).toLocaleString('pt-BR')}
                    </td>
                    <td className="border border-slate-300 p-1.5 pr-2.5 text-right font-mono text-[11px] text-slate-900">
                      <div className="flex justify-between items-center w-full px-1">
                        <span className="text-slate-500 font-sans text-[10px]">R$</span>
                        <span>
                          {item.sobraFinanceira > 0
                            ? item.sobraFinanceira.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ''}
                        </span>
                      </div>
                    </td>
                    <td className={`border border-slate-300 p-1.5 text-center text-[11px] ${pesoClass}`}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ================================================================= */}
        {/* COLUNA 3: PAINEL DE TOTAIS E SALDO FINAL                          */}
        {/* (SEM OS BOTÕES CONGELAR, SALVAR DIF OU LIMPAR DIF)                */}
        {/* ================================================================= */}
        <div className="flex flex-col space-y-3.5 pt-0.5">
          {/* Bloco de Informações Executivas do Armazém */}
          <div className="border border-slate-400 bg-slate-50 p-3.5 rounded shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                RELATÓRIO EXECUTIVO DE DIVERGÊNCIAS
              </div>
              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300">
                ✓ Padronizado
              </span>
            </div>
            <div className="font-bold text-slate-900 text-sm mt-1">{currentDepositoName}</div>
            <div className="text-xs text-slate-700 mt-1">
              Modo:{' '}
              <strong className={currentMode === 'com_ajuste' ? 'text-teal-700' : 'text-rose-700'}>
                {currentMode === 'com_ajuste' ? 'COM AJUSTES (Equalizado)' : 'SEM AJUSTE (Bruto)'}
              </strong>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Emissão: {new Date().toLocaleDateString('pt-BR')} às{' '}
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Boxes de TOTAL FALTAS e TOTAL SOBRAS lado a lado */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Box TOTAL FALTAS (Oficial Geral do Inventário) */}
            <div className="border border-slate-500 shadow-2xs">
              <div className="bg-[#2f3640] text-white text-center font-bold text-xs py-1.5 uppercase tracking-wider">
                TOTAL FALTAS
              </div>
              <div className="bg-white p-2.5 text-right font-mono font-bold text-xs text-slate-900 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-sans font-normal">R$</span>
                  <span>
                    {totalGeralPrejuizoFaltas.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {typeof totalGeralSkusFaltas === 'number' && totalGeralSkusFaltas > 0 && (
                  <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                    {totalGeralSkusFaltas.toLocaleString('pt-BR')} cx
                  </div>
                )}
              </div>
            </div>

            {/* Box TOTAL SOBRAS (Oficial Geral do Inventário) */}
            <div className="border border-slate-500 shadow-2xs">
              <div className="bg-[#2f3640] text-white text-center font-bold text-xs py-1.5 uppercase tracking-wider">
                TOTAL SOBRAS
              </div>
              <div className="bg-white p-2.5 text-right font-mono font-bold text-xs text-slate-900 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-sans font-normal">R$</span>
                  <span>
                    {totalGeralValorSobras.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {typeof totalGeralSkusSobras === 'number' && totalGeralSkusSobras > 0 && (
                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    +{totalGeralSkusSobras.toLocaleString('pt-BR')} cx
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Box Destaque: SALDO FINAL (Oficial Geral do Inventário - Idêntico ao Dashboard) */}
          <div className="border-2 border-slate-700 shadow-sm">
            <div className="bg-[#2f3640] text-white text-center font-black text-sm py-2 uppercase tracking-widest flex items-center justify-center space-x-1">
              <span>SALDO FINAL</span>
              <span className="text-[10px] font-normal text-slate-300">(RESIDUAL)</span>
            </div>
            <div
              className={`${
                finalSaldoGeral < 0
                  ? 'bg-[#fee2e2] text-[#b91c1c] border-t-2 border-[#b91c1c]'
                  : 'bg-[#dcfce7] text-[#15803d] border-t-2 border-[#15803d]'
              } py-5 px-3 flex flex-col items-center justify-center text-center`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-black font-mono">
                  {finalSaldoGeral < 0 ? '-R$' : '+R$'}
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
                  {Math.abs(finalSaldoGeral).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {typeof saldoFinalSkusGeral === 'number' && (
                <div className="text-xs font-bold font-mono mt-1 opacity-90">
                  {finalSaldoGeral === 0 ? '✓ Totalmente Amortizado' : `Residual: ${saldoFinalSkusGeral.toLocaleString('pt-BR')} cx`}
                </div>
              )}
            </div>
          </div>

          {/* Subtotal Informativo dos Itens Listados / Folha (Top 30 ou Seleção) */}
          {(totalDisplayFaltas !== totalGeralPrejuizoFaltas || totalDisplaySobras !== totalGeralValorSobras) && (
            <div className="border border-slate-300 bg-white p-2.5 rounded text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                <span>Subtotal dos Itens na Folha ({exportFaltas.length} Faltas / {exportSobras.length} Sobras)</span>
                {totalGeralPrejuizoFaltas > 0 && (
                  <span className="text-rose-700 font-mono font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    {((totalDisplayFaltas / totalGeralPrejuizoFaltas) * 100).toFixed(0)}% das faltas
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500 font-sans text-[10px]">Faltas:</span>
                  <span className="text-rose-700 font-bold">R$ {totalDisplayFaltas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500 font-sans text-[10px]">Sobras:</span>
                  <span className="text-emerald-700 font-bold">R$ {totalDisplaySobras.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200 flex justify-between items-center text-[11px] font-mono">
                <span className="text-slate-500 font-sans text-[10px]">Saldo da Folha:</span>
                <span className={`font-bold ${saldoFinalDisplay < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {saldoFinalDisplay < 0 ? '-R$' : '+R$'} {Math.abs(saldoFinalDisplay).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Assinaturas Operacionais */}
          <div className="border border-slate-300 bg-white p-3.5 rounded space-y-3.5 text-xs shadow-2xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-600 mb-1">
                Conferente / Recontador:
              </div>
              <div className="border-b border-slate-400 pb-1 h-6"></div>
              <div className="text-[9px] text-slate-400 mt-0.5">Assinatura / Matrícula</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-600 mb-1">
                Supervisor de Armazém:
              </div>
              <div className="border-b border-slate-400 pb-1 h-6"></div>
              <div className="text-[9px] text-slate-400 mt-0.5">Validação Física e Visto</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
