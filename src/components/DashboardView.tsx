import React, { useMemo, useState } from 'react';
import { 
  TrendingDown, 
  TrendingUp,
  AlertOctagon, 
  Boxes, 
  Droplet, 
  ShieldCheck, 
  Scale, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  CircleDollarSign,
  Filter,
  FileSpreadsheet,
  Maximize2,
  Camera,
  ImageDown,
  CheckSquare,
  Printer,
  X,
  FileText,
  CheckCircle2,
  PlusCircle
} from 'lucide-react';
import { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId,
  ViewTab,
  FrozenReconciliation
} from '../types';
import { formatCurrency, formatHectoliters, formatNumber, formatSkuUnit } from '../utils/parsers';
import { 
  calculateSkuDeviations, 
  isQuebraPendente, 
  isQuebraFaturada, 
  isValePendente, 
  isTrocaPendente 
} from '../utils/desviosUtils';
import { DEPOSITOS } from '../data/initialData';
import { RecontagemRankingsModal } from './RecontagemRankingsModal';
import { computeDashboardRankingItems } from '../utils/rankingUtils';

interface DashboardViewProps {
  stockPositions: StockPositionItem[];
  quebras: QuebraItem[];
  vales: ValeItem[];
  trocas: TrocaItem[];
  faltasMapeadas: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  onNavigateTab: (tab: ViewTab) => void;
  onOpenManualFaltaModal: () => void;
  onOpenManualModal?: (type?: 'quebra' | 'vale' | 'troca' | 'falta') => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
  frozenReconciliations?: FrozenReconciliation[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stockPositions,
  quebras,
  vales,
  trocas,
  faltasMapeadas,
  selectedDeposito,
  onNavigateTab,
  onOpenManualFaltaModal,
  onOpenManualModal,
  weeklyBillingStatus,
  frozenReconciliations = [],
}) => {
  // Obter o congelamento mais recente para exibição de status conectado
  const latestFrozen = useMemo(() => {
    if (!frozenReconciliations || frozenReconciliations.length === 0) return null;
    const depFrozens = selectedDeposito === 'ALL'
      ? frozenReconciliations
      : frozenReconciliations.filter(f => f.deposito === selectedDeposito);
    const found = depFrozens[0] || frozenReconciliations[0];
    if (!found) return null;

    const dateObj = found.dataCongelamento ? new Date(found.dataCongelamento) : null;
    const dateFormatted = dateObj && !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('pt-BR')
      : (found.date || '16/09/2026');
    const timeFormatted = dateObj && !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : (found.time || '18:00');

    return {
      ...found,
      name: found.nome || found.name || `Conciliação Congelada Dep. ${found.deposito}`,
      date: dateFormatted,
      time: timeFormatted,
      totalItems: found.totalSkus || found.totalItems || found.itensSemAjustes?.length || 0,
      totalPrejuizo: found.totalFaltasSemAjustesValor ?? found.totalPrejuizo ?? 0,
      totalSobras: found.totalSobrasSemAjustesValor ?? found.totalSobras ?? 0,
      acuraciaInventario: found.acuraciaInventario ?? 98.4
    };
  }, [frozenReconciliations, selectedDeposito]);

  // Configurable ranking limit (Top 5, Top 10, Top 20, Top 50, ALL) - Default to 20
  const [rankingLimit, setRankingLimit] = useState<number | 'ALL'>(20);

  // Modal maximizado e ficha de recontagem
  const [isRecontagemModalOpen, setIsRecontagemModalOpen] = useState(false);
  const [selectedRecountIds, setSelectedRecountIds] = useState<Set<string>>(new Set());

  const handleToggleRecountId = (id: string) => {
    setSelectedRecountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectTopFaltas = (count: number) => {
    setSelectedRecountIds(prev => {
      const next = new Set(prev);
      allRankingFaltas.slice(0, count).forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleSelectTopSobras = (count: number) => {
    setSelectedRecountIds(prev => {
      const next = new Set(prev);
      allRankingSobras.slice(0, count).forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleClearRecountSelection = () => {
    setSelectedRecountIds(new Set());
  };

  // Filter mode requested by user: Com Ajustes (Equalizado) vs Sem Ajustes (Bruto)
  const [dashboardFilterMode, setDashboardFilterMode] = useState<'com_ajustes' | 'sem_ajustes'>('com_ajustes');

  // Ranking view calculation mode: 'sem_ajuste' (bruto: físico vs fiscal) vs 'com_ajuste' (físico + soma de todos os desvios vs fiscal)
  const [rankingAdjustmentMode, setRankingAdjustmentMode] = useState<'com_ajuste' | 'sem_ajuste'>('com_ajuste');

  // Sincronização bidirecional completa entre Painel Geral e Ranking
  const handleToggleFilterMode = (mode: 'com_ajustes' | 'sem_ajustes') => {
    setDashboardFilterMode(mode);
    setRankingAdjustmentMode(mode === 'com_ajustes' ? 'com_ajuste' : 'sem_ajuste');
  };

  const handleToggleRankingMode = (mode: 'com_ajuste' | 'sem_ajuste') => {
    setRankingAdjustmentMode(mode);
    setDashboardFilterMode(mode === 'com_ajuste' ? 'com_ajustes' : 'sem_ajustes');
  };

  // Filter by selected depósito if applicable
  const filteredStock = useMemo(() => {
    if (selectedDeposito === 'ALL') return stockPositions;
    return stockPositions.filter(s => s.deposito === selectedDeposito);
  }, [stockPositions, selectedDeposito]);

  const filteredQuebras = useMemo(() => {
    if (selectedDeposito === 'ALL') return quebras;
    return quebras.filter(q => q.deposito === selectedDeposito);
  }, [quebras, selectedDeposito]);

  // REGRA DE NEGÓCIO CRÍTICA AMBEV:
  // Apenas desvios PENDENTES de faturamento amortizam as diferenças de estoque na conciliação.
  // As quebras, trocas e vales já faturados/baixados foram baixados contabilmente e não amortizam.
  const pendingQuebras = useMemo(() => {
    return filteredQuebras.filter(q => isQuebraPendente(q, weeklyBillingStatus));
  }, [filteredQuebras, weeklyBillingStatus]);

  const faturadasQuebras = useMemo(() => {
    return filteredQuebras.filter(q => isQuebraFaturada(q, weeklyBillingStatus));
  }, [filteredQuebras, weeklyBillingStatus]);

  const filteredVales = useMemo(() => {
    if (selectedDeposito === 'ALL') return vales;
    return vales.filter(v => v.deposito === selectedDeposito);
  }, [vales, selectedDeposito]);

  const pendingVales = useMemo(() => {
    return filteredVales.filter(v => isValePendente(v, weeklyBillingStatus));
  }, [filteredVales, weeklyBillingStatus]);

  const filteredTrocas = useMemo(() => {
    if (selectedDeposito === 'ALL') return trocas;
    return trocas.filter(t => t.deposito === selectedDeposito);
  }, [trocas, selectedDeposito]);

  const pendingTrocas = useMemo(() => {
    return filteredTrocas.filter(t => isTrocaPendente(t, weeklyBillingStatus));
  }, [filteredTrocas, weeklyBillingStatus]);

  const filteredFaltas = useMemo(() => {
    if (selectedDeposito === 'ALL') return faltasMapeadas;
    return faltasMapeadas.filter(f => !f.deposito || f.deposito === selectedDeposito);
  }, [faltasMapeadas, selectedDeposito]);

  // Cache de alta performance dos desvios calculados por SKU
  // Garante 100% de paridade instantânea entre Cards Executivos e Rankings
  const skuDeviationsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateSkuDeviations>>();
    filteredStock.forEach((item) => {
      const sku = String(item.produto).trim();
      const key = `${item.deposito}-${sku}`;
      if (!map.has(key)) {
        const fator = Math.max(1, item.fatorSku || 1);
        const dev = calculateSkuDeviations(
          sku,
          item.deposito,
          fator,
          item.valorUnitario,
          item.valorCaixa,
          item.fatorHl,
          pendingQuebras,
          pendingVales,
          pendingTrocas,
          filteredFaltas,
          weeklyBillingStatus
        );
        map.set(key, dev);
      }
    });
    return map;
  }, [filteredStock, pendingQuebras, pendingVales, pendingTrocas, filteredFaltas, weeklyBillingStatus]);

  // Financial and HL calculations
  const stats = useMemo(() => {
    // 1. Reconciliation Divergences
    let totalDisponivelUnits = 0;
    let totalInventarioUnits = 0;
    let totalDisponivelSkus = 0;
    let totalInventarioSkus = 0;
    let valorTotalEstoqueFisico = 0;
    let valorTotalEstoqueDisponivel = 0;
    let totalPrejuizoConciliacao = 0; // Faltas (R$)
    let totalSobraConciliacao = 0; // Sobras (R$)
    let totalSobraSkus = 0;
    let totalSobraHl = 0;
    let totalPrejuizoHl = 0;
    let totalPrejuizoSkusBruto = 0;
    let totalDiferencaHl = 0;
    let totalItensComFalta = 0;
    let totalItensComSobra = 0;
    let totalItensAcurados = 0;

    filteredStock.forEach((item) => {
      totalDisponivelUnits += item.disponivelTotalUnits;
      totalInventarioUnits += item.inventarioTotalUnits;
      
      const dispSkus = Math.floor(item.disponivelTotalUnits / (item.fatorSku || 1));
      const invSkus = Math.floor(item.inventarioTotalUnits / (item.fatorSku || 1));
      totalDisponivelSkus += dispSkus;
      totalInventarioSkus += invSkus;

      // Valoração total
      valorTotalEstoqueFisico += item.inventarioTotalUnits * item.valorUnitario;
      valorTotalEstoqueDisponivel += item.disponivelTotalUnits * item.valorUnitario;
      
      if (item.diferencaTotalUnits < 0) {
        totalPrejuizoConciliacao += item.prejuizoFinanceiro;
        totalItensComFalta++;
        totalPrejuizoSkusBruto += Math.abs(Math.floor(item.diferencaTotalUnits / (item.fatorSku || 1)));
        totalPrejuizoHl += Math.abs(item.impactoHl);
      } else if (item.diferencaTotalUnits > 0) {
        totalSobraConciliacao += item.sobraFinanceira;
        totalItensComSobra++;
        totalSobraSkus += Math.floor(item.diferencaTotalUnits / (item.fatorSku || 1));
        totalSobraHl += item.impactoHl;
      } else {
        totalItensAcurados++;
      }
      totalDiferencaHl += item.impactoHl;
    });

    const totalItens = filteredStock.length || 1;
    const acuracidadePct = Math.max(0, Math.min(100, (totalItensAcurados / totalItens) * 100));

    // 2. Quebras (Apenas PENDENTES amortizam o estoque físico na conciliação; faturadas já foram baixadas)
    const totalQuebrasValor = pendingQuebras.reduce((acc, q) => acc + (q.valorTotal || 0), 0);
    const totalQuebrasHl = pendingQuebras.reduce((acc, q) => acc + (q.volumeHl || 0), 0);
    const totalQuebrasQtd = pendingQuebras.reduce((acc, q) => acc + (q.quantidade || 0), 0);

    // Quebras Faturadas (Informativo de auditoria - baixadas no financeiro, NÃO amortizam o estoque)
    const totalQuebrasFaturadasValor = faturadasQuebras.reduce((acc, q) => acc + (q.valorTotal || 0), 0);
    const totalQuebrasFaturadasHl = faturadasQuebras.reduce((acc, q) => acc + (q.volumeHl || 0), 0);
    const totalQuebrasFaturadasQtd = faturadasQuebras.reduce((acc, q) => acc + (q.quantidade || 0), 0);
    const totalQuebrasFaturadasCount = faturadasQuebras.length;
    const totalQuebrasPendentesCount = pendingQuebras.length;

    // 3. Vales (Apenas PENDENTES)
    const totalValesValor = pendingVales.reduce((acc, v) => acc + (v.valorTotal || 0), 0);
    const totalValesHl = pendingVales.reduce((acc, v) => acc + (v.volumeHl || 0), 0);
    const totalValesQtd = pendingVales.reduce((acc, v) => acc + (v.quantidade || 0), 0);

    // 4. Trocas & Reposições (Apenas PENDENTES)
    const totalTrocasValor = pendingTrocas.reduce((acc, t) => acc + (t.valorTotal || 0), 0);
    const totalTrocasHl = pendingTrocas.reduce((acc, t) => acc + (t.volumeHl || 0), 0);
    const totalTrocasQtd = pendingTrocas.reduce((acc, t) => acc + (t.quantidade || 0), 0);

    // 5. Faltas Mapeadas (SKU fechado)
    const totalFaltasValor = filteredFaltas.reduce((acc, f) => acc + (f.valorTotal || 0), 0);
    const totalFaltasHl = filteredFaltas.reduce((acc, f) => acc + (f.volumeHl || 0), 0);
    const totalFaltasQtd = filteredFaltas.reduce((acc, f) => acc + (f.quantidade || f.quantidadeSkus || 0), 0);

    // Consolidated Losses
    const prejuizoGeral = totalPrejuizoConciliacao + totalQuebrasValor + totalValesValor + totalTrocasValor + totalFaltasValor;
    const volumeHlGeral = Math.abs(totalDiferencaHl) + totalQuebrasHl + totalValesHl + totalTrocasHl + totalFaltasHl;

    // Fatores de Amortização das Divergências da Conciliação
    const totalPrejuizoConciliacaoBruto = totalPrejuizoConciliacao;
    const totalSobraConciliacaoBruto = totalSobraConciliacao;
    const totalAmortizadoValor = totalQuebrasValor + totalValesValor + totalTrocasValor + totalFaltasValor;
    const totalAmortizadoSkus = totalQuebrasQtd + totalValesQtd + totalTrocasQtd + totalFaltasQtd;

    // 6. Micro-Equalização Rigorosa SKU a SKU (Garante 100% de paridade com o Ranking de Faltas e Sobras)
    let totalPrejuizoResidual = 0;
    let totalSobraResidual = 0;
    let totalPrejuizoResidualSkus = 0;
    let totalSobraResidualSkus = 0;
    let totalPrejuizoResidualHl = 0;
    let totalSobraResidualHl = 0;
    let totalItensEqualizadosAcurados = 0;

    filteredStock.forEach((item) => {
      const sku = String(item.produto).trim();
      const fator = Math.max(1, item.fatorSku || 1);
      const dev = skuDeviationsMap.get(`${item.deposito}-${sku}`) || calculateSkuDeviations(
        sku,
        item.deposito,
        fator,
        item.valorUnitario,
        item.valorCaixa,
        item.fatorHl,
        pendingQuebras,
        pendingVales,
        pendingTrocas,
        filteredFaltas,
        weeklyBillingStatus
      );

      const finalUnits = item.inventarioTotalUnits + dev.total.units;
      const fiscalUnits = item.disponivelTotalUnits;
      let diff = finalUnits - fiscalUnits;
      if (item.saldoNegativoDesconsiderado || fiscalUnits < 0) {
        diff = 0;
      }

      if (diff < 0) {
        totalPrejuizoResidual += Math.abs(diff) * item.valorUnitario;
        totalPrejuizoResidualSkus += Math.floor(Math.abs(diff) / fator);
        totalPrejuizoResidualHl += (Math.abs(diff) / fator) * item.fatorHl;
      } else if (diff > 0) {
        totalSobraResidual += diff * item.valorUnitario;
        totalSobraResidualSkus += Math.floor(diff / fator);
        totalSobraResidualHl += (diff / fator) * item.fatorHl;
      } else {
        totalItensEqualizadosAcurados++;
      }
    });

    const saldoResidualLiquido = totalSobraResidual - totalPrejuizoResidual;
    const divergenciaResidualLiquida = Math.max(0, totalPrejuizoResidual - totalSobraResidual);
    const divergenciaResidualSkus = Math.abs(totalPrejuizoResidualSkus - totalSobraResidualSkus);
    const superavitLiquido = Math.max(0, totalSobraResidual - totalPrejuizoResidual);
    const acuracidadeEqualizadaPct = Math.max(0, Math.min(100, (totalItensEqualizadosAcurados / totalItens) * 100));

    // Saldo Residual antes de sobras (apenas pós-fatores operacionais)
    const residualAposFatores = Math.max(0, totalPrejuizoConciliacaoBruto - totalAmortizadoValor);

    const percentualAmortizadoOperacional = totalPrejuizoConciliacaoBruto > 0 
      ? Math.min(100, (totalAmortizadoValor / totalPrejuizoConciliacaoBruto) * 100) 
      : 100;
    const percentualAmortizadoSobras = totalPrejuizoConciliacaoBruto > 0 
      ? Math.min(100, (totalSobraResidual / totalPrejuizoConciliacaoBruto) * 100) 
      : 0;
    const percentualAmortizadoTotal = totalPrejuizoConciliacaoBruto > 0 
      ? Math.min(100, ((totalPrejuizoConciliacaoBruto - divergenciaResidualLiquida) / totalPrejuizoConciliacaoBruto) * 100) 
      : 100;

    // Equalized Physical vs System units
    const totalPerdasOperacionaisUnits = totalQuebrasQtd + totalValesQtd + totalTrocasQtd + totalFaltasQtd;
    const estoqueEqualizadoUnits = totalDisponivelUnits - totalPerdasOperacionaisUnits;
    const divergenciaResidualUnits = totalInventarioUnits - estoqueEqualizadoUnits;

    return {
      totalItens,
      acuracidadePct,
      acuracidadeEqualizadaPct,
      totalDisponivelUnits,
      totalInventarioUnits,
      totalDisponivelSkus,
      totalInventarioSkus,
      valorTotalEstoqueFisico,
      valorTotalEstoqueDisponivel,
      totalPrejuizoConciliacao: totalPrejuizoConciliacaoBruto,
      totalSobraConciliacao: totalSobraConciliacaoBruto,
      totalSobraSkus,
      totalSobraHl,
      totalPrejuizoHl,
      totalDiferencaHl,
      totalItensComFalta,
      totalItensComSobra,
      totalItensAcurados,
      totalQuebrasValor,
      totalQuebrasHl,
      totalQuebrasQtd,
      totalQuebrasPendentesCount,
      totalQuebrasFaturadasValor,
      totalQuebrasFaturadasHl,
      totalQuebrasFaturadasQtd,
      totalQuebrasFaturadasCount,
      totalValesValor,
      totalValesHl,
      totalValesQtd,
      totalTrocasValor,
      totalTrocasHl,
      totalTrocasQtd,
      totalFaltasValor,
      totalFaltasHl,
      totalFaltasQtd,
      prejuizoGeral,
      volumeHlGeral,
      totalAmortizadoValor,
      totalAmortizadoSkus,
      totalCompensacaoGlobalValor: totalAmortizadoValor + totalSobraResidual,
      totalCompensacaoGlobalSkus: totalAmortizadoSkus + totalSobraResidualSkus,
      totalPrejuizoSkusBruto,
      totalPrejuizoResidual,
      totalSobraResidual,
      totalPrejuizoResidualSkus,
      totalSobraResidualSkus,
      totalPrejuizoResidualHl,
      totalSobraResidualHl,
      saldoResidualLiquido,
      residualAposFatores,
      divergenciaResidualLiquida,
      divergenciaResidualSkus,
      superavitLiquido,
      percentualAmortizadoOperacional,
      percentualAmortizadoSobras,
      percentualAmortizadoTotal,
      percentualAmortizado: percentualAmortizadoTotal,
      totalPerdasOperacionaisUnits,
      estoqueEqualizadoUnits,
      divergenciaResidualUnits,
    };
  }, [filteredStock, pendingQuebras, faturadasQuebras, filteredVales, filteredTrocas, filteredFaltas, weeklyBillingStatus]);

  // Computed ranking items reflecting either "Sem Ajuste" (físico bruto) or "Com Ajuste" (físico + soma de todos os desvios)
  const rankingItems = useMemo(() => {
    return filteredStock.map(item => {
      const sku = String(item.produto).trim();
      const fator = Math.max(1, item.fatorSku || 1);

      // Desvios obtidos do cache unificado (garantia de 100% de paridade com o Painel Geral)
      const dev = skuDeviationsMap.get(`${item.deposito}-${sku}`) || calculateSkuDeviations(
        sku,
        item.deposito,
        fator,
        item.valorUnitario,
        item.valorCaixa,
        item.fatorHl,
        pendingQuebras,
        pendingVales,
        pendingTrocas,
        filteredFaltas,
        weeklyBillingStatus
      );

      // Todas as guias somam uma quantidade de desvios unificada e coerente:
      const totalDesviosSkus = dev.total.skus;
      const totalDesviosUnits = dev.total.units;
      const desviosRaw = dev.total.raw;

      // Físico contado no inventário
      const fisicoUnits = item.inventarioTotalUnits;
      const fisicoRaw = item.inventarioRaw || formatSkuUnit(fisicoUnits, fator);

      // Quantidade Final: o estoque físico soma todos os desvios
      const finalUnits = fisicoUnits + totalDesviosUnits;
      const finalRaw = formatSkuUnit(finalUnits, fator);

      // Fiscal (Disponível 02.05.02)
      const fiscalUnits = item.disponivelTotalUnits;
      const fiscalRaw = item.disponivelRaw || formatSkuUnit(fiscalUnits, fator);

      // Divergência conforme o modo selecionado no botão dos rankings:
      let diferencaUnits = 0;
      let diferencaRaw = '0/00';
      let prejuizoFinanceiro = 0;
      let sobraFinanceira = 0;
      let impactoHl = 0;

      if (rankingAdjustmentMode === 'com_ajuste') {
        // COM AJUSTE: (Físico + Desvios) - Fiscal
        let diff = finalUnits - fiscalUnits;
        if (item.saldoNegativoDesconsiderado || fiscalUnits < 0) {
          diff = 0;
        }
        diferencaUnits = diff;
        diferencaRaw = formatSkuUnit(Math.abs(diff), fator);
        impactoHl = (diff / fator) * item.fatorHl;

        if (diff < 0) {
          prejuizoFinanceiro = Math.abs(diff) * item.valorUnitario;
          sobraFinanceira = 0;
        } else if (diff > 0) {
          prejuizoFinanceiro = 0;
          sobraFinanceira = diff * item.valorUnitario;
        }
      } else {
        // SEM AJUSTE: Físico Puro - Fiscal Puro
        diferencaUnits = item.diferencaTotalUnits;
        diferencaRaw = item.diferencaRaw.replace(/^[-+]/, '');
        prejuizoFinanceiro = item.prejuizoFinanceiro;
        sobraFinanceira = item.sobraFinanceira;
        impactoHl = item.impactoHl;
      }

      return {
        id: item.id,
        produto: item.produto,
        descricao: item.descricao,
        fatorSku: fator,
        fatorHl: item.fatorHl,
        valorUnitario: item.valorUnitario,
        deposito: item.deposito,

        fisicoUnits,
        fisicoRaw,

        totalDesviosSkus,
        totalDesviosUnits,
        desviosRaw,
        quebrasSkus: dev.quebras.skus,
        valesSkus: dev.vales.skus,
        trocasSkus: dev.trocas.skus,
        faltasSkus: dev.faltas.skus,

        finalUnits,
        finalRaw,

        fiscalUnits,
        fiscalRaw,

        diferencaUnits,
        diferencaRaw,
        prejuizoFinanceiro,
        sobraFinanceira,
        impactoHl,
      };
    });
  }, [filteredStock, skuDeviationsMap, rankingAdjustmentMode, pendingQuebras, pendingVales, pendingTrocas, filteredFaltas, weeklyBillingStatus]);

  // Ranking Top Faltas (Prejuízo) e Sobras de acordo com rankingLimit e rankingAdjustmentMode
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

  const rankingFaltas = useMemo(() => {
    return rankingLimit === 'ALL' ? allRankingFaltas : allRankingFaltas.slice(0, rankingLimit);
  }, [allRankingFaltas, rankingLimit]);

  const rankingSobras = useMemo(() => {
    return rankingLimit === 'ALL' ? allRankingSobras : allRankingSobras.slice(0, rankingLimit);
  }, [allRankingSobras, rankingLimit]);

  const totalPrejuizoGeralFaltas = useMemo(() => {
    return allRankingFaltas.reduce((acc, it) => acc + (it.prejuizoFinanceiro || 0), 0);
  }, [allRankingFaltas]);

  const totalValorGeralSobras = useMemo(() => {
    return allRankingSobras.reduce((acc, it) => acc + (it.sobraFinanceira || 0), 0);
  }, [allRankingSobras]);

  const getPercentualImpactoFalta = (prejuizo: number) => {
    if (!totalPrejuizoGeralFaltas || totalPrejuizoGeralFaltas <= 0) return '0,0%';
    const pct = (prejuizo / totalPrejuizoGeralFaltas) * 100;
    return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const getPercentualImpactoSobra = (sobra: number) => {
    if (!totalValorGeralSobras || totalValorGeralSobras <= 0) return '0,0%';
    const pct = (sobra / totalValorGeralSobras) * 100;
    return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  // Deposit comparison stats
  const depositBreakdown = useMemo(() => {
    return DEPOSITOS.map(dep => {
      const depStock = stockPositions.filter(s => s.deposito === dep.id);
      const faltas = depStock.reduce((acc, s) => acc + (s.prejuizoFinanceiro || 0), 0);
      const sobras = depStock.reduce((acc, s) => acc + (s.sobraFinanceira || 0), 0);
      const hlDivergencia = depStock.reduce((acc, s) => acc + Math.abs(s.impactoHl || 0), 0);
      const totalDisp = depStock.reduce((acc, s) => acc + s.disponivelTotalUnits, 0);
      return {
        ...dep,
        totalItens: depStock.length,
        faltas,
        sobras,
        hlDivergencia,
        totalDisp,
      };
    });
  }, [stockPositions]);

  // Status color badge
  const healthStatus = stats.acuracidadePct >= 98 
    ? { label: 'Excelente', color: 'emerald', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : stats.acuracidadePct >= 92 
    ? { label: 'Atenção Operacional', color: 'amber', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
    : { label: 'Crítico / Recontagem Urgente', color: 'rose', bg: 'bg-rose-50 text-rose-700 border-rose-200' };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Top Welcome / Status Banner with Filter Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${healthStatus.bg}`}>
              ● Saúde: {healthStatus.label}
            </span>
            <span className="text-xs text-slate-500">
              Acuracidade {dashboardFilterMode === 'com_ajustes' ? 'Equalizada' : 'Física'}: <strong className="text-slate-800 font-mono font-bold">
                {dashboardFilterMode === 'com_ajustes' 
                  ? `${formatNumber(stats.acuracidadeEqualizadaPct, 1)}%` 
                  : `${formatNumber(stats.acuracidadePct, 1)}%`}
              </strong>
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
              dashboardFilterMode === 'com_ajustes'
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {dashboardFilterMode === 'com_ajustes' ? '✓ Modo: Com Ajustes Ativo' : '● Modo: Sem Ajustes (Bruto)'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
            Painel Geral de Equalização & Conciliação
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1">
            {dashboardFilterMode === 'com_ajustes' 
              ? 'Exibindo a visão equalizada: o inventário físico é somado aos desvios congelados (quebras, vales, trocas, faltas) e amortizado pelas sobras apuradas.'
              : 'Exibindo a visão bruta do inventário: divergência pura entre o disponível fiscal (02.05.02) e a contagem física, sem considerar amortizações.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main User Requested Button: Filtrar com Ajustes / Sem Ajustes */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-300 rounded-lg shadow-2xs">
            <button
              onClick={() => handleToggleFilterMode('sem_ajustes')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                dashboardFilterMode === 'sem_ajustes'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Filtrar visão bruta sem amortização de quebras, vales, trocas e faltas"
            >
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              <span>Sem Ajustes</span>
            </button>

            <button
              onClick={() => handleToggleFilterMode('com_ajustes')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                dashboardFilterMode === 'com_ajustes'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Filtrar visão equalizada com amortização de quebras, vales, trocas, faltas e sobras"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Com Ajustes</span>
            </button>
          </div>

          {/* Navigation CTA depending on filter mode */}
          {dashboardFilterMode === 'com_ajustes' ? (
            <button
              onClick={() => onNavigateTab('conciliacao_ajustes')}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span>Ver Guia com Ajustes</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab('conciliacao')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Ver Conciliação Padrão</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {onOpenManualModal ? (
            <button
              onClick={() => onOpenManualModal('quebra')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              title="Inserir lançamento manual de Quebra, Vale, Troca ou Falta"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>+ Lançamento Manual</span>
            </button>
          ) : (
            <button
              onClick={onOpenManualFaltaModal}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition"
            >
              + Lançar Falta
            </button>
          )}
        </div>
      </div>

      {/* BANNER DE CONEXÃO COERENTE COM CONGELAMENTOS */}
      {latestFrozen && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border border-blue-700/50 rounded-xl p-3.5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-blue-200">
                  Congelamento Conectado:
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-blue-500/30 text-white border border-blue-400/30">
                  {latestFrozen.name}
                </span>
                <span className="text-[11px] text-blue-300 font-mono">
                  {latestFrozen.date} {latestFrozen.time}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-blue-200">
                  Dep. {latestFrozen.deposito}
                </span>
              </div>
              <p className="text-[11px] text-blue-200/80 mt-0.5">
                {latestFrozen.totalItems} SKUs congelados | Prejuízo: <strong className="text-rose-300">{formatCurrency(latestFrozen.totalPrejuizo)}</strong> | Sobras: <strong className="text-emerald-300">{formatCurrency(latestFrozen.totalSobras)}</strong> | Acurácia: <strong className="text-white">{latestFrozen.acuraciaInventario?.toFixed(1) || '100'}%</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onNavigateTab('dif_diaria')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-2xs flex items-center space-x-1 cursor-pointer"
              title="Abrir detalhes das divergências congeladas na tela de Diferença Diária"
            >
              <span>Ver na Dif. Diária</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('congeladas')}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-blue-100 border border-white/20 text-xs font-medium transition cursor-pointer"
              title="Acessar histórico completo de congelamentos salvos"
            >
              Histórico
            </button>
          </div>
        </div>
      )}

      {/* 6 Executive KPI Cards with Total Stock, 02.05.02 alone, Sobras, Amortizações, and Divergência Residual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Estoque Físico Total (Valor do Estoque) */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-white border-2 border-emerald-500/40 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Estoque Físico Total</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <CircleDollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-emerald-700 font-mono tracking-tight truncate" title={formatCurrency(stats.valorTotalEstoqueFisico)}>
              {formatCurrency(stats.valorTotalEstoqueFisico)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Valor Físico Inventariado
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Total Físico (SKU):</span>
            <span className="text-emerald-700 font-mono font-bold">{stats.totalInventarioSkus.toLocaleString('pt-BR')} cx</span>
          </div>
        </div>

        {/* KPI 2: Só a Conciliação 02.05.02 (Sem fatores) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sistêmico (02.05.02)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-blue-700 font-mono tracking-tight truncate" title={formatCurrency(stats.valorTotalEstoqueDisponivel)}>
              {formatCurrency(stats.valorTotalEstoqueDisponivel)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              WMS Disponível Puro
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Total Sistema (SKU):</span>
            <span className="text-blue-700 font-mono font-bold">{stats.totalDisponivelSkus.toLocaleString('pt-BR')} cx</span>
          </div>
        </div>

        {/* KPI 3: Divergência / Faltas da Conciliação */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              {dashboardFilterMode === 'com_ajustes' ? 'Faltas (Com Ajuste)' : 'Faltas (Sem Ajuste)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-rose-600 font-mono tracking-tight" title={formatCurrency(dashboardFilterMode === 'com_ajustes' ? stats.totalPrejuizoResidual : stats.totalPrejuizoConciliacao)}>
              -{formatCurrency(dashboardFilterMode === 'com_ajustes' ? stats.totalPrejuizoResidual : stats.totalPrejuizoConciliacao)}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-slate-500 truncate">
                {dashboardFilterMode === 'com_ajustes' ? 'Físico + Desvios vs 02.05.02' : 'Faltas Físicas vs 02.05.02'}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-rose-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Faltas em SKU:</span>
            <span className="text-rose-700 font-mono font-bold">
              {(dashboardFilterMode === 'com_ajustes' ? stats.totalPrejuizoResidualSkus : stats.totalPrejuizoSkusBruto).toLocaleString('pt-BR')} cx
            </span>
          </div>
        </div>

        {/* KPI 4: Sobras de Estoque (Excedente Físico que amortiza divergência) */}
        <div 
          onClick={() => onNavigateTab('conciliacao')}
          className="bg-emerald-50/40 hover:bg-emerald-50/80 border border-emerald-300 rounded-xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition group"
          title="Clique para detalhar as sobras na tela de Conciliação"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1">
              <span>{dashboardFilterMode === 'com_ajustes' ? 'Sobras (Com Ajuste)' : 'Sobras (Sem Ajuste)'}</span>
              <ChevronRight className="w-3 h-3 text-emerald-500 group-hover:translate-x-0.5 transition" />
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-emerald-700 font-mono tracking-tight" title={formatCurrency(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidual : stats.totalSobraConciliacao)}>
              +{formatCurrency(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidual : stats.totalSobraConciliacao)}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-emerald-700/80 font-medium truncate">
                {dashboardFilterMode === 'com_ajustes' ? 'Excedente Físico Equalizado' : 'Excedente Físico Puro'}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Sobras em SKU:</span>
            <span className="text-emerald-700 font-mono font-bold">
              {(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidualSkus : stats.totalSobraSkus).toLocaleString('pt-BR')} cx
            </span>
          </div>
        </div>

        {/* KPI 5: Amortizações Operacionais (Quebras, Trocas, Vales, Faltas) */}
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Amortizações</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-600 font-mono tracking-tight">
              +{formatCurrency(stats.totalAmortizadoValor)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Quebras, Trocas, Vales & Doca
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Taxa Fatores:</span>
            <span className="text-amber-700 font-mono font-bold">{formatNumber(stats.percentualAmortizadoOperacional, 1)}%</span>
          </div>
        </div>

        {/* KPI 6: Divergência Residual (Amortizada por Fatores + Sobras) */}
        <div className="bg-white border-2 border-purple-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Divergência Residual</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-bold font-mono tracking-tight ${stats.divergenciaResidualLiquida > 0 ? 'text-purple-800' : 'text-emerald-600'}`}>
              {formatCurrency(stats.divergenciaResidualLiquida)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Saldo Pós-Fatores & Sobras
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px]">
            {stats.superavitLiquido > 0 ? (
              <>
                <span className="text-emerald-700 font-medium">Superávit Líquido:</span>
                <span className="text-emerald-700 font-mono font-bold">+{formatCurrency(stats.superavitLiquido)}</span>
              </>
            ) : (
              <>
                <span className="text-slate-500">Residual SKU:</span>
                <span className="text-purple-800 font-mono font-bold">{stats.divergenciaResidualSkus.toLocaleString('pt-BR')} cx</span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Stock Equalization Section (The Core Equation with Sobras Amortization) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Scale className="w-4 h-4 text-emerald-600" />
              <span>Equalização & Amortização de Divergências da Conciliação</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Amortização das divergências sistêmicas da 02.05.02 pelos fatores operacionais rastreados e pelas sobras físicas de estoque.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-semibold">
            Divergência Bruta - Fatores Operacionais - Sobras = Residual
          </span>
        </div>

        {/* Visual Equalization Pipeline / Bento Cards - 7 Steps with Sobras */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 mt-4">
          
          {/* Step 1: Disponível Sistema */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Sistêmico (02.05.02)</div>
              <div className="text-base font-bold text-slate-800 font-mono mt-1 truncate">
                {stats.totalDisponivelSkus.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-500">cx</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-slate-200 pt-1.5">
              WMS Disponível
            </div>
          </div>

          {/* Step 2: Quebras Congeladas */}
          <div 
            onClick={() => onNavigateTab('quebras')}
            className="bg-rose-50/40 hover:bg-rose-50/80 rounded-xl p-3 border border-rose-200 cursor-pointer transition flex flex-col justify-between group"
            title="Apenas quebras com faturamento pendente amortizam o estoque físico na conciliação. Quebras já faturadas foram baixadas e não contam."
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-600">
                <span className="flex items-center gap-1.5">
                  <span>(+) Quebras</span>
                  <span className="text-[9px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full border border-rose-200">
                    Pendentes
                  </span>
                </span>
                <ChevronRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-base font-bold text-rose-600 font-mono mt-1 truncate">
                +{formatCurrency(stats.totalQuebrasValor)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-rose-100 pt-1.5 flex justify-between">
              <span>{formatHectoliters(stats.totalQuebrasHl)}</span>
              <span className="text-slate-700 font-mono font-medium">{stats.totalQuebrasQtd} cx</span>
            </div>
            {stats.totalQuebrasFaturadasCount > 0 && (
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between border-t border-rose-100/60 pt-1">
                <span>Faturadas (Baixadas):</span>
                <span className="font-mono text-slate-500">{stats.totalQuebrasFaturadasCount} itens ({formatCurrency(stats.totalQuebrasFaturadasValor)})</span>
              </div>
            )}
          </div>

          {/* Step 3: Vales */}
          <div 
            onClick={() => onNavigateTab('vales')}
            className="bg-amber-50/40 hover:bg-amber-50/80 rounded-xl p-3 border border-amber-200 cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-600">
                <span>(+) Vales</span>
                <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-base font-bold text-amber-600 font-mono mt-1 truncate">
                +{formatCurrency(stats.totalValesValor)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-amber-100 pt-1.5 flex justify-between">
              <span>{formatHectoliters(stats.totalValesHl)}</span>
              <span className="text-slate-700 font-mono font-medium">{stats.totalValesQtd} cx</span>
            </div>
          </div>

          {/* Step 4: Trocas & Reposições */}
          <div 
            onClick={() => onNavigateTab('trocas')}
            className="bg-purple-50/40 hover:bg-purple-50/80 rounded-xl p-3 border border-purple-200 cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-purple-600">
                <span>(+) Trocas</span>
                <ChevronRight className="w-3 h-3 text-purple-400 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-base font-bold text-purple-600 font-mono mt-1 truncate">
                +{formatCurrency(stats.totalTrocasValor)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-purple-100 pt-1.5 flex justify-between">
              <span>{formatHectoliters(stats.totalTrocasHl)}</span>
              <span className="text-slate-700 font-mono font-medium">{stats.totalTrocasQtd} cx</span>
            </div>
          </div>

          {/* Step 5: Faltas Mapeadas */}
          <div 
            onClick={() => onNavigateTab('faltas')}
            className="bg-orange-50/40 hover:bg-orange-50/80 rounded-xl p-3 border border-orange-200 cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-orange-600">
                <span>(+) Faltas Doca</span>
                <ChevronRight className="w-3 h-3 text-orange-400 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-base font-bold text-orange-600 font-mono mt-1 truncate">
                +{formatCurrency(stats.totalFaltasValor)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-orange-100 pt-1.5 flex justify-between">
              <span>{formatHectoliters(stats.totalFaltasHl)}</span>
              <span className="text-slate-700 font-mono font-medium">{stats.totalFaltasQtd} cx</span>
            </div>
          </div>

          {/* Step 6: Sobras de Estoque (Amortização Adicional) */}
          <div 
            onClick={() => onNavigateTab('conciliacao')}
            className="bg-emerald-50/50 hover:bg-emerald-50/90 rounded-xl p-3 border-2 border-emerald-400 cursor-pointer transition flex flex-col justify-between group shadow-xs"
            title="Clique para visualizar as sobras na Conciliação"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <span>(+) Sobras Estoque</span>
                <ChevronRight className="w-3 h-3 text-emerald-500 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="text-base font-bold text-emerald-700 font-mono mt-1 truncate">
                +{formatCurrency(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidual : stats.totalSobraConciliacao)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2 border-t border-emerald-200 pt-1.5 flex justify-between">
              <span>{formatHectoliters(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidualHl : stats.totalSobraHl)}</span>
              <span className="text-emerald-700 font-mono font-bold">
                {(dashboardFilterMode === 'com_ajustes' ? stats.totalSobraResidualSkus : stats.totalSobraSkus)} cx
              </span>
            </div>
          </div>

          {/* Step 7: Divergência Residual Líquida */}
          <div className={`rounded-xl p-3 border-2 flex flex-col justify-between ${stats.divergenciaResidualLiquida > 0 ? 'bg-purple-50/60 border-purple-300' : 'bg-emerald-50/70 border-emerald-400'}`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">(=) Residual Líquido</div>
              <div className={`text-base font-bold font-mono mt-1 truncate ${stats.divergenciaResidualLiquida > 0 ? 'text-purple-800' : 'text-emerald-700'}`}>
                {formatCurrency(stats.divergenciaResidualLiquida)}
              </div>
            </div>
            <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200 pt-1.5 flex justify-between">
              <span>{stats.divergenciaResidualLiquida === 0 ? '✓ Amortizado' : 'Pendente:'}</span>
              <span className="font-mono font-bold text-slate-800">{stats.divergenciaResidualSkus} cx</span>
            </div>
          </div>

        </div>

        {/* Visual Progress Equalization Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200 space-y-4">
          
          {/* Bar 1: Amortização da Divergência Bruta pelas Perdas e Sobras */}
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-700 mb-2 font-medium gap-1">
              <span className="font-bold flex items-center space-x-1.5 text-slate-900">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Amortização da Divergência Bruta ({formatCurrency(stats.totalPrejuizoConciliacao)})</span>
              </span>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="text-slate-500">Cobertura Total:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {formatNumber(stats.percentualAmortizadoTotal, 1)}% Amortizado
                </span>
              </div>
            </div>

            {/* Multi-segment Amortization bar */}
            <div className="w-full h-3.5 bg-slate-200 rounded-full flex overflow-hidden p-0.5 gap-0.5 border border-slate-300">
              {/* Amortizações Operacionais (Amber) */}
              <div 
                style={{ width: `${stats.totalPrejuizoConciliacao > 0 ? Math.min(100, (stats.totalAmortizadoValor / stats.totalPrejuizoConciliacao) * 100) : 0}%` }}
                className="h-full bg-amber-500 rounded-xs transition-all" 
                title={`Fatores Operacionais: +${formatCurrency(stats.totalAmortizadoValor)} (${formatNumber(stats.percentualAmortizadoOperacional, 1)}%)`}
              />
              {/* Sobras de Estoque (Emerald) */}
              <div 
                style={{ width: `${stats.totalPrejuizoConciliacao > 0 ? Math.min(100 - (stats.totalAmortizadoValor / stats.totalPrejuizoConciliacao) * 100, (stats.totalSobraConciliacao / stats.totalPrejuizoConciliacao) * 100) : 0}%` }}
                className="h-full bg-emerald-500 rounded-xs transition-all" 
                title={`Sobras de Estoque: +${formatCurrency(stats.totalSobraConciliacao)} (${formatNumber(stats.percentualAmortizadoSobras, 1)}%)`}
              />
              {/* Saldo Residual (Purple / Rose) */}
              {stats.divergenciaResidualLiquida > 0 && (
                <div 
                  style={{ width: `${stats.totalPrejuizoConciliacao > 0 ? (stats.divergenciaResidualLiquida / stats.totalPrejuizoConciliacao) * 100 : 100}%` }}
                  className="h-full bg-purple-500 rounded-xs transition-all" 
                  title={`Residual em Aberto: ${formatCurrency(stats.divergenciaResidualLiquida)}`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-600">
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                <span>Amort. Fatores (+{formatCurrency(stats.totalAmortizadoValor)} • {formatNumber(stats.percentualAmortizadoOperacional, 1)}%)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span className="font-semibold text-emerald-800">Sobras (+{formatCurrency(stats.totalSobraConciliacao)} • {formatNumber(stats.percentualAmortizadoSobras, 1)}%)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-xs bg-purple-500" />
                <span className="font-semibold text-purple-900">
                  {stats.divergenciaResidualLiquida > 0 
                    ? `Residual em Aberto (${formatCurrency(stats.divergenciaResidualLiquida)})` 
                    : `Equalizado (R$ 0,00)`}
                </span>
              </div>
            </div>
          </div>

          {/* Bar 2: Composição Geral dos Prejuízos */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
              <span>Composição Geral dos Prejuízos Rastreáveis ({formatCurrency(stats.prejuizoGeral)})</span>
              <span className="font-mono">100%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full flex overflow-hidden p-0.5 gap-0.5 border border-slate-200">
              <div 
                style={{ width: `${stats.prejuizoGeral > 0 ? (stats.totalPrejuizoConciliacao / stats.prejuizoGeral) * 100 : 20}%` }}
                className="h-full bg-rose-500 rounded-xs transition-all" 
                title={`Faltas de Inventário: ${formatCurrency(stats.totalPrejuizoConciliacao)}`}
              />
              <div 
                style={{ width: `${stats.prejuizoGeral > 0 ? (stats.totalQuebrasValor / stats.prejuizoGeral) * 100 : 20}%` }}
                className="h-full bg-amber-500 rounded-xs transition-all" 
                title={`Quebras: ${formatCurrency(stats.totalQuebrasValor)}`}
              />
              <div 
                style={{ width: `${stats.prejuizoGeral > 0 ? (stats.totalValesValor / stats.prejuizoGeral) * 100 : 20}%` }}
                className="h-full bg-orange-500 rounded-xs transition-all" 
                title={`Vales Equipe: ${formatCurrency(stats.totalValesValor)}`}
              />
              <div 
                style={{ width: `${stats.prejuizoGeral > 0 ? (stats.totalTrocasValor / stats.prejuizoGeral) * 100 : 20}%` }}
                className="h-full bg-purple-500 rounded-xs transition-all" 
                title={`Trocas & Reposições: ${formatCurrency(stats.totalTrocasValor)}`}
              />
              <div 
                style={{ width: `${stats.prejuizoGeral > 0 ? (stats.totalFaltasValor / stats.prejuizoGeral) * 100 : 20}%` }}
                className="h-full bg-sky-500 rounded-xs transition-all" 
                title={`Faltas Mapeadas: ${formatCurrency(stats.totalFaltasValor)}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-xs bg-rose-500" />
                <span>Faltas ({formatCurrency(stats.totalPrejuizoConciliacao)})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-xs bg-amber-500" />
                <span>Quebras ({formatCurrency(stats.totalQuebrasValor)})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-xs bg-orange-500" />
                <span>Vales ({formatCurrency(stats.totalValesValor)})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-xs bg-purple-500" />
                <span>Trocas ({formatCurrency(stats.totalTrocasValor)})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-xs bg-sky-500" />
                <span>Faltas Doca ({formatCurrency(stats.totalFaltasValor)})</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Ranking Control Toolbar: Botão Sem Ajuste vs Com Ajuste (Físico + Desvios) + Profundidade Top N */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              rankingAdjustmentMode === 'com_ajuste' 
                ? 'bg-teal-50 text-teal-700 border-teal-200' 
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}>
              {rankingAdjustmentMode === 'com_ajuste' ? <Sparkles className="w-4 h-4 text-teal-600" /> : <Scale className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Rankings de Divergências (Faltas & Sobras)
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${
                  rankingAdjustmentMode === 'com_ajuste'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {rankingAdjustmentMode === 'com_ajuste' ? 'Com Ajuste Ativo' : 'Sem Ajuste (Bruto)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {rankingAdjustmentMode === 'com_ajuste' ? (
                  <span>
                    <strong>Com Ajuste:</strong> O estoque físico soma todos os desvios congelados (quebras, vales, trocas e faltas) para apurar a quantidade final antes de confrontar com o fiscal.
                  </span>
                ) : (
                  <span>
                    <strong>Sem Ajuste:</strong> Confronto direto entre a contagem física bruta e o saldo fiscal (02.05.02), sem somar desvios operacionais.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* BOTÃO PRINCIPAL DE RANKINGS: [ Sem Ajuste | Com Ajuste ] */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-300 shadow-2xs">
            <button
              onClick={() => handleToggleRankingMode('sem_ajuste')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                rankingAdjustmentMode === 'sem_ajuste'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visualizar divergências brutas sem somar desvios (Físico vs Fiscal)"
            >
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              <span>Sem Ajuste</span>
            </button>

            <button
              onClick={() => handleToggleRankingMode('com_ajuste')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                rankingAdjustmentMode === 'com_ajuste'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Somar quebras, vales, trocas e faltas ao físico para apurar a divergência residual"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Com Ajuste</span>
              <span className="hidden sm:inline text-[10px] py-0.5 px-1 bg-teal-700 text-teal-100 rounded ml-1 font-mono">
                Físico + Desvios
              </span>
            </button>
          </div>

          {/* Seletor de Profundidade & Ações de Recontagem */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Visualizar:</span>
              {([5, 10, 20, 50, 'ALL'] as const).map((limit) => (
                <button
                  key={String(limit)}
                  onClick={() => setRankingLimit(limit)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    rankingLimit === limit
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {limit === 'ALL' ? 'Todos' : `Top ${limit}`}
                </button>
              ))}
            </div>

            {/* Botão Maximizar (Top 20 / Impressão) */}
            <button
              onClick={() => setIsRecontagemModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Maximizar tela para visualizar até o Top 20+ itens e poder imprimir"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
              <span>Maximizar (Top 20 / Print)</span>
            </button>

            {/* Botão Exportar Imagem para Recontar */}
            <button
              onClick={() => setIsRecontagemModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="Selecionar itens e exportar imagem de recontagem para o armazém"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Exportar Imagem (Recontagem)</span>
              {selectedRecountIds.size > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-emerald-800 flex items-center justify-center text-[10px] font-bold font-mono ml-1">
                  {selectedRecountIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Rankings Section: Top Faltas (Prejuízo) & Top Sobras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Faltas (Maior Prejuízo) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold text-xs">
                  ↓
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Ranking de Faltas {rankingLimit === 'ALL' ? '(Todos os Itens)' : `(Top ${rankingLimit})`}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                      rankingAdjustmentMode === 'com_ajuste' 
                        ? 'bg-teal-50 text-teal-700 border-teal-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {rankingAdjustmentMode === 'com_ajuste' ? 'COM AJUSTE' : 'SEM AJUSTE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {rankingAdjustmentMode === 'com_ajuste' 
                      ? 'Faltas residuais após somar quebras, vales, trocas e faltas ao físico'
                      : 'Maior perda financeira identificada na conciliação física bruta'}
                  </p>
                </div>
              </div>

              {/* Ações Diretas no Card */}
              <div className="flex items-center space-x-1.5">
                {/* Botão Maximizar (Print) */}
                <button
                  onClick={() => setIsRecontagemModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  title="Maximizar tela com Top 20 itens e imprimir"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>Maximizar (Print)</span>
                </button>

                {/* Botão Exportar Imagem de Recontagem */}
                <button
                  onClick={() => {
                    if (selectedRecountIds.size === 0) {
                      handleSelectTopFaltas(20);
                    }
                    setIsRecontagemModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  title="Selecionar e exportar imagem de recontagem para o armazém"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Exportar Imagem</span>
                  {selectedRecountIds.size > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white text-emerald-800 flex items-center justify-center text-[10px] font-bold font-mono">
                      {selectedRecountIds.size}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => onNavigateTab(rankingAdjustmentMode === 'com_ajuste' ? 'conciliacao_ajustes' : 'conciliacao')}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-1"
                >
                  Abrir Tabela
                </button>
              </div>
            </div>

            {/* Sub-barra de seleção rápida do card */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center space-x-2">
                <span>Selecionar p/ Recontagem:</span>
                <button
                  onClick={() => handleSelectTopFaltas(10)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer"
                >
                  + Top 10
                </button>
                <button
                  onClick={() => handleSelectTopFaltas(20)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer"
                >
                  + Top 20
                </button>
                {selectedRecountIds.size > 0 && (
                  <button
                    onClick={handleClearRecountSelection}
                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[10px] cursor-pointer"
                  >
                    Limpar ({selectedRecountIds.size})
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-400">Exibir:</span>
                <button
                  onClick={() => setRankingLimit(10)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 10 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  10
                </button>
                <button
                  onClick={() => setRankingLimit(20)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 20 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  20
                </button>
                <button
                  onClick={() => setRankingLimit(50)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 50 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  50
                </button>
              </div>
            </div>

              <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {rankingFaltas.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100 p-4">
                    {rankingAdjustmentMode === 'com_ajuste' 
                      ? '✓ Nenhuma falta residual no depósito selecionado! Todos os desvios equalizaram o estoque físico.'
                      : 'Nenhuma falta bruta identificada no depósito selecionado.'}
                  </div>
                ) : (
                  rankingFaltas.map((item, index) => {
                    const isSelected = selectedRecountIds.has(item.id);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleRecountId(item.id)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between transition text-xs cursor-pointer group ${
                          isSelected
                            ? 'bg-rose-100/80 border-rose-400 shadow-xs ring-1 ring-rose-400'
                            : 'bg-rose-50/40 hover:bg-rose-50/90 border-rose-100'
                        }`}
                        title="Clique para selecionar este item para a Ficha de Recontagem"
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleRecountId(item.id);
                              }}
                              className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                              title="Marcar para recontagem"
                            />
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0">
                              {index + 1}
                            </span>
                          </div>
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
                                {rankingAdjustmentMode === 'com_ajuste' ? 'Falta Residual:' : 'Falta:'} -{item.diferencaRaw} cx
                              </span>
                            </div>
                            {rankingAdjustmentMode === 'com_ajuste' && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded border border-rose-200/60">
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

                        <div className="flex items-center space-x-2.5 flex-shrink-0 pl-2">
                          <div className="text-right flex-shrink-0 flex flex-col items-end">
                            <div className="inline-flex items-center mb-1">
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
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

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRecountId(item.id);
                              setIsRecontagemModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              isSelected
                                ? 'bg-rose-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-400 hover:text-rose-600 group-hover:border-rose-300'
                            }`}
                            title="Exportar imagem / recontar este item"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
              <div className="flex items-center space-x-2">
                <span>Subtotal no {rankingLimit === 'ALL' ? 'Total' : `Top ${rankingLimit}`} ({rankingFaltas.length} SKUs):</span>
                {totalPrejuizoGeralFaltas > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {((rankingFaltas.reduce((acc, f) => acc + f.prejuizoFinanceiro, 0) / totalPrejuizoGeralFaltas) * 100).toFixed(1)}% do total
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-rose-600">
                -{formatCurrency(rankingFaltas.reduce((acc, f) => acc + f.prejuizoFinanceiro, 0))}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-dashed border-slate-200 text-slate-700 bg-rose-50/60 -mx-2 px-2.5 py-1.5 rounded-lg">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-800">Total Geral de Faltas ({allRankingFaltas.length} SKUs):</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ 100% Sincronizado c/ Card 3
                </span>
              </div>
              <span className="font-mono font-bold text-rose-700 text-sm">
                -{formatCurrency(totalPrejuizoGeralFaltas)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Sobras */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                  ↑
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Ranking de Sobras {rankingLimit === 'ALL' ? '(Todos os Itens)' : `(Top ${rankingLimit})`}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                      rankingAdjustmentMode === 'com_ajuste' 
                        ? 'bg-teal-50 text-teal-700 border-teal-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {rankingAdjustmentMode === 'com_ajuste' ? 'COM AJUSTE' : 'SEM AJUSTE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {rankingAdjustmentMode === 'com_ajuste' 
                      ? 'Sobras físicas excedentes após somar quebras, vales, trocas e faltas ao físico'
                      : 'Produtos físicos excedentes em relação ao WMS'}
                  </p>
                </div>
              </div>

              {/* Ações Diretas no Card */}
              <div className="flex items-center space-x-1.5">
                {/* Botão Maximizar (Print) */}
                <button
                  onClick={() => setIsRecontagemModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  title="Maximizar tela com Top 20 itens e imprimir"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>Maximizar (Print)</span>
                </button>

                {/* Botão Exportar Imagem de Recontagem */}
                <button
                  onClick={() => {
                    if (selectedRecountIds.size === 0) {
                      handleSelectTopSobras(20);
                    }
                    setIsRecontagemModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  title="Selecionar e exportar imagem de recontagem para o armazém"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Exportar Imagem</span>
                  {selectedRecountIds.size > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white text-emerald-800 flex items-center justify-center text-[10px] font-bold font-mono">
                      {selectedRecountIds.size}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => onNavigateTab(rankingAdjustmentMode === 'com_ajuste' ? 'conciliacao_ajustes' : 'conciliacao')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold px-1"
                >
                  Abrir Tabela
                </button>
              </div>
            </div>

            {/* Sub-barra de seleção rápida do card */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center space-x-2">
                <span>Selecionar p/ Recontagem:</span>
                <button
                  onClick={() => handleSelectTopSobras(10)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer"
                >
                  + Top 10
                </button>
                <button
                  onClick={() => handleSelectTopSobras(20)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer"
                >
                  + Top 20
                </button>
                {selectedRecountIds.size > 0 && (
                  <button
                    onClick={handleClearRecountSelection}
                    className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[10px] cursor-pointer"
                  >
                    Limpar ({selectedRecountIds.size})
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-400">Exibir:</span>
                <button
                  onClick={() => setRankingLimit(10)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 10 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  10
                </button>
                <button
                  onClick={() => setRankingLimit(20)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 20 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  20
                </button>
                <button
                  onClick={() => setRankingLimit(50)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${rankingLimit === 50 ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  50
                </button>
              </div>
            </div>

              <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {rankingSobras.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100 p-4">
                    Nenhuma sobra identificada no depósito selecionado.
                  </div>
                ) : (
                  rankingSobras.map((item, index) => {
                    const isSelected = selectedRecountIds.has(item.id);
                    return (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleRecountId(item.id)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between transition text-xs cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-100/80 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
                            : 'bg-emerald-50/40 hover:bg-emerald-50/90 border-emerald-100'
                        }`}
                        title="Clique para selecionar este item para a Ficha de Recontagem"
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleRecountId(item.id);
                              }}
                              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              title="Marcar para recontagem"
                            />
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0">
                              {index + 1}
                            </span>
                          </div>
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
                                {rankingAdjustmentMode === 'com_ajuste' ? 'Sobra Residual:' : 'Sobra:'} +{item.diferencaRaw} cx
                              </span>
                            </div>
                            {rankingAdjustmentMode === 'com_ajuste' && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded border border-emerald-200/60">
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

                        <div className="flex items-center space-x-2.5 flex-shrink-0 pl-2">
                          <div className="text-right flex-shrink-0 flex flex-col items-end">
                            <div className="inline-flex items-center mb-1">
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
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

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRecountId(item.id);
                              setIsRecontagemModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 group-hover:border-emerald-300'
                            }`}
                            title="Exportar imagem / recontar este item"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
              <div className="flex items-center space-x-2">
                <span>Subtotal no {rankingLimit === 'ALL' ? 'Total' : `Top ${rankingLimit}`} ({rankingSobras.length} SKUs):</span>
                {totalValorGeralSobras > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {((rankingSobras.reduce((acc, s) => acc + s.sobraFinanceira, 0) / totalValorGeralSobras) * 100).toFixed(1)}% do total
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-emerald-600">
                +{formatCurrency(rankingSobras.reduce((acc, s) => acc + s.sobraFinanceira, 0))}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-dashed border-slate-200 text-slate-700 bg-emerald-50/60 -mx-2 px-2.5 py-1.5 rounded-lg">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-800">Total Geral de Sobras ({allRankingSobras.length} SKUs):</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ 100% Sincronizado c/ Card 4
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                +{formatCurrency(totalValorGeralSobras)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Multi-Warehouse Status Table (Comparison across 01, 02, 03, 05, 06) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Saúde e Conciliação Comparativa por Depósito</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitore a equalização de cada armazém (Central, Varejo, Análise, Faltas, Devoluções).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Depósito</th>
                <th className="py-2.5 px-3">Finalidade Operacional</th>
                <th className="py-2.5 px-3 text-right">Itens Cadastrados</th>
                <th className="py-2.5 px-3 text-right">Disponível Total</th>
                <th className="py-2.5 px-3 text-right">Prejuízo Faltas (R$)</th>
                <th className="py-2.5 px-3 text-right">Sobras Físicas (R$)</th>
                <th className="py-2.5 px-3 text-right">Volume Divergente (HL)</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {depositBreakdown.map((dep) => (
                <tr key={dep.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${
                      dep.id === '01' ? 'bg-blue-500' :
                      dep.id === '02' ? 'bg-emerald-500' :
                      dep.id === '03' ? 'bg-amber-500' :
                      dep.id === '05' ? 'bg-rose-500' : 'bg-purple-500'
                    }`} />
                    <span>{dep.nome}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{dep.descricao}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{dep.totalItens}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {dep.totalDisp.toLocaleString('pt-BR')} un
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-semibold">
                    {dep.faltas > 0 ? `-${formatCurrency(dep.faltas)}` : 'R$ 0,00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                    {dep.sobras > 0 ? `+${formatCurrency(dep.sobras)}` : 'R$ 0,00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatHectoliters(dep.hlDivergencia)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => onNavigateTab('conciliacao')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-medium transition"
                    >
                      Conciliar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra Flutuante de Itens Selecionados para Recontagem */}
      {selectedRecountIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-mono font-bold">
              {selectedRecountIds.size}
            </span>
            <span className="text-xs font-semibold text-slate-200">
              {selectedRecountIds.size === 1 ? 'item selecionado para recontar' : 'itens selecionados para recontar'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center space-x-2">
            {/* Botão Exportar Imagem */}
            <button
              onClick={() => setIsRecontagemModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="Gerar e baixar imagem dos itens selecionados para envio no WhatsApp"
            >
              <Camera className="w-4 h-4" />
              <span>Exportar Imagem (PNG)</span>
            </button>

            {/* Botão Maximizar / Imprimir */}
            <button
              onClick={() => setIsRecontagemModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              title="Maximizar tela de recontagem para visualização ou impressão"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
              <span>Maximizar / Print</span>
            </button>

            {/* Limpar Seleção */}
            <button
              onClick={handleClearRecountSelection}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border border-slate-700 transition cursor-pointer"
              title="Desmarcar todos os itens selecionados"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Maximizado de Recontagem / Impressão / Exportar Imagem */}
      <RecontagemRankingsModal
        isOpen={isRecontagemModalOpen}
        onClose={() => setIsRecontagemModalOpen(false)}
        allRankingFaltas={allRankingFaltas}
        allRankingSobras={allRankingSobras}
        selectedDeposito={selectedDeposito}
        rankingAdjustmentMode={rankingAdjustmentMode}
        onToggleAdjustmentMode={handleToggleRankingMode}
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
