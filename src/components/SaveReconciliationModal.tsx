import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Calendar,
  CheckCircle2, 
  Clock,
  Download, 
  FileSpreadsheet, 
  FolderDown, 
  HelpCircle, 
  Info, 
  Layers, 
  RotateCcw,
  Save, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  X 
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
  UserAccount, 
  FrozenReconciliation 
} from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit } from '../utils/parsers';
import { calculateSkuDeviations, isQuebraPendente, isQuebraFaturada } from '../utils/desviosUtils';
import { buildReconciliationWorkbook, saveExcelWithFolderPicker } from '../utils/excelReconciliationExport';

interface SaveReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSaveAndReset: (savedInfo: { filename: string; frozenRecord: FrozenReconciliation; method: string }) => void;
  stockPositions: StockPositionItem[];
  quebras: QuebraItem[];
  vales: ValeItem[];
  trocas: TrocaItem[];
  faltasMapeadas: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  productsMap: Map<string, ProductMaster>;
  currentUser?: UserAccount | null;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const SaveReconciliationModal: React.FC<SaveReconciliationModalProps> = ({
  isOpen,
  onClose,
  onConfirmSaveAndReset,
  stockPositions,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  selectedDeposito,
  productsMap,
  currentUser,
  weeklyBillingStatus,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rankingPreviewTab, setRankingPreviewTab] = useState<'sem_ajustes' | 'com_ajustes'>('sem_ajustes');

  // Utilitários de data local
  const formatBrDate = (isoYMD: string): string => {
    if (!isoYMD) return '';
    const parts = isoYMD.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoYMD;
  };

  const getLocalIsoDate = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getRelativeIsoDate = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return getLocalIsoDate(d);
  };

  // Data e hora de referência escolhidas pelo colaborador
  const [dataConciliacao, setDataConciliacao] = useState<string>(() => getLocalIsoDate());
  const [horaConciliacao, setHoraConciliacao] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);

  // Nome sugerido dinâmico para a conciliação e para o arquivo Excel
  const defaultTitle = useMemo(() => {
    const brDate = formatBrDate(dataConciliacao);
    const timeFormatted = (horaConciliacao || '18:00').replace(':', 'h');
    return `Conciliação de Estoque - Depósito ${selectedDeposito} - ${brDate} ${timeFormatted}`;
  }, [dataConciliacao, horaConciliacao, selectedDeposito]);

  const [conciliacaoNome, setConciliacaoNome] = useState(defaultTitle);
  const [confirmedAwareness, setConfirmedAwareness] = useState(false);

  // Handlers para atualizar data e hora com sincronização automática do título
  const handleDateChange = (newDate: string) => {
    setDataConciliacao(newDate);
    if (!isTitleManuallyEdited) {
      const brDate = formatBrDate(newDate);
      const timeFormatted = (horaConciliacao || '18:00').replace(':', 'h');
      setConciliacaoNome(`Conciliação de Estoque - Depósito ${selectedDeposito} - ${brDate} ${timeFormatted}`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setHoraConciliacao(newTime);
    if (!isTitleManuallyEdited) {
      const brDate = formatBrDate(dataConciliacao);
      const timeFormatted = (newTime || '18:00').replace(':', 'h');
      setConciliacaoNome(`Conciliação de Estoque - Depósito ${selectedDeposito} - ${brDate} ${timeFormatted}`);
    }
  };

  const handleResetTitleToDefault = () => {
    setIsTitleManuallyEdited(false);
    setConciliacaoNome(defaultTitle);
  };

  // Quebras pendentes de faturamento (apenas semana corrente e datas restantes inseridas)
  const pendingQuebras = useMemo(() => {
    return quebras.filter(q => isQuebraPendente(q, weeklyBillingStatus));
  }, [quebras, weeklyBillingStatus]);

  const billedQuebras = useMemo(() => {
    return quebras.filter(q => isQuebraFaturada(q, weeklyBillingStatus));
  }, [quebras, weeklyBillingStatus]);

  const totalQuebrasPendentesValor = useMemo(() => {
    return pendingQuebras.reduce((acc, q) => acc + q.valorTotal, 0);
  }, [pendingQuebras]);

  const totalQuebrasPendentesUnits = useMemo(() => {
    return pendingQuebras.reduce((acc, q) => acc + q.quantidade, 0);
  }, [pendingQuebras]);

  // 1. Calcula itens ajustados com todos os desvios
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
        faltasMapeadas,
        weeklyBillingStatus
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
  }, [stockPositions, quebras, vales, trocas, faltasMapeadas, weeklyBillingStatus]);

  // 2. Apuração dos Rankings Sem Ajustes (02.05.02)
  const rankingFaltasSemAjustes = useMemo<RankingItem[]>(() => {
    return stockPositions
      .filter(s => s.status === 'FALTA' && s.prejuizoFinanceiro > 0)
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
  }, [stockPositions]);

  const rankingSobrasSemAjustes = useMemo<RankingItem[]>(() => {
    return stockPositions
      .filter(s => s.status === 'SOBRA' && s.sobraFinanceira > 0)
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
  }, [stockPositions]);

  // 3. Apuração dos Rankings Com Ajustes (Equalizado com Desvios)
  const rankingFaltasComAjustes = useMemo<RankingItem[]>(() => {
    return adjustedItems
      .filter(item => item.statusAjustado === 'FALTA_RESIDUAL')
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
  }, [adjustedItems]);

  const rankingSobrasComAjustes = useMemo<RankingItem[]>(() => {
    return adjustedItems
      .filter(item => item.statusAjustado === 'SOBRA_RESIDUAL')
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
  }, [adjustedItems]);

  // Totais Gerais
  const totalFaltasSemAjustesValor = rankingFaltasSemAjustes.reduce((acc, r) => acc + Math.abs(r.impactoFinanceiro), 0);
  const totalSobrasSemAjustesValor = rankingSobrasSemAjustes.reduce((acc, r) => acc + r.impactoFinanceiro, 0);

  const totalFaltasComAjustesValor = rankingFaltasComAjustes.reduce((acc, r) => acc + Math.abs(r.impactoFinanceiro), 0);
  const totalSobrasComAjustesValor = rankingSobrasComAjustes.reduce((acc, r) => acc + r.impactoFinanceiro, 0);

  const totalDesviosValor = adjustedItems.reduce((acc, item) => acc + item.valorDesvios, 0);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!confirmedAwareness) {
      alert("Atenção: Para evitar erros ao salvar, confirme marcando a caixa de que está ciente de que a diferença será congelada na Diferença Diária e na Diferença Congelada.");
      return;
    }

    setIsProcessing(true);
    try {
      // Data e hora de referência escolhidas
      const [year, month, day] = dataConciliacao.split('-').map(Number);
      const [hours, minutes] = (horaConciliacao || '18:00').split(':').map(Number);
      const recordDate = new Date(year, (month || 1) - 1, day || 1, hours || 18, minutes || 0);
      const isoString = recordDate.toISOString();
      const brDate = formatBrDate(dataConciliacao);
      const safeTimeStr = (horaConciliacao || '18:00').replace(':', 'h');

      // 1. Gera o arquivo Excel completo com todas as guias
      const safeFilename = `Conciliacao_Estoque_Ambev_Dep_${selectedDeposito}_${dataConciliacao}_${safeTimeStr}.xlsx`
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      const wb = buildReconciliationWorkbook({
        stockPositions,
        adjustedItems,
        rankingSobrasSemAjustes,
        rankingFaltasSemAjustes,
        rankingSobrasComAjustes,
        rankingFaltasComAjustes,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        selectedDeposito,
        nomeConciliacao: conciliacaoNome || defaultTitle,
        usuario: currentUser?.nome || 'Analista de Estoque',
        dataRef: `${brDate} às ${horaConciliacao}`,
        weeklyBillingStatus
      });

      // 2. Abre seletor de pasta nativo no computador do colaborador
      const saveRes = await saveExcelWithFolderPicker(wb, safeFilename);

      if (!saveRes.success) {
        // Usuário cancelou o diálogo de salvar do Windows
        setIsProcessing(false);
        return;
      }

      // 3. Monta o registro de congelamento para persistência com data escolhida
      const frozenRecord: FrozenReconciliation = {
        id: `congelamento_${Date.now()}`,
        dataCongelamento: isoString,
        dataReferencia: dataConciliacao,
        horaReferencia: horaConciliacao,
        nome: conciliacaoNome || defaultTitle,
        name: conciliacaoNome || defaultTitle,
        date: brDate,
        time: horaConciliacao,
        totalItems: stockPositions.length,
        totalPrejuizo: totalFaltasSemAjustesValor,
        totalSobras: totalSobrasSemAjustesValor,
        acuraciaInventario: (totalSobrasSemAjustesValor + totalFaltasSemAjustesValor === 0) ? 100 : 98.4,
        usuario: currentUser?.nome || 'Analista de Estoque',
        deposito: selectedDeposito,
        totalSkus: stockPositions.length,

        totalFaltasSemAjustesValor,
        totalSobrasSemAjustesValor,
        saldoLiquidoSemAjustesValor: totalSobrasSemAjustesValor - totalFaltasSemAjustesValor,
        totalHlSemAjustes: stockPositions.reduce((acc, s) => acc + s.impactoHl, 0),

        totalDesviosValor,
        totalQuebrasValor: totalQuebrasPendentesValor,
        totalValesValor: vales.reduce((acc, v) => acc + v.valorTotal, 0),
        totalTrocasValor: trocas.reduce((acc, t) => acc + t.valorTotal, 0),
        totalFaltasValor: faltasMapeadas.reduce((acc, f) => acc + (f.valorTotal || 0), 0),

        totalFaltasComAjustesValor,
        totalSobrasComAjustesValor,
        saldoLiquidoComAjustesValor: totalSobrasComAjustesValor - totalFaltasComAjustesValor,
        totalHlComAjustes: adjustedItems.reduce((acc, item) => acc + item.impactoHlResidual, 0),

        rankingSobrasSemAjustes,
        rankingFaltasSemAjustes,
        rankingSobrasComAjustes,
        rankingFaltasComAjustes,

        itensSemAjustes: stockPositions,
        itensComAjustes: adjustedItems
      };

      // 4. Executa o callback no App (Zera 02.05.02, salva histórico, preserva deviações)
      onConfirmSaveAndReset({
        filename: saveRes.filename,
        frozenRecord,
        method: saveRes.method
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar e congelar conciliação:', err);
      alert(`Erro ao salvar conciliação: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Salvar & Congelar Conciliação Diária</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Depósito {selectedDeposito}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Gera a planilha oficial em Excel com guias separadas e arquiva o ranking diário
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">

          {/* PERGUNTA DE CERTEZA & ALERTA CRÍTICO DESTACADO SOLICITADO PELO USUÁRIO */}
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-sm space-y-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <span>Tem certeza de que deseja salvar a diferença?</span>
                </h3>
                <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                  <strong>AVISO OBRIGATÓRIO (PARA NÃO TER ERRO AO SALVAR):</strong> Se salvar a diferença, ela <strong>será congelada na Diferença Diária e na Diferença Congelada</strong> (alimentando a conciliação diária e a matriz de divergência mensal).
                </p>
                <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Apenas o relatório de estoque físico <strong>02.05.02 será arquivado e zerado</strong> para a próxima contagem. As demais guias operacionais (<strong>Trocas, Vales, Faltas e Quebras</strong>) permanecerão com seus históricos intactos.
                  </span>
                </div>
              </div>
            </div>

            {/* Checkbox de confirmação explícita */}
            <div className="pt-2 border-t border-amber-200">
              <label className="flex items-center gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-50/50 transition">
                <input
                  type="checkbox"
                  checked={confirmedAwareness}
                  onChange={(e) => setConfirmedAwareness(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  Sim, tenho certeza de que desejo salvar a diferença e confirmo que ela será congelada na Diferença Diária e na Diferença Congelada.
                </span>
              </label>
            </div>
          </div>

          {/* SELETOR DE DATA DA CONCILIAÇÃO (SOLICITADO PELO USUÁRIO) */}
          <div className="p-4 rounded-xl bg-blue-50/70 border-2 border-blue-300 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-black text-blue-950 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Data de Referência da Conciliação (Data do Inventário / Contagem):</span>
              </label>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-200/80 px-2 py-0.5 rounded-md">
                Define a coluna do dia na Diferença Mensal
              </span>
            </div>

            <p className="text-[11px] text-blue-900 leading-relaxed font-medium">
              Escolha a data exata a que se refere esta conciliação. Os saldos, faltas e sobras serão congelados nesta data de fechamento na <strong>Diferença Diária</strong> e na respectiva coluna da <strong>Diferença Mensal</strong>.
            </p>

            {/* Chips de atalhos rápidos de data */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1">Atalhos rápidos:</span>
              <button
                type="button"
                onClick={() => handleDateChange(getLocalIsoDate())}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  dataConciliacao === getLocalIsoDate()
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-50'
                }`}
              >
                <span>Hoje ({formatBrDate(getLocalIsoDate())})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(getRelativeIsoDate(-1))}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  dataConciliacao === getRelativeIsoDate(-1)
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-50'
                }`}
              >
                <span>Ontem ({formatBrDate(getRelativeIsoDate(-1))})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(getRelativeIsoDate(-2))}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  dataConciliacao === getRelativeIsoDate(-2)
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-50'
                }`}
              >
                <span>Anteontem ({formatBrDate(getRelativeIsoDate(-2))})</span>
              </button>
            </div>

            {/* Campos de Data e Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Data da Conciliação:
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dataConciliacao}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Horário do Fechamento:
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={horaConciliacao}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Nome da Conciliação */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">
                Identificação / Nome do Registro da Conciliação:
              </label>
              {isTitleManuallyEdited && (
                <button
                  type="button"
                  onClick={handleResetTitleToDefault}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Restaurar nome automático sincronizado com a data selecionada"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sincronizar com Data</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={conciliacaoNome}
              onChange={(e) => {
                setIsTitleManuallyEdited(true);
                setConciliacaoNome(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Ex: Conciliação de Fechamento Diário - Depósito 01"
            />
          </div>

          {/* KPI COMPARATIVO: SEM AJUSTES VS COM AJUSTES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                SKUs Conciliados
              </span>
              <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                {stockPositions.length} <span className="text-xs text-slate-400 font-normal">produtos</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Posição física vs sistêmica
              </span>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                Faltas (Sem Ajustes)
              </span>
              <div className="text-lg font-bold text-rose-800 font-mono mt-0.5 truncate">
                {formatCurrency(totalFaltasSemAjustesValor)}
              </div>
              <span className="text-[10px] text-rose-600 block mt-0.5">
                {rankingFaltasSemAjustes.length} itens com falta física
              </span>
            </div>

            <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
                Faltas (Com Ajustes)
              </span>
              <div className="text-lg font-bold text-teal-900 font-mono mt-0.5 truncate">
                {formatCurrency(totalFaltasComAjustesValor)}
              </div>
              <span className="text-[10px] text-teal-700 block mt-0.5">
                Residual após {formatCurrency(totalDesviosValor)} em desvios
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Sobras (Com Ajustes)
              </span>
              <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5 truncate">
                {formatCurrency(totalSobrasComAjustesValor)}
              </div>
              <span className="text-[10px] text-emerald-700 block mt-0.5">
                {rankingSobrasComAjustes.length} itens com sobra residual
              </span>
            </div>
          </div>

          {/* Card de Regra de Negócio Ambev: Quebras no Congelamento & Amortização */}
          <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Congelamento de Quebras & Amortização de Divergências:</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 text-blue-900">
                Semana 31/08 - 05/09 + Datas Restantes
              </span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Conforme a regra operacional Ambev, <strong>apenas as quebras pendentes desta semana corrente e datas restantes inseridas</strong> são consideradas no congelamento que impacta a amortização das divergências no final. Semanas anteriores já foram baixadas e faturadas, permanecendo arquivadas sem duplicar baixa contábil.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-semibold text-blue-900 shadow-xs">
                Amortizando Estoque: <strong>{formatCurrency(totalQuebrasPendentesValor)}</strong> ({pendingQuebras.length} registros | {totalQuebrasPendentesUnits} un.)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/70 border border-slate-200 text-slate-600">
                Histórico Já Baixado: <strong>{billedQuebras.length} registros</strong> (não amortiza)
              </span>
            </div>
          </div>

          {/* Guias do Excel que serão geradas */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Guias do Excel separadas incluídas no arquivo (.xlsx):</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>1. Conciliação Padrão</strong>
                <span className="block text-[10px] text-slate-500">Sem ajustes (02.05.02)</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>2. Conciliação c/ Ajustes</strong>
                <span className="block text-[10px] text-slate-500">Equalizada com desvios</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>3. Rankings Sobras/Faltas</strong>
                <span className="block text-[10px] text-slate-500">Com e sem ajustes</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>4. Trocas e Reposições</strong>
                <span className="block text-[10px] text-slate-500">{trocas.length} registros</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>5. Vales de Rota</strong>
                <span className="block text-[10px] text-slate-500">{vales.length} registros</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                <strong>6. Faltas Mapeadas</strong>
                <span className="block text-[10px] text-slate-500">{faltasMapeadas.length} registros</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700 col-span-2">
                <strong>7. Quebras de Armazém</strong>
                <span className="block text-[10px] text-slate-500">{quebras.length} registros de avarias</span>
              </div>
            </div>
          </div>

          {/* PREVIEW DOS RANKINGS DO DIA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pré-visualização do Ranking de Sobras e Faltas:</span>
              </span>

              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setRankingPreviewTab('sem_ajustes')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    rankingPreviewTab === 'sem_ajustes'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sem Ajustes (02.05.02)
                </button>
                <button
                  type="button"
                  onClick={() => setRankingPreviewTab('com_ajustes')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    rankingPreviewTab === 'com_ajustes'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Com Ajustes (Equalizado)
                </button>
              </div>
            </div>

            {rankingPreviewTab === 'sem_ajustes' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Top Faltas Sem Ajustes */}
                <div className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-3.5 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                    <span className="font-bold text-rose-800 text-xs flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>Maiores Faltas (Sem Ajustes)</span>
                    </span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                      {rankingFaltasSemAjustes.length} SKUs
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                    {rankingFaltasSemAjustes.slice(0, 8).map(r => (
                      <div key={r.codigo} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 mr-1.5">#{r.posicao}</span>
                          <span className="font-mono text-slate-600 font-semibold">{r.codigo}</span> - <span className="text-slate-700">{r.descricao}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-rose-600 font-mono block">
                            {formatCurrency(r.impactoFinanceiro)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {r.quantidadeRaw} cx
                          </span>
                        </div>
                      </div>
                    ))}
                    {rankingFaltasSemAjustes.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">Nenhuma falta apurada.</div>
                    )}
                  </div>
                </div>

                {/* Top Sobras Sem Ajustes */}
                <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-3.5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <span className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Maiores Sobras (Sem Ajustes)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {rankingSobrasSemAjustes.length} SKUs
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                    {rankingSobrasSemAjustes.slice(0, 8).map(r => (
                      <div key={r.codigo} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 mr-1.5">#{r.posicao}</span>
                          <span className="font-mono text-slate-600 font-semibold">{r.codigo}</span> - <span className="text-slate-700">{r.descricao}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-emerald-600 font-mono block">
                            +{formatCurrency(r.impactoFinanceiro)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            +{r.quantidadeRaw} cx
                          </span>
                        </div>
                      </div>
                    ))}
                    {rankingSobrasSemAjustes.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">Nenhuma sobra apurada.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Top Faltas Residuais Com Ajustes */}
                <div className="bg-white border border-teal-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-3.5 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                    <span className="font-bold text-teal-900 text-xs flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-teal-700" />
                      <span>Faltas Residuais (Com Ajustes)</span>
                    </span>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                      {rankingFaltasComAjustes.length} SKUs
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                    {rankingFaltasComAjustes.slice(0, 8).map(r => (
                      <div key={r.codigo} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 mr-1.5">#{r.posicao}</span>
                          <span className="font-mono text-slate-600 font-semibold">{r.codigo}</span> - <span className="text-slate-700">{r.descricao}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-teal-700 font-mono block">
                            {formatCurrency(r.impactoFinanceiro)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {r.quantidadeRaw} cx
                          </span>
                        </div>
                      </div>
                    ))}
                    {rankingFaltasComAjustes.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">
                        Nenhuma falta residual! Todos os desvios foram equalizados.
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Sobras Residuais Com Ajustes */}
                <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-3.5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <span className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sobras Residuais (Com Ajustes)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {rankingSobrasComAjustes.length} SKUs
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                    {rankingSobrasComAjustes.slice(0, 8).map(r => (
                      <div key={r.codigo} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 mr-1.5">#{r.posicao}</span>
                          <span className="font-mono text-slate-600 font-semibold">{r.codigo}</span> - <span className="text-slate-700">{r.descricao}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-emerald-600 font-mono block">
                            +{formatCurrency(r.impactoFinanceiro)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            +{r.quantidadeRaw} cx
                          </span>
                        </div>
                      </div>
                    ))}
                    {rankingSobrasComAjustes.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">Nenhuma sobra residual apurada.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Explicação da Escolha de Pasta */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2.5">
            <FolderDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              Ao clicar no botão de confirmação, será aberta a janela oficial do seu sistema operacional permitindo <strong>escolher exatamente em qual pasta do seu computador deseja salvar o arquivo Excel</strong>.
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || stockPositions.length === 0 || !confirmedAwareness}
            className={`px-5 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 active:scale-95 cursor-pointer ${
              confirmedAwareness && !isProcessing && stockPositions.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                <span>Gerando Excel & Congelando Diferença...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Diferença & Congelar na Dif Diária e Congelada</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
