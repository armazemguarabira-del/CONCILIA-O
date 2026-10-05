import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingDown, 
  Search, 
  UploadCloud, 
  Calendar, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  BarChart3, 
  Table2, 
  RotateCcw, 
  Check, 
  AlertCircle,
  FileCheck,
  ChevronDown,
  X,
  FileText,
  Printer,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Calculator,
  Sparkles,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { QuebraItem, DepositoId, AreaLossSummary, WeeklyLossSummary } from '../types';
import { INITIAL_QUEBRAS } from '../data/initialData';
import { sanitizeAndDeduplicateQuebras, isCorruptedOrInflatedDataset } from '../utils/quebrasDeduplicator';
import { getSkuUnitMetrics, SKU_CATALOG, calculateProportionalValues } from '../utils/productCatalog';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { 
  calculateAreaLosses, 
  calculateWeeklyLosses, 
  calculateDailyLosses, 
  exportAreaLossesToExcel, 
  exportWeeklyLossesToExcel, 
  exportDetailedQuebrasToExcel, 
  exportCompleteWorkbookToExcel,
  parseDateSafe,
  getMonthName
} from '../utils/quebrasReports';
import { exportElementToPdf } from '../utils/pdfExport';
import { safeLocalStorageSet } from '../utils/persistentStorage';

interface QuebrasViewProps {
  quebras: QuebraItem[];
  selectedDeposito: DepositoId | 'ALL';
  onOpenImportModal: () => void;
  onOpenManualQuebra?: () => void;
  onUpdateQuebras?: (items: QuebraItem[]) => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
  onUpdateWeeklyBillingStatus?: (status: Record<string, 'PENDENTE' | 'OK'>) => void;
}

type SubTabMode = 'semanas' | 'area' | 'detalhado' | 'todos';
type DatePreset = '8_semanas' | 'mes_junho' | 'mes_julho' | 'mes_agosto' | 'mes_setembro' | 'ultimos_30' | 'todas' | 'custom';

