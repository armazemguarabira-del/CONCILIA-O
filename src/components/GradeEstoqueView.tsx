import React, { useState, useMemo, useRef } from 'react';
import { 
  Boxes, 
  UploadCloud, 
  Download, 
  Copy, 
  Check, 
  Filter, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  FileSpreadsheet, 
  FileText, 
  ShieldAlert, 
  HelpCircle, 
  TrendingDown, 
  Building2,
  RefreshCw,
  Eye,
  Sliders,
  Minus,
  Plus,
  RotateCcw,
  X,
  FileCheck2,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { 
  StockPositionItem, 
  DepositoId, 
  ProductMaster, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  GradeEstoqueItem,
  FrozenReconciliation,
  ViewTab 
} from '../types';
import { DEPOSITOS } from '../data/initialData';
import { formatCurrency, formatHectoliters, parse020502Csv, parseExcelWorkbookToCsv } from '../utils/parsers';
import { calculateSkuDeviations, matchSku } from '../utils/desviosUtils';
import { roundSkuDown } from './DifMensalView';
import { INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026 } from '../data/initialFrozenData';
import { ConfirmarGradeModal } from './ConfirmarGradeModal';
import * as XLSX from 'xlsx';
import { persistData, STORAGE_KEYS } from '../utils/persistentStorage';

interface GradeEstoqueViewProps {
  stockPositions: StockPositionItem[];
  setStockPositions: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  generalStockPositions?: StockPositionItem[];
  setGeneralStockPositions?: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  productsMap: Map<string, ProductMaster>;
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
  frozenReconciliations?: FrozenReconciliation[];
  onNavigateTab?: (tab: ViewTab) => void;
  onOpenImportModal?: (type?: any) => void;
}

export const GradeEstoqueView: React.FC<GradeEstoqueViewProps> = ({
  stockPositions,
  setStockPositions,
  generalStockPositions = [],
  setGeneralStockPositions,
  productsMap,
  quebras = [],
  vales = [],
  trocas = [],
  faltasMapeadas = [],
  weeklyBillingStatus,
  frozenReconciliations = [],
  onNavigateTab,
  onOpenImportModal,
}) => {
  // Modo de cálculo da Grade:
  // 'com_ajuste' (padrão obrigatório da logística Ambev: deduzindo a última dif mensal congelada e desvios) ou 'sem_ajuste' (02.05.02 bruta pura)
  const [modoAjuste, setModoAjuste] = useState<'sem_ajuste' | 'com_ajuste'>('com_ajuste');
  
  // Reserva geral de segurança (em caixas / SKUs) aplicada a todos os itens
  const [reservaGlobal, setReservaGlobal] = useState<number>(0);

  // Reservas individualizadas por SKU caso o analista queira customizar itens específicos
  const [reservasCustomizadas, setReservasCustomizadas] = useState<Record<string, number>>({});

  // Depósito de origem dos dados da 02.05.02 (Padrão Depósito 01 Central, mas selecionável)
  const [depositoOrigem, setDepositoOrigem] = useState<DepositoId | 'ALL'>('01');

  // Filtros e pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APTOS' | 'DESCARTADOS' | 'AVULSOS'>('ALL');
  const [grupoFilter, setGrupoFilter] = useState('ALL');

  // Feedback Toast & Modal de Pré-visualização do Arquivo
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmarModal, setShowConfirmarModal] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState(false);

  // Histórico/Timestamp da 02.05.02 da Grade
  const [importTimestamp, setImportTimestamp] = useState<string>(() => {
    return localStorage.getItem('gestao_estoque_v3_grade_data_importacao') || '';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Copiar posições da 02.05.02 carregada para a Grade
  const handleCopyFromConciliacao = () => {
    if (generalStockPositions.length === 0) {
      showToast('Não há posições de estoque na Conciliação para copiar.', 'error');
      return;
    }
    const confirmed = window.confirm(
      `Deseja carregar as ${generalStockPositions.length} posições da 02.05.02 para a Grade de Estoque? ` +
      `A base anterior da Grade será substituída integralmente por estas posições vigentes.`
    );
    if (!confirmed) return;

    setStockPositions([...generalStockPositions]);
    const nowStr = new Date().toLocaleString('pt-BR');
    const label = `Sincronizado da 02.05.02 (${nowStr})`;
    setImportTimestamp(label);
    persistData(STORAGE_KEYS.GRADE_IMPORT_LABEL, label);
    persistData(STORAGE_KEYS.GRADE_POSITIONS, generalStockPositions);
    persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, generalStockPositions);
    showToast(`Base da Grade substituída com ${generalStockPositions.length} itens vigentes!`);
  };

  // Mapa de faltas apuradas na data do último congelamento da DIF MENSAL (não na Dif Diária)
  // Conforme requisito do usuário:
  // "o congelado deverá puxar da data do ultimo congelamento na dif mensal não na dif diária.
  // quando importarmos a 02.05.02 na guia de grade ela não deve considerar a dif atual, apenas a 02.05.02 da conciliação."
  const difMensalUltimoCongelamentoMap = useMemo(() => {
    const map = new Map<string, { skus: number }>();

    // 1. Matriz de base da DIF MENSAL (Setembro/2026): busca a quantidade do último dia registrado (dia 16)
    INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.forEach(item => {
      const cleanSku = String(item.sku).trim().replace(/^0+/, '');
      const recordedDays = Object.keys(item.dias).map(Number).sort((a, b) => a - b);
      let diffLastDay = item.fechamento;
      if (recordedDays.length > 0) {
        const lastDay = recordedDays[recordedDays.length - 1];
        diffLastDay = item.dias[lastDay];
      }
      const rounded = roundSkuDown(diffLastDay);
      // Na Dif Mensal, se o saldo for negativo (< 0), é uma falta física a abater na grade com ajuste
      if (rounded < 0) {
        map.set(cleanSku, { skus: Math.abs(rounded) });
      }
    });

    // 2. Se houver histórico de reconciliações congeladas salvas pelo usuário,
    // a última congelada (mais recente) tem precedência
    if (frozenReconciliations && frozenReconciliations.length > 0) {
      const sorted = [...frozenReconciliations].sort(
        (a, b) => new Date(b.dataCongelamento).getTime() - new Date(a.dataCongelamento).getTime()
      );
      const latest = sorted[0];
      const items = (latest.itensComAjustes && latest.itensComAjustes.length > 0)
        ? latest.itensComAjustes
        : (latest.itensSemAjustes || []);

      items.forEach((it: any) => {
        const cleanSku = String(it.produto).trim().replace(/^0+/, '');
        const rawDiff = it.divergenciaResidualSkus !== undefined
          ? it.divergenciaResidualSkus
          : (it.diferencaSkus || 0);
        const rounded = roundSkuDown(rawDiff);
        if (rounded < 0) {
          map.set(cleanSku, { skus: Math.abs(rounded) });
        } else if (rounded >= 0) {
          map.delete(cleanSku);
        }
      });
    }

    return map;
  }, [frozenReconciliations]);

  // Processamento e cálculo analítico da Grade de Estoque
  const gradeItems = useMemo<GradeEstoqueItem[]>(() => {
    // Se a Grade tiver posições próprias importadas nela, usa-as. Senão usa as posições da conciliação
    const positionsSource = stockPositions.length > 0 ? stockPositions : (generalStockPositions || []);

    // Agrupa ou filtra itens pelo depósito de origem
    const filteredPositions = positionsSource.filter(item => {
      if (depositoOrigem !== 'ALL' && item.deposito !== depositoOrigem) return false;
      return true;
    });

    // Se houver mais de uma linha para o mesmo produto (ex: ALL), consolida por produto
    const productMap = new Map<string, {
      deposito: DepositoId;
      item: StockPositionItem;
      totalDispUnits: number;
    }>();

    filteredPositions.forEach(p => {
      const existing = productMap.get(p.produto);
      if (existing) {
        existing.totalDispUnits += p.disponivelTotalUnits;
      } else {
        productMap.set(p.produto, {
          deposito: p.deposito,
          item: p,
          totalDispUnits: p.disponivelTotalUnits
        });
      }
    });

    return Array.from(productMap.values()).map(({ deposito, item, totalDispUnits }) => {
      const sku = String(item.produto).trim();
      const fatorSku = Math.max(1, item.fatorSku || 1);

      // Quantidade sistêmica da 02.05.02 Bruta (apenas posições de estoque da 02.05.02 sem dif atual)
      const isNegative = totalDispUnits < 0;
      const validTotalUnits = isNegative ? 0 : totalDispUnits;
      const disponivelSkus = Math.floor(validTotalUnits / fatorSku);
      const disponivelLooseUnits = validTotalUnits % fatorSku;

      // Cálculo dos desvios da plataforma (Quebras, Vales, Trocas, Faltas)
      const dev = calculateSkuDeviations(
        sku,
        deposito,
        fatorSku,
        item.valorUnitario,
        item.valorCaixa,
        item.fatorHl,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        weeklyBillingStatus
      );

      // Quantidades individuais de cada desvio operacional pendente/congelado
      const quebrasUnits = dev.quebras.units;
      const quebrasSkus = quebrasUnits > 0 ? Math.ceil(quebrasUnits / fatorSku) : 0;

      const trocasUnits = dev.trocas.units;
      const trocasSkus = trocasUnits > 0 ? Math.ceil(trocasUnits / fatorSku) : 0;

      const valesUnits = dev.vales.units;
      const valesSkus = valesUnits > 0 ? Math.ceil(valesUnits / fatorSku) : 0;

      const faltasUnits = dev.faltas.units;
      const faltasSkus = faltasUnits > 0 ? Math.ceil(faltasUnits / fatorSku) : 0;

      // Dif Congelada = soma das diferenças operacionais congeladas (trocas, faltas, quebras e vales)
      const difCongeladaSkus = quebrasSkus + trocasSkus + valesSkus + faltasSkus;
      const difCongeladaUnits = quebrasUnits + trocasUnits + valesUnits + faltasUnits;

      const cleanSku = sku.replace(/^0+/, '');

      // Dif Inventário: puxa da data do último congelamento na DIF MENSAL COM AJUSTE
      // Regra de ouro da logística Ambev: "lembrar de não considerar sobras, só falta, pois não podemos lançar quantidades maiores do que temos no nosso saldo fiscal"
      const difMensal = difMensalUltimoCongelamentoMap.get(cleanSku);
      const difInventarioSkus = (difMensal && difMensal.skus > 0) ? difMensal.skus : 0;
      const difInventarioUnits = difInventarioSkus * fatorSku;

      // Não considera diferença do dia atual da contagem, apenas a 02.05.02 da conciliação
      const diferencaDiaUnits = 0;
      const diferencaDiaSkus = 0;

      // AJUSTE TOTAL REALIZADO PARA ENTREGAR A QUANTIDADE FINAL DA GRADE:
      // "eu só preciso da dif de inventário, pois a dif congelada (quebras, faltas, trocas e reposições, vales) já está inclusa na contagem de inventário, e já foi salva com o ajuste, então para a grade só considere a dif de inventário"
      const totalAjusteSkus = modoAjuste === 'com_ajuste' 
        ? difInventarioSkus 
        : 0;

      const congeladosTotalSkus = totalAjusteSkus;
      const congeladosTotalUnits = difInventarioUnits;

      // Base líquida de caixas disponíveis antes da reserva:
      const baseSkus = modoAjuste === 'com_ajuste' 
        ? Math.max(0, disponivelSkus - totalAjusteSkus) 
        : disponivelSkus;

      // Reserva aplicada (customizada ou global)
      const rawReserva = reservasCustomizadas[sku] !== undefined 
        ? reservasCustomizadas[sku] 
        : reservaGlobal;
      const reservaSkus = Math.max(0, Number.isFinite(rawReserva) ? rawReserva : 0);

      // Quantidade final lançada na Grade (Disponível - Dif. Inventário - Reserva)
      const gradeFinalSkus = Math.max(0, baseSkus - reservaSkus);

      // Apenas produtos com SKU fechado > 0 entram na grade
      const aptoParaGrade = Boolean(Number.isFinite(gradeFinalSkus) && gradeFinalSkus > 0);

      let motivoDescarte: string | undefined;
      if (aptoParaGrade) {
        motivoDescarte = undefined;
      } else if (disponivelSkus <= 0 && disponivelLooseUnits > 0) {
        motivoDescarte = 'Apenas avulsos na 02.05.02 - descartado';
      } else if (totalDispUnits <= 0) {
        motivoDescarte = isNegative ? 'Saldo negativo no disponível' : 'Sem estoque disponível';
      } else if (baseSkus > 0 && gradeFinalSkus === 0) {
        motivoDescarte = `Zerado pela reserva de ${reservaSkus} cx`;
      } else if (modoAjuste === 'com_ajuste' && disponivelSkus > 0 && baseSkus === 0) {
        motivoDescarte = `Zerado por falta no inventário mensal (-${difInventarioSkus} cx)`;
      } else {
        motivoDescarte = 'Quantidade zerada';
      }

      const valorCaixa = item.valorCaixa || (item.valorUnitario * fatorSku);
      const valorTotalGrade = gradeFinalSkus * valorCaixa;

      return {
        depositoLancamento: 1, // Sempre "1" conforme regra do usuário
        depositoOrigem: deposito,
        produto: sku,
        descricao: item.descricao,
        grupo: item.grupo || 'GERAL',
        fatorSku,
        disponivelRaw: item.disponivelRaw,
        disponivelSkus,
        disponivelLooseUnits,
        difInventarioSkus,
        difCongeladaSkus,
        quebrasSkus,
        quebrasUnits,
        trocasSkus,
        trocasUnits,
        valesSkus,
        valesUnits,
        faltasSkus,
        faltasUnits,
        divergenciaAnteriorSkus: difInventarioSkus,
        divergenciaAnteriorUnits: difInventarioUnits,
        diferencaDiaSkus,
        diferencaDiaUnits,
        congeladosTotalSkus,
        congeladosTotalUnits,
        baseSkus,
        reservaSkus,
        gradeFinalSkus,
        aptoParaGrade,
        motivoDescarte,
        valorUnitario: item.valorUnitario,
        valorCaixa,
        valorTotalGrade
      };
    });
  }, [stockPositions, generalStockPositions, depositoOrigem, modoAjuste, reservaGlobal, reservasCustomizadas, quebras, vales, trocas, faltasMapeadas, weeklyBillingStatus, difMensalUltimoCongelamentoMap]);

  // Lista filtrada para renderização na tela
  const filteredGradeItems = useMemo(() => {
    return gradeItems.filter(item => {
      // Filtro de Status
      if (statusFilter === 'APTOS' && !item.aptoParaGrade) return false;
      if (statusFilter === 'DESCARTADOS' && item.aptoParaGrade) return false;
      if (statusFilter === 'AVULSOS' && !(item.disponivelSkus === 0 && item.disponivelLooseUnits > 0)) return false;

      // Filtro de Grupo
      if (grupoFilter !== 'ALL' && item.grupo !== grupoFilter) return false;

      // Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchCode = item.produto.toLowerCase().includes(term);
        const matchDesc = item.descricao.toLowerCase().includes(term);
        if (!matchCode && !matchDesc) return false;
      }

      return true;
    }).sort((a, b) => {
      // Aptos primeiro, depois maior quantidade de grade
      if (a.aptoParaGrade !== b.aptoParaGrade) {
        return a.aptoParaGrade ? -1 : 1;
      }
      return b.gradeFinalSkus - a.gradeFinalSkus;
    });
  }, [gradeItems, statusFilter, grupoFilter, searchTerm]);

  // Grupos distintos para filtro
  const distinctGroups = useMemo(() => {
    const set = new Set<string>();
    gradeItems.forEach(i => { if (i.grupo) set.add(i.grupo); });
    return Array.from(set).sort();
  }, [gradeItems]);

  // KPIs Resumo Executivo
  const kpis = useMemo(() => {
    let totalSkus = gradeItems.length;
    let totalAptos = 0;
    let totalDescartados = 0;
    let totalApenasAvulsos = 0;
    let totalDisponivelSkus = 0;
    let totalDifInventarioSkus = 0;
    let totalDifCongeladaSkus = 0;
    let totalCaixasGrade = 0;
    let totalValorGrade = 0;
    let totalCaixasReservadas = 0;
    let totalCongeladosAbatidos = 0;
    let totalCongeladosUnits = 0;
    let totalQuebrasUnits = 0;
    let totalValesUnits = 0;
    let totalTrocasUnits = 0;
    let totalFaltasUnits = 0;

    gradeItems.forEach(item => {
      totalDisponivelSkus += item.disponivelSkus;
      totalDifInventarioSkus += item.difInventarioSkus;
      totalDifCongeladaSkus += item.difCongeladaSkus;
      totalCaixasReservadas += item.reservaSkus;
      totalCongeladosAbatidos += item.congeladosTotalSkus;

      if (item.aptoParaGrade) {
        totalAptos++;
        totalCaixasGrade += item.gradeFinalSkus;
        totalValorGrade += item.valorTotalGrade;
      } else {
        totalDescartados++;
        if (item.disponivelSkus === 0 && item.disponivelLooseUnits > 0) {
          totalApenasAvulsos++;
        }
      }
      totalCongeladosUnits += item.congeladosTotalUnits;
      totalQuebrasUnits += item.quebrasUnits;
      totalValesUnits += item.valesUnits;
      totalTrocasUnits += item.trocasUnits;
      totalFaltasUnits += item.faltasUnits;
    });

    return {
      totalSkus,
      totalAptos,
      totalDescartados,
      totalApenasAvulsos,
      totalDisponivelSkus,
      totalDifInventarioSkus,
      totalDifCongeladaSkus,
      totalCaixasGrade,
      totalValorGrade,
      totalCaixasReservadas,
      totalCongeladosAbatidos,
      totalCongeladosUnits,
      totalQuebrasUnits,
      totalValesUnits,
      totalTrocasUnits,
      totalFaltasUnits
    };
  }, [gradeItems]);

  // Gera o conteúdo oficial do arquivo no formato "1;CODIGO;QUANTIDADE"
  // SOMENTE COM ITENS APTOS (SKU FECHADO > 0)
  const generateExportContent = (): string => {
    const aptos = gradeItems.filter(item => item.aptoParaGrade && item.gradeFinalSkus > 0);
    const lines = aptos.map(item => `1;${item.produto};${item.gradeFinalSkus}`);
    return lines.join('\r\n');
  };

  // Função robusta de download compatível com sandboxed iframes e navegadores desktop
  const downloadFile = async (
    content: string, 
    filename: string, 
    mimeType: string = 'text/csv;charset=utf-8'
  ): Promise<boolean> => {
    // 1. Tenta API nativa do sistema operacional (Chrome/Edge desktop)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const ext = filename.toLowerCase().endsWith('.txt') ? '.txt' : '.csv';
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: ext === '.txt' ? 'Arquivo de Texto (*.txt)' : 'Arquivo CSV (*.csv)',
            accept: { [mimeType]: [ext] }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob(['\uFEFF' + content], { type: mimeType }));
        await writable.close();
        showToast(`Arquivo "${fileHandle.name || filename}" salvo com sucesso!`, 'success');
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return false; // Usuário cancelou a janela Salvar Como
        }
        console.warn('showSaveFilePicker indisponível ou bloqueado no iframe, usando download padrão:', err);
      }
    }

    // 2. Download via Blob URL com revogação postergada (NUNCA revogar imediatamente para não cancelar o download)
    try {
      const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Mantém o ObjectURL ativo por 60 segundos para que o motor de download do navegador processe sem erros
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 60000);

      showToast(`Arquivo "${filename}" baixado com sucesso!`, 'success');
      return true;
    } catch (blobErr) {
      console.warn('Blob URL falhou, tentando fallback Data URI:', blobErr);
    }

    // 3. Fallback Data URI caso o Blob URL seja bloqueado pelo iframe
    try {
      const dataUri = `data:${mimeType};charset=utf-8,` + encodeURIComponent('\uFEFF' + content);
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Arquivo "${filename}" baixado com sucesso!`, 'success');
      return true;
    } catch (fallbackErr) {
      console.error('Falha ao exportar arquivo:', fallbackErr);
      showToast('Falha no download pelo navegador. Use o botão "Copiar Grade" para colar no SAP.', 'error');
      return false;
    }
  };

  // Download do arquivo TXT/CSV oficial "1;SKU;QTD"
  const handleExportTxtCsv = async (extension: 'csv' | 'txt' = 'csv') => {
    const aptos = gradeItems.filter(item => item.aptoParaGrade && item.gradeFinalSkus > 0);

    if (aptos.length === 0) {
      showToast(
        modoAjuste === 'com_ajuste' 
          ? 'Nenhum item com saldo na grade com ajuste (as reservas ou congelamentos zeraram todos os itens).' 
          : 'Nenhum item com SKU fechado (> 0) disponível para exportação.',
        'error'
      );
      return;
    }

    const content = generateExportContent();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const modeStr = modoAjuste === 'com_ajuste' ? 'COM_AJUSTES_CONGELAMENTOS' : 'SEM_AJUSTE_BRUTO';
    const filename = `Grade_Estoque_Ambev_Dep1_${modeStr}_${dateStr}.${extension}`;
    const mimeType = extension === 'txt' ? 'text/plain' : 'text/csv';

    await downloadFile(content, filename, mimeType);
  };

  // Copiar linhas para área de transferência
  const handleCopyClipboard = async () => {
    const aptos = gradeItems.filter(item => item.aptoParaGrade && item.gradeFinalSkus > 0);

    if (aptos.length === 0) {
      showToast('Nenhum item com SKU fechado (> 0) para copiar.', 'error');
      return;
    }

    const content = generateExportContent();
    try {
      await navigator.clipboard.writeText(content);
      showToast(`${aptos.length} linhas da grade copiadas para a área de transferência!`, 'success');
    } catch {
      showToast('Falha ao copiar automaticamente. Use a exportação em arquivo.', 'error');
    }
  };

  // Exportar Planilha Excel Detalhada
  const handleExportExcel = () => {
    const aptos = gradeItems.filter(item => item.aptoParaGrade && item.gradeFinalSkus > 0);
    if (aptos.length === 0) {
      showToast('Nenhum item apto para gerar planilha Excel.', 'error');
      return;
    }

    try {
      // Aba 1: Formato padrão de importação SAP (1;SKU;QTD)
      const sapData = aptos.map(item => ({
        'Depósito': item.depositoLancamento,
        'Código': item.produto,
        'Quantidade': item.gradeFinalSkus,
      }));

      // Aba 2: Grade Formatada exatamente com as colunas da tela
      const formatadaData = gradeItems.map(item => ({
        'Status': item.aptoParaGrade ? 'OK' : 'NOK',
        'Código': item.produto,
        'Descrição': item.descricao,
        'Disponível': item.disponivelSkus,
        'Dif Inventário': item.difInventarioSkus > 0 ? -item.difInventarioSkus : 0,
        'Reserva': item.reservaSkus,
        'Quantidade Final': item.gradeFinalSkus,
        'Grupo': item.grupo,
        'Motivo / Regra': item.motivoDescarte || 'SKU Fechado Válido'
      }));

      // Aba 3: Conferência Detalhada para Auditoria com TODOS OS CONGELAMENTOS
      const conferenciaData = gradeItems.map(item => ({
        'Status': item.aptoParaGrade ? 'OK' : 'NOK',
        'Motivo / Regra': item.motivoDescarte || 'SKU Fechado Válido',
        'Depósito Lançamento': item.depositoLancamento,
        'Código SKU': item.produto,
        'Descrição': item.descricao,
        'Grupo': item.grupo,
        'Fator SKU (un/cx)': item.fatorSku,
        'Disponível (cx)': item.disponivelSkus,
        '02.05.02 Avulsos (un)': item.disponivelLooseUnits,
        'Dif Inventário (cx)': item.difInventarioSkus > 0 ? -item.difInventarioSkus : 0,
        'Dif Congelada (cx)': item.difCongeladaSkus > 0 ? -item.difCongeladaSkus : 0,
        'Quebras Congeladas (cx)': item.quebrasSkus,
        'Vales Congelados (cx)': item.valesSkus,
        'Trocas/Reposições Congeladas (cx)': item.trocasSkus,
        'Faltas Mapeadas Congeladas (cx)': item.faltasSkus,
        'Reserva Aplicada (cx)': item.reservaSkus,
        'Quantidade Final Grade (cx)': item.gradeFinalSkus,
        'Valor Caixa (R$)': item.valorCaixa || (item.valorUnitario * item.fatorSku),
        'Valor Total Grade (R$)': item.valorTotalGrade
      }));

      const wb = XLSX.utils.book_new();

      const wsFormatada = XLSX.utils.json_to_sheet(formatadaData);
      XLSX.utils.book_append_sheet(wb, wsFormatada, 'Grade_Estoque');

      const wsSap = XLSX.utils.json_to_sheet(sapData);
      XLSX.utils.book_append_sheet(wb, wsSap, 'Grade_SAP_1_SKU_QTD');

      const wsConf = XLSX.utils.json_to_sheet(conferenciaData);
      XLSX.utils.book_append_sheet(wb, wsConf, 'Conferencia_Analitica');

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `Grade_Estoque_Conferencia_${modoAjuste.toUpperCase()}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      showToast(`Planilha Excel "${filename}" gerada com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      showToast(`Erro ao gerar Excel: ${err.message || 'Falha no processamento'}`, 'error');
    }
  };

  // Upload direto do arquivo 02.05.02 do dia exclusivo para a Grade
  const handleFileDropOrSelect = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | undefined;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file) return;

    setIsUploading(true);
    try {
      const lower = file.name.toLowerCase();
      let csvContent = '';

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm') || lower.endsWith('.xlsb')) {
        const buffer = await file.arrayBuffer();
        const result = parseExcelWorkbookToCsv(buffer);
        csvContent = result.csv;
      } else {
        csvContent = await file.text();
      }

      const parsed = parse020502Csv(csvContent, productsMap);
      if (parsed.length === 0) {
        throw new Error('Nenhum registro válido de 02.05.02 encontrado no arquivo.');
      }

      // Substitui integralmente a base anterior da Grade (apenas para a Grade, sem afetar a conciliação nem considerar dif atual)
      setStockPositions(parsed);
      const nowStr = new Date().toLocaleString('pt-BR');
      const label = `${file.name} (${nowStr})`;
      setImportTimestamp(label);
      persistData(STORAGE_KEYS.GRADE_IMPORT_LABEL, label);
      persistData(STORAGE_KEYS.GRADE_POSITIONS, parsed);
      persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, parsed);

      showToast(`Base 02.05.02 da Grade carregada com sucesso (${parsed.length} produtos). A Grade considera apenas a 02.05.02 da conciliação sem aplicar a dif atual!`, 'success');
    } catch (err: any) {
      showToast(`Erro ao processar arquivo 02.05.02: ${err.message || 'Verifique o formato'}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
          toastMessage.type === 'error'
            ? 'bg-rose-900 border-rose-700'
            : toastMessage.type === 'info'
            ? 'bg-blue-900 border-blue-700'
            : 'bg-slate-900 border-slate-700'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Informative Status Badge for 02.05.02 da Grade */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-gradient-to-r from-teal-50/80 via-emerald-50/60 to-slate-50 border border-teal-200/90 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  02.05.02 Vigente da Grade de Estoque
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Substituição Contínua (Não Mescla)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {stockPositions.length > 0 ? (
                  <>
                    <strong className="text-teal-800">{stockPositions.length} SKUs</strong> carregados • {importTimestamp || 'Pronta para emissão'} • A nova 02.05.02 enviada durante o dia substitui automaticamente a anterior (sem mesclagem de saldos).
                  </>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Nenhuma 02.05.02 carregada para a Grade. Suba o arquivo atualizado ou sincronize abaixo.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {generalStockPositions.length > 0 && stockPositions.length === 0 && (
              <button
                onClick={handleCopyFromConciliacao}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-teal-300 hover:bg-teal-50 text-teal-800 text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                title="Sincronizar posições da 02.05.02 para a Grade de Estoque"
              >
                <Copy className="w-3.5 h-3.5 text-teal-600" />
                <span>Usar 02.05.02 Carregada ({generalStockPositions.length})</span>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Processando...' : 'Subir 02.05.02 da Grade'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center">
                <Boxes className="w-3.5 h-3.5 mr-1" />
                Lançamento de Grade de Estoque
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                Coluna 1: Depósito 1
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Apenas SKUs Fechados &gt; 0
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              <span>Grade de Estoque Diária (Formato 1;CÓDIGO;QUANTIDADE)</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl mt-0.5">
              Consulte e valide as quantidades de produtos antes da emissão. O sistema filtra automaticamente itens sem saldo ou com apenas unidades avulsas, garantindo que o arquivo exportado contenha estritamente os SKUs fechados prontos para lançamento no SAP/Promax.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileDropOrSelect} 
              accept=".csv,.txt,.xlsx,.xls,.xlsm" 
              className="hidden" 
            />

            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
              title="Pré-visualizar o arquivo 1;CODIGO;QUANTIDADE antes de baixar"
            >
              <Eye className="w-4 h-4 text-slate-600" />
              <span>Inspecionar Arquivo</span>
            </button>

            <button
              onClick={handleCopyClipboard}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              title="Copiar todas as linhas (1;SKU;QTD) para a área de transferência"
            >
              <Copy className="w-4 h-4 text-slate-300" />
              <span>Copiar Grade</span>
            </button>

            <button
              onClick={() => setShowConfirmarModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer border border-teal-700"
              title="Conciliar e confirmar Grade Final com o Saldo Inicial da 02.03.04"
            >
              <FileCheck2 className="w-4 h-4 text-teal-300" />
              <span>Confirmar Grade (02.03.04)</span>
            </button>

            {/* Botão Exportar Grade com Opções (.csv, .txt, .xlsx, copiar) */}
            <div className="relative inline-flex items-center">
              <button
                onClick={() => handleExportTxtCsv('csv')}
                className="px-3.5 py-2 rounded-l-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer border-r border-teal-500"
                title="Exportar arquivo CSV padrão (1;SKU;QUANTIDADE)"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Grade (CSV/TXT)</span>
              </button>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-2 py-2 rounded-r-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center active:scale-95 cursor-pointer"
                title="Escolher formato de exportação (.csv, .txt, .xlsx ou copiar)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setShowExportMenu(false)} 
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-slate-800">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Escolha o Formato da Grade
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportTxtCsv('csv');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-teal-50 text-xs font-semibold flex items-center space-x-2.5 text-slate-700 hover:text-teal-900 transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold">Baixar Arquivo CSV (.csv)</div>
                        <div className="text-[10px] text-slate-500">Delimitado 1;CÓDIGO;QUANTIDADE</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportTxtCsv('txt');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-teal-50 text-xs font-semibold flex items-center space-x-2.5 text-slate-700 hover:text-teal-900 transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold">Baixar Arquivo TXT (.txt)</div>
                        <div className="text-[10px] text-slate-500">Texto Puro padrão SAP / Promax</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportExcel();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-teal-50 text-xs font-semibold flex items-center space-x-2.5 text-slate-700 hover:text-teal-900 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-teal-700 flex-shrink-0" />
                      <div>
                        <div className="font-bold">Baixar Planilha Excel (.xlsx)</div>
                        <div className="text-[10px] text-slate-500">Abas Grade SAP e Auditoria</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        handleCopyClipboard();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-2.5 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <div>
                        <div className="font-bold">Copiar Grade (Clipboard)</div>
                        <div className="text-[10px] text-slate-500">Copiar linhas formatadas para colar</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Ajuste de Modo & Reserva de Quantidade */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-200">
          
          {/* Seletor de Modo: Sem Ajuste vs Com Ajuste (Deduzindo Todos os Congelamentos e Diferença do Dia) */}
          <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider pl-1 whitespace-nowrap">
              Modo:
            </span>
            <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 shadow-xs">
              <button
                onClick={() => setModoAjuste('sem_ajuste')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  modoAjuste === 'sem_ajuste'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Utiliza as quantidades brutas da 02.05.02 sem deduzir diferenças congeladas"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Sem Ajuste (02.05.02 Bruta)</span>
              </button>

              <button
                onClick={() => setModoAjuste('com_ajuste')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  modoAjuste === 'com_ajuste'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Aplica todos os ajustes: desvios da plataforma (quebras, trocas, vales, faltas) e o último congelamento da Dif Mensal"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Com Ajuste (Desvios + Dif. Mensal)</span>
              </button>
            </div>
          </div>

          {/* Campo de Reserva Geral de Segurança */}
          <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">Reserva (cx):</span>
              <span className="text-[10px] text-slate-500">Por SKU</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setReservaGlobal(prev => Math.max(0, prev - 1))}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 transition"
                title="Diminuir reserva"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={reservaGlobal}
                  onChange={(e) => setReservaGlobal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-12 text-center py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                onClick={() => setReservaGlobal(prev => prev + 1)}
                className="w-7 h-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 transition"
                title="Aumentar reserva"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Depósito de Origem da Base 02.05.02 */}
          <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Dep. Origem:</span>
            <select
              value={depositoOrigem}
              onChange={(e) => setDepositoOrigem(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-teal-500 font-semibold max-w-[140px]"
            >
              <option value="01">Dep. 01 (Central)</option>
              <option value="02">Dep. 02 (Varejo)</option>
              <option value="03">Dep. 03 (Análise)</option>
              <option value="05">Dep. 05 (Faltas)</option>
              <option value="06">Dep. 06 (Devoluções)</option>
              <option value="31">Dep. 31 (PNC)</option>
              <option value="ALL">Consolidado (Todos)</option>
            </select>
          </div>

        </div>

      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">SKUs Cadastrados</span>
          <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
            {kpis.totalSkus} <span className="text-xs text-slate-400 font-normal">produtos</span>
          </div>
        </div>

        <div className="bg-white border border-teal-200 bg-teal-50/30 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-teal-800 font-bold">SKUs Aptos p/ Grade</span>
          <div className="text-lg font-bold font-mono text-teal-700 mt-0.5 flex items-center gap-1.5">
            <span>{kpis.totalAptos}</span>
            <span className="text-[11px] font-semibold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded-full">
              {kpis.totalSkus > 0 ? `${((kpis.totalAptos / kpis.totalSkus) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-blue-50/20 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-blue-800 font-bold">Disponível (02.05.02)</span>
          <div className="text-xl font-extrabold font-mono text-blue-700 mt-0.5">
            {kpis.totalDisponivelSkus.toLocaleString('pt-BR')} <span className="text-xs text-blue-600 font-semibold">cx</span>
          </div>
        </div>

        <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-indigo-800 font-bold">Dif. Inventário</span>
          <div className="text-lg font-bold font-mono text-indigo-700 mt-0.5">
            {kpis.totalDifInventarioSkus > 0 ? (
              <span>-{kpis.totalDifInventarioSkus.toLocaleString('pt-BR')} cx</span>
            ) : (
              <span className="text-slate-400">0 cx</span>
            )}
          </div>
          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5 truncate" title="Faltas do último fechamento da Dif Mensal congelada com ajuste">
            Faltas Dif. Mensal
          </div>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-amber-900 font-bold">Reserva Aplicada</span>
          <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
            {kpis.totalCaixasReservadas > 0 ? (
              <span>{kpis.totalCaixasReservadas.toLocaleString('pt-BR')} cx</span>
            ) : (
              <span className="text-slate-400">0 cx</span>
            )}
          </div>
          <div className="text-[10px] text-amber-800 font-semibold mt-0.5 truncate">
            Segurança de Estoque
          </div>
        </div>

        <div className="bg-white border border-emerald-300 bg-emerald-50/30 rounded-xl p-3.5 shadow-sm">
          <span className="text-[11px] text-emerald-800 font-black">Quantidade Final</span>
          <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
            {kpis.totalCaixasGrade.toLocaleString('pt-BR')} <span className="text-xs text-emerald-600 font-bold">cx</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate" title={formatCurrency(kpis.totalValorGrade)}>
            {formatCurrency(kpis.totalValorGrade)}
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
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({gradeItems.length})
            </button>

            <button
              onClick={() => setStatusFilter('APTOS')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                statusFilter === 'APTOS'
                  ? 'bg-teal-600 text-white shadow-xs font-bold'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apenas Aptos p/ Grade ({kpis.totalAptos})</span>
            </button>

            <button
              onClick={() => setStatusFilter('DESCARTADOS')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                statusFilter === 'DESCARTADOS'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Descartados / Zerados ({kpis.totalDescartados})</span>
            </button>

            <button
              onClick={() => setStatusFilter('AVULSOS')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                statusFilter === 'AVULSOS'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span>Apenas Avulsos ({kpis.totalApenasAvulsos})</span>
            </button>
          </div>

          {/* Group dropdown & Reset reserves */}
          <div className="flex items-center space-x-2 text-xs">
            <select
              value={grupoFilter}
              onChange={(e) => setGrupoFilter(e.target.value)}
              className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none"
            >
              <option value="ALL">Todos os Grupos</option>
              {distinctGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {Object.keys(reservasCustomizadas).length > 0 && (
              <button
                onClick={() => setReservasCustomizadas({})}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs transition flex items-center gap-1"
                title="Limpar customizações manuais de reserva"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resetar Customizações</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Table for Visual Confirmation */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-14 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-left font-mono w-24 whitespace-nowrap">Código</th>
                <th className="py-3 px-4 min-w-[200px]">Descrição</th>
                <th className="py-3 px-3 text-right whitespace-nowrap font-mono">Disponível</th>
                <th className="py-3 px-3 text-right whitespace-nowrap font-mono text-indigo-700" title="Última diferença mensal congelada com ajuste (apenas faltas)">
                  Dif. Inventário
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap w-24">Reserva</th>
                <th className="py-3 px-4 text-right bg-teal-50/80 text-teal-900 font-black whitespace-nowrap">
                  Quantidade Final
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredGradeItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Boxes className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">Nenhum produto encontrado com os filtros atuais.</p>
                      <p className="text-[11px] text-slate-400">Verifique os filtros de pesquisa ou suba o arquivo 02.05.02 do dia.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGradeItems.map((item) => {
                  const isApto = item.aptoParaGrade;
                  const hasCustomReserva = reservasCustomizadas[item.produto] !== undefined;

                  return (
                    <tr 
                      key={item.produto}
                      className={`hover:bg-slate-50/80 transition ${
                        !isApto ? 'bg-slate-50/40 text-slate-400' : ''
                      }`}
                    >
                      {/* Status: OK ou NOK */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isApto ? (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center tracking-wider"
                            title={`Apto: ${item.gradeFinalSkus} caixas disponíveis`}
                          >
                            OK
                          </span>
                        ) : (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center tracking-wider" 
                            title={item.motivoDescarte || 'Não apto para lançamento de grade'}
                          >
                            NOK
                          </span>
                        )}
                      </td>

                      {/* Código SKU */}
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.produto}
                      </td>

                      {/* Descrição & Grupo */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[280px] xl:max-w-[360px]" title={item.descricao}>
                          {item.descricao}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5 truncate">
                          <span className="uppercase font-medium text-slate-500">
                            {item.grupo}
                          </span>
                        </div>
                      </td>

                      {/* Disponível (apenas caixas fechadas convertidas) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs sm:text-sm">
                        {item.disponivelSkus.toLocaleString('pt-BR')}
                      </td>

                      {/* Dif. Inventário (Falta da última Dif Mensal congelada com ajuste) */}
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {item.difInventarioSkus > 0 ? (
                          <span 
                            className="inline-flex items-center font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs"
                            title={`Falta apurada na última Dif. Mensal congelada com ajuste: -${item.difInventarioSkus} cx`}
                          >
                            -{item.difInventarioSkus.toLocaleString('pt-BR')} cx
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Reserva Aplicada (editável individualmente) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            value={item.reservaSkus}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setReservasCustomizadas(prev => ({ ...prev, [item.produto]: val }));
                            }}
                            className={`w-12 text-center py-1 rounded border text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                              hasCustomReserva 
                                ? 'bg-amber-50 border-amber-400 text-amber-900' 
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                            title={hasCustomReserva ? 'Reserva customizada para este SKU' : 'Reserva herdada do padrão geral'}
                          />
                          {hasCustomReserva && (
                            <button
                              onClick={() => {
                                setReservasCustomizadas(prev => {
                                  const copy = { ...prev };
                                  delete copy[item.produto];
                                  return copy;
                                });
                              }}
                              className="text-slate-400 hover:text-rose-600 p-0.5 transition"
                              title="Restaurar para reserva geral"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Quantidade Final Grade */}
                      <td className={`py-2.5 px-4 text-right font-mono font-black text-xs sm:text-sm whitespace-nowrap ${
                        isApto ? 'bg-teal-50/80 text-teal-900' : 'text-slate-300'
                      }`}>
                        {isApto ? item.gradeFinalSkus.toLocaleString('pt-BR') : 0}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-slate-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span>
              Exibindo <strong className="text-slate-800">{filteredGradeItems.length}</strong> de <strong className="text-slate-800">{gradeItems.length}</strong> itens cadastrados
            </span>
            <span>•</span>
            <span className="text-teal-700 font-bold">
              {kpis.totalAptos} itens aptos serão exportados no arquivo
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Baixar planilha Excel com as abas de importação SAP e conferência analítica"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel Completo</span>
            </button>

            <button
              onClick={() => handleExportTxtCsv('csv')}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Gerar arquivo final CSV/TXT 1;SKU;QTD"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Gerar Arquivo 1;SKU;QTD</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Pré-visualização do Arquivo Formatado 1;CODIGO;QTD */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-mono font-bold text-xs">
                  1;
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Inspeção do Arquivo de Grade (1;CÓDIGO;QUANTIDADE)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {gradeItems.filter(i => i.aptoParaGrade).length} itens com SKU fechado (&gt; 0) prontos para importação
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-900 text-slate-100 font-mono text-xs space-y-1">
              <div className="text-slate-400 text-[10px] pb-2 border-b border-slate-800">
                # Formato oficial: [Depósito = 1];[Código do Produto];[Quantidade de Caixas]
              </div>
              {gradeItems.filter(i => i.aptoParaGrade).map((item, idx) => (
                <div key={item.produto} className="flex items-center justify-between hover:bg-slate-800/60 px-1.5 py-0.5 rounded">
                  <span className="text-emerald-400 font-bold">
                    1;{item.produto};{item.gradeFinalSkus}
                  </span>
                  <span className="text-slate-500 text-[10px] truncate max-w-xs">
                    // {item.descricao}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Itens zerados ou apenas avulsos não constam no arquivo.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyClipboard}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Tudo</span>
                </button>
                <button
                  onClick={() => handleExportTxtCsv('txt')}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Baixar em formato Texto (.txt)"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Baixar TXT</span>
                </button>
                <button
                  onClick={() => handleExportTxtCsv('csv')}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Baixar em formato CSV (.csv)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conciliação e Confirmação da Grade com o Saldo Inicial da 02.03.04 */}
      <ConfirmarGradeModal
        isOpen={showConfirmarModal}
        onClose={() => setShowConfirmarModal(false)}
        gradeItems={gradeItems}
        modoAjuste={modoAjuste}
      />

    </div>
  );
};
