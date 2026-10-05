import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calculator, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  Sparkles, 
  RefreshCw, 
  ArrowLeftRight, 
  Plus, 
  Minus, 
  Trash2,
  AlertCircle,
  Building2,
  Sliders,
  Scale,
  FileSpreadsheet,
  Download,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { 
  InversaoPair, 
  InversaoStockItem, 
  DepositoId, 
  SimuladorFiscalConfig,
  SimuladorFiscalResultado 
} from '../types';
import { DEPOSITOS } from '../data/initialData';
import { simularAbatimentoFiscal, recalculatePairValues, getProductConversionRatio } from '../utils/inversaoUtils';
import { exportPlanilhaModeloFiscalExcel } from '../utils/excelInversaoExport';

interface SimuladorFiscalModalProps {
  isOpen: boolean;
  onClose: () => void;
  todasSobrasDisponiveis: InversaoStockItem[];
  todasFaltasDisponiveis: InversaoStockItem[];
  onApplySimulation: (paresSimulados: InversaoPair[]) => void;
}

export const SimuladorFiscalModal: React.FC<SimuladorFiscalModalProps> = ({
  isOpen,
  onClose,
  todasSobrasDisponiveis,
  todasFaltasDisponiveis,
  onApplySimulation,
}) => {
  // Estado da Configuração
  const [metaValor, setMetaValor] = useState<number>(5000);
  const [inputMetaStr, setInputMetaStr] = useState<string>('5000');
  const [deposito, setDeposito] = useState<DepositoId | 'ALL'>('ALL');
  const [apenasMesmoGrupo, setApenasMesmoGrupo] = useState<boolean>(true);
  const [estrategia, setEstrategia] = useState<'META_PRECISA' | 'MAX_RETORNO' | 'MAIORES_FALTAS'>('META_PRECISA');
  const [viewMode, setViewMode] = useState<'PLANILHA' | 'CARDS'>('PLANILHA');
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado dos pares simulados (editáveis manualmente no próprio simulador)
  const [paresSimulados, setParesSimulados] = useState<InversaoPair[]>([]);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  // Calcula o valor total de faltas fiscais reais disponíveis no depósito selecionado
  const totalFaltasDisponiveisValor = useMemo(() => {
    const filtered = deposito === 'ALL' 
      ? todasFaltasDisponiveis 
      : todasFaltasDisponiveis.filter(f => f.deposito === deposito);
    return filtered.reduce((acc, f) => acc + f.valorTotal, 0);
  }, [todasFaltasDisponiveis, deposito]);

  // Executa o motor de simulação
  const runSimulation = (targetValue: number) => {
    const config: SimuladorFiscalConfig = {
      metaAbatimentoValor: targetValue,
      deposito,
      apenasMesmoGrupo,
      estrategia
    };

    const res: SimuladorFiscalResultado = simularAbatimentoFiscal(
      todasSobrasDisponiveis,
      todasFaltasDisponiveis,
      config
    );

    setParesSimulados(res.paresSugeridos);
    setHasCalculated(true);
  };

  // Inicializa a simulação ao abrir se ainda não tiver calculado
  React.useEffect(() => {
    if (isOpen && !hasCalculated) {
      runSimulation(metaValor);
    }
  }, [isOpen]);

  // Recalcular ao alterar configuração automática
  const handleRecalculate = () => {
    const val = parseFloat(inputMetaStr.replace(/\D/g, '')) || 0;
    const finalVal = val > 0 ? val : 5000;
    setMetaValor(finalVal);
    runSimulation(finalVal);
  };

  // Atalhos rápidos de metas
  const handleSelectQuickTarget = (val: number) => {
    const rounded = Math.round(val);
    setMetaValor(rounded);
    setInputMetaStr(rounded.toString());
    runSimulation(rounded);
  };

  // Alteração de quantidade de um par dentro do simulador
  const handleChangeQtd = (pairId: string, newQtd: number) => {
    setParesSimulados(prev => prev.map(p => {
      if (p.id === pairId) {
        return recalculatePairValues(p, newQtd);
      }
      return p;
    }));
  };

  // Remover um par do plano de simulação
  const handleRemovePair = (pairId: string) => {
    setParesSimulados(prev => prev.filter(p => p.id !== pairId));
  };

  // Totais em tempo real da lista atual de simulação
  const totals = useMemo(() => {
    const totalAbatido = paresSimulados.reduce((acc, p) => acc + p.valorSaida, 0);
    const totalEntrada = paresSimulados.reduce((acc, p) => acc + p.valorEntrada, 0);
    const saldo = totalEntrada - totalAbatido;
    const totalSobraSkus = paresSimulados.reduce((acc, p) => acc + p.quantidadeInversaoSkus, 0);
    const totalSaidaSkus = paresSimulados.reduce((acc, p) => acc + (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus), 0);
    const totalUnits = paresSimulados.reduce((acc, p) => acc + p.quantidadeInversaoUnits, 0);
    const percent = metaValor > 0 ? Math.min(150, (totalAbatido / metaValor) * 100) : 0;

    return {
      totalAbatido,
      totalEntrada,
      saldo,
      totalSobraSkus,
      totalSaidaSkus,
      totalUnits,
      percent
    };
  }, [paresSimulados, metaValor]);

  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  // Exportar Excel no modelo idêntico da imagem do usuário
  const handleExportModelExcel = async () => {
    if (paresSimulados.length === 0) return;
    setIsExportingExcel(true);
    try {
      const res = await exportPlanilhaModeloFiscalExcel({
        pares: paresSimulados,
        selectedDeposito: deposito,
      });
      if (res.success) {
        setToastMessage(`Planilha Modelo Fiscal exportada com sucesso: ${res.filename}`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao exportar planilha modelo.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl max-h-[94vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Toast Notification Interno */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-60 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Cabeçalho do Modal */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-600 via-slate-900 to-slate-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Simulador de Abatimento Fiscal
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                  Metodologia DPO
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Simule metas em R$ para abater do saldo faltante do estoque fiscal através de inversões inteligentes do mesmo grupo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Painel Superior: Definição da Meta e Filtros */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            
            {/* Input da Meta em R$ */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>Meta a Abater das Faltas Fiscais (R$):</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                  R$
                </span>
                <input
                  type="number"
                  step="100"
                  min="100"
                  value={inputMetaStr}
                  onChange={(e) => setInputMetaStr(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecalculate()}
                  placeholder="Ex: 5000"
                  className="w-full bg-white border-2 border-amber-400/80 rounded-xl pl-9 pr-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                />
              </div>
            </div>

            {/* Atalhos Rápidos */}
            <div className="md:col-span-5 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Atalhos de Metas Financeiras:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1000, 2500, 5000, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectQuickTarget(val)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      metaValor === val
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    R$ {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}

                {/* Atalho Especial: Abater 100% das faltas apuradas no depósito */}
                {totalFaltasDisponiveisValor > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectQuickTarget(totalFaltasDisponiveisValor)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                    title="Definir meta igual ao total de faltas financeiras apuradas no depósito para equalizar todo o fiscal"
                  >
                    <span>100% Faltas ({formatMoney(totalFaltasDisponiveisValor)})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Estratégia de Otimização */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Estratégia:</span>
              </label>
              <select
                value={estrategia}
                onChange={(e) => setEstrategia(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="META_PRECISA">🎯 Meta Precisa (Próximo de R$ {metaValor})</option>
                <option value="MAX_RETORNO">💰 Maior Retorno Fiscal</option>
                <option value="MAIORES_FALTAS">📦 Maiores Faltas Primeiro</option>
              </select>
            </div>
          </div>

          {/* Filtros complementares e botões de ação */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Depósito */}
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-600">Depósito:</span>
                <select
                  value={deposito}
                  onChange={(e) => setDeposito(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Todos os Depósitos</option>
                  {DEPOSITOS.map(d => (
                    <option key={d.id} value={d.id}>Depósito {d.id} - {d.nome}</option>
                  ))}
                </select>
              </div>

              {/* Checkbox mesmo grupo */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-semibold">
                <input
                  type="checkbox"
                  checked={apenasMesmoGrupo}
                  onChange={(e) => setApenasMesmoGrupo(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Restringir estritamente ao mesmo grupo</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecalculate}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recalcular Simulação</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BANNER OFICIAL DA METODOLOGIA FISCAL (IDÊNTICO À PLANILHA DA IMAGEM)       */}
        {/* ========================================================================= */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-md">
            
            {/* 1. VALOR ENTRADA (Amarelo Âmbar da Planilha) */}
            <div className="bg-[#FFC000] p-3 text-center border-b md:border-b-0 md:border-r border-amber-600/30">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-950 block">
                VALOR ENTRADA
              </span>
              <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                <span className="text-xs font-black text-slate-800">R$</span>
                <span className="text-2xl font-black font-mono text-slate-950">
                  {totals.totalEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-800 block mt-0.5">
                Sobras físicas que entrarão no fiscal ({totals.totalSobraSkus} SKU{totals.totalSobraSkus !== 1 ? 's' : ''})
              </span>
            </div>

            {/* 2. BALANÇO FISCAL (Preto Alto Contraste da Planilha) */}
            <div className="bg-black p-3 text-center text-white border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#FFC000]">
                    BALANÇO FISCAL
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Variação Contábil
                  </span>
                </div>
                <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-slate-400">R$</span>
                  <span className={`text-2xl font-black font-mono ${
                    totals.saldo > 0 ? 'text-emerald-400' : totals.saldo < 0 ? 'text-amber-300' : 'text-slate-200'
                  }`}>
                    {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                  {totals.saldo > 0 ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      ▲ Aumentando Valor Fiscal (+{formatMoney(totals.saldo)})
                    </span>
                  ) : totals.saldo < 0 ? (
                    <span className="text-amber-300 flex items-center gap-0.5">
                      ▼ Variação Fiscal Líquida ({formatMoney(totals.saldo)})
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      = Equalização Neutra
                    </span>
                  )}
                </div>
                {totals.saldo < 0 && (
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] text-emerald-300 font-bold">
                    ✓ Ganho: Abatidos {formatMoney(totals.totalAbatido)} em faltas com {formatMoney(totals.totalEntrada)} em sobras (+{formatMoney(Math.abs(totals.saldo))})
                  </div>
                )}
              </div>
            </div>

            {/* 3. VALOR SAÍDA (Amarelo Âmbar da Planilha) */}
            <div className="bg-[#FFC000] p-3 text-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-950 block">
                VALOR SAÍDA (ABATE DAS FALTAS)
              </span>
              <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                <span className="text-xs font-black text-slate-800">R$</span>
                <span className="text-2xl font-black font-mono text-slate-950">
                  {totals.totalAbatido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-800 block mt-0.5">
                Faltas baixadas do fiscal ({totals.totalSaidaSkus} SKU{totals.totalSaidaSkus !== 1 ? 's' : ''})
              </span>
            </div>
          </div>

          {/* Barra de Progresso em relação à meta solicitada */}
          <div className="flex items-center justify-between text-xs font-bold pt-1">
            <span className="text-slate-700 flex items-center gap-1.5">
              <span>Meta de Abatimento Solicitada:</span>
              <strong className="text-slate-900 font-mono">{formatMoney(metaValor)}</strong>
              <span className="text-slate-400">•</span>
              <span>Abatimento Apurado:</span>
              <strong className="text-amber-800 font-mono">{formatMoney(totals.totalAbatido)}</strong>
            </span>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md font-black text-[11px] font-mono ${
                totals.percent >= 98 && totals.percent <= 105
                  ? 'bg-emerald-600 text-white'
                  : totals.percent > 105
                    ? 'bg-amber-600 text-white'
                    : 'bg-blue-600 text-white'
              }`}>
                {totals.percent.toFixed(1)}% Alcançado
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Alternância de Visualização e Ações da Lista */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Formato de Visualização:</span>
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('PLANILHA')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'PLANILHA'
                    ? 'bg-[#FFC000] text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Modelo Planilha Fiscal (Lado a Lado)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Modo Cards Interativos</span>
              </button>
            </div>
          </div>

          {/* Botão de Exportação Direta no Formato da Imagem */}
          <button
            type="button"
            disabled={paresSimulados.length === 0 || isExportingExcel}
            onClick={handleExportModelExcel}
            className="px-3.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Baixar a planilha em Excel (.xlsx) com a formatação oficial do modelo (Valor Entrada | Balanço Fiscal | Valor Saída)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
            <span>{isExportingExcel ? 'Gerando...' : 'Exportar Modelo Fiscal (Excel)'}</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CORPO DO SIMULADOR: TABELA FISCAL OU CARDS INTERATIVOS                   */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          
          {paresSimulados.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Nenhuma combinação viável encontrada para os critérios atuais.</p>
              <p className="mt-1">Tente desmarcar "Restringir estritamente ao mesmo grupo" ou selecionar "Todos os Depósitos".</p>
            </div>
          ) : viewMode === 'PLANILHA' ? (
            
            /* TABELA MODELO PLANILHA FISCAL (LADO A LADO) */
            <div className="border border-amber-300 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  {/* Linha de Seções ENTRADA vs SAÍDA com faixa preta superior idêntica à imagem */}
                  <tr className="bg-[#FFBF00] text-slate-950 font-black uppercase text-center border-t-4 border-black border-b border-amber-500">
                    <th colSpan={4} className="py-2.5 px-3 border-r-2 border-white tracking-wider text-xs">
                      ENTRADA
                    </th>
                    <th colSpan={4} className="py-2.5 px-3 border-r-2 border-white tracking-wider text-xs">
                      SAÍDA
                    </th>
                    <th colSpan={2} className="py-2.5 px-3 bg-black text-[#FFBF00] tracking-wide text-xs">
                      BALANÇO FISCAL
                    </th>
                  </tr>

                  {/* Linha de Cabeçalhos de Colunas */}
                  <tr className="bg-[#FFC000] text-slate-950 font-black border-b border-amber-400 text-[11px]">
                    {/* ENTRADA */}
                    <th className="py-2 px-2.5 text-center w-20 border-r border-white/60">CÓD</th>
                    <th className="py-2 px-3 border-r border-white/60">PROD</th>
                    <th className="py-2 px-2 text-center w-28 border-r border-white/60">QTDE. (SKU)</th>
                    <th className="py-2 px-2.5 text-right w-24 border-r-2 border-white">VALOR (R$)</th>

                    {/* SAÍDA */}
                    <th className="py-2 px-2.5 text-center w-20 border-r border-white/60">CÓD</th>
                    <th className="py-2 px-3 border-r border-white/60">PROD</th>
                    <th className="py-2 px-2 text-center w-28 border-r border-white/60">QTDE. (SKU)</th>
                    <th className="py-2 px-2.5 text-right w-24 border-r-2 border-white">VALOR (R$)</th>

                    {/* BALANÇO */}
                    <th className="py-2 px-3 text-center bg-slate-950 text-white w-28 border-r border-slate-800">DIFERENÇA</th>
                    <th className="py-2 px-2 text-center bg-slate-950 text-white w-14">AÇÃO</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paresSimulados.map((pair, idx) => {
                    const { label: propLabel, isPersonalizado } = getProductConversionRatio(
                      pair.sobraSku,
                      pair.faltaSku,
                      pair.sobraFatorSku,
                      pair.faltaFatorSku
                    );
                    const qtdSaida = pair.quantidadeSaidaSkus ?? pair.quantidadeInversaoSkus;

                    return (
                      <tr 
                        key={pair.id || idx}
                        className="hover:bg-amber-50/40 transition font-sans"
                      >
                        {/* ENTRADA: CÓD */}
                        <td className="py-2.5 px-2.5 font-mono font-black text-slate-900">
                          {pair.sobraSku}
                        </td>

                        {/* ENTRADA: PROD */}
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="line-clamp-2" title={pair.sobraDescricao}>
                            {pair.sobraDescricao}
                          </div>
                          {isPersonalizado && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 font-mono">
                              {propLabel}
                            </span>
                          )}
                        </td>

                        {/* ENTRADA: SKU COM CONTADOR */}
                        <td className="py-2.5 px-2 text-center font-mono font-black">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleChangeQtd(pair.id, Math.max(1, pair.quantidadeInversaoSkus - 1))}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-slate-900 w-10 text-center font-bold">
                              {pair.quantidadeInversaoSkus}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleChangeQtd(pair.id, pair.quantidadeInversaoSkus + 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({pair.quantidadeInversaoSkus} SKU fechado{pair.quantidadeInversaoSkus !== 1 ? 's' : ''})
                          </span>
                        </td>

                        {/* ENTRADA: VALOR TOTAL */}
                        <td className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-700 border-r border-amber-300">
                          {formatMoney(pair.valorEntrada)}
                        </td>

                        {/* SAÍDA: CÓD */}
                        <td className="py-2.5 px-2.5 font-mono font-black text-slate-900">
                          {pair.faltaSku}
                        </td>

                        {/* SAÍDA: PROD */}
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="line-clamp-2" title={pair.faltaDescricao}>
                            {pair.faltaDescricao}
                          </div>
                        </td>

                        {/* SAÍDA: SKU */}
                        <td className="py-2.5 px-2 text-center font-mono font-black text-rose-700">
                          {qtdSaida}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({qtdSaida} SKU fechado{qtdSaida !== 1 ? 's' : ''})
                          </span>
                        </td>

                        {/* SAÍDA: VALOR TOTAL */}
                        <td className="py-2.5 px-2.5 text-right font-mono font-black text-rose-700 border-r border-amber-300">
                          {formatMoney(pair.valorSaida)}
                        </td>

                        {/* BALANÇO: DIFERENÇA LÍQUIDA */}
                        <td className="py-2.5 px-3 text-center font-mono font-black bg-slate-950">
                          <span className={`${
                            pair.diferencaValor > 0 ? 'text-emerald-400' : pair.diferencaValor < 0 ? 'text-rose-400' : 'text-slate-300'
                          }`}>
                            {formatMoney(pair.diferencaValor)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {pair.diferencaValor >= 0 ? '▲ Aumento' : '▼ Saída'}
                          </span>
                        </td>

                        {/* AÇÃO: REMOVER */}
                        <td className="py-2.5 px-2 text-center bg-slate-950">
                          <button
                            type="button"
                            onClick={() => handleRemovePair(pair.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                            title="Remover par"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          ) : (

            /* MODO CARDS INTERATIVOS */
            paresSimulados.map((pair, idx) => {
              const { label: propLabel, isPersonalizado } = getProductConversionRatio(
                pair.sobraSku,
                pair.faltaSku,
                pair.sobraFatorSku,
                pair.faltaFatorSku
              );
              const qtdSaida = pair.quantidadeSaidaSkus ?? pair.quantidadeInversaoSkus;

              return (
                <div 
                  key={pair.id || idx}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:border-amber-400 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-800">
                        Par #{idx + 1} • Dep. {pair.deposito}
                      </span>
                      <span className="font-bold text-slate-900 truncate max-w-xs">
                        {pair.grupo}
                      </span>

                      {/* Badge de Proporção Especial (Ex: 1 cx = 6 packs) */}
                      {isPersonalizado && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Scale className="w-3 h-3 text-amber-700" />
                          <span>{propLabel}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold text-[11px] ${
                        pair.diferencaValor >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        Balanço: {formatMoney(pair.diferencaValor)} ({pair.diferencaValor >= 0 ? '▲ Aumentando' : '▼ Saindo'})
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemovePair(pair.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                        title="Remover este par da simulação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Detalhes da Inversão: Entrada vs Saída */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 text-xs items-center">
                    
                    {/* Sobra (Entrada) */}
                    <div className="md:col-span-4 bg-[#FFC000]/15 rounded-lg p-2.5 border border-amber-300">
                      <div className="flex items-center justify-between font-bold text-slate-900 text-[11px] mb-1">
                        <span className="text-amber-900 font-black">ENTRADA (Sobra Física)</span>
                        <span className="font-mono text-slate-900 font-black">SKU {pair.sobraSku}</span>
                      </div>
                      <p className="text-slate-800 font-bold line-clamp-1" title={pair.sobraDescricao}>
                        {pair.sobraDescricao}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 font-mono">
                        <span>Disp: {pair.sobraDisponivelSkus} SKU</span>
                        <span className="font-bold text-emerald-800">Total: {formatMoney(pair.valorEntrada)}</span>
                      </div>
                    </div>

                    {/* Centro: Quantidade & Conversão */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center py-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Inversão (SKU)
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangeQtd(pair.id, Math.max(1, pair.quantidadeInversaoSkus - 1))}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer active:scale-95"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <div className="text-center px-2">
                          <span className="text-base font-black text-slate-900 font-mono">
                            {pair.quantidadeInversaoSkus} SKU
                          </span>
                          <span className="block text-[10px] font-bold text-blue-700 font-mono">
                            = {qtdSaida} SKU (Saída)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleChangeQtd(pair.id, pair.quantidadeInversaoSkus + 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-400 mt-1 font-mono">
                        ({pair.quantidadeInversaoUnits} un físicas equalizadas)
                      </span>
                    </div>

                    {/* Falta (Saída) */}
                    <div className="md:col-span-4 bg-rose-50 rounded-lg p-2.5 border border-rose-200">
                      <div className="flex items-center justify-between font-bold text-rose-900 text-[11px] mb-1">
                        <span className="font-black">SAÍDA (Falta no Fiscal)</span>
                        <span className="font-mono text-rose-950 font-black">SKU {pair.faltaSku}</span>
                      </div>
                      <p className="text-slate-800 font-bold line-clamp-1" title={pair.faltaDescricao}>
                        {pair.faltaDescricao}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1 font-mono">
                        <span>Falta: -{pair.faltaApuradaSkus} SKU</span>
                        <span className="font-black text-rose-700">
                          Abate: {formatMoney(pair.valorSaida)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Ações de Aplicação e Cancelamento */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-600">
            <span>Total da Simulação: </span>
            <strong className="text-amber-800 font-mono font-bold">{formatMoney(totals.totalAbatido)}</strong>
            <span> de falta abatida com </span>
            <strong className="text-slate-800 font-mono font-bold">{paresSimulados.length} pares</strong>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={paresSimulados.length === 0}
              onClick={() => {
                onApplySimulation(paresSimulados);
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-black disabled:bg-slate-300 text-white text-xs font-black transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 border border-amber-400/40"
            >
              <Check className="w-4 h-4 text-amber-400" />
              <span>Aplicar Simulação à Tela Principal ({formatMoney(totals.totalAbatido)})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