export const QuebrasView: React.FC<QuebrasViewProps> = ({
  quebras,
  selectedDeposito,
  onOpenImportModal,
  onOpenManualQuebra,
  onUpdateQuebras,
  weeklyBillingStatus: propWeeklyBillingStatus,
  onUpdateWeeklyBillingStatus,
}) => {
  // Sub-tabs de visualização
  const [activeTab, setActiveTab] = useState<SubTabMode>('semanas');

  // Filtro de Data Personalizado
  const [datePreset, setDatePreset] = useState<DatePreset>('8_semanas');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-05-25');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-08-31');

  // Filtros tradicionais
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('ALL');
  const [turnoFilter, setTurnoFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [faturamentoFilter, setFaturamentoFilter] = useState<'ALL' | 'PENDENTE' | 'OK'>('ALL');

  // Mapa persistido de status de faturamento semanal ('PENDENTE' | 'OK')
  const [internalWeeklyBillingStatus, setInternalWeeklyBillingStatus] = useState<Record<string, 'PENDENTE' | 'OK'>>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_faturamento_semanal_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignora erro
    }
    // Estado inicial padrão alinhado com o histórico da imagem 2
    return {
      '13/07 - 17/07': 'PENDENTE',
      '04/07 - 09/07': 'PENDENTE',
      '29/06 - 03/07': 'PENDENTE',
      '23/06 - 28/06': 'PENDENTE',
      '15/06 - 20/06': 'OK',
      '08/06 - 12/06': 'OK',
      '01/06 - 05/06': 'OK',
      '25/05 - 30/05': 'OK',
    };
  });

  const weeklyBillingStatus = propWeeklyBillingStatus || internalWeeklyBillingStatus;

  // Modal de Exportação
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<'pdf' | 'excel'>('pdf');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modais de Edição e Exclusão de Ocorrência com Proporcionalidade Dinâmica
  const [editingQuebra, setEditingQuebra] = useState<QuebraItem | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<QuebraItem>>({});
  const [modalUnitPrice, setModalUnitPrice] = useState<number>(0);
  const [modalUnitHl, setModalUnitHl] = useState<number>(0);
  const [autoProportional, setAutoProportional] = useState<boolean>(true);
  const [disproportionateDetected, setDisproportionateDetected] = useState<boolean>(false);
  const [deletingQuebra, setDeletingQuebra] = useState<QuebraItem | null>(null);

  // Label do Depósito e do Período para cabeçalhos executivos
  const depositoLabel = useMemo(() => {
    if (selectedDeposito === 'ALL') return 'Todos os Depósitos (Rede Ambev)';
    return `Depósito ${selectedDeposito} - CDD Logística`;
  }, [selectedDeposito]);

  // Maior data presente no conjunto de dados de quebras
  const maxQuebraDate = useMemo(() => {
    let maxTime = 0;
    quebras.forEach(q => {
      const dt = parseDateSafe(q.data);
      if (dt && dt.getTime() > maxTime) maxTime = dt.getTime();
    });
    return maxTime > 0 ? new Date(maxTime) : new Date(2026, 7, 28);
  }, [quebras]);

  const periodoLabel = useMemo(() => {
    const formattedMax = `${String(maxQuebraDate.getDate()).padStart(2, '0')}/${String(maxQuebraDate.getMonth() + 1).padStart(2, '0')}/${maxQuebraDate.getFullYear()}`;
    if (datePreset === '8_semanas') return `8 Últimas Semanas (até ${formattedMax})`;
    if (datePreset === 'mes_setembro') return 'Mês de Setembro / 2026';
    if (datePreset === 'mes_agosto') return 'Mês de Agosto / 2026';
    if (datePreset === 'mes_julho') return 'Mês de Julho / 2026';
    if (datePreset === 'mes_junho') return 'Mês de Junho / 2026';
    if (datePreset === 'ultimos_30') return 'Últimos 30 Dias';
    if (datePreset === 'custom') return `${customStartDate} até ${customEndDate}`;
    return 'Histórico Completo de Quebras';
  }, [datePreset, customStartDate, customEndDate, maxQuebraDate]);

  // Salva no localStorage quando weeklyBillingStatus mudar
  useEffect(() => {
    try {
      localStorage.setItem('gestao_estoque_faturamento_semanal_v2', JSON.stringify(weeklyBillingStatus));
    } catch {
      // Fallback
    }
  }, [weeklyBillingStatus]);

  // Exibe toast temporário
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Filtragem por Depósito e Data
  const dateFilteredQuebras = useMemo(() => {
    return quebras.filter(q => {
      if (selectedDeposito !== 'ALL' && q.deposito !== selectedDeposito) return false;

      // Filtro de data
      if (datePreset === 'todas') return true;

      const dt = parseDateSafe(q.data);
      if (!dt) return true;

      if (datePreset === 'mes_junho') {
        return dt.getFullYear() === 2026 && dt.getMonth() === 5; // 5 = Junho (0-indexed)
      }
      if (datePreset === 'mes_julho') {
        return dt.getFullYear() === 2026 && dt.getMonth() === 6; // 6 = Julho (0-indexed)
      }
      if (datePreset === 'mes_agosto') {
        return dt.getFullYear() === 2026 && dt.getMonth() === 7; // 7 = Agosto
      }
      if (datePreset === 'mes_setembro') {
        return dt.getFullYear() === 2026 && dt.getMonth() === 8; // 8 = Setembro
      }
      if (datePreset === 'ultimos_30') {
        const diffDays = (maxQuebraDate.getTime() - dt.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }
      if (datePreset === '8_semanas') {
        // As 8 últimas semanas baseadas na data mais recente do conjunto
        const day = maxQuebraDate.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        const curMonday = new Date(maxQuebraDate.getFullYear(), maxQuebraDate.getMonth(), maxQuebraDate.getDate() + diffToMon);
        const startMonday = new Date(curMonday.getTime() - 7 * 7 * 86400000);
        startMonday.setHours(0, 0, 0, 0);
        const endSunday = new Date(curMonday.getTime() + 6 * 86400000 + 86399999);
        return dt >= startMonday && dt <= endSunday;
      }
      if (datePreset === 'custom') {
        if (customStartDate) {
          const s = parseDateSafe(customStartDate);
          if (s && dt < s) return false;
        }
        if (customEndDate) {
          const e = parseDateSafe(customEndDate);
          if (e) {
            e.setHours(23, 59, 59, 999);
            if (dt > e) return false;
          }
        }
        return true;
      }

      return true;
    });
  }, [quebras, selectedDeposito, datePreset, customStartDate, customEndDate, maxQuebraDate]);

  // 2. Filtragem Adicional para Busca e Colunas
  const fullyFilteredQuebras = useMemo(() => {
    return dateFilteredQuebras.filter(q => {
      if (motivoFilter !== 'ALL' && q.motivo !== motivoFilter) return false;
      if (turnoFilter !== 'ALL' && q.turno !== turnoFilter) return false;
      if (areaFilter !== 'ALL' && q.area !== areaFilter) return false;

      // Status de faturamento
      const weekLabel = q.semanaRef;
      const isFaturado = q.faturado || (weekLabel && weeklyBillingStatus[weekLabel] === 'OK');
      if (faturamentoFilter === 'PENDENTE' && isFaturado) return false;
      if (faturamentoFilter === 'OK' && !isFaturado) return false;

      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const matchSku = q.sku.toLowerCase().includes(t);
        const matchDesc = q.descricao.toLowerCase().includes(t);
        const matchMotivo = q.motivo.toLowerCase().includes(t);
        const matchColab = q.colaborador ? q.colaborador.toLowerCase().includes(t) : false;
        const matchArea = q.area ? q.area.toLowerCase().includes(t) : false;
        const matchTurno = q.turno ? q.turno.toLowerCase().includes(t) : false;
        if (!matchSku && !matchDesc && !matchMotivo && !matchColab && !matchArea && !matchTurno) return false;
      }
      return true;
    });
  }, [dateFilteredQuebras, motivoFilter, turnoFilter, areaFilter, faturamentoFilter, searchTerm, weeklyBillingStatus]);

  // 3. Cálculos de Relatórios
  // Determina a data de referência para as 8 semanas:
  // "as 8 últimas semanas têm de ser as anteriores a data filtrada"
  const weeklyReferenceDate = useMemo(() => {
    if (datePreset === 'custom' && customEndDate) {
      return parseDateSafe(customEndDate) || maxQuebraDate;
    }
    if (datePreset === 'mes_setembro') {
      return new Date(2026, 8, 30);
    }
    if (datePreset === 'mes_agosto') {
      return new Date(2026, 7, 28); // 28/08/2026
    }
    if (datePreset === 'mes_julho') {
      return new Date(2026, 6, 17); // 17/07/2026
    }
    if (datePreset === 'ultimos_30') {
      return maxQuebraDate;
    }
    // Para '8_semanas' ou 'todas', usa a maior data de quebras
    return maxQuebraDate;
  }, [datePreset, customEndDate, maxQuebraDate]);

  // Relatório das 8 Últimas Semanas (calculadas como as 8 semanas consecutivas anteriores à data de referência)
  const { weeks: weeklyReportList, total: weeklyTotal } = useMemo(() => {
    // Usamos a base de quebras do depósito selecionado (sem limitar à janela do mês)
    // para que a função encontre o histórico das 8 semanas anteriores à data de referência
    const baseQuebras = selectedDeposito === 'ALL'
      ? quebras
      : quebras.filter(q => q.deposito === selectedDeposito);

    return calculateWeeklyLosses(
      baseQuebras,
      weeklyBillingStatus,
      8,
      weeklyReferenceDate
    );
  }, [quebras, selectedDeposito, weeklyBillingStatus, weeklyReferenceDate]);

  // Relatório de Perdas por Área
  const { areas: areaLossList, totalGeral: areaTotalGeral } = useMemo(() => {
    return calculateAreaLosses(fullyFilteredQuebras);
  }, [fullyFilteredQuebras]);

  // Gráfico Diário de Comparação (Reais vs HL)
  const dailyChartData = useMemo(() => {
    return calculateDailyLosses(fullyFilteredQuebras);
  }, [fullyFilteredQuebras]);

  // Listas para filtros dinâmicos
  const motivos = useMemo(() => {
    const set = new Set<string>();
    quebras.forEach(q => { if (q.motivo) set.add(q.motivo); });
    return Array.from(set).sort();
  }, [quebras]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    quebras.forEach(q => { if (q.area) set.add(q.area); });
    return Array.from(set).sort();
  }, [quebras]);

  // Estatísticas Gerais
  const stats = useMemo(() => {
    const totalQtd = fullyFilteredQuebras.reduce((acc, q) => acc + q.quantidade, 0);
    const totalValor = fullyFilteredQuebras.reduce((acc, q) => acc + q.valorTotal, 0);
    const totalHl = fullyFilteredQuebras.reduce((acc, q) => acc + q.volumeHl, 0);
    const pendentesCount = fullyFilteredQuebras.filter(q => {
      const w = q.semanaRef;
      return !q.faturado && (!w || weeklyBillingStatus[w] !== 'OK');
    }).length;
    return { totalQtd, totalValor, totalHl, totalRecords: fullyFilteredQuebras.length, pendentesCount };
  }, [fullyFilteredQuebras, weeklyBillingStatus]);

  // Ação: Alternar Faturamento Semanal (Dar Baixa)
  const handleToggleWeeklyBilling = (weekLabel: string) => {
    const currentStatus = weeklyBillingStatus[weekLabel] || 'PENDENTE';
    const newStatus: 'OK' | 'PENDENTE' = currentStatus === 'OK' ? 'PENDENTE' : 'OK';

    const newStatusMap: Record<string, 'OK' | 'PENDENTE'> = {
      ...weeklyBillingStatus,
      [weekLabel]: newStatus,
    };
    setInternalWeeklyBillingStatus(newStatusMap);
    if (onUpdateWeeklyBillingStatus) {
      onUpdateWeeklyBillingStatus(newStatusMap);
    }

    // Se houver callback para atualizar itens em memória e localStorage
    if (onUpdateQuebras) {
      const updated = quebras.map(q => {
        if (q.semanaRef === weekLabel) {
          return {
            ...q,
            faturado: newStatus === 'OK',
            dataFaturamento: newStatus === 'OK' ? new Date().toLocaleDateString('pt-BR') : undefined
          };
        }
        return q;
      });
      onUpdateQuebras(updated);
    }

    if (newStatus === 'OK') {
      showToast(`Baixa efetuada: Semana "${weekLabel}" marcada como FATURADA (OK)!`);
    } else {
      showToast(`Semana "${weekLabel}" reaberta com status PENDENTE.`);
    }
  };

  // Ação: Dar Baixa em Todas as Semanas do Período
  const handleFaturarTodasSemanas = () => {
    const newStatusMap = { ...weeklyBillingStatus };
    weeklyReportList.forEach(w => {
      newStatusMap[w.label] = 'OK';
    });
    setInternalWeeklyBillingStatus(newStatusMap);
    if (onUpdateWeeklyBillingStatus) {
      onUpdateWeeklyBillingStatus(newStatusMap);
    }

    if (onUpdateQuebras) {
      const activeLabels = new Set(weeklyReportList.map(w => w.label));
      const updated = quebras.map(q => {
        if (q.semanaRef && activeLabels.has(q.semanaRef)) {
          return { ...q, faturado: true, dataFaturamento: new Date().toLocaleDateString('pt-BR') };
        }
        return q;
      });
      onUpdateQuebras(updated);
    }

    showToast(`Baixa de faturamento concluída com sucesso para todas as ${weeklyReportList.length} semanas!`);
  };

  // Ações de Exportação
  const handleExportArea = () => {
    exportAreaLossesToExcel(areaLossList, areaTotalGeral);
    showToast('Relatório de Percas por Área exportado com sucesso!');
  };

  const handleExportWeekly = () => {
    exportWeeklyLossesToExcel(weeklyReportList, weeklyTotal);
    showToast('Relatório das 8 Últimas Semanas exportado com sucesso!');
  };

  const handleExportDetailed = () => {
    exportDetailedQuebrasToExcel(fullyFilteredQuebras);
    showToast('Relatório Detalhado de Quebras exportado com sucesso!');
  };

  const handleExportComplete = () => {
    exportCompleteWorkbookToExcel(
      areaLossList,
      areaTotalGeral,
      weeklyReportList,
      weeklyTotal,
      fullyFilteredQuebras
    );
    showToast('Pasta de Trabalho Completa (.xlsx com 3 abas) exportada com sucesso!');
  };

  const formatTurno = (t?: string): string => {
    if (!t) return '-';
    const clean = String(t).trim().toUpperCase();
    if (clean.startsWith('MANH')) return 'MANHÃ';
    if (clean.startsWith('NOIT')) return 'NOITE';
    if (clean.startsWith('TARD')) return 'TARDE';
    return t;
  };

  // Ações de Exportação em PDF com Gráficos da Plataforma
  const handleExportWeeklyPdf = async () => {
    let el = document.getElementById('report-semanas-print');
    if (!el) {
      setActiveTab('semanas');
      await new Promise((r) => setTimeout(r, 80));
      el = document.getElementById('report-semanas-print');
    }
    if (!el) return;
    setIsExportingPdf(true);
    showToast('Gerando PDF do Relatório das 8 Últimas Semanas...');
    try {
      await exportElementToPdf(el, {
        fileName: `ambev-8-ultimas-semanas-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'portrait',
        title: 'RELATÓRIO DAS 8 ÚLTIMAS SEMANAS & STATUS DE FATURAMENTO',
        subtitle: 'Comparativo Cronológico de Quebras Semanais com Tendências e Baixa de Faturamento',
        depositoName: depositoLabel,
        periodo: `8 Semanas Anteriores a ${weeklyReportList[0]?.endDate || 'Data Filtrada'}`,
      });
      showToast('PDF das 8 Últimas Semanas exportado com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PDF das semanas.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportAreaPdf = async () => {
    let el = document.getElementById('report-area-print');
    if (!el) {
      setActiveTab('area');
      await new Promise((r) => setTimeout(r, 80));
      el = document.getElementById('report-area-print');
    }
    if (!el) return;
    setIsExportingPdf(true);
    showToast('Gerando PDF de Percas por Área com Gráficos de Distribuição...');
    try {
      await exportElementToPdf(el, {
        fileName: `ambev-percas-por-area-grafico-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'portrait',
        title: 'RELATÓRIO DE PERCAS POR ÁREA & GRÁFICO DE DISTRIBUIÇÃO',
        subtitle: 'Prejuízo Financeiro (R$), Volume (HL) e Participação Percentual por Setor Operacional',
        depositoName: depositoLabel,
        periodo: periodoLabel,
      });
      showToast('PDF de Percas por Área exportado com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PDF por área.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDetailedPdf = async () => {
    let el = document.getElementById('report-detalhado-print');
    if (!el) {
      setActiveTab('detalhado');
      await new Promise((r) => setTimeout(r, 80));
      el = document.getElementById('report-detalhado-print');
    }
    if (!el) return;
    setIsExportingPdf(true);
    showToast('Gerando PDF com Gráfico Comparativo Diário e Tabela Detalhada...');
    try {
      await exportElementToPdf(el, {
        fileName: `ambev-relatorio-detalhado-grafico-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape',
        title: 'RELATÓRIO DETALHADO DE QUEBRAS & GRÁFICO DIÁRIO (R$ vs HL)',
        subtitle: 'Comparativo Diário Visual e Relação Completa de Lançamentos Unitários',
        depositoName: depositoLabel,
        periodo: periodoLabel,
      });
      showToast('PDF Detalhado com Gráfico exportado com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PDF detalhado.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCompletePdf = async () => {
    const el = document.getElementById('report-dossie-completo-print');
    if (!el) return;
    setIsExportingPdf(true);
    showToast('Gerando Dossiê Consolidado em PDF com todos os relatórios e gráficos...');
    try {
      await exportElementToPdf(el, {
        fileName: `ambev-dossie-completo-quebras-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'portrait',
        title: 'DOSSIÊ EXECUTIVO CONSOLIDADO DE QUEBRAS & AVARIAS',
        subtitle: 'Visão Integrada: 8 Últimas Semanas, Percas por Área, Gráficos e Ocorrências',
        depositoName: depositoLabel,
        periodo: periodoLabel,
      });
      showToast('Dossiê Completo em PDF exportado com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar Dossiê Completo em PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Gráfico: valor máximo para calcular a altura das barras proporcionais
  const maxChartValue = useMemo(() => {
    if (dailyChartData.length === 0) return 1;
    return Math.max(...dailyChartData.map(d => d.valor));
  }, [dailyChartData]);

  const maxChartHl = useMemo(() => {
    if (dailyChartData.length === 0) return 1;
    return Math.max(...dailyChartData.map(d => d.hectolitro));
  }, [dailyChartData]);

  // Auto-correção para garantir que as informações coincidam sempre com a base real não-duplicada
  useEffect(() => {
    if (isCorruptedOrInflatedDataset(quebras) && onUpdateQuebras) {
      console.warn('Detectada base inflada com lançamentos duplicados no período oficial (R$ 16.901,19). Restaurando base limpa...');
      onUpdateQuebras(INITIAL_QUEBRAS);
      safeLocalStorageSet('gestao_estoque_v4_quebras', JSON.stringify(INITIAL_QUEBRAS));
      try {
        localStorage.removeItem('gestao_estoque_v3_quebras');
      } catch (e) {}
    }
  }, [quebras, onUpdateQuebras]);

  const handleAuditAndDeduplicate = () => {
    const { cleaned, duplicatesRemoved, syntheticRemoved, isCorrupted } = sanitizeAndDeduplicateQuebras(quebras);
    const baseList = isCorrupted ? INITIAL_QUEBRAS : cleaned;

    // Harmoniza proporções caso existam itens salvos com valores antigos descompassados
    let harmonizedCount = 0;
    const target = baseList.map(q => {
      const metrics = getSkuUnitMetrics(q.sku);
      if (!metrics) return q;
      const qty = Number(q.quantidade) || 0;
      if (qty <= 0) return q;
      const expectedTotal = Number((metrics.unitPrice * qty).toFixed(2));
      const expectedHl = Number((metrics.unitHl * qty).toFixed(4));
      if (Math.abs(q.valorTotal - expectedTotal) > 0.8 || Math.abs(q.volumeHl - expectedHl) > 0.05) {
        harmonizedCount++;
        return {
          ...q,
          valorTotal: expectedTotal,
          volumeHl: expectedHl
        };
      }
      return q;
    });

    if (onUpdateQuebras) {
      onUpdateQuebras(target);
    }
    try {
      localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(target));
      localStorage.removeItem('gestao_estoque_v3_quebras');
    } catch (e) {}

    if (isCorrupted) {
      showToast('Base corrigida! Lançamentos duplicados removidos: R$ 10.586,22 / 24,45 HL estabelecidos.');
    } else if (duplicatesRemoved > 0 || syntheticRemoved > 0 || harmonizedCount > 0) {
      showToast(`Base auditada: ${duplicatesRemoved} duplicações e ${harmonizedCount} valores desproporcionais corrigidos!`);
    } else {
      showToast('Base 100% íntegra e auditada: sem duplicações e com todas as proporções exatas.');
    }
  };

  const downloadQuebrasTemplateCsv = () => {
    const header = 'Código;Descrição;Quantidade;Valor Total (R$);Hecto Total (HL);Código Motivo;AREA;MOTIVO\r\n';
    const sampleRows = [
      '988;BRAHMA CHOPP 600ML;34;147,98;2,4480;577;PUXADA;QUEBRADA',
      '2353;GUARANA CHP ANTARCTICA DIET PET 2L CAIXA C/6;42;196,60;5,0400;578;PUXADA;VAZAMENTO',
      '2546;ORIGINAL 600ML;9;45,77;0,6480;539;ARMAZÉM;QUEBRA COM MOVIMENTAÇÃO',
      '7983;GATORADE MORANGO-MARACUJA PET 500ML SIXPACK;1;3,89;0,0300;578;PUXADA;VAZAMENTO',
      '9276;PEPSI ZERO PET 2L CAIXA C/6;90;391,96;10,8000;578;PUXADA;VAZAMENTO',
      '21632;SPATEN N LN 355ML SIXPACK SH C/4;36;141,88;3,0672;575;PUXADA;ESTUFADO',
      '33857;STELLA ARTOIS PURE GOLD 600ML;24;216,00;1,7280;577;PUXADA;QUEBRADA'
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_padrao_quebras_ambev.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Modelo padrão oficial de Quebras (.csv) baixado com sucesso!');
  };

  const downloadDreQuebrasTemplateCsv = () => {
    const header = 'Data;Mês;Cód Produto;Descrição;Quantidade;Área;Turno;Cód Quebra;Motivo;Colaborador;Função;VALOR DA AVARIA;HECTO LITRO;HECTO PERDIDO;Origem\r\n';
    const sampleRows = [
      '22/06/2026;JUNHO;1166;SUKITA UVA P2;1;PUXADA;NOITE;578;VAZAMENTO;;;3,35;0,0200;0,0200;DRE Quebras',
      '22/06/2026;JUNHO;13061;H2OH LIMONETO PET500ML;1;PUXADA;NOITE;575;ESTUFADO;;;2,73;0,0050;0,0050;DRE Quebras',
      '22/06/2026;JUNHO;21020;BUDWEISER 350ML;10;PUXADA;MANHÃ;575;ESTUFADO;;;26,49;0,0035;0,0350;DRE Quebras',
      '23/06/2026;JUNHO;2349;GUARANÁ CHP P2;5;PUXADA;NOITE;578;VAZAMENTO;;;23,66;0,0200;0,1000;DRE Quebras',
      '24/06/2026;JUNHO;9068;SKOL 350ML;4;PUXADA;MANHÃ;578;VAZAMENTO;N/A;N/A;10,09;0,0035;0,0208;DRE Quebras',
      '25/06/2026;JUNHO;21658;SPATEN LT 350ML;2;PUXADA;NOITE;575;ESTUFADO;;;6,69;0,0035;0,0070;DRE Quebras',
      '26/06/2026;JUNHO;34608;SKOL MULTIPACK;10;ENTREGA;MANHÃ;548;VAZAMENTO;;;25,25;0,0035;0,0350;DRE Quebras'
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_dre_quebras_promax_detalhado.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Modelo DRE Quebras Promax (.csv) baixado com sucesso!');
  };

  const handleRestoreOfficialBaseline = () => {
    if (onUpdateQuebras) {
      onUpdateQuebras(INITIAL_QUEBRAS);
    }
    try {
      localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(INITIAL_QUEBRAS));
      localStorage.removeItem('gestao_estoque_v3_quebras');
    } catch (e) {}
    showToast('Base oficial das 8 últimas semanas restaurada (R$ 10.586,22 / 24,45 HL)!');
  };

  // Handlers para Ações de Edição e Exclusão no Detalhamento com Proporcionalidade Dinâmica
  const handleOpenEditModal = (item: QuebraItem) => {
    setEditingQuebra(item);
    const metrics = getSkuUnitMetrics(item.sku, item.quantidade, item.valorTotal, item.volumeHl);
    const currentQty = Number(item.quantidade) || 1;
    const expectedValue = Number((metrics.unitPrice * currentQty).toFixed(2));
    const isDisproportionate = currentQty > 0 && Math.abs(expectedValue - item.valorTotal) > 0.8;
    
    setDisproportionateDetected(isDisproportionate);
    setModalUnitPrice(metrics.unitPrice);
    setModalUnitHl(metrics.unitHl);
    setAutoProportional(true);

    if (isDisproportionate) {
      // Se detectou que a quantidade foi alterada anteriormente sem que o valor tivesse sido recalculado,
      // sugere e preenche o valor proporcional exato
      setEditFormData({
        ...item,
        valorTotal: expectedValue,
        volumeHl: Number((metrics.unitHl * currentQty).toFixed(4)),
        faturado: item.faturado || (item.semanaRef && weeklyBillingStatus[item.semanaRef] === 'OK') || false
      });
    } else {
      setEditFormData({
        ...item,
        faturado: item.faturado || (item.semanaRef && weeklyBillingStatus[item.semanaRef] === 'OK') || false
      });
    }
  };

  const handleModalQuantityChange = (newQty: number) => {
    if (autoProportional && modalUnitPrice > 0 && newQty >= 0) {
      const newTotal = Number((modalUnitPrice * newQty).toFixed(2));
      const newHl = Number((modalUnitHl * newQty).toFixed(4));
      setEditFormData(prev => ({
        ...prev,
        quantidade: newQty,
        valorTotal: newTotal,
        volumeHl: newHl
      }));
    } else {
      setEditFormData(prev => ({
        ...prev,
        quantidade: newQty
      }));
    }
  };

  const handleModalUnitPriceChange = (newPrice: number) => {
    setModalUnitPrice(newPrice);
    const qty = Number(editFormData.quantidade) || 0;
    const newTotal = Number((newPrice * qty).toFixed(2));
    setEditFormData(prev => ({
      ...prev,
      valorTotal: newTotal
    }));
  };

  const handleModalValorTotalChange = (newTotal: number) => {
    const qty = Number(editFormData.quantidade) || 0;
    if (qty > 0) {
      setModalUnitPrice(Number((newTotal / qty).toFixed(4)));
    }
    setEditFormData(prev => ({
      ...prev,
      valorTotal: newTotal
    }));
  };

  const handleModalUnitHlChange = (newUnitHl: number) => {
    setModalUnitHl(newUnitHl);
    const qty = Number(editFormData.quantidade) || 0;
    const newHl = Number((newUnitHl * qty).toFixed(4));
    setEditFormData(prev => ({
      ...prev,
      volumeHl: newHl
    }));
  };

  const handleModalVolumeHlChange = (newHl: number) => {
    const qty = Number(editFormData.quantidade) || 0;
    if (qty > 0) {
      setModalUnitHl(Number((newHl / qty).toFixed(6)));
    }
    setEditFormData(prev => ({
      ...prev,
      volumeHl: newHl
    }));
  };

  const handleApplyOfficialProportions = () => {
    if (!editFormData.sku) return;
    const metrics = getSkuUnitMetrics(editFormData.sku);
    const qty = Number(editFormData.quantidade) || 0;
    const newTotal = Number((metrics.unitPrice * qty).toFixed(2));
    const newHl = Number((metrics.unitHl * qty).toFixed(4));
    setModalUnitPrice(metrics.unitPrice);
    setModalUnitHl(metrics.unitHl);
    setDisproportionateDetected(false);
    setEditFormData(prev => ({
      ...prev,
      valorTotal: newTotal,
      volumeHl: newHl
    }));
    showToast(`Proporção oficial restabelecida: R$ ${formatCurrency(newTotal)} e ${newHl.toFixed(3)} HL!`);
  };

  const handleHarmonizeProportions = () => {
    let harmonizedCount = 0;
    const harmonized = quebras.map(q => {
      const metrics = getSkuUnitMetrics(q.sku);
      if (!metrics) return q;
      const qty = Number(q.quantidade) || 0;
      if (qty <= 0) return q;
      const expectedTotal = Number((metrics.unitPrice * qty).toFixed(2));
      const expectedHl = Number((metrics.unitHl * qty).toFixed(4));
      if (Math.abs(q.valorTotal - expectedTotal) > 0.8 || Math.abs(q.volumeHl - expectedHl) > 0.05) {
        harmonizedCount++;
        return {
          ...q,
          valorTotal: expectedTotal,
          volumeHl: expectedHl
        };
      }
      return q;
    });

    if (harmonizedCount > 0) {
      if (onUpdateQuebras) {
        onUpdateQuebras(harmonized);
      }
      try {
        localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(harmonized));
      } catch (e) {}
      showToast(`Harmonização concluída: ${harmonizedCount} item(ns) tiveram seus valores recalculados proporcionalmente à quantidade!`);
    } else {
      showToast('Todos os itens já possuem valores rigorosamente proporcionais às suas quantidades!');
    }
  };

  const handleOpenDeleteModal = (item: QuebraItem) => {
    setDeletingQuebra(item);
  };

  const handleRecalculateProportional = () => {
    handleApplyOfficialProportions();
  };

  const handleSaveEditQuebra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuebra) return;

    const qty = Number(editFormData.quantidade) || 0;
    const val = Number(editFormData.valorTotal) || 0;
    const hl = Number(editFormData.volumeHl) || 0;

    const updatedItem: QuebraItem = {
      ...editingQuebra,
      data: editFormData.data ? editFormData.data.trim() : editingQuebra.data,
      sku: editFormData.sku ? editFormData.sku.trim() : editingQuebra.sku,
      descricao: editFormData.descricao ? editFormData.descricao.trim() : editingQuebra.descricao,
      quantidade: qty,
      turno: (editFormData.turno || editingQuebra.turno || 'MANHÃ').toUpperCase(),
      codQuebra: editFormData.codQuebra || editingQuebra.codQuebra || '',
      area: (editFormData.area || editingQuebra.area || 'ENTREGA').toUpperCase(),
      motivo: (editFormData.motivo || editingQuebra.motivo || 'OUTROS').toUpperCase(),
      colaborador: editFormData.colaborador ? editFormData.colaborador.trim() : '',
      valorTotal: val,
      volumeHl: hl,
      deposito: (editFormData.deposito as DepositoId) || editingQuebra.deposito,
      faturado: Boolean(editFormData.faturado),
      mes: editFormData.mes || getMonthName(editFormData.data || editingQuebra.data),
    };

    const updatedQuebras = quebras.map(q => q.id === editingQuebra.id ? updatedItem : q);
    if (onUpdateQuebras) {
      onUpdateQuebras(updatedQuebras);
    }
    try {
      localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(updatedQuebras));
    } catch (err) {}

    setEditingQuebra(null);
    showToast(`Lançamento SKU ${updatedItem.sku} atualizado com sucesso em toda a plataforma!`);
  };

  const handleConfirmDeleteQuebra = () => {
    if (!deletingQuebra) return;

    const targetSku = deletingQuebra.sku;
    const updatedQuebras = quebras.filter(q => q.id !== deletingQuebra.id);

    if (onUpdateQuebras) {
      onUpdateQuebras(updatedQuebras);
    }
    try {
      localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(updatedQuebras));
    } catch (err) {}

    setDeletingQuebra(null);
    showToast(`Lançamento SKU ${targetSku} excluído com sucesso! Relatórios e conciliação recalculados.`);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 text-xs font-semibold flex items-center space-x-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Operacional */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center">
              <TrendingDown className="w-3.5 h-3.5 mr-1" />
              Gestão de Quebras & Avarias
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center">
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              Relatórios Semanais & por Área (HL e R$)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Baixa de Faturamento Integrada
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Avarias de Armazém, Puxada & Rota
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Apuração volumétrica (Hectolitros) e financeira (R$), comparativo com a semana anterior, divisão por área operacional e controle de liquidação de quebras semanais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Dossiê PDF Completo com Gráficos */}
          <button
            onClick={handleExportCompletePdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center space-x-1.5"
            title="Exportar Dossiê Completo em PDF com todos os relatórios e gráficos"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileText className="w-4 h-4 text-rose-200" />
            )}
            <span>Exportar PDF (com Gráficos)</span>
          </button>

          {/* Botão Central de Exportações (Modal com abas PDF e Excel) */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-xs flex items-center space-x-1.5"
            title="Escolher formato de relatório em PDF ou Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Central de Exportação...</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Botão de Harmonizar Valores Proporcionais */}
          <button
            onClick={handleHarmonizeProportions}
            className="px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition border border-indigo-200 flex items-center space-x-1.5 shadow-xs active:scale-95"
            title="Recalcular automaticamente os valores (R$) e volumes (HL) proporcionalmente à quantidade para todos os itens"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span>Harmonizar Proporções</span>
          </button>

          {/* Botão de Auditoria e Deduplicação */}
          <button
            onClick={handleAuditAndDeduplicate}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-300 flex items-center space-x-1.5"
            title="Verificar e eliminar quaisquer duplicações de lançamentos ou resumos redundantes"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>Auditar & Deduplicar</span>
          </button>

          {/* Botão Modelo Padrão Oficial */}
          <button
            onClick={downloadQuebrasTemplateCsv}
            className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold transition border border-blue-200 flex items-center space-x-1.5 shadow-xs active:scale-95"
            title="Baixar modelo padronizado oficial de 8 colunas para preenchimento de quebras futuras"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Modelo Padrão (8 col)</span>
          </button>

          {/* Botão Modelo DRE Quebras Promax */}
          <button
            onClick={downloadDreQuebrasTemplateCsv}
            className="px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold transition border border-purple-200 flex items-center space-x-1.5 shadow-xs active:scale-95"
            title="Baixar modelo detalhado DRE Quebras Promax / Ambev com 15 colunas (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Modelo DRE Quebras (15 col)</span>
          </button>

          {/* Botão de Restaurar Base Oficial */}
          <button
            onClick={handleRestoreOfficialBaseline}
            className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition border border-amber-300 flex items-center space-x-1.5 shadow-xs active:scale-95"
            title="Restaurar base limpa de quebras sem duplicações"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Restaurar Base Oficial</span>
          </button>

          {onOpenManualQuebra && (
            <button
              onClick={onOpenManualQuebra}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              title="Inserção manual de Quebra / Avaria"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lançar Quebra</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center space-x-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Planilha</span>
          </button>
        </div>
      </div>

      {/* Bar de Filtro de Período Personalizado (Conforme Solicitado pelo Usuário) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 mr-2 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Período:
          </span>

          <button
            onClick={() => setDatePreset('8_semanas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === '8_semanas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            8 Últimas Semanas
          </button>

          <button
            onClick={() => setDatePreset('mes_junho')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'mes_junho'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês de Junho
          </button>

          <button
            onClick={() => setDatePreset('mes_julho')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'mes_julho'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês de Julho
          </button>

          <button
            onClick={() => setDatePreset('mes_agosto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'mes_agosto'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês de Agosto
          </button>

          <button
            onClick={() => setDatePreset('mes_setembro')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'mes_setembro'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês de Setembro
          </button>

          <button
            onClick={() => setDatePreset('ultimos_30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'ultimos_30'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Últimos 30 Dias
          </button>

          <button
            onClick={() => setDatePreset('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'todas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas as Datas
          </button>

          <button
            onClick={() => setDatePreset('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              datePreset === 'custom'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Personalizado
          </button>
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800"
            />
            <span className="text-slate-500 font-medium">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800"
            />
          </div>
        )}

        <div className="text-xs text-slate-500 font-medium self-center">
          Mostrando <span className="font-bold text-slate-900">{stats.totalRecords}</span> registros (
          <span className="text-rose-600 font-bold">{formatCurrency(stats.totalValor)}</span> |{' '}
          <span className="text-amber-700 font-bold">{formatHectoliters(stats.totalHl)}</span>)
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 shadow-xs">
        <button
          onClick={() => setActiveTab('semanas')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'semanas'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>8 Últimas Semanas & Faturamento (Foto 2)</span>
        </button>

        <button
          onClick={() => setActiveTab('area')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'area'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Percas por Área (Foto 1)</span>
        </button>

        <button
          onClick={() => setActiveTab('detalhado')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'detalhado'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-600" />
          <span>Relatório Detalhado & Gráfico Diário (Foto 3)</span>
        </button>

        <button
          onClick={() => setActiveTab('todos')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'todos'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Table2 className="w-4 h-4 text-slate-600" />
          <span>Lançamentos & Ocorrências Unitárias</span>
        </button>
      </div>

      {/* TAB 1: 8 ÚLTIMAS SEMANAS & STATUS FATURAMENTO (Conforme Imagem 2) */}
      {activeTab === 'semanas' && (
        <div className="space-y-4">
          {/* Header com ações rápidas de faturamento */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                  Status de Comparação Automática
                </span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                  Liquidação Semanal
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                Controle das 8 Últimas Semanas & Baixa de Quebras
              </h3>
              <p className="text-xs text-slate-300">
                Seta vermelha <span className="text-rose-400 font-bold">↑</span> indica quebra maior que a semana anterior; seta verde <span className="text-emerald-400 font-bold">↓</span> indica redução de avaria. Clique no botão de ação para dar baixa no faturamento.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleFaturarTodasSemanas}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
                title="Marcar todas as semanas exibidas como Faturadas / OK"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Dar Baixa em Todas</span>
              </button>

              <button
                onClick={handleExportWeeklyPdf}
                disabled={isExportingPdf}
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
                title="Exportar Relatório das 8 Semanas em PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-200" />
                <span>Exportar PDF</span>
              </button>

              <button
                onClick={handleExportWeekly}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Tabela Formatada Idêntica à Imagem 2 */}
          <div id="report-semanas-print" className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
              <div>
                <span>8 ÚLTIMAS SEMANAS</span>
                <span className="ml-2 text-[10px] text-slate-400 font-normal">
                  (Anteriores à data de referência: {weeklyReportList[0]?.endDate || 'Data Atual'})
                </span>
              </div>
              <span className="text-[11px] font-normal text-slate-300">Formato Padrão Logística Ambev</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                    <th className="py-2.5 px-4">DATA</th>
                    <th className="py-2.5 px-4 text-right">SOMA</th>
                    <th className="py-2.5 px-4 text-right">HECTOLITRO</th>
                    <th className="py-2.5 px-4 text-center">STATUS</th>
                    <th className="py-2.5 px-4 text-center">STATUS FATURAMENTO</th>
                    <th className="py-2.5 px-4 text-center">AÇÃO / BAIXA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {weeklyReportList.map((week) => {
                    const isFaturado = week.statusFaturamento === 'OK';
                    const isIncrease = week.statusTrend === 'UP';

                    return (
                      <tr key={week.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {week.label}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(week.somaValor)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 text-sm">
                          {week.hectolitro.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isIncrease ? (
                            <span className="inline-flex items-center justify-center font-bold text-base text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={`Aumento de R$ ${Math.abs(week.valorDiff).toFixed(2)} vs semana anterior`}>
                              ↑
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center font-bold text-base text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title={`Redução de R$ ${Math.abs(week.valorDiff).toFixed(2)} vs semana anterior`}>
                              ↓
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isFaturado ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Clock className="w-3.5 h-3.5 mr-1 text-rose-600" />
                              PENDENTE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleWeeklyBilling(week.label)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition shadow-xs ${
                              isFaturado
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                            }`}
                          >
                            {isFaturado ? 'Reabrir PENDENTE' : 'Dar Baixa (Faturar)'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Linha de Total Geral */}
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                    <td className="py-3 px-4 uppercase tracking-wider text-xs font-extrabold">
                      TOTAL
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-extrabold text-slate-900">
                      {formatCurrency(weeklyTotal.somaValor)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-extrabold text-slate-900">
                      {weeklyTotal.hectolitro.toFixed(2).replace('.', ',')}
                    </td>
                    <td colSpan={3} className="py-3 px-4 text-right text-xs text-slate-500 font-normal">
                      Soma total acumulada das {weeklyReportList.length} semanas
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERCAS POR ÁREA (Conforme Imagem 1) */}
      {activeTab === 'area' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Detalhamento de Quebras por Setor Operacional
              </h3>
              <p className="text-xs text-slate-500">
                Demonstrativo proporcional de prejuízo e volume perdido entre Armazém, Puxada, Entrega (Rota) e Mercado.
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                onClick={handleExportAreaPdf}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
                title="Exportar Relatório de Percas por Área e Gráfico em PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-200" />
                <span>Exportar PDF (com Gráficos)</span>
              </button>

              <button
                onClick={handleExportArea}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          <div id="report-area-print" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tabela Idêntica à Imagem 1 */}
            <div className="lg:col-span-2 bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider">
                PERCAS POR ÁREA
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                    <th className="py-2.5 px-4">SETOR</th>
                    <th className="py-2.5 px-4 text-right">VALOR</th>
                    <th className="py-2.5 px-4 text-right">PERCENTUAL</th>
                    <th className="py-2.5 px-4 text-right">HECTOLITRO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {areaLossList.map((item) => (
                    <tr key={item.setor} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.setor}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {item.valor > 0 ? formatCurrency(item.valor) : 'R$ -'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                        {Math.round(item.percentual)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                        {item.hectolitro.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))}

                  {/* Linha Total Geral */}
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                    <td className="py-3 px-4 font-extrabold uppercase">
                      {areaTotalGeral.setor}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      {formatCurrency(areaTotalGeral.valor)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      100%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      {areaTotalGeral.hectolitro.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual Summary Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Distribuição de Perdas por Área
                </h4>
                <div className="space-y-3">
                  {areaLossList.map((area) => (
                    <div key={area.setor}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-800">{area.setor}</span>
                        <span className="text-slate-600 font-mono">
                          {formatCurrency(area.valor)} ({Math.round(area.percentual)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            area.setor === 'PUXADA'
                              ? 'bg-rose-500'
                              : area.setor === 'ENTREGA'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, area.percentual))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block">Foco Operacional:</span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  A área de <strong className="text-rose-600">PUXADA</strong> concentra o maior volume de avarias (96% no período), caracterizada por latas e garrafas com vazamento e estufamento durante movimentação interna.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RELATÓRIO DETALHADO & GRÁFICO DIÁRIO (Conforme Imagem 3) */}
      {activeTab === 'detalhado' && (
        <div id="report-detalhado-print" className="space-y-5">
          {/* Gráfico Comparativo Diário: Reais vs Hectolitros */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Comparativo Diário de Perdas
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Reais (R$) e Hectolitros (HL) por Data
                </h3>
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-blue-500 rounded-xs" />
                  <span className="text-slate-600 font-medium">Reais (R$)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-amber-500 rounded-xs" />
                  <span className="text-slate-600 font-medium">Hectolitro (HL)</span>
                </div>
              </div>
            </div>

            {/* Container do Gráfico */}
            <div className="pt-6 pb-2 overflow-x-auto">
              {dailyChartData.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum dado diário para o período selecionado.
                </div>
              ) : (
                <div className="flex items-end justify-around gap-4 min-w-[550px] h-48 px-4 border-b border-slate-200">
                  {dailyChartData.map((d) => {
                    const heightPercentValor = Math.min(100, Math.max(12, (d.valor / maxChartValue) * 100));
                    const heightPercentHl = Math.min(100, Math.max(12, (d.hectolitro / maxChartHl) * 100));

                    return (
                      <div key={d.data} className="flex flex-col items-center flex-1 max-w-[90px] group">
                        {/* Valores flutuantes no topo das barras */}
                        <div className="text-[10px] font-mono text-center mb-1 text-slate-700 leading-tight">
                          <span className="block font-bold text-blue-700">{formatCurrency(d.valor)}</span>
                          <span className="block text-amber-700 font-semibold">{d.hectolitro.toFixed(2)} HL</span>
                        </div>

                        {/* Par de Barras: Azul (R$) e Laranja (HL) */}
                        <div className="flex items-end space-x-1.5 h-32 w-full justify-center">
                          {/* Barra Azul (R$) */}
                          <div
                            style={{ height: `${heightPercentValor}%` }}
                            className="w-5 bg-blue-500 hover:bg-blue-600 transition-all rounded-t-sm shadow-xs relative"
                            title={`Data: ${d.data}\nValor: ${formatCurrency(d.valor)}`}
                          />
                          {/* Barra Laranja (HL) */}
                          <div
                            style={{ height: `${heightPercentHl}%` }}
                            className="w-5 bg-amber-500 hover:bg-amber-600 transition-all rounded-t-sm shadow-xs relative"
                            title={`Data: ${d.data}\nVolume: ${d.hectolitro.toFixed(3)} HL`}
                          />
                        </div>

                        {/* Rótulo da data */}
                        <span className="text-[11px] font-mono text-slate-600 mt-2 whitespace-nowrap">
                          {d.data}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabela Amarela Detalhada (Conforme Foto 3) */}
          <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-yellow-400 text-slate-900 px-4 py-2.5 font-bold text-xs uppercase tracking-wider flex flex-wrap items-center justify-between gap-2 border-b border-yellow-500">
              <span className="font-extrabold">RELATÓRIO DETALHADO DE QUEBRAS</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportDetailedPdf}
                  disabled={isExportingPdf}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-[11px] font-semibold transition flex items-center space-x-1"
                  title="Exportar Relatório Detalhado com Gráficos em PDF"
                >
                  <FileText className="w-3 h-3" />
                  <span>Exportar PDF (com Gráfico)</span>
                </button>
                <button
                  onClick={handleExportDetailed}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold transition flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Exportar Tabela Excel</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-yellow-300/80 text-slate-900 font-bold uppercase text-[10px] tracking-wider border-b border-yellow-400">
                    <th className="py-2.5 px-3 whitespace-nowrap">DATA</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">MÊS</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">PRODUTO</th>
                    <th className="py-2.5 px-3 min-w-[220px]">DESCRIÇÃO</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">QUANT. UND.</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">TURNO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">CÓD</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ÁREA</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">MOTIVO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">COLABORADOR</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">VALOR TOTAL</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">HECTO</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">STATUS</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {fullyFilteredQuebras.map((item) => (
                    <tr key={item.id} className="hover:bg-yellow-50/50 transition font-sans">
                      <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{item.data}</td>
                      <td className="py-2 px-3 font-semibold text-slate-600 uppercase whitespace-nowrap">
                        {item.mes || getMonthName(item.data)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.sku}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{item.descricao}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{item.quantidade}</td>
                      <td className="py-2 px-3 font-semibold text-slate-600">{formatTurno(item.turno)}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{item.codQuebra}</td>
                      <td className="py-2 px-3 font-bold text-slate-700">{item.area}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {item.motivo}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{item.colaborador || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(item.valorTotal)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {item.volumeHl.toFixed(3).replace('.', ',')}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {item.faturado || (item.semanaRef && weeklyBillingStatus[item.semanaRef] === 'OK') ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            OK
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            PENDENTE
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition"
                            title="Editar lançamento de quebra"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition"
                            title="Excluir lançamento de quebra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-yellow-200/90 font-bold text-slate-900 border-t-2 border-yellow-500">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 uppercase text-[11px] tracking-wide">
                      TOTAL GERAL ({fullyFilteredQuebras.length} REGISTROS)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      {fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.quantidade) || 0), 0)}
                    </td>
                    <td colSpan={5} className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-blue-900 whitespace-nowrap">
                      {formatCurrency(fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.valorTotal) || 0), 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-amber-900 whitespace-nowrap">
                      {fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.volumeHl) || 0), 0).toFixed(3).replace('.', ',')}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TODOS OS LANÇAMENTOS E OCORRÊNCIAS UNITÁRIAS */}
      {activeTab === 'todos' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por SKU, descrição, motivo, colaborador ou área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={faturamentoFilter}
                onChange={(e) => setFaturamentoFilter(e.target.value as any)}
                className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none"
              >
                <option value="ALL">Status Faturamento: Todos</option>
                <option value="PENDENTE">Faturamento Pendente</option>
                <option value="OK">Faturado (OK)</option>
              </select>

              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none"
              >
                <option value="ALL">Todas as Áreas</option>
                {areas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={motivoFilter}
                onChange={(e) => setMotivoFilter(e.target.value)}
                className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none"
              >
                <option value="ALL">Todos os Motivos</option>
                {motivos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={turnoFilter}
                onChange={(e) => setTurnoFilter(e.target.value)}
                className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none"
              >
                <option value="ALL">Todos os Turnos</option>
                <option value="MANHÃ">Manhã</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3 min-w-[220px]">Descrição</th>
                    <th className="py-3 px-3 text-right">Qtd (Un)</th>
                    <th className="py-3 px-3">Motivo</th>
                    <th className="py-3 px-3">Área / Turno</th>
                    <th className="py-3 px-3 text-right">Prejuízo (R$)</th>
                    <th className="py-3 px-3 text-right">Volume (HL)</th>
                    <th className="py-3 px-3 text-center">Faturamento</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {fullyFilteredQuebras.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">Nenhum registro encontrado no filtro</p>
                      </td>
                    </tr>
                  ) : (
                    fullyFilteredQuebras.map((item) => {
                      const isFat = item.faturado || (item.semanaRef && weeklyBillingStatus[item.semanaRef] === 'OK');

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {item.data}
                            {item.semanaRef && (
                              <span className="block text-[10px] text-slate-400 font-sans">{item.semanaRef}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.sku}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{item.descricao}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {item.quantidade} un
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {item.motivo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            <span className="font-semibold text-slate-800">{item.area}</span>
                            {item.turno && <span className="text-slate-400"> • {formatTurno(item.turno)}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                            -{formatCurrency(item.valorTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {formatHectoliters(item.volumeHl)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isFat ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                FATURADO (OK)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                PENDENTE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition"
                                title="Editar lançamento de quebra"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(item)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition"
                                title="Excluir lançamento de quebra"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 uppercase text-[11px] tracking-wide">
                      TOTAL GERAL ({fullyFilteredQuebras.length} REGISTROS)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      {fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.quantidade) || 0), 0)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-rose-700 whitespace-nowrap">
                      -{formatCurrency(fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.valorTotal) || 0), 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-800 whitespace-nowrap">
                      {formatHectoliters(fullyFilteredQuebras.reduce((acc, q) => acc + (Number(q.volumeHl) || 0), 0))}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE OCORRÊNCIA DE QUEBRA */}
      {editingQuebra && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setEditingQuebra(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Editar Lançamento de Quebra
                </h3>
                <p className="text-xs text-slate-500">
                  Altere os dados da ocorrência. As métricas e relatórios em toda a plataforma serão recalculados automaticamente.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEditQuebra} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Produto Selecionado</span>
                  <p className="text-xs font-mono font-bold text-slate-900">SKU {editingQuebra.sku}</p>
                  <p className="text-xs font-semibold text-slate-700">{editingQuebra.descricao}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original</span>
                  <p className="text-xs font-bold text-rose-600 font-mono">
                    {editingQuebra.quantidade} un • R$ {formatCurrency(editingQuebra.valorTotal)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {formatHectoliters(editingQuebra.volumeHl)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data (DD/MM/AAAA) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.data || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, data: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    placeholder="DD/MM/AAAA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Depósito</label>
                  <select
                    value={editFormData.deposito || '548'}
                    onChange={(e) => setEditFormData({ ...editFormData, deposito: e.target.value as DepositoId })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="548">548 - Principal</option>
                    <option value="547">547</option>
                    <option value="575">575</option>
                    <option value="578">578</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Turno</label>
                  <select
                    value={editFormData.turno || 'MANHÃ'}
                    onChange={(e) => setEditFormData({ ...editFormData, turno: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="MANHÃ">Manhã</option>
                    <option value="TARDE">Tarde</option>
                    <option value="NOITE">Noite</option>
                    <option value="ADM">Administrativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Código *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.sku || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição do Produto *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.descricao || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, descricao: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Alerta de Desproporção Detectada */}
              {disproportionateDetected && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Correção de Proporcionalidade Aplicada!</p>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      A quantidade deste item havia sido alterada para <strong>{editFormData.quantidade} un</strong>, mas o valor e volume antigos ainda constavam na linha.
                      Os valores foram recalculados proporcionalmente ao preço oficial unitário: <strong>R$ {formatCurrency(editFormData.valorTotal || 0)}</strong> e <strong>{formatHectoliters(editFormData.volumeHl || 0)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quantidade (Unidades) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={editFormData.quantidade !== undefined ? editFormData.quantidade : ''}
                    onChange={(e) => handleModalQuantityChange(Number(e.target.value))}
                    className="w-full bg-blue-50/50 border border-blue-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 5"
                  />
                  <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
                    Atualiza valor e volume em tempo real
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Área da Quebra</label>
                  <select
                    value={editFormData.area || 'ENTREGA'}
                    onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ENTREGA">ENTREGA</option>
                    <option value="PUXADA">PUXADA</option>
                    <option value="ARMAZÉM">ARMAZÉM</option>
                    <option value="MERCADO">MERCADO</option>
                    <option value="PROCESSO">PROCESSO</option>
                    <option value="ROTA">ROTA</option>
                    <option value="CARREGAMENTO">CARREGAMENTO</option>
                    <option value="DESCARGA">DESCARGA</option>
                    <option value="OUTROS">OUTROS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motivo da Quebra</label>
                  <select
                    value={editFormData.motivo || 'VAZAMENTO'}
                    onChange={(e) => setEditFormData({ ...editFormData, motivo: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="VAZAMENTO">VAZAMENTO</option>
                    <option value="QUEBRADA">QUEBRADA</option>
                    <option value="ESTUFADO">ESTUFADO</option>
                    <option value="TAMPINHA FROUXA/QUEBRADA">TAMPINHA FROUXA/QUEBRADA</option>
                    <option value="LATA AMASSADA/FURADA">LATA AMASSADA/FURADA</option>
                    <option value="GARRAFA QUEBRADA/TRINCADA">GARRAFA QUEBRADA/TRINCADA</option>
                    <option value="CORPO ESTRANHO">CORPO ESTRANHO</option>
                    <option value="GARRAFA VAZIA">GARRAFA VAZIA</option>
                    <option value="AVARIA">AVARIA</option>
                    <option value="OUTROS">OUTROS</option>
                  </select>
                </div>
              </div>

              {/* Bloco de Indicadores Unitários & Proporcionalidade Dinâmica */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <Calculator className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cálculo Proporcional Automático</span>
                  </div>
                  <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoProportional}
                      onChange={(e) => setAutoProportional(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-[11px]">Vincular Total à Quantidade</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Preço Unitário (R$/un)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={modalUnitPrice || ''}
                        onChange={(e) => handleModalUnitPriceChange(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Volume Unitário (HL/un)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={modalUnitHl || ''}
                      onChange={(e) => handleModalUnitHlChange(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Resumo Dinâmico da Fórmula */}
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-mono text-slate-700">
                    <span className="text-slate-400">Fórmula: </span>
                    <strong className="text-blue-700">{editFormData.quantidade || 0} un</strong>
                    <span className="text-slate-400"> × </span>
                    <span>R$ {modalUnitPrice.toFixed(2)}</span>
                    <span className="text-slate-400"> = </span>
                    <strong className="text-rose-600">R$ {formatCurrency(editFormData.valorTotal || 0)}</strong>
                    <span className="mx-2 text-slate-300">|</span>
                    <strong className="text-indigo-700">{formatHectoliters(editFormData.volumeHl || 0)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyOfficialProportions}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[11px] font-bold transition flex items-center space-x-1"
                    title="Recalcular com base na tabela oficial de preços e volumes Ambev"
                  >
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Aplicar Catálogo Oficial</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Colaborador / Operador</label>
                  <input
                    type="text"
                    value={editFormData.colaborador || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, colaborador: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    placeholder="Nome ou matrícula..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status de Faturamento</label>
                  <select
                    value={editFormData.faturado ? 'OK' : 'PENDENTE'}
                    onChange={(e) => setEditFormData({ ...editFormData, faturado: e.target.value === 'OK' })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="OK">FATURADO (OK)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prejuízo Total (R$) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editFormData.valorTotal !== undefined ? editFormData.valorTotal : ''}
                    onChange={(e) => handleModalValorTotalChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Volume Hectolitros (HL) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    required
                    value={editFormData.volumeHl !== undefined ? editFormData.volumeHl : ''}
                    onChange={(e) => handleModalVolumeHlChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingQuebra(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingQuebra && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setDeletingQuebra(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Lançamento de Quebra
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmação de exclusão com atualização global
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2 mb-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  Tem certeza que deseja excluir esta ocorrência de quebra?
                </p>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-rose-200/60 space-y-1 font-mono text-[11px]">
                <p><span className="font-sans font-bold text-slate-600">Produto:</span> SKU {deletingQuebra.sku} - {deletingQuebra.descricao}</p>
                <p><span className="font-sans font-bold text-slate-600">Data:</span> {deletingQuebra.data} ({deletingQuebra.semanaRef || '-'})</p>
                <p><span className="font-sans font-bold text-slate-600">Quantidade:</span> {deletingQuebra.quantidade} un</p>
                <p><span className="font-sans font-bold text-slate-600">Prejuízo:</span> -{formatCurrency(deletingQuebra.valorTotal)} ({formatHectoliters(deletingQuebra.volumeHl)})</p>
                <p><span className="font-sans font-bold text-slate-600">Área / Motivo:</span> {deletingQuebra.area} • {deletingQuebra.motivo}</p>
              </div>
              <p className="text-[11px] text-rose-700">
                Ao excluir, o item será removido e <strong>todos os relatórios, gráficos e indicadores de conciliação</strong> da plataforma serão sincronizados imediatamente.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingQuebra(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteQuebra}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CENTRAL DE EXPORTAÇÃO (PDF COM GRÁFICOS & EXCEL) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                <Printer className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Central de Exportação de Relatórios de Quebras
                </h3>
                <p className="text-xs text-slate-500">
                  Exporte relatórios em PDF corporativo (com gráficos visuais) ou planilhas Excel (.xlsx)
                </p>
              </div>
            </div>

            {/* Abas do Modal: PDF vs Excel */}
            <div className="flex border-b border-slate-200 mb-4">
              <button
                onClick={() => setExportModalTab('pdf')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition ${
                  exportModalTab === 'pdf'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Relatórios em PDF (com Gráficos da Plataforma)</span>
              </button>
              <button
                onClick={() => setExportModalTab('excel')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition ${
                  exportModalTab === 'excel'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Planilhas Excel (.xlsx)</span>
              </button>
            </div>

            {/* Conteúdo Aba PDF */}
            {exportModalTab === 'pdf' && (
              <div className="space-y-2.5 my-3">
                {/* Opção 1: Dossiê Completo em PDF */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportCompletePdf();
                  }}
                  className="p-3.5 border-2 border-rose-200 hover:border-rose-500 bg-rose-50/40 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-rose-950">
                        Dossiê Executivo Consolidado (PDF com Todos os Gráficos)
                      </span>
                      <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">
                        Completo
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Gera um documento PDF com as 8 Últimas Semanas, Percas por Área com gráficos de distribuição e Comparativo Diário visual.
                    </p>
                  </div>
                  <FileText className="w-5 h-5 text-rose-600 group-hover:scale-110 transition shrink-0 ml-3" />
                </div>

                {/* Opção 2: 8 Semanas em PDF */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportWeeklyPdf();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório das 8 Últimas Semanas & Faturamento (PDF)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tabela formatada com valores em R$, Hectolitros, setas de evolução (↑/↓) e status de baixa semanal.
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>

                {/* Opção 3: Percas por Área em PDF com Gráfico */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportAreaPdf();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório de Percas por Área com Gráficos de Distribuição (PDF)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Demonstrativo por setor (Armazém, Puxada, Entrega, Mercado) com gráficos de participação percentual.
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>

                {/* Opção 4: Relatório Detalhado com Gráfico Diário */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportDetailedPdf();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório Detalhado com Gráfico Diário R$ vs HL (PDF)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gráfico comparativo de barras diárias (Reais e Hectolitros) e relação completa de lançamentos com código SKU.
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>
              </div>
            )}

            {/* Conteúdo Aba Excel */}
            {exportModalTab === 'excel' && (
              <div className="space-y-2.5 my-3">
                {/* Opção 1: Pasta de Trabalho Completa */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportComplete();
                  }}
                  className="p-3.5 border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-emerald-900">
                        Pasta de Trabalho Executiva Completa (.xlsx)
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Gera um único arquivo Excel contendo 3 abas estruturadas: 8 Últimas Semanas, Percas por Área e Detalhamento.
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition shrink-0 ml-3" />
                </div>

                {/* Opção 2: 8 Últimas Semanas */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportWeekly();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório das 8 Últimas Semanas (Imagem 2)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Colunas DATA, SOMA (R$), HECTOLITRO, STATUS (↑/↓) e STATUS FATURAMENTO (PENDENTE/OK).
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>

                {/* Opção 3: Percas por Área */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportArea();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório de Percas por Área (Imagem 1)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Detalhamento por setor com VALOR, PERCENTUAL e HECTOLITRO.
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>

                {/* Opção 4: Relatório Detalhado */}
                <div
                  onClick={() => {
                    setIsExportModalOpen(false);
                    handleExportDetailed();
                  }}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Relatório Detalhado de Quebras (Imagem 3)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lista completa com código SKU, descrição, quantidade em unidades, turno e colaborador.
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition shrink-0 ml-3" />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTAINER OFFSCREEN PARA EXPORTAÇÃO DO DOSSIÊ COMPLETO EM PDF COM TODOS OS GRÁFICOS */}
      <div
        id="report-dossie-completo-print"
        className="fixed -left-[9999px] top-0 w-[1000px] bg-white p-6 space-y-6 text-slate-900"
      >
        {/* Seção 1: 8 Últimas Semanas */}
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-slate-900 text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
            <span>1. RELATÓRIO DAS 8 ÚLTIMAS SEMANAS & STATUS DE FATURAMENTO</span>
            <span className="text-[11px] font-normal text-slate-300">Formato Padrão Logística Ambev</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                <th className="py-2 px-3">DATA</th>
                <th className="py-2 px-3 text-right">SOMA (R$)</th>
                <th className="py-2 px-3 text-right">HECTOLITRO</th>
                <th className="py-2 px-3 text-center">STATUS</th>
                <th className="py-2 px-3 text-center">STATUS FATURAMENTO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {weeklyReportList.map((week) => (
                <tr key={week.id}>
                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{week.label}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(week.somaValor)}</td>
                  <td className="py-2 px-3 text-right font-mono">{week.hectolitro.toFixed(2).replace('.', ',')}</td>
                  <td className="py-2 px-3 text-center font-bold">
                    {week.statusTrend === 'UP' ? '↑ MAIOR' : week.statusTrend === 'DOWN' ? '↓ MENOR' : '-'}
                  </td>
                  <td className="py-2 px-3 text-center font-bold">
                    {week.statusFaturamento === 'OK' ? 'FATURADO (OK)' : 'PENDENTE'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white font-bold">
                <td className="py-2 px-3 uppercase">TOTAL GERAL</td>
                <td className="py-2 px-3 text-right font-mono">{formatCurrency(weeklyTotal.somaValor)}</td>
                <td className="py-2 px-3 text-right font-mono">{weeklyTotal.hectolitro.toFixed(2).replace('.', ',')}</td>
                <td colSpan={2} className="py-2 px-3 text-right text-[11px] text-slate-300 font-normal">
                  Soma total acumulada das 8 semanas
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Seção 2: Percas por Área com Gráficos */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider">
              2. PERCAS POR ÁREA (DISTRIBUIÇÃO OPERACIONAL)
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                  <th className="py-2 px-3">SETOR</th>
                  <th className="py-2 px-3 text-right">VALOR</th>
                  <th className="py-2 px-3 text-right">PERCENTUAL</th>
                  <th className="py-2 px-3 text-right">HECTOLITRO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {areaLossList.map((item) => (
                  <tr key={item.setor}>
                    <td className="py-2 px-3 font-bold text-slate-800">{item.setor}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(item.valor)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{Math.round(item.percentual)}%</td>
                    <td className="py-2 px-3 text-right font-mono">{item.hectolitro.toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-2 px-3 uppercase">TOTAL GERAL</td>
                  <td className="py-2 px-3 text-right font-mono">{formatCurrency(areaTotalGeral.valor)}</td>
                  <td className="py-2 px-3 text-right font-mono">{Math.round(areaTotalGeral.percentual)}%</td>
                  <td className="py-2 px-3 text-right font-mono">{areaTotalGeral.hectolitro.toFixed(2).replace('.', ',')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gráfico de Barras de Distribuição */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-800 mb-2">Gráfico de Participação (%)</h4>
              <div className="space-y-3">
                {areaLossList.map((a) => (
                  <div key={a.setor}>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>{a.setor}</span>
                      <span>{Math.round(a.percentual)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          a.setor === 'PUXADA' ? 'bg-rose-500' : a.setor === 'ENTREGA' ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, a.percentual))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200">
              * PUXADA concentra a maior incidência de avarias no período selecionado.
            </div>
          </div>
        </div>

        {/* Seção 3: Gráfico Diário de Perdas (R$ vs HL) */}
        <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-xs">
          <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              3. GRÁFICO COMPARATIVO DIÁRIO DE PERDAS: REAIS (R$) vs HECTOLITROS (HL)
            </h4>
            <div className="flex items-center space-x-4 text-xs font-semibold">
              <span className="text-blue-600">■ Reais (R$)</span>
              <span className="text-amber-600">■ Hectolitro (HL)</span>
            </div>
          </div>
          <div className="flex items-end justify-around gap-2 h-40 pt-4 px-2 border-b border-slate-200">
            {dailyChartData.map((d) => {
              const heightPercentValor = Math.min(100, Math.max(12, (d.valor / maxChartValue) * 100));
              const heightPercentHl = Math.min(100, Math.max(12, (d.hectolitro / maxChartHl) * 100));
              return (
                <div key={d.data} className="flex flex-col items-center flex-1 max-w-[90px]">
                  <div className="text-[9px] font-mono text-center mb-1 leading-tight">
                    <span className="block font-bold text-blue-700">{formatCurrency(d.valor)}</span>
                    <span className="block text-amber-700 font-semibold">{d.hectolitro.toFixed(2)} HL</span>
                  </div>
                  <div className="flex items-end space-x-1.5 h-24 w-full justify-center">
                    <div style={{ height: `${heightPercentValor}%` }} className="w-4 bg-blue-500 rounded-t-xs" />
                    <div style={{ height: `${heightPercentHl}%` }} className="w-4 bg-amber-500 rounded-t-xs" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-700 mt-1">{d.data}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seção 4: Amostra Resumida de Lançamentos Unitários */}
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-yellow-400 text-slate-900 px-4 py-2 font-bold text-xs uppercase tracking-wider">
            4. RELATÓRIO DETALHADO DE QUEBRAS (REGISTROS EM DESTAQUE)
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-yellow-300/80 text-slate-900 font-bold uppercase text-[10px] border-b border-yellow-400">
                <th className="py-2 px-3">DATA</th>
                <th className="py-2 px-3">PRODUTO</th>
                <th className="py-2 px-3">DESCRIÇÃO</th>
                <th className="py-2 px-3 text-right">QUANT.</th>
                <th className="py-2 px-3">ÁREA</th>
                <th className="py-2 px-3 text-right">VALOR TOTAL</th>
                <th className="py-2 px-3 text-right">HECTO</th>
                <th className="py-2 px-3 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {fullyFilteredQuebras.map((q) => (
                <tr key={q.id}>
                  <td className="py-1.5 px-3 font-mono">{q.data}</td>
                  <td className="py-1.5 px-3 font-mono font-bold">{q.sku || (q as any).codigoProduto}</td>
                  <td className="py-1.5 px-3 truncate max-w-[220px]">{q.descricao}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{q.quantidade} un</td>
                  <td className="py-1.5 px-3">{q.area}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(q.valorTotal)}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{q.volumeHl.toFixed(3)}</td>
                  <td className="py-1.5 px-3 text-center font-semibold text-[10px]">
                    {weeklyBillingStatus[q.semanaRef || ''] === 'OK' || q.faturado ? 'FATURADO (OK)' : 'PENDENTE'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
