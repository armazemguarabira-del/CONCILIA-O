import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeftRight, 
  ArrowRight, 
  CheckCircle2, 
  FileSpreadsheet, 
  Filter, 
  Layers, 
  Plus, 
  RotateCcw, 
  Search, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle,
  Info,
  CheckSquare,
  Square,
  ChevronDown,
  Building2,
  Download,
  Percent,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Trash2,
  Eye,
  X,
  Check,
  Calculator,
  Scale,
  Target,
  Table as TableIcon,
  LayoutGrid,
  Upload,
  DollarSign,
  FileText,
  ShieldCheck,
  ArrowUpDown,
  Pencil
} from 'lucide-react';
import { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId, 
  InversaoPair, 
  InversaoStockItem,
  UserAccount,
  ProductMaster
} from '../types';
import { 
  buildInversaoStockItems, 
  generateInversionSuggestions, 
  validateAndSanitizeInversionPairs,
  recalculatePairValues, 
  calculateInversionHeaderTotals, 
  createManualInversaoPair,
  getProductConversionRatio,
  calculateMaxViableSobraSkus,
  calculateQtdSaidaSkus,
  calculateProductCompatibility,
  buildInversaoAuditSummary,
  findTopCompatiblePartners
} from '../utils/inversaoUtils';
import { exportChamadoInversaoExcel, exportPlanilhaModeloFiscalExcel } from '../utils/excelInversaoExport';
import { 
  formatCurrency, 
  formatHectoliters, 
  parseCadastroCsv, 
  parseBrNumber, 
  splitCsvLines, 
  splitCsvColumns, 
  detectDelimiter,
  normalizeSku,
  parseExcelWorkbookToCsv
} from '../utils/parsers';
import { DEPOSITOS } from '../data/initialData';
import { QuantityStepperCell } from './QuantityStepperCell';
import { persistData, STORAGE_KEYS } from '../utils/persistentStorage';
import { SimuladorFiscalModal } from './SimuladorFiscalModal';
import { InversaoErrorBoundary } from './InversaoErrorBoundary';

interface InversaoViewProps {
  stockPositions: StockPositionItem[];
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  currentUser?: UserAccount | null;
  productsMap?: Map<string, ProductMaster>;
  onUpdateProductsMap?: (updater: (prev: Map<string, ProductMaster>) => Map<string, ProductMaster>) => void;
  onUpdateStockPositions?: (updater: (prev: StockPositionItem[]) => StockPositionItem[]) => void;
  onUpdateGradeStockPositions?: (updater: (prev: StockPositionItem[]) => StockPositionItem[]) => void;
  onOpenImportModal?: (type: 'cadastro') => void;
}

export const InversaoView: React.FC<InversaoViewProps> = ({
  stockPositions,
  quebras = [],
  vales = [],
  trocas = [],
  faltasMapeadas = [],
  selectedDeposito,
  setSelectedDeposito,
  currentUser,
  productsMap,
  onUpdateProductsMap,
  onUpdateStockPositions,
  onUpdateGradeStockPositions,
  onOpenImportModal
}) => {
  // Base de conciliação: com ajustes ou sem ajustes (físico puro)
  const [baseMode, setBaseMode] = useState<'COM_AJUSTES' | 'SEM_AJUSTES'>('COM_AJUSTES');
  
  // Navegação principal da Inversão (Tabela Oficial ou Saldos Livres; Guia de Auditoria abre em balão flutuante)
  const [activeMainTab, setActiveMainTab] = useState<'SUGESTOES' | 'LIVRES'>('SUGESTOES');

  // Pares gerados e gerenciados pelo analista
  const [pares, setPares] = useState<InversaoPair[]>([]);
  const [sobrasSemPar, setSobrasSemPar] = useState<InversaoStockItem[]>([]);
  const [faltasSemPar, setFaltasSemPar] = useState<InversaoStockItem[]>([]);
  const [todasSobrasDisponiveis, setTodasSobrasDisponiveis] = useState<InversaoStockItem[]>([]);
  const [todasFaltasDisponiveis, setTodasFaltasDisponiveis] = useState<InversaoStockItem[]>([]);

  // Filtros e pesquisa
  const [busca, setBusca] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('TODOS');
  const [viewFormat, setViewFormat] = useState<'PLANILHA' | 'CARDS'>('PLANILHA');
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [justUpdatedPairId, setJustUpdatedPairId] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const prevDepositoRef = useRef(selectedDeposito);
  const prevBaseModeRef = useRef(baseMode);

  // Modal para pareamento manual de sobra sem par existente
  const [manualPairModalSobra, setManualPairModalSobra] = useState<InversaoStockItem | null>(null);
  const [manualSelectedFaltaSku, setManualSelectedFaltaSku] = useState<string>('');

  // Modal de inclusão livre de Novo Par de Inversão
  const [isNewPairModalOpen, setIsNewPairModalOpen] = useState(false);
  const [newPairDeposito, setNewPairDeposito] = useState<DepositoId>('01');
  const [newPairSobraSku, setNewPairSobraSku] = useState<string>('');
  const [newPairFaltaSku, setNewPairFaltaSku] = useState<string>('');
  const [newPairQtd, setNewPairQtd] = useState<number>(1);
  const [newPairJustificativa, setNewPairJustificativa] = useState<string>('');

  // Modal de Auditoria e Coerência com a Conciliação (Balão Flutuante)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTab, setAuditTab] = useState<'TODOS' | 'SOBRAS' | 'FALTAS' | 'PENDENTES' | 'EQUALIZADOS'>('TODOS');
  const [auditSearch, setAuditSearch] = useState('');

  // Fecha o balão de auditoria com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuditModalOpen) {
        setIsAuditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuditModalOpen]);

  // Modal com o botão ALTERNAR para listar demais sobras ou faltas da conciliação
  interface AlternarModalState {
    pairId: string;
    tipo: 'SOBRA' | 'FALTA';
    currentSku: string;
    pairIndex: number;
  }
  const [alternarModal, setAlternarModal] = useState<AlternarModalState | null>(null);
  const [alternarModalTab, setAlternarModalTab] = useState<'SOBRAS' | 'FALTAS' | 'TODOS'>('SOBRAS');
  const [alternarSearch, setAlternarSearch] = useState('');
  const [alternarGrupoFilter, setAlternarGrupoFilter] = useState('TODOS');
  const [alternarDepFilter, setAlternarDepFilter] = useState<'PAR' | 'ALL'>('PAR');

  // Estado para confirmação quando o item alternado já está na lista invertendo com outro
  interface AlternarConflictInfo {
    selectedItem: InversaoStockItem;
    targetPairId: string;
    targetPairIndex: number;
    tipo: 'SOBRA' | 'FALTA';
    conflictingPair: InversaoPair;
    conflictingPairIndex: number;
    conflictingRole: 'SOBRA' | 'FALTA';
    partnerSku: string;
    partnerDescricao: string;
  }
  const [conflictConfirmation, setConflictConfirmation] = useState<AlternarConflictInfo | null>(null);

  // Modal do Simulador Fiscal para abatimento de metas em R$
  const [isSimuladorModalOpen, setIsSimuladorModalOpen] = useState(false);

  // Modal de Atualização Seletiva de Preços dos Itens
  const [isPriceUpdateModalOpen, setIsPriceUpdateModalOpen] = useState(false);
  const [priceUpdateText, setPriceUpdateText] = useState('');
  const [priceUpdatePreview, setPriceUpdatePreview] = useState<Array<{
    sku: string;
    descricao: string;
    oldPriceUnit: number;
    newPriceUnit: number;
    oldPriceBox: number;
    newPriceBox: number;
  }>>([]);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aplica o plano gerado pelo Simulador Fiscal na tela principal de Inversões
  const handleApplySimulation = (paresSimulados: InversaoPair[]) => {
    if (!paresSimulados || paresSimulados.length === 0) return;
    const paresSaneados = validateAndSanitizeInversionPairs(paresSimulados, todasSobrasDisponiveis, todasFaltasDisponiveis);
    setPares(paresSaneados);
    setToastMessage(`Simulação Fiscal aplicada com 100% de coerência: ${paresSaneados.length} pares alocados para a Inversão!`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Chaves de armazenamento local para persistência de alterações manuais de quantidades e pares completos
  const fullPairsStorageKey = useMemo(() => `ambev_inversao_full_pairs_${selectedDeposito}_${baseMode}`, [selectedDeposito, baseMode]);
  const globalBackupStorageKey = useMemo(() => `ambev_inversao_active_pairs_backup_${baseMode}`, [baseMode]);
  const customPairsStorageKey = useMemo(() => `ambev_inversao_custom_pairs_${selectedDeposito}_${baseMode}`, [selectedDeposito, baseMode]);
  const deletedPairsStorageKey = useMemo(() => `ambev_inversao_deleted_keys_${selectedDeposito}_${baseMode}`, [selectedDeposito, baseMode]);
  const globalDeletedPairsStorageKey = useMemo(() => `ambev_inversao_global_deleted_keys_${baseMode}`, [baseMode]);

  // Recupera todas as chaves de pares excluídos manualmente pelo analista (para NUNCA regenerá-los)
  const getDeletedPairKeys = (): Set<string> => {
    const keys = new Set<string>();
    try {
      [deletedPairsStorageKey, globalDeletedPairsStorageKey].forEach(storageKey => {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(k => {
              if (typeof k === 'string' && k.trim().length > 0) keys.add(k.trim());
            });
          }
        }
      });
    } catch {
      // Ignora erro de leitura
    }
    return keys;
  };

  // Registra par excluído para mantê-lo permanentemente fora das sugestões e da lista
  const recordDeletedPair = (pair: InversaoPair) => {
    try {
      const keys = getDeletedPairKeys();
      if (pair.id) keys.add(pair.id);
      if (pair.sobraSku && pair.faltaSku) {
        keys.add(`${pair.deposito}-${pair.sobraSku}-${pair.faltaSku}`);
        keys.add(`${pair.sobraSku}-${pair.faltaSku}`);
      }
      const arr = Array.from(keys);
      localStorage.setItem(deletedPairsStorageKey, JSON.stringify(arr));
      localStorage.setItem(globalDeletedPairsStorageKey, JSON.stringify(arr));
    } catch {
      // Ignora erro de escrita
    }
  };

  // Verifica se um par foi explicitamente excluído pelo analista
  const isDeletedPair = (p: InversaoPair): boolean => {
    if (!p) return false;
    const deletedKeys = getDeletedPairKeys();
    return (
      (!!p.id && deletedKeys.has(p.id)) ||
      (!!p.sobraSku && !!p.faltaSku && (
        deletedKeys.has(`${p.deposito}-${p.sobraSku}-${p.faltaSku}`) ||
        deletedKeys.has(`${p.sobraSku}-${p.faltaSku}`)
      ))
    );
  };

  // Recupera todas as customizações existentes no localStorage (de qualquer chave salva anteriormente)
  const recoverSavedCustomMap = (): Map<string, { qtdSobra: number; qtdSaida: number }> => {
    const customMap = new Map<string, { qtdSobra: number; qtdSaida: number }>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ambev_inversao_custom_pairs') || key.startsWith('ambev_inversao_full_pairs') || key.startsWith('ambev_inversao_active_pairs'))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              // É uma lista de pares salvos
              parsed.forEach((p: InversaoPair) => {
                if (p && p.sobraSku && p.faltaSku) {
                  const val = {
                    qtdSobra: p.quantidadeInversaoSkus ?? 1,
                    qtdSaida: p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus ?? 1
                  };
                  customMap.set(`${p.deposito}-${p.sobraSku}-${p.faltaSku}`, val);
                  customMap.set(`${p.sobraSku}-${p.faltaSku}`, val);
                }
              });
            } else if (typeof parsed === 'object') {
              // É um dicionário de customizações
              Object.entries(parsed).forEach(([k, v]: [string, any]) => {
                if (v && typeof v.qtdSobra === 'number') {
                  customMap.set(k, { qtdSobra: v.qtdSobra, qtdSaida: v.qtdSaida ?? v.qtdSobra });
                }
              });
            }
          }
        }
      }
    } catch {
      // Ignora erro de leitura
    }
    return customMap;
  };

  // Persiste a lista completa de pares e as customizações para garantir que NENHUMA edição do analista se perca
  const persistParesState = (currentPares: InversaoPair[]) => {
    if (!currentPares) return;
    try {
      const serialized = JSON.stringify(currentPares);
      localStorage.setItem(fullPairsStorageKey, serialized);
      localStorage.setItem(globalBackupStorageKey, serialized);

      const customData: Record<string, { qtdSobra: number; qtdSaida: number }> = {};
      currentPares.forEach(p => {
        if (p && (p.isCustomQuantity || p.quantidadeSaidaSkus !== undefined)) {
          const k1 = `${p.deposito}-${p.sobraSku}-${p.faltaSku}`;
          const k2 = `${p.sobraSku}-${p.faltaSku}`;
          const itemVal = {
            qtdSobra: p.quantidadeInversaoSkus ?? 1,
            qtdSaida: p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus ?? 1
          };
          customData[k1] = itemVal;
          customData[k2] = itemVal;
        }
      });
      localStorage.setItem(customPairsStorageKey, JSON.stringify(customData));
    } catch {
      // Ignora erro de storage
    }
  };

  const persistCustomPairs = persistParesState;

  // 1. Gera e recupera os chamados de inversão baseado na conciliação e no histórico salvo
  const refreshSuggestions = () => {
    const { sobras, faltas } = buildInversaoStockItems(
      stockPositions,
      quebras,
      vales,
      trocas,
      faltasMapeadas,
      selectedDeposito,
      baseMode
    );

    setTodasSobrasDisponiveis(sobras || []);
    setTodasFaltasDisponiveis(faltas || []);

    const { sugestoesPares, sobrasSemPar: sSemPar, faltasSemPar: fSemPar } = generateInversionSuggestions(sobras, faltas);
    const paresSaneados = validateAndSanitizeInversionPairs(sugestoesPares, sobras, faltas);

    // Recupera pares completos salvos anteriormente no localStorage
    let savedPairsList: InversaoPair[] | null = null;
    try {
      const savedRaw = localStorage.getItem(fullPairsStorageKey) || localStorage.getItem(globalBackupStorageKey);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          savedPairsList = parsed;
        }
      }
    } catch {
      // Ignora erro
    }

    const allCustomMap = recoverSavedCustomMap();

    setPares(prev => {
      // Prioridade absoluta: se prev já tem pares na sessão atual, mantém prev!
      // Se não, usa savedPairsList do storage.
      // Se não houver nada salvo, usa paresSaneados gerados pelo algoritmo.
      const basePairs = (prev && prev.length > 0)
        ? prev
        : (savedPairsList && savedPairsList.length > 0)
          ? savedPairsList
          : paresSaneados;

      const finalPairs: InversaoPair[] = [];
      const seenKeys = new Set<string>();

      (basePairs || []).forEach(p => {
        if (!p || !p.sobraSku || !p.faltaSku) return;
        // Prioridade absoluta: tudo que o usuário excluiu NUNCA deve ser recuperado
        if (isDeletedPair(p)) return;

        const pairKey = `${p.deposito}-${p.sobraSku}-${p.faltaSku}`;
        const fallbackKey = `${p.sobraSku}-${p.faltaSku}`;
        const custom = allCustomMap.get(pairKey) || allCustomMap.get(fallbackKey);

        const qtdSobra = custom ? custom.qtdSobra : p.quantidadeInversaoSkus;
        const qtdSaida = custom ? custom.qtdSaida : (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus);

        const updatedPair = recalculatePairValues(p, qtdSobra, qtdSaida, false);
        if (custom || p.isCustomQuantity) {
          updatedPair.isCustomQuantity = true;
        }
        updatedPair.selected = p.selected !== false;

        finalPairs.push(updatedPair);
        seenKeys.add(pairKey);
        seenKeys.add(fallbackKey);
      });

      // Se a lista final ficou vazia e não houve exclusão deliberada pelo analista, oferece as sugestões automáticas
      const hasExplicitDeletions = getDeletedPairKeys().size > 0;
      if (finalPairs.length === 0 && !hasExplicitDeletions) {
        paresSaneados.filter(p => !isDeletedPair(p)).forEach(p => {
          const pairKey = `${p.deposito}-${p.sobraSku}-${p.faltaSku}`;
          const fallbackKey = `${p.sobraSku}-${p.faltaSku}`;
          const custom = allCustomMap.get(pairKey) || allCustomMap.get(fallbackKey);
          if (custom) {
            const up = recalculatePairValues(p, custom.qtdSobra, custom.qtdSaida, false);
            up.isCustomQuantity = true;
            finalPairs.push(up);
          } else {
            finalPairs.push(p);
          }
        });
      }

      // Persiste o estado consolidado
      persistParesState(finalPairs);
      return finalPairs;
    });

    setSobrasSemPar(sSemPar || []);
    setFaltasSemPar(fSemPar || []);
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      refreshSuggestions();
      return;
    }
    if (prevDepositoRef.current !== selectedDeposito || prevBaseModeRef.current !== baseMode) {
      prevDepositoRef.current = selectedDeposito;
      prevBaseModeRef.current = baseMode;
      refreshSuggestions();
    }
  }, [stockPositions, quebras, vales, trocas, faltasMapeadas, selectedDeposito, baseMode]);

  // Mapas de estoque para cruzamento rápido de saldos apurados
  const stockSobrasMap = useMemo(() => {
    const map = new Map<string, InversaoStockItem>();
    (todasSobrasDisponiveis || []).forEach(s => {
      if (s && s.sku) {
        map.set(`${s.deposito}-${s.sku}`, s);
        map.set(s.sku, s);
      }
    });
    return map;
  }, [todasSobrasDisponiveis]);

  const stockFaltasMap = useMemo(() => {
    const map = new Map<string, InversaoStockItem>();
    (todasFaltasDisponiveis || []).forEach(f => {
      if (f && f.sku) {
        map.set(`${f.deposito}-${f.sku}`, f);
        map.set(f.sku, f);
      }
    });
    return map;
  }, [todasFaltasDisponiveis]);

  // Alocação agregada por SKU somando todos os chamados ativos (garante 100% de coerência entre o que sai e as sobras/faltas apuradas)
  const skuAllocations = useMemo(() => {
    const sobraMap = new Map<string, {
      deposito: string;
      sku: string;
      descricao: string;
      totalApurado: number;
      totalMovimentado: number;
      saldoResidual: number;
      status: 'EXATO' | 'PARCIAL' | 'EXCEDENTE';
      excedente: number;
      paresIds: string[];
    }>();

    const faltaMap = new Map<string, {
      deposito: string;
      sku: string;
      descricao: string;
      totalApurado: number;
      totalMovimentado: number;
      saldoResidual: number;
      status: 'EXATO' | 'PARCIAL' | 'EXCEDENTE';
      excedente: number;
      paresIds: string[];
    }>();

    // 1. Inicializa com todas as sobras físicas apuradas na conciliação
    (todasSobrasDisponiveis || []).forEach(s => {
      if (!s || !s.sku) return;
      const key = `${s.deposito}-${s.sku}`;
      const item = {
        deposito: s.deposito,
        sku: s.sku,
        descricao: s.descricao,
        totalApurado: s.saldoSkus || 0,
        totalMovimentado: 0,
        saldoResidual: s.saldoSkus || 0,
        status: 'PARCIAL' as const,
        excedente: 0,
        paresIds: []
      };
      sobraMap.set(key, item);
      sobraMap.set(s.sku, item);
    });

    // 2. Inicializa com todas as faltas fiscais apuradas na conciliação
    (todasFaltasDisponiveis || []).forEach(f => {
      if (!f || !f.sku) return;
      const key = `${f.deposito}-${f.sku}`;
      const item = {
        deposito: f.deposito,
        sku: f.sku,
        descricao: f.descricao,
        totalApurado: f.saldoSkus || 0,
        totalMovimentado: 0,
        saldoResidual: f.saldoSkus || 0,
        status: 'PARCIAL' as const,
        excedente: 0,
        paresIds: []
      };
      faltaMap.set(key, item);
      faltaMap.set(f.sku, item);
    });

    // 3. Soma as quantidades movimentadas de cada SKU em todos os pares marcados
    (pares || []).forEach(p => {
      if (!p || !p.selected || (p.quantidadeInversaoSkus || 0) <= 0) return;

      const kS = `${p.deposito}-${p.sobraSku}`;
      const kF = `${p.deposito}-${p.faltaSku}`;
      const qSobra = p.quantidadeInversaoSkus || 0;
      const qSaida = p.quantidadeSaidaSkus ?? calculateQtdSaidaSkus(p.sobraSku, p.faltaSku, qSobra);

      // Sobra
      let sEntry = sobraMap.get(kS) || sobraMap.get(p.sobraSku);
      if (!sEntry) {
        sEntry = {
          deposito: p.deposito || '01',
          sku: p.sobraSku,
          descricao: p.sobraDescricao || `Produto ${p.sobraSku}`,
          totalApurado: p.sobraDisponivelSkus || qSobra,
          totalMovimentado: 0,
          saldoResidual: p.sobraDisponivelSkus || qSobra,
          status: 'PARCIAL',
          excedente: 0,
          paresIds: []
        };
        sobraMap.set(kS, sEntry);
        sobraMap.set(p.sobraSku, sEntry);
      }
      sEntry.totalMovimentado += qSobra;
      sEntry.paresIds.push(p.id);

      // Falta
      let fEntry = faltaMap.get(kF) || faltaMap.get(p.faltaSku);
      if (!fEntry) {
        fEntry = {
          deposito: p.deposito || '01',
          sku: p.faltaSku,
          descricao: p.faltaDescricao || `Produto ${p.faltaSku}`,
          totalApurado: p.faltaApuradaSkus || qSaida,
          totalMovimentado: 0,
          saldoResidual: p.faltaApuradaSkus || qSaida,
          status: 'PARCIAL',
          excedente: 0,
          paresIds: []
        };
        faltaMap.set(kF, fEntry);
        faltaMap.set(p.faltaSku, fEntry);
      }
      fEntry.totalMovimentado += qSaida;
      fEntry.paresIds.push(p.id);
    });

    // 4. Calcula saldo residual e status de equalização para cada SKU
    sobraMap.forEach(entry => {
      entry.saldoResidual = Math.max(0, entry.totalApurado - entry.totalMovimentado);
      if (entry.totalMovimentado === entry.totalApurado && entry.totalApurado > 0) {
        entry.status = 'EXATO';
        entry.excedente = 0;
      } else if (entry.totalMovimentado > entry.totalApurado) {
        entry.status = 'EXCEDENTE';
        entry.excedente = entry.totalMovimentado - entry.totalApurado;
      } else {
        entry.status = 'PARCIAL';
        entry.excedente = 0;
      }
    });

    faltaMap.forEach(entry => {
      entry.saldoResidual = Math.max(0, entry.totalApurado - entry.totalMovimentado);
      if (entry.totalMovimentado === entry.totalApurado && entry.totalApurado > 0) {
        entry.status = 'EXATO';
        entry.excedente = 0;
      } else if (entry.totalMovimentado > entry.totalApurado) {
        entry.status = 'EXCEDENTE';
        entry.excedente = entry.totalMovimentado - entry.totalApurado;
      } else {
        entry.status = 'PARCIAL';
        entry.excedente = 0;
      }
    });

    return { sobraMap, faltaMap };
  }, [pares, todasSobrasDisponiveis, todasFaltasDisponiveis]);

  // Resumo Analítico e Estatísticas de Coerência com a Conciliação
  const auditSummary = useMemo(() => {
    return buildInversaoAuditSummary(todasSobrasDisponiveis || [], todasFaltasDisponiveis || [], pares || []);
  }, [todasSobrasDisponiveis, todasFaltasDisponiveis, pares]);

  // Lista de grupos únicos para filtro
  const gruposDisponiveis = useMemo(() => {
    const setGrupos = new Set<string>();
    (pares || []).forEach(p => { if (p?.grupo) setGrupos.add(p.grupo); });
    (sobrasSemPar || []).forEach(s => { if (s?.grupo) setGrupos.add(s.grupo); });
    (todasSobrasDisponiveis || []).forEach(s => { if (s?.grupo) setGrupos.add(s.grupo); });
    return Array.from(setGrupos).sort();
  }, [pares, sobrasSemPar, todasSobrasDisponiveis]);

  // Pares filtrados pela barra de busca e pelo grupo com segurança contra nulos
  const paresFiltrados = useMemo(() => {
    return (pares || []).filter(p => {
      if (!p) return false;
      const pGrupo = p.grupo || '';
      const matchGrupo = grupoFiltro === 'TODOS' || pGrupo.toLowerCase().includes(grupoFiltro.toLowerCase());
      if (!matchGrupo) return false;

      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const sSku = p.sobraSku || '';
      const sDesc = p.sobraDescricao || '';
      const fSku = p.faltaSku || '';
      const fDesc = p.faltaDescricao || '';
      return (
        sSku.toLowerCase().includes(b) ||
        sDesc.toLowerCase().includes(b) ||
        fSku.toLowerCase().includes(b) ||
        fDesc.toLowerCase().includes(b) ||
        pGrupo.toLowerCase().includes(b)
      );
    });
  }, [pares, grupoFiltro, busca]);

  // Métricas do cabeçalho calculadas em tempo real apenas dos itens marcados
  const headerTotals = useMemo(() => {
    return calculateInversionHeaderTotals(pares);
  }, [pares]);

  // Manipulação de pares
  const handleToggleSelectPair = (pairId: string) => {
    setPares(prev => {
      const next = prev.map(p => {
        if (p.id === pairId) {
          return { ...p, selected: !p.selected };
        }
        return p;
      });
      persistCustomPairs(next);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    setPares(prev => {
      const next = prev.map(p => ({ ...p, selected: select }));
      persistCustomPairs(next);
      return next;
    });
  };

  // Alteração livre de quantidade de Entrada (Sobra) - não força nem bloqueia a quantidade de Saída
  const handleChangeQuantitySobra = (pairId: string, newQtdSobra: number) => {
    setPares(prev => {
      const next = prev.map(p => {
        if (p.id === pairId) {
          return recalculatePairValues(p, newQtdSobra, undefined, false);
        }
        return p;
      });
      persistCustomPairs(next);
      return next;
    });
  };

  const handleChangeQuantity = handleChangeQuantitySobra;

  // Alteração livre de quantidade de Saída (Falta) - não altera nem bloqueia a quantidade de Entrada
  const handleChangeQuantitySaida = (pairId: string, newQtdSaida: number) => {
    setPares(prev => {
      const next = prev.map(p => {
        if (p.id === pairId) {
          return recalculatePairValues(p, undefined, newQtdSaida, false);
        }
        return p;
      });
      persistCustomPairs(next);
      return next;
    });
  };

  // Sincronização explícita pela proporção de embalagem caso o analista deseje
  const handleSyncRatioSaida = (pairId: string) => {
    setPares(prev => {
      const next = prev.map(p => {
        if (p.id === pairId) {
          return recalculatePairValues(p, p.quantidadeInversaoSkus, undefined, true);
        }
        return p;
      });
      persistCustomPairs(next);
      return next;
    });
    setToastMessage('Quantidade de Saída sincronizada conforme a proporção de embalagem.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Ajusta a quantidade do par para que a soma total de saídas deste SKU feche exatamente a sobra apurada
  const handleEqualizeSobraExact = (pairId: string) => {
    setPares(prev => {
      const pair = prev.find(p => p.id === pairId);
      if (!pair) return prev;

      const kS = `${pair.deposito}-${pair.sobraSku}`;
      const entry = skuAllocations.sobraMap.get(kS) || skuAllocations.sobraMap.get(pair.sobraSku);
      const totalApurado = entry?.totalApurado ?? pair.sobraDisponivelSkus;

      // Soma de saídas nos outros pares marcados do mesmo SKU
      let othersMovimentado = 0;
      prev.forEach(p => {
        if (p.id !== pairId && p.selected && p.sobraSku === pair.sobraSku && p.deposito === pair.deposito) {
          othersMovimentado += (p.quantidadeInversaoSkus || 0);
        }
      });

      const needed = Math.max(1, totalApurado - othersMovimentado);
      const next = prev.map(p => {
        if (p.id === pairId) {
          return recalculatePairValues(p, needed, undefined, false);
        }
        return p;
      });
      persistCustomPairs(next);
      setToastMessage(`Quantidade ajustada para ${needed} cx: agora a soma das saídas deste SKU fecha exatamente a sobra apurada (${totalApurado} cx)!`);
      setTimeout(() => setToastMessage(null), 3500);
      return next;
    });
  };

  // Ajusta a quantidade de saída do par para que a soma total de baixas deste SKU feche exatamente a falta apurada
  const handleEqualizeFaltaExact = (pairId: string) => {
    setPares(prev => {
      const pair = prev.find(p => p.id === pairId);
      if (!pair) return prev;

      const kF = `${pair.deposito}-${pair.faltaSku}`;
      const entry = skuAllocations.faltaMap.get(kF) || skuAllocations.faltaMap.get(pair.faltaSku);
      const totalApurado = entry?.totalApurado ?? pair.faltaApuradaSkus;

      // Soma de baixas nos outros pares marcados do mesmo SKU
      let othersMovimentado = 0;
      prev.forEach(p => {
        if (p.id !== pairId && p.selected && p.faltaSku === pair.faltaSku && p.deposito === pair.deposito) {
          othersMovimentado += (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus ?? 0);
        }
      });

      const needed = Math.max(1, totalApurado - othersMovimentado);
      const next = prev.map(p => {
        if (p.id === pairId) {
          return recalculatePairValues(p, undefined, needed, false);
        }
        return p;
      });
      persistCustomPairs(next);
      setToastMessage(`Quantidade de saída ajustada para ${needed} cx: agora a soma fecha exatamente a falta fiscal apurada (${totalApurado} cx)!`);
      setTimeout(() => setToastMessage(null), 3500);
      return next;
    });
  };

  // Equaliza todas as sobras ativas para que saia exatamente a quantidade apurada
  const handleEqualizeAllSobras = () => {
    setPares(prev => {
      // 1. Mapeia total apurado por sobra
      const sobraTotalMap = new Map<string, number>();
      (todasSobrasDisponiveis || []).forEach(s => {
        if (s && s.sku) {
          sobraTotalMap.set(`${s.deposito}-${s.sku}`, s.saldoSkus || 0);
          sobraTotalMap.set(s.sku, s.saldoSkus || 0);
        }
      });

      // 2. Agrupa pares selecionados por sobra
      const pairsBySobra = new Map<string, InversaoPair[]>();
      prev.forEach(p => {
        if (!p || !p.selected || !p.sobraSku) return;
        const key = `${p.deposito}-${p.sobraSku}`;
        const list = pairsBySobra.get(key) || [];
        list.push(p);
        pairsBySobra.set(key, list);
      });

      let adjustedCount = 0;
      const updatedPairsMap = new Map<string, InversaoPair>();

      pairsBySobra.forEach((pairList, key) => {
        const totalApurado = sobraTotalMap.get(key) || (pairList[0]?.sobraDisponivelSkus || 0);
        if (totalApurado <= 0) return;

        // Se só tem 1 par desse SKU, a quantidade DEVE ser exatamente totalApurado
        if (pairList.length === 1) {
          const p = pairList[0];
          if (p.quantidadeInversaoSkus !== totalApurado) {
            adjustedCount++;
            const up = recalculatePairValues(p, totalApurado, undefined, false);
            updatedPairsMap.set(p.id, up);
          }
        } else {
          // Se tem múltiplos pares, garante que a soma dê exatamente totalApurado
          let currentSum = pairList.reduce((acc, p) => acc + (p.quantidadeInversaoSkus || 0), 0);
          if (currentSum !== totalApurado) {
            let remaining = totalApurado;
            pairList.forEach((p, idx) => {
              const isLast = idx === pairList.length - 1;
              let targetQtd: number;
              if (isLast) {
                targetQtd = Math.max(1, remaining);
              } else {
                const ratio = (p.quantidadeInversaoSkus || 1) / (currentSum || 1);
                targetQtd = Math.max(1, Math.round(totalApurado * ratio));
                remaining -= targetQtd;
              }
              if (targetQtd !== p.quantidadeInversaoSkus) {
                adjustedCount++;
                const up = recalculatePairValues(p, targetQtd, undefined, false);
                updatedPairsMap.set(p.id, up);
              }
            });
          }
        }
      });

      const next = prev.map(p => updatedPairsMap.get(p.id) || p);
      persistCustomPairs(next);
      setToastMessage(`Equalização de Sobras concluída: ${adjustedCount > 0 ? `${adjustedCount} pares ajustados.` : 'Todas as saídas de sobras já estão 100% equalizadas com o estoque apurado!'}`);
      setTimeout(() => setToastMessage(null), 4000);
      return next;
    });
  };

  // Estado para Edição Manual de Itens (Entrada e Saída)
  interface ManualEditItemModalState {
    pairId: string;
    tipo: 'SOBRA' | 'FALTA';
    sku: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }
  const [manualEditItemModal, setManualEditItemModal] = useState<ManualEditItemModalState | null>(null);

  const handleOpenManualEditItem = (pairId: string, tipo: 'SOBRA' | 'FALTA') => {
    const pair = pares.find(p => p.id === pairId);
    if (!pair) return;
    if (tipo === 'SOBRA') {
      setManualEditItemModal({
        pairId,
        tipo: 'SOBRA',
        sku: pair.sobraSku,
        descricao: pair.sobraDescricao,
        quantidade: pair.quantidadeInversaoSkus,
        valorUnitario: pair.sobraValorUnitario
      });
    } else {
      const qtdSaida = pair.quantidadeSaidaSkus ?? calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, pair.quantidadeInversaoSkus);
      setManualEditItemModal({
        pairId,
        tipo: 'FALTA',
        sku: pair.faltaSku,
        descricao: pair.faltaDescricao,
        quantidade: qtdSaida,
        valorUnitario: pair.faltaValorUnitario
      });
    }
  };

  // Função auxiliar de cores conforme o percentual de compatibilidade
  const getCompatBadgeStyle = (score: number) => {
    if (score >= 95) {
      return 'bg-emerald-500/25 text-emerald-300 border-emerald-400/80 shadow-xs font-black';
    }
    if (score >= 85) {
      return 'bg-cyan-500/25 text-cyan-300 border-cyan-400/80 shadow-xs font-black';
    }
    if (score >= 70) {
      return 'bg-amber-500/25 text-amber-300 border-amber-400/80 shadow-xs font-black';
    }
    if (score >= 50) {
      return 'bg-purple-500/25 text-purple-300 border-purple-400/80 shadow-xs font-black';
    }
    return 'bg-rose-500/25 text-rose-300 border-rose-400/80 shadow-xs font-black';
  };

  const handleSaveManualEditItem = () => {
    if (!manualEditItemModal) return;
    const { pairId, tipo, sku, descricao, quantidade, valorUnitario } = manualEditItemModal;

    const trimmedSku = sku.trim();
    const master = productsMap?.get(trimmedSku);
    const stockItem = [...todasSobrasDisponiveis, ...todasFaltasDisponiveis].find(s => s.sku === trimmedSku);
    const resolvedDesc = descricao.trim() || stockItem?.descricao || master?.descricao;

    setPares(prev => {
      const next = prev.map(p => {
        if (p.id !== pairId) return p;

      const finalSobraSku = tipo === 'SOBRA' ? (trimmedSku || p.sobraSku) : p.sobraSku;
      const finalSobraDesc = tipo === 'SOBRA' ? (resolvedDesc || p.sobraDescricao) : p.sobraDescricao;
      const finalFaltaSku = tipo === 'FALTA' ? (trimmedSku || p.faltaSku) : p.faltaSku;
      const finalFaltaDesc = tipo === 'FALTA' ? (resolvedDesc || p.faltaDescricao) : p.faltaDescricao;

      const compat = calculateProductCompatibility(
        { sku: finalSobraSku, descricao: finalSobraDesc, grupo: p.grupo } as any,
        { sku: finalFaltaSku, descricao: finalFaltaDesc, grupo: p.grupo } as any
      );

      if (tipo === 'SOBRA') {
        const safeQtd = Math.max(1, quantidade);
        const fator = Math.max(1, stockItem?.fatorSku || master?.fatorSku || p.sobraFatorSku || 1);
        const units = safeQtd * fator;
        const safeValorUnit = valorUnitario > 0 ? valorUnitario : (stockItem?.valorUnitario || master?.valorUnit || p.sobraValorUnitario || 0);
        const valorEntrada = units * safeValorUnit;
        const diferencaValor = valorEntrada - p.valorSaida;

        return {
          ...p,
          sobraSku: finalSobraSku,
          sobraDescricao: finalSobraDesc,
          sobraFatorSku: fator,
          sobraFatorHl: stockItem?.fatorHl || master?.fatorHl || p.sobraFatorHl,
          quantidadeInversaoSkus: safeQtd,
          quantidadeInversaoUnits: units,
          sobraValorUnitario: safeValorUnit,
          valorEntrada,
          diferencaValor,
          compatibilidadeScore: compat.score,
          compatibilidadeNivel: compat.nivel,
          compatibilidadeLabel: `${compat.score}%`,
          justificativa: compat.motivo,
          isCustomQuantity: true
        };
      } else {
        const safeQtd = Math.max(1, quantidade);
        const fator = Math.max(1, stockItem?.fatorSku || master?.fatorSku || p.faltaFatorSku || 1);
        const units = safeQtd * fator;
        const safeValorUnit = valorUnitario > 0 ? valorUnitario : (stockItem?.valorUnitario || master?.valorUnit || p.faltaValorUnitario || 0);
        const valorSaida = units * safeValorUnit;
        const diferencaValor = p.valorEntrada - valorSaida;

        return {
          ...p,
          faltaSku: finalFaltaSku,
          faltaDescricao: finalFaltaDesc,
          faltaFatorSku: fator,
          faltaFatorHl: stockItem?.fatorHl || master?.fatorHl || p.faltaFatorHl,
          quantidadeSaidaSkus: safeQtd,
          faltaValorUnitario: safeValorUnit,
          valorSaida,
          diferencaValor,
          compatibilidadeScore: compat.score,
          compatibilidadeNivel: compat.nivel,
          compatibilidadeLabel: `${compat.score}%`,
          justificativa: compat.motivo,
          isCustomQuantity: true
        };
      }
    });
    persistCustomPairs(next);
    return next;
  });

    setJustUpdatedPairId(pairId);
    setTimeout(() => setJustUpdatedPairId(null), 3500);

    if (busca.trim()) {
      setBusca('');
    }

    setToastMessage(`Item de ${tipo === 'SOBRA' ? 'Entrada' : 'Saída'} editado manualmente com sucesso na tabela!`);
    setTimeout(() => setToastMessage(null), 3000);
    setManualEditItemModal(null);
  };

  // Alternar produto no par
  const handleOpenAlternarModal = (
    pairId: string, 
    tipo: 'SOBRA' | 'FALTA', 
    currentSku: string,
    pairIndex: number
  ) => {
    setAlternarModal({ pairId, tipo, currentSku, pairIndex });
    setAlternarModalTab(tipo === 'SOBRA' ? 'SOBRAS' : 'FALTAS');
    setAlternarSearch('');
    setAlternarGrupoFilter('TODOS');
    setAlternarDepFilter('PAR');
  };

  const handleApplyAlternar = (
    pairId: string,
    tipo: 'SOBRA' | 'FALTA',
    selectedItem: InversaoStockItem,
    targetPairIndex?: number,
    swapWithPairId?: string
  ) => {
    const target = pares.find(p => p.id === pairId);
    if (!target) return;

    // Dados do par anterior para possível troca caso o item já estivesse em outro par
    const oldSobra = {
      sku: target.sobraSku,
      descricao: target.sobraDescricao,
      saldoSkus: target.sobraDisponivelSkus,
      saldoUnits: target.sobraDisponivelUnits,
      valorUnitario: target.sobraValorUnitario,
      fatorSku: target.sobraFatorSku,
      fatorHl: target.sobraFatorHl,
      grupo: target.grupo
    };

    const oldFalta = {
      sku: target.faltaSku,
      descricao: target.faltaDescricao,
      saldoSkus: target.faltaApuradaSkus,
      saldoUnits: target.faltaApuradaUnits,
      valorUnitario: target.faltaValorUnitario,
      fatorSku: target.faltaFatorSku,
      fatorHl: target.faltaFatorHl,
      grupo: target.grupo
    };

    setPares(prev => {
      return prev.map(p => {
        if (p.id === pairId) {
          if (tipo === 'SOBRA') {
            const compat = calculateProductCompatibility(selectedItem, {
              sku: p.faltaSku,
              descricao: p.faltaDescricao,
              grupo: p.grupo,
              deposito: p.deposito,
              fatorSku: p.faltaFatorSku,
              fatorHl: p.faltaFatorHl,
              valorUnitario: p.faltaValorUnitario,
              valorCaixa: p.faltaValorUnitario * (p.faltaFatorSku || 1),
              saldoSkus: p.faltaApuradaSkus,
              saldoUnits: p.faltaApuradaUnits,
              saldoRaw: '',
              valorTotal: p.faltaApuradaUnits * p.faltaValorUnitario,
              tipo: 'FALTA'
            });

            const faltaSaldo = Math.max(1, p.faltaApuradaSkus || p.quantidadeSaidaSkus || 1);
            const sobraSaldo = Math.max(1, selectedItem.saldoSkus || p.quantidadeInversaoSkus || 1);
            const maxViableSobra = calculateMaxViableSobraSkus(
              selectedItem.sku,
              p.faltaSku,
              sobraSaldo,
              faltaSaldo
            );
            const newQtdSobra = Math.max(1, maxViableSobra > 0 ? maxViableSobra : (p.quantidadeInversaoSkus || 1));
            const newQtdFalta = calculateQtdSaidaSkus(selectedItem.sku, p.faltaSku, newQtdSobra);

            const { ratio, label: propLabel, isPersonalizado } = getProductConversionRatio(selectedItem.sku, p.faltaSku);
            const sFator = Math.max(1, selectedItem.fatorSku || 1);
            const fFator = Math.max(1, p.faltaFatorSku || 1);
            const sValorUnit = selectedItem.valorUnitario > 0 ? selectedItem.valorUnitario : p.sobraValorUnitario;
            const fValorUnit = p.faltaValorUnitario;
            const valorEntrada = newQtdSobra * sFator * sValorUnit;
            const valorSaida = newQtdFalta * fFator * fValorUnit;

            return {
              ...p,
              sobraSku: selectedItem.sku,
              sobraDescricao: selectedItem.descricao,
              sobraDisponivelSkus: selectedItem.saldoSkus,
              sobraDisponivelUnits: selectedItem.saldoUnits,
              sobraValorUnitario: sValorUnit,
              sobraFatorSku: sFator,
              sobraFatorHl: selectedItem.fatorHl || p.sobraFatorHl,
              quantidadeInversaoSkus: newQtdSobra,
              quantidadeSaidaSkus: newQtdFalta,
              quantidadeInversaoUnits: newQtdSobra * sFator,
              razaoConversao: ratio,
              proporcaoLabel: propLabel,
              isPersonalizadoProporcao: isPersonalizado,
              valorEntrada,
              valorSaida,
              diferencaValor: valorEntrada - valorSaida,
              volumeHlInvertido: newQtdSobra * (selectedItem.fatorHl || p.faltaFatorHl || 0),
              compatibilidadeScore: compat.score,
              compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
              compatibilidadeLabel: `${compat.score}%`,
              justificativa: `Item de entrada alternado para ${selectedItem.sku}. ${compat.motivo}`
            };
          } else {
            // Substituição de FALTA (Saída)
            const compat = calculateProductCompatibility({
              sku: p.sobraSku,
              descricao: p.sobraDescricao,
              grupo: p.grupo,
              deposito: p.deposito,
              fatorSku: p.sobraFatorSku,
              fatorHl: p.sobraFatorHl,
              valorUnitario: p.sobraValorUnitario,
              valorCaixa: p.sobraValorUnitario * (p.sobraFatorSku || 1),
              saldoSkus: p.sobraDisponivelSkus,
              saldoUnits: p.sobraDisponivelUnits,
              saldoRaw: '',
              valorTotal: p.sobraDisponivelUnits * p.sobraValorUnitario,
              tipo: 'SOBRA'
            }, selectedItem);

            const sobraSaldo = Math.max(1, p.sobraDisponivelSkus || p.quantidadeInversaoSkus || 1);
            const faltaSaldo = Math.max(1, selectedItem.saldoSkus || p.quantidadeSaidaSkus || 1);
            const maxViableSobra = calculateMaxViableSobraSkus(
              p.sobraSku,
              selectedItem.sku,
              sobraSaldo,
              faltaSaldo
            );
            const newQtdSobra = Math.max(1, maxViableSobra > 0 ? maxViableSobra : (p.quantidadeInversaoSkus || 1));
            const newQtdFalta = calculateQtdSaidaSkus(p.sobraSku, selectedItem.sku, newQtdSobra);

            const { ratio, label: propLabel, isPersonalizado } = getProductConversionRatio(p.sobraSku, selectedItem.sku);
            const sFator = Math.max(1, p.sobraFatorSku || 1);
            const fFator = Math.max(1, selectedItem.fatorSku || 1);
            const sValorUnit = p.sobraValorUnitario;
            const fValorUnit = selectedItem.valorUnitario > 0 ? selectedItem.valorUnitario : p.faltaValorUnitario;
            const valorEntrada = newQtdSobra * sFator * sValorUnit;
            const valorSaida = newQtdFalta * fFator * fValorUnit;

            return {
              ...p,
              faltaSku: selectedItem.sku,
              faltaDescricao: selectedItem.descricao,
              faltaApuradaSkus: selectedItem.saldoSkus,
              faltaApuradaUnits: selectedItem.saldoUnits,
              faltaValorUnitario: fValorUnit,
              faltaFatorSku: fFator,
              faltaFatorHl: selectedItem.fatorHl || p.faltaFatorHl,
              quantidadeInversaoSkus: newQtdSobra,
              quantidadeSaidaSkus: newQtdFalta,
              quantidadeInversaoUnits: newQtdSobra * sFator,
              razaoConversao: ratio,
              proporcaoLabel: propLabel,
              isPersonalizadoProporcao: isPersonalizado,
              valorEntrada,
              valorSaida,
              diferencaValor: valorEntrada - valorSaida,
              volumeHlInvertido: newQtdSobra * (p.sobraFatorHl || selectedItem.fatorHl || 0),
              compatibilidadeScore: compat.score,
              compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
              compatibilidadeLabel: `${compat.score}%`,
              justificativa: `Item de saída alternado para ${selectedItem.sku}. ${compat.motivo}`
            };
          }
        }

        // Se havia outro par com este mesmo SKU, executa troca inteligente de postos
        if (swapWithPairId && p.id === swapWithPairId) {
          if (tipo === 'SOBRA') {
            const compat = calculateProductCompatibility(oldSobra as any, {
              sku: p.faltaSku,
              descricao: p.faltaDescricao,
              grupo: p.grupo
            } as any);
            const sFator = Math.max(1, oldSobra.fatorSku || 1);
            const fFator = Math.max(1, p.faltaFatorSku || 1);
            const valorEntrada = p.quantidadeInversaoSkus * sFator * oldSobra.valorUnitario;
            const valorSaida = (p.quantidadeSaidaSkus || p.quantidadeInversaoSkus) * fFator * p.faltaValorUnitario;

            return {
              ...p,
              sobraSku: oldSobra.sku,
              sobraDescricao: oldSobra.descricao,
              sobraDisponivelSkus: oldSobra.saldoSkus,
              sobraDisponivelUnits: oldSobra.saldoUnits,
              sobraValorUnitario: oldSobra.valorUnitario,
              sobraFatorSku: sFator,
              sobraFatorHl: oldSobra.fatorHl || p.sobraFatorHl,
              valorEntrada,
              valorSaida,
              diferencaValor: valorEntrada - valorSaida,
              compatibilidadeScore: compat.score,
              compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
              compatibilidadeLabel: `${compat.score}%`,
              justificativa: `Troca inteligente: recebeu ${oldSobra.sku} para equalização.`
            };
          } else {
            const compat = calculateProductCompatibility({
              sku: p.sobraSku,
              descricao: p.sobraDescricao,
              grupo: p.grupo
            } as any, oldFalta as any);
            const sFator = Math.max(1, p.sobraFatorSku || 1);
            const fFator = Math.max(1, oldFalta.fatorSku || 1);
            const valorEntrada = p.quantidadeInversaoSkus * sFator * p.sobraValorUnitario;
            const valorSaida = (p.quantidadeSaidaSkus || p.quantidadeInversaoSkus) * fFator * oldFalta.valorUnitario;

            return {
              ...p,
              faltaSku: oldFalta.sku,
              faltaDescricao: oldFalta.descricao,
              faltaApuradaSkus: oldFalta.saldoSkus,
              faltaApuradaUnits: oldFalta.saldoUnits,
              faltaValorUnitario: oldFalta.valorUnitario,
              faltaFatorSku: fFator,
              faltaFatorHl: oldFalta.fatorHl || p.faltaFatorHl,
              valorEntrada,
              valorSaida,
              diferencaValor: valorEntrada - valorSaida,
              compatibilidadeScore: compat.score,
              compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
              compatibilidadeLabel: `${compat.score}%`,
              justificativa: `Troca inteligente: recebeu ${oldFalta.sku} para equalização.`
            };
          }
        }

        return p;
      });
    });

    setAlternarModal(null);
    setConflictConfirmation(null);
    setJustUpdatedPairId(pairId);
    setTimeout(() => setJustUpdatedPairId(null), 3500);

    // Se o filtro de busca escondia o novo item, limpa a busca para que o usuário veja a mudança imediatamente na tabela
    if (busca.trim()) {
      setBusca('');
    }

    setToastMessage(`Item ${tipo === 'SOBRA' ? 'de Entrada' : 'de Saída'} alterado com sucesso na tabela para ${selectedItem.sku}!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSelectAlternarItem = (selectedItem: InversaoStockItem) => {
    if (!alternarModal) return;

    // Garantia 100% de coerência com a conciliação
    if (alternarModal.tipo === 'SOBRA' && selectedItem.tipo !== 'SOBRA') {
      setToastMessage('Apenas itens com SOBRA apurada na conciliação podem entrar como Entrada (Sobra Física)!');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    if (alternarModal.tipo === 'FALTA' && selectedItem.tipo !== 'FALTA') {
      setToastMessage('Apenas itens com FALTA apurada na conciliação podem sair como Saída (Falta Fiscal)!');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    // Localiza se o SKU selecionado já está sendo usado em outro par
    let conflictingPair: InversaoPair | null = null;
    let conflictingPairIndex = -1;

    for (let i = 0; i < pares.length; i++) {
      const p = pares[i];
      if (p.id === alternarModal.pairId) continue;

      if (alternarModal.tipo === 'SOBRA' && p.sobraSku === selectedItem.sku) {
        conflictingPair = p;
        conflictingPairIndex = i + 1;
        break;
      }
      if (alternarModal.tipo === 'FALTA' && p.faltaSku === selectedItem.sku) {
        conflictingPair = p;
        conflictingPairIndex = i + 1;
        break;
      }
    }

    // Aplica imediatamente a seleção! Se houver par conflitante, realiza troca inteligente
    // sem travar ou deixar o usuário sem retorno visual na tabela.
    handleApplyAlternar(
      alternarModal.pairId,
      alternarModal.tipo,
      selectedItem,
      alternarModal.pairIndex,
      conflictingPair?.id
    );
  };

  // Excluir par (mantendo permanentemente excluído sem risco de ser recuperado)
  const handleDeletePair = (pairId: string) => {
    const target = pares.find(p => p.id === pairId);
    if (target) {
      recordDeletedPair(target);
    }
    setPares(prev => {
      const next = prev.filter(p => p.id !== pairId);
      persistCustomPairs(next);
      return next;
    });
    setToastMessage('Par de inversão excluído definitivamente e mantido fora do cálculo.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Pareamento manual a partir de sobra ou falta
  const handleOpenNewPairModal = (preSelectedSobra?: InversaoStockItem, preSelectedFalta?: InversaoStockItem) => {
    if (preSelectedSobra) {
      setNewPairDeposito(preSelectedSobra.deposito);
      setNewPairSobraSku(preSelectedSobra.sku);
      if (preSelectedFalta) {
        setNewPairFaltaSku(preSelectedFalta.sku);
      } else {
        const opposingFaltas = todasFaltasDisponiveis.filter(f => f.deposito === preSelectedSobra.deposito && f.sku !== preSelectedSobra.sku);
        const top = findTopCompatiblePartners(preSelectedSobra, opposingFaltas, 1);
        setNewPairFaltaSku(top.length > 0 ? top[0].partner.sku : (opposingFaltas[0]?.sku || ''));
      }
      setNewPairQtd(Math.max(1, preSelectedSobra.saldoSkus));
    } else if (preSelectedFalta) {
      setNewPairDeposito(preSelectedFalta.deposito);
      setNewPairFaltaSku(preSelectedFalta.sku);
      const opposingSobras = todasSobrasDisponiveis.filter(s => s.deposito === preSelectedFalta.deposito && s.sku !== preSelectedFalta.sku);
      const top = findTopCompatiblePartners(preSelectedFalta, opposingSobras, 1);
      setNewPairSobraSku(top.length > 0 ? top[0].partner.sku : (opposingSobras[0]?.sku || ''));
      setNewPairQtd(Math.max(1, preSelectedFalta.saldoSkus));
    } else {
      setNewPairDeposito(selectedDeposito === 'ALL' ? '01' : selectedDeposito);
      const s = todasSobrasDisponiveis.find(i => selectedDeposito === 'ALL' || i.deposito === selectedDeposito);
      const f = todasFaltasDisponiveis.find(i => selectedDeposito === 'ALL' || i.deposito === selectedDeposito);
      setNewPairSobraSku(s ? s.sku : '');
      setNewPairFaltaSku(f ? f.sku : '');
      setNewPairQtd(1);
    }
    setNewPairJustificativa('');
    setIsNewPairModalOpen(true);
  };

  const handleCreateNewPair = () => {
    const sobra = todasSobrasDisponiveis.find(s => s.sku === newPairSobraSku && s.deposito === newPairDeposito);
    const falta = todasFaltasDisponiveis.find(f => f.sku === newPairFaltaSku && f.deposito === newPairDeposito);

    if (!sobra || sobra.tipo !== 'SOBRA' || sobra.saldoSkus <= 0) {
      setToastMessage('O item de Entrada deve ser rigorosamente uma SOBRA física apurada na conciliação.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    if (!falta || falta.tipo !== 'FALTA' || falta.saldoSkus <= 0) {
      setToastMessage('O item de Saída deve ser rigorosamente uma FALTA fiscal apurada na conciliação.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    if (sobra.sku === falta.sku) {
      setToastMessage('Não é permitido criar par de inversão com o mesmo SKU.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const maxViable = calculateMaxViableSobraSkus(sobra.sku, falta.sku, sobra.saldoSkus, falta.saldoSkus);
    if (maxViable <= 0) {
      setToastMessage('Saldo apurado na conciliação insuficiente para esta inversão.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const finalQtd = Math.max(1, newPairQtd);
    const newPair = createManualInversaoPair(sobra, falta, finalQtd, newPairJustificativa);
    newPair.isCustomQuantity = true;

    // Se o usuário adicionou manualmente, remove da lista de excluídos
    try {
      const keys = getDeletedPairKeys();
      keys.delete(newPair.id);
      keys.delete(`${sobra.deposito}-${sobra.sku}-${falta.sku}`);
      keys.delete(`${sobra.sku}-${falta.sku}`);
      const arr = Array.from(keys);
      localStorage.setItem(deletedPairsStorageKey, JSON.stringify(arr));
      localStorage.setItem(globalDeletedPairsStorageKey, JSON.stringify(arr));
    } catch {
      // Ignora erro
    }

    setPares(prev => {
      const next = [newPair, ...prev];
      persistCustomPairs(next);
      return next;
    });
    setIsNewPairModalOpen(false);
    setToastMessage(`Novo par adicionado com 100% de coerência: ${sobra.sku} x ${falta.sku} (${newPair.compatibilidadeLabel || 'Par Manual'})`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Exportação Excel
  const handleExportExcel = async () => {
    const selecionados = pares.filter(p => p.selected && p.quantidadeInversaoSkus > 0);
    if (selecionados.length === 0) {
      setToastMessage('Selecione ao menos um par de inversão para exportar.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportChamadoInversaoExcel({
        pares: selecionados,
        selectedDeposito,
        usuario: currentUser?.nome || 'Analista de Estoque',
        dataRef: new Date().toLocaleDateString('pt-BR'),
        baseMode
      });
      if (result.success) {
        setToastMessage(`Chamado Técnico exportado com sucesso: ${result.filename}`);
      }
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setToastMessage('Erro ao gerar planilha Excel.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportModeloFiscalExcel = async () => {
    const paresValidos = pares.filter(p => p.quantidadeInversaoSkus > 0);
    if (paresValidos.length === 0) {
      setToastMessage('Nenhum par de inversão disponível para exportar.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportPlanilhaModeloFiscalExcel({
        pares,
        selectedDeposito,
        usuario: currentUser?.nome || 'Analista de Estoque',
        dataRef: new Date().toLocaleDateString('pt-BR'),
        baseMode
      });
      if (result.success) {
        setToastMessage(`Tabela de Inversão exportada com sucesso no modelo oficial: ${result.filename}`);
      }
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setToastMessage('Erro ao gerar tabela de inversão.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  // PARSER E ATUALIZAÇÃO SELETIVA DE VALORES DE PRODUTOS
  const handleParsePriceUpdateText = (text: string) => {
    setPriceUpdateText(text);
    setPriceUpdateError(null);

    if (!text.trim()) {
      setPriceUpdatePreview([]);
      return;
    }

    try {
      const parsedMap = parseCadastroCsv(text);
      if (parsedMap.size === 0) {
        setPriceUpdateError('Nenhum produto com código e valor identificado no texto inserido.');
        setPriceUpdatePreview([]);
        return;
      }

      const previewList: Array<{
        sku: string;
        descricao: string;
        oldPriceUnit: number;
        newPriceUnit: number;
        oldPriceBox: number;
        newPriceBox: number;
      }> = [];

      parsedMap.forEach((newProd, sku) => {
        const existing = productsMap?.get(sku);
        const oldPriceUnit = existing?.valorUnit || 0;
        const oldPriceBox = existing?.valor || (oldPriceUnit * (existing?.fatorSku || 1));

        const newPriceUnit = newProd.valorUnit > 0 ? newProd.valorUnit : (newProd.valor / Math.max(1, newProd.fatorSku));
        const newPriceBox = newProd.valor > 0 ? newProd.valor : (newPriceUnit * Math.max(1, newProd.fatorSku));

        previewList.push({
          sku,
          descricao: newProd.descricao || existing?.descricao || `Produto ${sku}`,
          oldPriceUnit,
          newPriceUnit,
          oldPriceBox,
          newPriceBox
        });
      });

      setPriceUpdatePreview(previewList);
    } catch (err: any) {
      setPriceUpdateError(`Erro ao interpretar tabela: ${err?.message || 'formato inválido'}`);
      setPriceUpdatePreview([]);
    }
  };

  const handleApplyPriceUpdates = () => {
    if (priceUpdatePreview.length === 0) {
      setPriceUpdateError('Nenhum item com novo valor para aplicar.');
      return;
    }

    try {
      const parsedMap = parseCadastroCsv(priceUpdateText);
      const updatedProductsMap = new Map<string, ProductMaster>(productsMap || new Map());
      let countUpdated = 0;
      let countNew = 0;

      parsedMap.forEach((v, k) => {
        const existing = updatedProductsMap.get(k);
        if (existing) {
          const newFator = v.fatorSku > 1 ? v.fatorSku : existing.fatorSku;
          const newValorUnit = v.valorUnit > 0 ? v.valorUnit : (v.valor > 0 ? v.valor / newFator : existing.valorUnit);
          const newValor = v.valor > 0 ? v.valor : (newValorUnit * newFator);

          updatedProductsMap.set(k, {
            ...existing,
            descricao: v.descricao && !v.descricao.startsWith('Produto ') ? v.descricao : existing.descricao,
            fatorSku: newFator,
            valorUnit: newValorUnit,
            valor: newValor,
            fatorHl: v.fatorHl > 0 ? v.fatorHl : existing.fatorHl,
            grupo: v.grupo && v.grupo !== 'GERAL' ? v.grupo : existing.grupo,
            embalagem: v.embalagem || existing.embalagem
          });
          countUpdated++;
        } else {
          updatedProductsMap.set(k, v);
          countNew++;
        }
      });

      // 1. Atualiza estado de produtos e persiste
      if (onUpdateProductsMap) {
        onUpdateProductsMap(() => updatedProductsMap);
      }
      persistData(STORAGE_KEYS.PRODUCTS, Array.from(updatedProductsMap.entries()));

      // 2. Recalcula valores de impacto financeiro em StockPositions (02.05.02)
      if (onUpdateStockPositions) {
        onUpdateStockPositions(prev => {
          const updated = prev.map(item => {
            const p = updatedProductsMap.get(item.produto);
            if (!p) return item;

            const valorUnitario = p.valorUnit || item.valorUnitario;
            const valorCaixa = p.valor || (valorUnitario * item.fatorSku);
            const impactoFinanceiro = item.diferencaTotalUnits * valorUnitario;
            const prejuizoFinanceiro = item.diferencaTotalUnits < 0 ? Math.abs(impactoFinanceiro) : 0;
            const sobraFinanceira = item.diferencaTotalUnits > 0 ? impactoFinanceiro : 0;

            return {
              ...item,
              valorUnitario,
              valorCaixa,
              impactoFinanceiro,
              prejuizoFinanceiro,
              sobraFinanceira
            };
          });
          persistData(STORAGE_KEYS.STOCK_POSITIONS_020502, updated);
          persistData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, updated);
          return updated;
        });
      }

      // 3. Recalcula Grade de Estoque se disponível
      if (onUpdateGradeStockPositions) {
        onUpdateGradeStockPositions(prev => {
          const updated = prev.map(item => {
            const p = updatedProductsMap.get(item.produto);
            if (!p) return item;

            const valorUnitario = p.valorUnit || item.valorUnitario;
            const valorCaixa = p.valor || (valorUnitario * item.fatorSku);
            const impactoFinanceiro = item.diferencaTotalUnits * valorUnitario;
            const prejuizoFinanceiro = item.diferencaTotalUnits < 0 ? Math.abs(impactoFinanceiro) : 0;
            const sobraFinanceira = item.diferencaTotalUnits > 0 ? impactoFinanceiro : 0;

            return {
              ...item,
              valorUnitario,
              valorCaixa,
              impactoFinanceiro,
              prejuizoFinanceiro,
              sobraFinanceira
            };
          });
          persistData(STORAGE_KEYS.GRADE_POSITIONS, updated);
          persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, updated);
          return updated;
        });
      }

      setIsPriceUpdateModalOpen(false);
      setPriceUpdateText('');
      setPriceUpdatePreview([]);
      setToastMessage(`Valores atualizados com sucesso: ${countUpdated} produtos modificados, demais ${updatedProductsMap.size - countUpdated} produtos preservados intactos!`);
      setTimeout(() => setToastMessage(null), 5000);
      refreshSuggestions();
    } catch (e: any) {
      setPriceUpdateError(`Falha ao aplicar valores: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.match(/\.(xlsx|xls|xlsm|xlsb)$/i)) {
        const buffer = await file.arrayBuffer();
        const { csv } = parseExcelWorkbookToCsv(buffer);
        handleParsePriceUpdateText(csv);
      } else {
        const text = await file.text();
        handleParsePriceUpdateText(text);
      }
    } catch (err: any) {
      setPriceUpdateError(`Erro ao abrir arquivo: ${err?.message || 'arquivo incompatível'}`);
    }
  };

  // Cache de compatibilidade entre itens (executado apenas quando os itens de estoque mudam, nunca em re-renders de digitação)
  const compatiblePartnersMap = useMemo(() => {
    const map = new Map<string, {
      sku: string;
      descricao: string;
      score: number;
      motivo: string;
      deposito: DepositoId;
      saldoSkusDisponivel: number;
    }>();

    // Para cada sobra, localiza a melhor falta compatível
    todasSobrasDisponiveis.forEach(sobra => {
      const opposing = todasFaltasDisponiveis.filter(f => f.deposito === sobra.deposito || selectedDeposito === 'ALL');
      const top = findTopCompatiblePartners(sobra, opposing, 1)[0];
      if (top) {
        map.set(`${sobra.deposito}-${sobra.sku}`, {
          sku: top.partner.sku,
          descricao: top.partner.descricao,
          score: top.compatibility.score,
          motivo: top.compatibility.motivo,
          deposito: top.partner.deposito as DepositoId,
          saldoSkusDisponivel: top.partner.saldoSkus
        });
      }
    });

    // Para cada falta, localiza a melhor sobra compatível
    todasFaltasDisponiveis.forEach(falta => {
      const opposing = todasSobrasDisponiveis.filter(s => s.deposito === falta.deposito || selectedDeposito === 'ALL');
      const top = findTopCompatiblePartners(falta, opposing, 1)[0];
      if (top) {
        map.set(`${falta.deposito}-${falta.sku}`, {
          sku: top.partner.sku,
          descricao: top.partner.descricao,
          score: top.compatibility.score,
          motivo: top.compatibility.motivo,
          deposito: top.partner.deposito as DepositoId,
          saldoSkusDisponivel: top.partner.saldoSkus
        });
      }
    });

    return map;
  }, [todasSobrasDisponiveis, todasFaltasDisponiveis, selectedDeposito]);

  // Mapa O(1) de alocações atuais dos pares ativos para resposta instantânea ao alterar qualquer quantidade
  const allocationsMap = useMemo(() => {
    const sobraAlocada = new Map<string, number>();
    const faltaAlocada = new Map<string, number>();

    pares.forEach(p => {
      if (p.selected && p.quantidadeInversaoSkus > 0) {
        const kSobra = `${p.deposito}-${p.sobraSku}`;
        const kFalta = `${p.deposito}-${p.faltaSku}`;
        const qtdSobra = p.quantidadeInversaoSkus;
        const qtdSaida = p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus;
        sobraAlocada.set(kSobra, (sobraAlocada.get(kSobra) || 0) + qtdSobra);
        faltaAlocada.set(kFalta, (faltaAlocada.get(kFalta) || 0) + qtdSaida);
      }
    });

    return { sobraAlocada, faltaAlocada };
  }, [pares]);

  // Itens da auditoria enriquecidos em O(N) com status e parceiro precomputado sem travamento
  const auditItemsEnriched = useMemo(() => {
    const list: InversaoStockItem[] = [];

    const processItem = (item: InversaoStockItem, isSobra: boolean): InversaoStockItem => {
      const key = `${item.deposito}-${item.sku}`;
      const alocado = (isSobra ? allocationsMap.sobraAlocada.get(key) : allocationsMap.faltaAlocada.get(key)) || 0;
      const saldoResidualSkus = Math.max(0, item.saldoSkus - alocado);
      const saldoResidualUnits = Math.max(0, item.saldoUnits - (alocado * item.fatorSku));

      let statusAuditoria: InversaoStockItem['statusAuditoria'] = 'PENDENTE';
      if (alocado >= item.saldoSkus && item.saldoSkus > 0) {
        statusAuditoria = 'TOTALMENTE_EQUALIZADO';
      } else if (alocado > 0) {
        statusAuditoria = 'PARCIALMENTE_EQUALIZADO';
      }

      const topMatch = compatiblePartnersMap.get(key);

      return {
        ...item,
        alocadoSkus: alocado,
        saldoResidualSkus,
        saldoResidualUnits,
        statusAuditoria,
        melhorCandidatoInversao: topMatch
      };
    };

    todasSobrasDisponiveis.forEach(s => list.push(processItem(s, true)));
    todasFaltasDisponiveis.forEach(f => list.push(processItem(f, false)));

    return list;
  }, [todasSobrasDisponiveis, todasFaltasDisponiveis, allocationsMap, compatiblePartnersMap]);

  // Itens da auditoria filtrados para exibição ultra rápida no balão
  const auditItemsFiltered = useMemo(() => {
    return auditItemsEnriched.filter(item => {
      if (auditTab === 'SOBRAS' && item.tipo !== 'SOBRA') return false;
      if (auditTab === 'FALTAS' && item.tipo !== 'FALTA') return false;
      if (auditTab === 'PENDENTES' && item.statusAuditoria === 'TOTALMENTE_EQUALIZADO') return false;
      if (auditTab === 'EQUALIZADOS' && item.statusAuditoria !== 'TOTALMENTE_EQUALIZADO') return false;

      if (!auditSearch.trim()) return true;
      const q = auditSearch.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.descricao.toLowerCase().includes(q) ||
        item.grupo.toLowerCase().includes(q) ||
        (item.marca && item.marca.toLowerCase().includes(q))
      );
    });
  }, [auditItemsEnriched, auditTab, auditSearch]);

  const auditItemsList = auditItemsFiltered;

  return (
    <div className="space-y-6 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-fade-in text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Top Banner: Informações, Seletor de Base e Seletor de Depósito */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-700 text-white flex items-center justify-center shadow-xs">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Central de Inversão de Produtos
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-700" />
                    <span>Inteligência Analítica DPO</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Equalização inteligente de <strong className="text-emerald-700 font-bold">Sobras Físicas</strong> e <strong className="text-rose-700 font-bold">Faltas Fiscais</strong> com 100% de coerência de auditoria e cálculo de afinidade por embalagem.
                </p>
              </div>
            </div>
          </div>

          {/* Seletores: Depósito, Base de Cálculo, Atualizar e Atualizar Preços */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Depósito */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <select
                value={selectedDeposito}
                onChange={(e) => setSelectedDeposito(e.target.value as any)}
                className="bg-white border-0 text-slate-800 rounded-lg px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                <option value="ALL">Geral (Todos os Depósitos)</option>
                {DEPOSITOS.map(d => (
                  <option key={d.id} value={d.id}>
                    Depósito {d.id} - {d.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Base da Conciliação (Com Ajustes vs Físico Puro) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBaseMode('COM_AJUSTES')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  baseMode === 'COM_AJUSTES'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Conciliação Equalizada: Físico + Desvios de Quebras, Vales, Trocas e Faltas Mapeadas vs Fiscal"
              >
                Com Ajustes Operacionais
              </button>
              <button
                type="button"
                onClick={() => setBaseMode('SEM_AJUSTES')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  baseMode === 'SEM_AJUSTES'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Conciliação Padrão: Físico Puro do Inventário vs Fiscal 02.05.02"
              >
                Físico Puro (Sem Ajustes)
              </button>
            </div>

            {/* Botão de Atualizar Preços Seletivos */}
            <button
              type="button"
              onClick={() => setIsPriceUpdateModalOpen(true)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Atualizar valores seletivamente: apenas os itens informados terão seus preços atualizados, preservando todos os demais"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-700" />
              <span>Atualizar Preços (Seletiva)</span>
            </button>

            {/* Recalcular / Atualizar */}
            <button
              type="button"
              onClick={refreshSuggestions}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200 cursor-pointer"
              title="Recalcular pares e dados com base no estoque atual"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. PAINEL DE COERÊNCIA MATEMÁTICA E AUDITORIA */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50/70 via-blue-50/50 to-slate-50 border border-emerald-200/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  Coerência 100% Confirmada com a Conciliação
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                  {(auditSummary?.taxaEqualizacaoSobras ?? 0).toFixed(1)}% das sobras equalizadas
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-0.5 font-sans">
                <span>
                  Sobras Físicas: <strong className="text-emerald-700 font-mono font-bold">+{auditSummary?.totalSobrasApuradasSkus ?? 0} cx</strong> ({formatCurrency(auditSummary?.totalSobrasApuradasValor ?? 0)})
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Faltas Fiscais: <strong className="text-rose-700 font-mono font-bold">-{auditSummary?.totalFaltasApuradasSkus ?? 0} cx</strong> ({formatCurrency(auditSummary?.totalFaltasApuradasValor ?? 0)})
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Residual Pós-Inversão: <strong className="text-slate-800 font-mono font-bold">+{auditSummary?.totalSobrasResiduaisSkus ?? 0} cx sobra</strong> / <strong className="text-slate-800 font-mono font-bold">-{auditSummary?.totalFaltasResiduaisSkus ?? 0} cx falta</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer bg-blue-600 hover:bg-blue-700 active:scale-95 text-white"
              title="Abrir o balão flutuante com o Guia de Auditoria Completo (100% Conciliado)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver Guia de Auditoria</span>
            </button>
          </div>
        </div>

        {/* 3. CABEÇALHO COM VALORAÇÃO EM TEMPO REAL */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Chamados Ativos</span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {headerTotals.totalParesSelecionados}
              <span className="text-xs font-normal text-slate-500 ml-1">pares</span>
            </div>
            <div className="text-[11px] font-bold text-blue-700 mt-1 font-mono">
              {headerTotals.totalSkusInvertidos} caixas equalizadas
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-bold mb-1">
              <span>Entrada (Sobras Físicas)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              {formatCurrency(headerTotals.valorTotalEntrada)}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 font-mono">
              {headerTotals.totalUnitsInvertidas} unidades físicas
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-rose-800 font-bold mb-1">
              <span>Saída (Faltas Fiscais)</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
              {formatCurrency(headerTotals.valorTotalSaida)}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">
              Baixa contábil fiscal
            </div>
          </div>

          <div className={`border rounded-xl p-3.5 ${
            Math.abs(headerTotals.saldoLiquido) < 10
              ? 'bg-blue-50/70 border-blue-200'
              : headerTotals.saldoLiquido >= 0
                ? 'bg-teal-50/70 border-teal-200'
                : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Balanço Líquido</span>
              <Percent className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              headerTotals.saldoLiquido >= 0 ? 'text-teal-800' : 'text-amber-800'
            }`}>
              {formatCurrency(headerTotals.saldoLiquido)}
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1 truncate">
              {headerTotals.saldoLiquido < 0
                ? `Eficiência de Abate (+${formatCurrency(Math.abs(headerTotals.saldoLiquido))})`
                : Math.abs(headerTotals.saldoLiquido) < 5
                  ? 'Equalização Quase Neutra'
                  : 'Variação por apresentação'}
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-indigo-800 font-bold mb-1">
              <span>Volume Regularizado</span>
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">
              {formatHectoliters(headerTotals.totalHl)}
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold mt-1">
              Hectolitros (HL)
            </div>
          </div>
        </div>

        {/* 4. Barra de Ações: Abas Principais, Incluir Novo Par, Exportar Excel, Filtro e Busca */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-5 border-t border-slate-100 mt-5">
          {/* Navegação entre Abas e Botão Balão de Auditoria */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveMainTab('SUGESTOES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'SUGESTOES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Tabela Oficial de Inversão ({pares.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-white/80 active:scale-95"
              title="Abrir balão com o Guia de Auditoria e Coerência de Estoque (100% Conciliado)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Guia de Auditoria & Coerência</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('LIVRES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'LIVRES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Saldos Livres ({sobrasSemPar.length + faltasSemPar.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenNewPairModal()}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Criar um par de inversão customizado selecionando qualquer item que entra e sai"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Incluir Par de Inversão</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSimuladorModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Simular abatimento de metas em R$ das faltas fiscais com cálculo de equivalência física e retorno financeiro"
            >
              <Calculator className="w-4 h-4 text-emerald-300" />
              <span>Simulador Fiscal</span>
            </button>

            {/* Exportar Planilha Modelo Oficial */}
            <button
              type="button"
              onClick={handleExportModeloFiscalExcel}
              disabled={isExporting || (headerTotals.totalParesSelecionados === 0 && pares.filter(p => p.quantidadeInversaoSkus > 0).length === 0)}
              className="bg-[#FFBF00] hover:bg-[#E6AA00] text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer flex-shrink-0 border border-amber-600/40"
              title="Exportar a planilha exatamente no modelo oficial: ENTRADA [CÓD, PROD, QTDE.] x SAÍDA [CÓD, PROD, QTDE.]"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              <span>{isExporting ? 'Exportando...' : 'Exportar Tabela (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BANNER OFICIAL DA METODOLOGIA FISCAL (ENTRADA x BALANÇO x SAÍDA) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-md">
        <div className="bg-[#FFC000] p-3.5 text-center border-b md:border-b-0 md:border-r border-amber-600/30">
          <span className="text-xs font-black uppercase tracking-wider text-slate-950 block">
            VALOR ENTRADA
          </span>
          <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
            <span className="text-xs font-black text-slate-800">R$</span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950">
              {(headerTotals?.valorTotalEntrada ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-800 block mt-0.5">
            Sobras físicas que entrarão no fiscal ({headerTotals?.totalSkusInvertidos ?? 0} cx equalizadas de {auditSummary?.totalSobrasApuradasSkus ?? 0} cx apuradas)
          </span>
        </div>

        <div className="bg-black p-3.5 text-center text-white border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#FFC000]">
                BALANÇO FISCAL
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Variação Contábil
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-slate-400">R$</span>
              <span className={`text-2xl sm:text-3xl font-black font-mono ${
                (headerTotals?.saldoLiquido ?? 0) > 0 ? 'text-emerald-400' : (headerTotals?.saldoLiquido ?? 0) < 0 ? 'text-amber-300' : 'text-slate-200'
              }`}>
                {(headerTotals?.saldoLiquido ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-1 space-y-1.5">
            <div className="flex items-center justify-center gap-1">
              {(headerTotals?.saldoLiquido ?? 0) > 0 ? (
                <span className="text-xs font-black text-emerald-400 flex items-center gap-0.5">
                  ▲ Aumentando Valor Fiscal (+{formatCurrency(headerTotals?.saldoLiquido ?? 0)})
                </span>
              ) : (headerTotals?.saldoLiquido ?? 0) < 0 ? (
                <span className="text-xs font-black text-amber-300 flex items-center gap-0.5">
                  ▼ Variação Fiscal Líquida ({formatCurrency(headerTotals?.saldoLiquido ?? 0)})
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-300">
                  = Equalização Neutra (R$ 0,00)
                </span>
              )}
            </div>

            {/* PARECER TÉCNICO DE COERÊNCIA DO ANALISTA */}
            <div className="pt-1.5 border-t border-slate-800/80 text-[10.5px] leading-tight flex items-center justify-center">
              {(headerTotals?.saldoLiquido ?? 0) < 0 ? (
                <span className="text-emerald-300 font-bold bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                  ✓ Ganho Operacional: Abatidos R$ {(headerTotals?.valorTotalSaida ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em faltas usando R$ {(headerTotals?.valorTotalEntrada ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de sobras (+{formatCurrency(Math.abs(headerTotals?.saldoLiquido ?? 0))} de economia em quebras)
                </span>
              ) : (headerTotals?.saldoLiquido ?? 0) > 0 ? (
                <span className="text-blue-300 font-bold bg-blue-950/70 px-2 py-0.5 rounded border border-blue-500/30">
                  ✓ Sobras inseridas superam as faltas baixadas em +{formatCurrency(headerTotals?.saldoLiquido ?? 0)}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">
                  ✓ Entradas e saídas perfeitamente balanceadas em valor
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#FFC000] p-3.5 text-center">
          <span className="text-xs font-black uppercase tracking-wider text-slate-950 block">
            VALOR SAÍDA (ABATE DAS FALTAS)
          </span>
          <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
            <span className="text-xs font-black text-slate-800">R$</span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950">
              {(headerTotals?.valorTotalSaida ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-800 block mt-0.5">
            Faltas abatidas do estoque fiscal ({headerTotals?.totalSaidaSkus ?? 0} cx baixadas de {auditSummary?.totalFaltasApuradasSkus ?? 0} cx apuradas)
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: CHAMADOS DE INVERSÃO PROPOSTOS                                     */}
      {/* ========================================================================= */}
      {activeMainTab === 'SUGESTOES' && (
        <InversaoErrorBoundary fallbackMessage="Instabilidade na exibição da tabela. Suas edições foram salvas com sucesso.">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Chamados de Inversão Propostos</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {paresFiltrados.length} pares
                </span>
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Desmarcar Todos
                </button>
                <button
                  type="button"
                  onClick={handleEqualizeAllSobras}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  title="Equalizar todas as quantidades para que a saída de cada sobra corresponda exatamente ao saldo apurado na conciliação"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Equalizar Quantidades ao Apurado</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Filtro por Grupo */}
              <select
                value={grupoFiltro}
                onChange={(e) => setGrupoFiltro(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="TODOS">Todos os Grupos ({gruposDisponiveis.length})</option>
                {gruposDisponiveis.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Busca */}
              <div className="relative w-48 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar SKU ou nome..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Seletor Planilha vs Cards */}
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewFormat('PLANILHA')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewFormat === 'PLANILHA'
                      ? 'bg-[#FFC000] text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Planilha</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewFormat('CARDS')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewFormat === 'CARDS'
                      ? 'bg-slate-900 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {paresFiltrados.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma inversão pendente identificada para os critérios atuais
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Utilize o botão <strong>"Incluir Par de Inversão"</strong> acima para criar uma inversão customizada ou clique em <button type="button" onClick={() => setIsAuditModalOpen(true)} className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer">"Ver Guia de Auditoria"</button> para abrir o balão com todos os itens com saldo apurado.
              </p>
            </div>
          ) : viewFormat === 'PLANILHA' ? (
            /* TABELA MODELO PLANILHA FISCAL (LADO A LADO) */
            <div className="border-2 border-amber-400 rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-[13px] text-left border-collapse min-w-[1360px] 2xl:min-w-[1480px]">
                  <thead>
                    <tr className="bg-[#FFBF00] text-slate-950 font-black uppercase text-center border-t-4 border-black border-b border-amber-500">
                      <th colSpan={5} className="py-3 px-3 border-r-2 border-white tracking-wider text-xs sm:text-sm">
                        ENTRADA (SOBRA FÍSICA)
                      </th>
                      <th colSpan={4} className="py-3 px-3 border-r-2 border-white tracking-wider text-xs sm:text-sm">
                        SAÍDA (FALTA FISCAL)
                      </th>
                      <th colSpan={3} className="py-3 px-3 bg-black text-[#FFBF00] tracking-wide text-xs sm:text-sm">
                        BALANÇO & COMPATIBILIDADE
                      </th>
                    </tr>

                    <tr className="bg-[#FFC000] text-slate-950 font-black border-b border-amber-400 text-xs">
                      {/* ENTRADA */}
                      <th className="py-2.5 px-2 text-center w-12 border-r border-white/60">
                        <input
                          type="checkbox"
                          checked={paresFiltrados.length > 0 && paresFiltrados.every(p => p.selected)}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-400 cursor-pointer"
                          title="Selecionar / Desmarcar todos os pares"
                        />
                      </th>
                      <th className="py-2.5 px-2 text-center w-36 border-r border-white/60">CÓD</th>
                      <th className="py-2.5 px-3.5 border-r border-white/60 min-w-[320px]">PRODUTO</th>
                      <th className="py-2.5 px-2 text-center w-32 border-r border-white/60">QTDE. (SKU)</th>
                      <th className="py-2.5 px-3 text-right w-28 border-r-2 border-white">VALOR (R$)</th>

                      {/* SAÍDA */}
                      <th className="py-2.5 px-2 text-center w-36 border-r border-white/60">CÓD</th>
                      <th className="py-2.5 px-3.5 border-r border-white/60 min-w-[320px]">PRODUTO</th>
                      <th className="py-2.5 px-2 text-center w-32 border-r border-white/60">QTDE. (SKU)</th>
                      <th className="py-2.5 px-3 text-right w-28 border-r-2 border-white">VALOR (R$)</th>

                      {/* BALANÇO */}
                      <th className="py-2.5 px-3 text-center bg-slate-950 text-white w-32 border-r border-slate-800">DIFERENÇA</th>
                      <th className="py-2.5 px-2 text-center bg-slate-950 text-[#FFBF00] w-28 border-r border-slate-800 font-black">% COMPAT.</th>
                      <th className="py-2.5 px-2 text-center bg-slate-950 text-white w-14">AÇÃO</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {paresFiltrados.map((pair, idx) => {
                      const qtdSaidaSkus = pair.quantidadeSaidaSkus ?? calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, pair.quantidadeInversaoSkus);
                      const compatScore = pair.compatibilidadeScore ?? calculateProductCompatibility(
                        { sku: pair.sobraSku, descricao: pair.sobraDescricao, grupo: pair.grupo } as any,
                        { sku: pair.faltaSku, descricao: pair.faltaDescricao, grupo: pair.grupo } as any
                      ).score;
                      const sobraAlloc = skuAllocations?.sobraMap?.get(`${pair.deposito}-${pair.sobraSku}`) || skuAllocations?.sobraMap?.get(pair.sobraSku);
                      const faltaAlloc = skuAllocations?.faltaMap?.get(`${pair.deposito}-${pair.faltaSku}`) || skuAllocations?.faltaMap?.get(pair.faltaSku);

                      return (
                        <tr 
                          key={pair.id}
                          className={`transition font-sans ${
                            justUpdatedPairId === pair.id
                              ? 'bg-emerald-100/90 ring-2 ring-emerald-500 shadow-md animate-pulse'
                              : pair.selected ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'opacity-60 hover:opacity-80'
                          }`}
                        >
                          <td className="py-3 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={pair.selected}
                              onChange={() => handleToggleSelectPair(pair.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-2 font-mono font-black text-slate-900 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs sm:text-[13px]">{pair.sobraSku}</span>
                              <button
                                type="button"
                                onClick={() => handleOpenAlternarModal(pair.id, 'SOBRA', pair.sobraSku, idx + 1)}
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-slate-950 border border-amber-400 transition cursor-pointer shadow-2xs group"
                                title="Verificar sobras na conciliação e alternar item"
                              >
                                <ArrowLeftRight className="w-3 h-3 text-amber-950 group-hover:scale-110 transition-transform" />
                                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenManualEditItem(pair.id, 'SOBRA')}
                                className="p-1 rounded bg-blue-50 hover:bg-blue-200 text-blue-800 border border-blue-200 transition cursor-pointer shadow-2xs"
                                title="Editar manualmente este item de Entrada (código, descrição, quantidade e valor)"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-slate-800">
                            <div className="font-semibold text-slate-900 leading-snug whitespace-normal break-words text-xs sm:text-[13px]">
                              {pair.sobraDescricao}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 font-sans">
                              <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Saldo físico total apurado de sobra na conciliação">
                                Apurado: +{sobraAlloc?.totalApurado ?? pair.sobraDisponivelSkus} cx
                              </span>
                              <span className="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold" title="Total somado de caixas deste SKU em saída em todos os chamados">
                                SKU saindo: {sobraAlloc?.totalMovimentado ?? pair.quantidadeInversaoSkus}/{sobraAlloc?.totalApurado ?? pair.sobraDisponivelSkus} cx
                              </span>
                              {sobraAlloc?.status === 'EXATO' && (
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                  ✓ Sai 100% da sobra (+{sobraAlloc.totalApurado} cx)
                                </span>
                              )}
                              {sobraAlloc?.status === 'PARCIAL' && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span>Resta sair +{sobraAlloc.saldoResidual} cx</span>
                                  <button
                                    type="button"
                                    onClick={() => handleEqualizeSobraExact(pair.id)}
                                    className="text-[9px] underline font-black text-blue-800 hover:text-blue-950 cursor-pointer"
                                    title="Ajustar quantidade deste par para fechar exatamente a sobra física apurada"
                                  >
                                    [Igualar]
                                  </button>
                                </span>
                              )}
                              {sobraAlloc?.status === 'EXCEDENTE' && (
                                <span className="text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span>⚠️ Excede sobra em +{sobraAlloc.excedente} cx</span>
                                  <button
                                    type="button"
                                    onClick={() => handleEqualizeSobraExact(pair.id)}
                                    className="text-[9px] underline font-black text-rose-900 hover:text-rose-950 cursor-pointer"
                                    title="Corrigir quantidade para não ultrapassar a sobra apurada"
                                  >
                                    [Corrigir]
                                  </button>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenManualEditItem(pair.id, 'SOBRA')}
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer font-medium ml-auto"
                                title="Editar descrição ou valores de Entrada"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center font-mono">
                            <QuantityStepperCell
                              value={pair.quantidadeInversaoSkus}
                              onChange={(val) => handleChangeQuantitySobra(pair.id, val)}
                              variant="emerald"
                              title="Editar quantidade de Entrada (Sobra Física)"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 text-xs sm:text-[13px]">
                            {formatCurrency(pair.valorEntrada)}
                          </td>

                          <td className="py-3 px-2 font-mono font-black text-slate-900 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs sm:text-[13px]">{pair.faltaSku}</span>
                              <button
                                type="button"
                                onClick={() => handleOpenAlternarModal(pair.id, 'FALTA', pair.faltaSku, idx + 1)}
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-slate-950 border border-amber-400 transition cursor-pointer shadow-2xs group"
                                title="Verificar faltas na conciliação e alternar item"
                              >
                                <ArrowLeftRight className="w-3 h-3 text-amber-950 group-hover:scale-110 transition-transform" />
                                <ShieldCheck className="w-3 h-3 text-rose-700" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenManualEditItem(pair.id, 'FALTA')}
                                className="p-1 rounded bg-blue-50 hover:bg-blue-200 text-blue-800 border border-blue-200 transition cursor-pointer shadow-2xs"
                                title="Editar manualmente este item de Saída (código, descrição, quantidade e valor)"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-slate-800">
                            <div className="font-semibold text-slate-900 leading-snug whitespace-normal break-words text-xs sm:text-[13px]">
                              {pair.faltaDescricao}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 font-sans">
                              <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Saldo fiscal apurado de falta na conciliação">
                                Apurado: -{faltaAlloc?.totalApurado ?? pair.faltaApuradaSkus} cx
                              </span>
                              <span className="text-[10px] text-rose-700 font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-bold" title="Total somado de abatimentos deste SKU em todos os chamados">
                                SKU abatido: {faltaAlloc?.totalMovimentado ?? qtdSaidaSkus}/{faltaAlloc?.totalApurado ?? pair.faltaApuradaSkus} cx
                              </span>
                              {faltaAlloc?.status === 'EXATO' && (
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                  ✓ Abate 100% da falta (-{faltaAlloc.totalApurado} cx)
                                </span>
                              )}
                              {faltaAlloc?.status === 'PARCIAL' && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span>Resta abater -{faltaAlloc.saldoResidual} cx</span>
                                  <button
                                    type="button"
                                    onClick={() => handleEqualizeFaltaExact(pair.id)}
                                    className="text-[9px] underline font-black text-blue-800 hover:text-blue-950 cursor-pointer"
                                    title="Ajustar quantidade deste par para abater exatamente a falta fiscal apurada"
                                  >
                                    [Igualar]
                                  </button>
                                </span>
                              )}
                              {faltaAlloc?.status === 'EXCEDENTE' && (
                                <span className="text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span>⚠️ Excede falta em +{faltaAlloc.excedente} cx</span>
                                  <button
                                    type="button"
                                    onClick={() => handleEqualizeFaltaExact(pair.id)}
                                    className="text-[9px] underline font-black text-rose-900 hover:text-rose-950 cursor-pointer"
                                    title="Corrigir quantidade para não ultrapassar a falta apurada"
                                  >
                                    [Corrigir]
                                  </button>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenManualEditItem(pair.id, 'FALTA')}
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer font-medium ml-auto"
                                title="Editar descrição ou valores de Saída"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center font-mono">
                            <QuantityStepperCell
                              value={qtdSaidaSkus}
                              onChange={(val) => handleChangeQuantitySaida(pair.id, val)}
                              variant="rose"
                              title="Editar quantidade de Saída (Falta Fiscal)"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-rose-800 text-xs sm:text-[13px]">
                            {formatCurrency(pair.valorSaida)}
                          </td>

                          <td className="py-3 px-3 text-center bg-slate-950 font-mono font-black">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`text-xs sm:text-[13px] ${
                                pair.diferencaValor > 0 ? 'text-emerald-400' : pair.diferencaValor < 0 ? 'text-rose-400' : 'text-slate-300'
                              }`}>
                                {formatCurrency(pair.diferencaValor)}
                              </span>
                              {pair.quantidadeInversaoSkus !== qtdSaidaSkus && (
                                <span className="text-[10px] font-sans font-bold text-amber-300/90 mt-0.5 tracking-tight" title={`Proporção livre definida pelo analista: ${pair.quantidadeInversaoSkus} cx entrada vs ${qtdSaidaSkus} cx saída`}>
                                  {pair.quantidadeInversaoSkus} cx ⟷ {qtdSaidaSkus} cx
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center bg-slate-950">
                            <span
                              className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-black font-mono border ${getCompatBadgeStyle(compatScore)}`}
                              title={pair.justificativa || `Grau de compatibilidade: ${compatScore}%`}
                            >
                              {compatScore}%
                            </span>
                          </td>

                          <td className="py-3 px-2 text-center bg-slate-950">
                            <div className="flex items-center justify-center gap-1">
                              {pair.razaoConversao && pair.razaoConversao !== 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleSyncRatioSaida(pair.id)}
                                  className="text-slate-400 hover:text-amber-400 p-1 transition cursor-pointer rounded hover:bg-slate-900"
                                  title={`Sincronizar saída conforme proporção de embalagem (${pair.proporcaoLabel || '1:' + pair.razaoConversao})`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeletePair(pair.id)}
                                className="text-slate-400 hover:text-rose-400 p-1.5 transition cursor-pointer rounded hover:bg-slate-900"
                                title="Remover par da lista"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* MODO CARDS DETALHADOS */
            <div className="space-y-4">
              {paresFiltrados.map((pair, idx) => {
                const qtdSaidaSkus = pair.quantidadeSaidaSkus ?? calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, pair.quantidadeInversaoSkus);
                const sobraResidual = Math.max(0, pair.sobraDisponivelSkus - pair.quantidadeInversaoSkus);
                const faltaResidual = Math.max(0, pair.faltaApuradaSkus - qtdSaidaSkus);

                return (
                <div 
                  key={pair.id}
                  className={`bg-white border rounded-2xl transition-all duration-200 shadow-xs overflow-hidden ${
                    justUpdatedPairId === pair.id
                      ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-md animate-pulse'
                      : pair.selected 
                        ? 'border-blue-300 ring-2 ring-blue-500/10' 
                        : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pair.selected}
                          onChange={() => handleToggleSelectPair(pair.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span className="text-xs font-black text-slate-800">
                          PAR #{idx + 1}
                        </span>
                      </label>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {pair.grupo}
                      </span>

                      {/* Badge de Compatibilidade Analítica */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 shadow-2xs ${
                        (pair.compatibilidadeScore ?? 0) >= 95 
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                          : (pair.compatibilidadeScore ?? 0) >= 85
                            ? 'bg-cyan-100 text-cyan-950 border-cyan-300'
                            : (pair.compatibilidadeScore ?? 0) >= 70
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : (pair.compatibilidadeScore ?? 0) >= 50
                                ? 'bg-purple-100 text-purple-950 border-purple-300'
                                : 'bg-rose-100 text-rose-950 border-rose-300'
                      }`} title={pair.justificativa || `Grau de compatibilidade: ${pair.compatibilidadeScore ?? 0}%`}>
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{pair.compatibilidadeScore ?? 0}%</span>
                      </span>

                      <span className="text-xs text-slate-400 font-mono">
                        Depósito: <strong className="text-slate-700">{pair.deposito}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-medium">
                        Impacto Líquido: 
                        <strong className={`ml-1.5 font-mono font-bold ${
                          pair.diferencaValor >= 0 ? 'text-teal-700' : 'text-rose-700'
                        }`}>
                          {formatCurrency(pair.diferencaValor)}
                        </strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeletePair(pair.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Excluir este par de inversão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* ENTRADA (SOBRA) */}
                    <div className="lg:col-span-5 bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                          <TrendingUp className="w-3 h-3" />
                          Entrada (Sobra Física)
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            SKU {pair.sobraSku}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleOpenAlternarModal(pair.id, 'SOBRA', pair.sobraSku, idx + 1)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            title="Clique na setinha / auditoria para verificar sobras da conciliação e alternar item"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Auditoria</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenManualEditItem(pair.id, 'SOBRA')}
                            className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 transition cursor-pointer shadow-xs"
                            title="Editar manualmente este item de Entrada"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border border-emerald-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {pair.sobraDescricao}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <span>Sobra Apurada: <strong className="text-emerald-700 font-mono font-bold">+{pair.sobraDisponivelSkus} cx</strong> ({pair.sobraDisponivelUnits} un)</span>
                          <span>Preço: <strong className="text-slate-800 font-mono">{formatCurrency(pair.sobraValorUnitario)}/un</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-950 bg-emerald-100/70 border border-emerald-300 p-2 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-bold">Qtde. Entrada (Sobra):</span>
                          <span className="text-[10px] text-emerald-700 font-mono">{pair.quantidadeInversaoUnits} un equalizadas</span>
                        </div>
                        <QuantityStepperCell
                          value={pair.quantidadeInversaoSkus}
                          onChange={(val) => handleChangeQuantitySobra(pair.id, val)}
                          variant="emerald"
                          title="Ajustar quantidade de Entrada (Sobra Física)"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 bg-emerald-100/50 p-2 rounded-lg">
                        <span>Valor Entrando no Fiscal:</span>
                        <span className="font-mono font-black text-sm text-emerald-700">
                          {formatCurrency(pair.valorEntrada)}
                        </span>
                      </div>
                    </div>

                    {/* CENTRO: RESUMO ANALÍTICO DE QUANTIDADES E BALANÇO */}
                    <div className="lg:col-span-2 flex flex-col items-center justify-center p-2 text-center space-y-2">
                      <span className="text-[11px] font-black uppercase text-slate-500">
                        Balanço da Operação
                      </span>

                      <div className="bg-slate-100 border border-slate-300 rounded-xl p-2 w-full space-y-1 text-center shadow-2xs font-mono">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                          <span className="text-emerald-700 font-black">+{pair.quantidadeInversaoSkus} cx</span>
                          <span className="text-slate-400">⟷</span>
                          <span className="text-rose-700 font-black">-{qtdSaidaSkus} cx</span>
                        </div>
                        {pair.quantidadeInversaoSkus !== qtdSaidaSkus && (
                          <div className="text-[10px] font-sans font-bold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5" title="Alteração livre definida pelo analista">
                            Livre ({pair.quantidadeInversaoSkus} x {qtdSaidaSkus})
                          </div>
                        )}
                        {pair.razaoConversao && pair.razaoConversao !== 1 && (
                          <button
                            type="button"
                            onClick={() => handleSyncRatioSaida(pair.id)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 underline font-sans block w-full mt-1 cursor-pointer font-bold"
                            title="Sincronizar saída conforme proporção de embalagem"
                          >
                            Sincronizar pela Razão
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] font-black font-mono">
                        <span className={pair.diferencaValor > 0 ? 'text-emerald-700' : pair.diferencaValor < 0 ? 'text-rose-700' : 'text-slate-600'}>
                          Dif: {formatCurrency(pair.diferencaValor)}
                        </span>
                      </div>
                    </div>

                    {/* SAÍDA (FALTA) */}
                    <div className="lg:col-span-5 bg-rose-50/40 border border-rose-200/80 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shadow-2xs">
                          <TrendingDown className="w-3 h-3" />
                          Saída (Falta Fiscal)
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-rose-800 bg-rose-100/70 px-2 py-0.5 rounded-md">
                            SKU {pair.faltaSku}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleOpenAlternarModal(pair.id, 'FALTA', pair.faltaSku, idx + 1)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            title="Clique na setinha / auditoria para verificar faltas da conciliação e alternar item"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-200" />
                            <span>Auditoria</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenManualEditItem(pair.id, 'FALTA')}
                            className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 transition cursor-pointer shadow-xs"
                            title="Editar manualmente este item de Saída"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border border-rose-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {pair.faltaDescricao}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <span>Falta Apurada: <strong className="text-rose-700 font-mono font-bold">-{pair.faltaApuradaSkus} cx</strong> ({pair.faltaApuradaUnits} un)</span>
                          <span>Preço: <strong className="text-slate-800 font-mono">{formatCurrency(pair.faltaValorUnitario)}/un</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-rose-950 bg-rose-100/70 border border-rose-300 p-2 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-bold">Qtde. Saída (Falta):</span>
                          <span className="text-[10px] text-rose-700 font-mono">{(qtdSaidaSkus * Math.max(1, pair.faltaFatorSku || 1))} un equalizadas</span>
                        </div>
                        <QuantityStepperCell
                          value={qtdSaidaSkus}
                          onChange={(val) => handleChangeQuantitySaida(pair.id, val)}
                          variant="rose"
                          title="Ajustar quantidade de Saída (Falta Fiscal)"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-rose-900 bg-rose-100/50 p-2 rounded-lg">
                        <span>Valor Baixando do Fiscal:</span>
                        <span className="font-mono font-black text-sm text-rose-700">
                          {formatCurrency(pair.valorSaida)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Card com Resíduos e Justificativa */}
                  <div className="px-4 py-2 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-slate-500">
                      <span>Sobra Residual pós-inversão: <strong className="text-emerald-700 font-mono font-bold">+{sobraResidual} cx</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Falta Residual pós-inversão: <strong className="text-rose-700 font-mono font-bold">-{faltaResidual} cx</strong></span>
                    </div>

                    <div className="text-slate-600 text-[11px] font-medium italic">
                      {pair.justificativa}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
        </InversaoErrorBoundary>
      )}

      {/* ========================================================================= */}
      {/* BALÃO / MODAL DE AUDITORIA & COERÊNCIA (100% CONCILIADO)                  */}
      {/* ========================================================================= */}
      {isAuditModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={() => setIsAuditModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Balão com o ícone oficial de auditoria */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-bold shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Guia de Auditoria e Coerência de Estoque
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                      100% Conciliado
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Relação completa de todos os produtos com divergência física ou fiscal (02.05.02), status de equalização e sugestão de parceiro mais compatível.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Painel com Métricas de Conciliação Rápida */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500">Sobras Físicas Apuradas</div>
                <div className="text-sm sm:text-base font-black text-emerald-700 font-mono mt-0.5">
                  +{auditSummary.totalSobrasApuradasSkus} cx
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(auditSummary.totalSobrasApuradasValor)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500">Faltas Fiscais Apuradas</div>
                <div className="text-sm sm:text-base font-black text-rose-700 font-mono mt-0.5">
                  -{auditSummary.totalFaltasApuradasSkus} cx
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {formatCurrency(auditSummary.totalFaltasApuradasValor)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500">Taxa de Equalização</div>
                <div className="text-sm sm:text-base font-black text-blue-700 font-mono mt-0.5">
                  {auditSummary.taxaEqualizacaoSobras.toFixed(1)}%
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">
                  {auditSummary.totalSobrasInvertidasSkus} cx equalizadas
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500">Residual Pós-Inversão</div>
                <div className="text-xs sm:text-sm font-black text-slate-800 font-mono mt-0.5">
                  +{auditSummary.totalSobrasResiduaisSkus} / -{auditSummary.totalFaltasResiduaisSkus} cx
                </div>
                <div className="text-[10px] text-slate-500">
                  Saldo pendente sem par
                </div>
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filtros da Auditoria */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuditTab('TODOS')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    auditTab === 'TODOS' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({todasSobrasDisponiveis.length + todasFaltasDisponiveis.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('SOBRAS')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    auditTab === 'SOBRAS' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sobras Físicas ({todasSobrasDisponiveis.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('FALTAS')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    auditTab === 'FALTAS' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Faltas Fiscais ({todasFaltasDisponiveis.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('PENDENTES')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    auditTab === 'PENDENTES' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pendentes de Par
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('EQUALIZADOS')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    auditTab === 'EQUALIZADOS' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  100% Equalizados
                </button>
              </div>

              {/* Busca */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Pesquisar produto ou código SKU..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Tabela de Itens da Auditoria */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                  <tr className="text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">CÓD. SKU</th>
                    <th className="py-2.5 px-3">PRODUTO</th>
                    <th className="py-2.5 px-3">GRUPO & EMBALAGEM</th>
                    <th className="py-2.5 px-2 text-center">DEP</th>
                    <th className="py-2.5 px-3 text-right">APURAÇÃO (SKU/UN)</th>
                    <th className="py-2.5 px-3 text-right">VALOR UNIT.</th>
                    <th className="py-2.5 px-3 text-center">STATUS DE AUDITORIA</th>
                    <th className="py-2.5 px-3 text-right">ALOCADO / RESIDUAL</th>
                    <th className="py-2.5 px-3">MAIS COMPATÍVEL RECOMENDADO</th>
                    <th className="py-2.5 px-3 text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {auditItemsFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        Nenhum item localizado com os critérios de filtro.
                      </td>
                    </tr>
                  ) : (
                    auditItemsFiltered.map(item => {
                      const isSobra = item.tipo === 'SOBRA';
                      const topMatch = item.melhorCandidatoInversao;

                      return (
                        <tr key={`${item.deposito}-${item.sku}`} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs truncate" title={item.descricao}>
                            {item.descricao}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold">
                              {item.grupo}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                            {item.deposito}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-black ${
                            isSobra ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isSobra ? '+' : '-'}{item.saldoSkus} cx ({item.saldoRaw || `${item.saldoUnits} un`})
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(item.valorUnitario)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.statusAuditoria === 'TOTALMENTE_EQUALIZADO' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ 100% Equalizado
                              </span>
                            ) : item.statusAuditoria === 'PARCIALMENTE_EQUALIZADO' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                Parcial ({item.alocadoSkus}/{item.saldoSkus} cx)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs">
                            <span className="text-blue-700 font-bold">{item.alocadoSkus || 0} cx alocadas</span>
                            <span className="text-slate-400 block text-[10px]">
                              Residual: {item.saldoResidualSkus || item.saldoSkus} cx
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            {topMatch ? (
                              <div>
                                <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                    topMatch.score >= 95 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                  }`}>
                                    {topMatch.score}%
                                  </span>
                                  <span className="font-mono text-slate-900">SKU {topMatch.sku}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate" title={topMatch.motivo}>
                                  {topMatch.descricao}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Sem parceiro disponível</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAuditModalOpen(false);
                                if (isSobra) {
                                  handleOpenNewPairModal(item, undefined);
                                } else {
                                  handleOpenNewPairModal(undefined, item);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center gap-1 mx-auto"
                              title="Adicionar chamada de inversão com este item"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Inverter</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Mostrando <strong className="font-mono text-slate-900">{auditItemsFiltered.length}</strong> itens apurados na conciliação.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition cursor-pointer"
              >
                Fechar Guia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ITENS COM SALDO RESIDUAL LIVRE                                      */}
      {/* ========================================================================= */}
      {activeMainTab === 'LIVRES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sobras com Saldo Livre */}
          <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Sobras Físicas com Saldo Residual Livre ({sobrasSemPar.length})
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700">
                {sobrasSemPar.reduce((sum, s) => sum + (s.saldoResidualSkus || s.saldoSkus), 0)} caixas disponíveis
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {sobrasSemPar.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Todas as sobras físicas foram 100% equalizadas no plano de inversão!
                </div>
              ) : (
                sobrasSemPar.map(sobra => (
                  <div key={`${sobra.deposito}-${sobra.sku}`} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                        <span className="font-mono bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                          {sobra.sku}
                        </span>
                        <span>{sobra.descricao}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Saldo Livre: <strong className="text-emerald-700 font-mono font-bold">+{sobra.saldoResidualSkus || sobra.saldoSkus} cx</strong> ({formatCurrency(sobra.valorUnitario * (sobra.saldoResidualUnits || sobra.saldoUnits))})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenNewPairModal(sobra, undefined)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition cursor-pointer"
                    >
                      Inverter
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Faltas com Saldo Livre */}
          <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Faltas Fiscais com Saldo Residual Pendente ({faltasSemPar.length})
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-rose-700">
                {faltasSemPar.reduce((sum, f) => sum + (f.saldoResidualSkus || f.saldoSkus), 0)} caixas pendentes
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {faltasSemPar.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Todas as faltas fiscais foram 100% amortizadas no plano de inversão!
                </div>
              ) : (
                faltasSemPar.map(falta => (
                  <div key={`${falta.deposito}-${falta.sku}`} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                        <span className="font-mono bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded text-[10px]">
                          {falta.sku}
                        </span>
                        <span>{falta.descricao}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Saldo Pendente: <strong className="text-rose-700 font-mono font-bold">-{falta.saldoResidualSkus || falta.saldoSkus} cx</strong> ({formatCurrency(falta.valorUnitario * (falta.saldoResidualUnits || falta.saldoUnits))})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenNewPairModal(undefined, falta)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                    >
                      Inverter
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATUALIZAÇÃO SELETIVA DE VALORES DE PRODUTOS                         */}
      {/* ========================================================================= */}
      {isPriceUpdateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Atualização Seletiva de Valores de Itens
                  </h3>
                  <p className="text-xs text-slate-600">
                    Atualize apenas os produtos informados. Todos os demais permanecem 100% preservados com os valores cadastrados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPriceUpdateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Preservação Integral Garantida:</strong> Apenas os SKUs inseridos na tabela abaixo terão seus valores (unitário ou caixa) atualizados. Os demais produtos já cadastrados no sistema continuarão exatamente com os preços atuais intactos.
                </div>
              </div>

              {/* Botões de inserção */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700">
                  Cole os dados da planilha ou selecione o arquivo:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.xlsx,.xls,.txt"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Carregar Arquivo (.xlsx / .csv)</span>
                  </button>
                </div>
              </div>

              {/* Textarea para colar */}
              <div>
                <textarea
                  value={priceUpdateText}
                  onChange={(e) => handleParsePriceUpdateText(e.target.value)}
                  placeholder={`Cole aqui os dados da tabela (exemplo):\nCódigo;Descrição;VALOR UNIT\n9068;SKOL LATA 350ML;2,38\n34608;SKOL MULTIPACK 350ML;3,25\n2319;GUARANA PET 1L;2,85`}
                  rows={6}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-800"
                />
              </div>

              {priceUpdateError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                  {priceUpdateError}
                </div>
              )}

              {/* Pré-visualização dos Itens Identificados */}
              {priceUpdatePreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Itens identificados para atualização ({priceUpdatePreview.length} produtos):
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {priceUpdatePreview.filter(p => p.oldPriceUnit !== p.newPriceUnit).length} com alteração de preço
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-1.5 px-3">SKU</th>
                          <th className="py-1.5 px-3">Descrição</th>
                          <th className="py-1.5 px-3 text-right">Preço Atual</th>
                          <th className="py-1.5 px-3 text-right">Novo Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {priceUpdatePreview.map(p => (
                          <tr key={p.sku} className="hover:bg-amber-50/40">
                            <td className="py-1.5 px-3 font-bold text-slate-900">{p.sku}</td>
                            <td className="py-1.5 px-3 font-sans truncate max-w-xs">{p.descricao}</td>
                            <td className="py-1.5 px-3 text-right text-slate-400">{formatCurrency(p.oldPriceUnit)}</td>
                            <td className="py-1.5 px-3 text-right font-bold text-amber-700">{formatCurrency(p.newPriceUnit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Demais {Math.max(0, (productsMap?.size || 0) - priceUpdatePreview.length)} produtos cadastrados permanecerão inalterados.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriceUpdateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPriceUpdates}
                  disabled={priceUpdatePreview.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  Confirmar e Atualizar Preços ({priceUpdatePreview.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUDITORIA DE SOBRAS E FALTAS DA CONCILIAÇÃO (ESCOLHA ATRAVÉS DA AUDITORIA) */}
      {alternarModal && (() => {
        const targetPair = pares.find(p => p.id === alternarModal.pairId);
        const isSobra = alternarModal.tipo === 'SOBRA';
        const counterpartSku = isSobra ? targetPair?.faltaSku : targetPair?.sobraSku;
        const counterpartDesc = isSobra ? targetPair?.faltaDescricao : targetPair?.sobraDescricao;
        const counterpartDep = targetPair?.deposito;

        // Item virtual da ponta oposta para teste de afinidade em tempo real
        const counterpartStockItem: InversaoStockItem | null = targetPair ? (
          isSobra ? {
            sku: targetPair.faltaSku,
            descricao: targetPair.faltaDescricao,
            grupo: targetPair.grupo,
            deposito: targetPair.deposito,
            fatorSku: targetPair.faltaFatorSku,
            fatorHl: targetPair.faltaFatorHl,
            valorUnitario: targetPair.faltaValorUnitario,
            valorCaixa: targetPair.faltaValorUnitario * targetPair.faltaFatorSku,
            saldoSkus: targetPair.faltaApuradaSkus,
            saldoUnits: targetPair.faltaApuradaUnits,
            saldoRaw: '',
            valorTotal: targetPair.faltaApuradaUnits * targetPair.faltaValorUnitario,
            tipo: 'FALTA'
          } : {
            sku: targetPair.sobraSku,
            descricao: targetPair.sobraDescricao,
            grupo: targetPair.grupo,
            deposito: targetPair.deposito,
            fatorSku: targetPair.sobraFatorSku,
            fatorHl: targetPair.sobraFatorHl,
            valorUnitario: targetPair.sobraValorUnitario,
            valorCaixa: targetPair.sobraValorUnitario * targetPair.sobraFatorSku,
            saldoSkus: targetPair.sobraDisponivelSkus,
            saldoUnits: targetPair.sobraDisponivelUnits,
            saldoRaw: '',
            valorTotal: targetPair.sobraDisponivelUnits * targetPair.sobraValorUnitario,
            tipo: 'SOBRA'
          }
        ) : null;

        const baseList = alternarModalTab === 'SOBRAS'
          ? todasSobrasDisponiveis
          : alternarModalTab === 'FALTAS'
            ? todasFaltasDisponiveis
            : [...todasSobrasDisponiveis, ...todasFaltasDisponiveis];

        const filteredModalItems = baseList.filter(item => {
          if (alternarDepFilter === 'PAR' && targetPair && item.deposito !== targetPair.deposito) {
            return false;
          }
          if (item.sku === alternarModal.currentSku) return false;
          if (!alternarSearch.trim()) return true;
          const q = alternarSearch.toLowerCase();
          return (
            item.sku.toLowerCase().includes(q) ||
            item.descricao.toLowerCase().includes(q) ||
            item.grupo.toLowerCase().includes(q) ||
            (item.marca && item.marca.toLowerCase().includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Cabeçalho com o mesmo ícone oficial de auditoria */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-bold shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                        Auditoria de Sobras e Faltas (Conciliação 02.05.02)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                        100% Conciliado
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Verifique o saldo real apurado de sobras e faltas no estoque e escolha o item através da auditoria.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAlternarModal(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Faixa de Contexto do Par */}
              <div className="p-3 bg-amber-50/80 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    Par #{alternarModal.pairIndex}:
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black ${
                    isSobra ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {isSobra ? 'Substituindo Item de Entrada (Sobra Física)' : 'Substituindo Item de Saída (Falta Fiscal)'}
                  </span>
                  <span className="text-slate-500 font-mono">
                    Atual: SKU {alternarModal.currentSku}
                  </span>
                </div>

                {counterpartSku && (
                  <div className="text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-amber-200 text-[11px]">
                    <span className="text-slate-500">Pareando contra {isSobra ? 'Saída (Falta)' : 'Entrada (Sobra)'}:</span>{' '}
                    <strong className="text-slate-900 font-mono">SKU {counterpartSku}</strong> - <span className="font-semibold">{counterpartDesc}</span> (Dep. {counterpartDep})
                  </div>
                )}
              </div>

              {/* Barra de Ferramentas da Auditoria: Abas + Busca + Filtro Depósito */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Abas da Auditoria */}
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-2xs text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAlternarModalTab('SOBRAS')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      alternarModalTab === 'SOBRAS'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Sobras Físicas (+{todasSobrasDisponiveis.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlternarModalTab('FALTAS')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      alternarModalTab === 'FALTAS'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Faltas Fiscais (-{todasFaltasDisponiveis.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlternarModalTab('TODOS')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      alternarModalTab === 'TODOS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Todas Divergências ({todasSobrasDisponiveis.length + todasFaltasDisponiveis.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-md">
                  {/* Filtro Depósito */}
                  {targetPair && (
                    <button
                      type="button"
                      onClick={() => setAlternarDepFilter(prev => prev === 'PAR' ? 'ALL' : 'PAR')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                        alternarDepFilter === 'PAR'
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                      title="Alternar entre itens do mesmo depósito ou todos"
                    >
                      <Building2 className="w-3 h-3" />
                      <span>{alternarDepFilter === 'PAR' ? `Dep. ${targetPair.deposito}` : 'Todos Deps'}</span>
                    </button>
                  )}

                  {/* Campo de Busca */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={alternarSearch}
                      onChange={(e) => setAlternarSearch(e.target.value)}
                      placeholder="Pesquisar SKU, produto, grupo, embalagem..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Tabela de Auditoria para Seleção */}
              <div className="overflow-y-auto overflow-x-auto flex-1 p-2 sm:p-4">
                {filteredModalItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Nenhum item localizado na conciliação com os critérios informados.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="py-2 px-2.5">CÓD. SKU</th>
                        <th className="py-2 px-2.5">PRODUTO</th>
                        <th className="py-2 px-2">DEP</th>
                        <th className="py-2 px-2.5 text-right">APURAÇÃO (SKU/UN)</th>
                        <th className="py-2 px-2.5 text-right">RESIDUAL LIVRE</th>
                        <th className="py-2 px-2.5 text-center">STATUS</th>
                        <th className="py-2 px-2.5 text-right">PREÇO UNIT.</th>
                        <th className="py-2 px-2.5 text-center">% COMPATIBILIDADE</th>
                        <th className="py-2 px-2.5 text-center">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModalItems.map(item => {
                        const itemIsSobra = item.tipo === 'SOBRA';
                        
                        // Cálculo de compatibilidade em tempo real com o parceiro
                        const compat = counterpartStockItem 
                          ? (itemIsSobra
                              ? calculateProductCompatibility(item, counterpartStockItem)
                              : calculateProductCompatibility(counterpartStockItem, item))
                          : null;

                        const isCompatibleRole = (isSobra && itemIsSobra) || (!isSobra && !itemIsSobra);

                        return (
                          <tr key={`${item.deposito}-${item.sku}`} className="hover:bg-amber-50/40 transition">
                            <td className="py-2.5 px-2.5 font-mono font-black text-slate-900">
                              {item.sku}
                            </td>

                            <td className="py-2.5 px-2.5 font-semibold text-slate-800 max-w-xs">
                              <div className="truncate" title={item.descricao}>
                                {item.descricao}
                              </div>
                              <div className="text-[10px] text-slate-500 font-normal">
                                {item.grupo}
                              </div>
                            </td>

                            <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                              {item.deposito}
                            </td>

                            <td className={`py-2.5 px-2.5 text-right font-mono font-black ${
                              itemIsSobra ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {itemIsSobra ? '+' : '-'}{item.saldoSkus} cx
                              <span className="block text-[10px] font-normal text-slate-500 font-mono">
                                ({item.saldoRaw || `${item.saldoUnits} un`})
                              </span>
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 font-bold">
                              {item.saldoResidualSkus ?? item.saldoSkus} cx
                            </td>

                            <td className="py-2.5 px-2.5 text-center">
                              {item.statusAuditoria === 'TOTALMENTE_EQUALIZADO' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  100% Equalizado
                                </span>
                              ) : item.statusAuditoria === 'PARCIALMENTE_EQUALIZADO' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                  Parcial
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  Pendente
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 text-[11px]">
                              {formatCurrency(item.valorUnitario)}
                            </td>

                            <td className="py-2.5 px-2.5 text-center">
                              {compat ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black inline-block ${
                                  compat.score >= 95
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : compat.score >= 85
                                      ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                      : compat.score >= 60
                                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                                }`} title={compat.motivo}>
                                  {compat.score}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Auditado</span>
                              )}
                            </td>

                            <td className="py-2.5 px-2.5 text-center">
                              {isCompatibleRole ? (
                                <button
                                  type="button"
                                  onClick={() => handleSelectAlternarItem(item)}
                                  className="px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center gap-1 mx-auto bg-blue-600 hover:bg-blue-700 text-white"
                                  title="Escolher este item da conciliação para compor o par com 100% de coerência"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Escolher</span>
                                </button>
                              ) : (
                                <span 
                                  className="px-2 py-1 rounded text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 inline-block cursor-not-allowed select-none"
                                  title={isSobra ? "Item apurado como Falta Fiscal na conciliação. Não pode entrar na coluna de Sobra." : "Item apurado como Sobra Física na conciliação. Não pode sair na coluna de Falta."}
                                >
                                  {isSobra ? "Falta Fiscal" : "Sobra Física"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Rodapé do Modal com Informações Rápidas */}
              <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    Mostrando <strong className="font-mono text-slate-900">{filteredModalItems.length}</strong> itens apurados na conciliação.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAlternarModal(null)}
                  className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-200 font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: CONFLITO DE PRODUTO DUPLICADO */}
      {conflictConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Produto já participante de outro par
                </h3>
                <p className="text-xs text-slate-500">
                  SKU {conflictConfirmation.selectedItem.sku} já está no Par #{conflictConfirmation.conflictingPairIndex}.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Deseja utilizar este SKU também neste chamado ou substituir?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictConfirmation(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleApplyAlternar(conflictConfirmation.targetPairId, conflictConfirmation.tipo, conflictConfirmation.selectedItem, conflictConfirmation.targetPairIndex)}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg cursor-pointer shadow-xs"
              >
                Confirmar e Inverter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PAR LIVRE */}
      {isNewPairModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">
                  Incluir Par de Inversão Manual
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPairModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Depósito</label>
                <select
                  value={newPairDeposito}
                  onChange={(e) => setNewPairDeposito(e.target.value as DepositoId)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {DEPOSITOS.map(d => (
                    <option key={d.id} value={d.id}>Depósito {d.id} - {d.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">Produto de Entrada (Sobra)</label>
                <select
                  value={newPairSobraSku}
                  onChange={(e) => setNewPairSobraSku(e.target.value)}
                  className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="">Selecione uma sobra...</option>
                  {todasSobrasDisponiveis
                    .filter(s => s.deposito === newPairDeposito)
                    .map(s => (
                      <option key={s.sku} value={s.sku}>
                        {s.sku} - {s.descricao} (+{s.saldoSkus} cx)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-800 mb-1">Produto de Saída (Falta)</label>
                <select
                  value={newPairFaltaSku}
                  onChange={(e) => setNewPairFaltaSku(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="">Selecione uma falta...</option>
                  {todasFaltasDisponiveis
                    .filter(f => f.deposito === newPairDeposito)
                    .map(f => (
                      <option key={f.sku} value={f.sku}>
                        {f.sku} - {f.descricao} (-{f.saldoSkus} cx)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantidade em Caixas / SKUs</label>
                <input
                  type="number"
                  min={0}
                  value={newPairQtd === 0 ? '' : newPairQtd}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setNewPairQtd(raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0));
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    if (newPairQtd <= 0) setNewPairQtd(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Justificativa Operacional (Opcional)</label>
                <input
                  type="text"
                  value={newPairJustificativa}
                  onChange={(e) => setNewPairJustificativa(e.target.value)}
                  placeholder="Ex: Inversão autorizada pela supervisão de estoque"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewPairModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewPair}
                disabled={!newPairSobraSku || !newPairFaltaSku}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50"
              >
                Adicionar Par ao Chamado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO MANUAL DE ITEM (ENTRADA OU SAÍDA) */}
      {manualEditItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className={`p-4 text-white flex items-center justify-between ${
              manualEditItemModal.tipo === 'SOBRA'
                ? 'bg-emerald-700'
                : 'bg-rose-700'
            }`}>
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Editar {manualEditItemModal.tipo === 'SOBRA' ? 'Entrada (Sobra Física)' : 'Saída (Falta Fiscal)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualEditItemModal(null)}
                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Selecionar Outro Item da Conciliação</span>
                  <span className="text-[10px] text-blue-600 font-semibold">Preenchimento automático</span>
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const selSku = e.target.value;
                    if (!selSku) return;
                    const pool = manualEditItemModal.tipo === 'SOBRA' ? todasSobrasDisponiveis : todasFaltasDisponiveis;
                    const found = pool.find(item => item.sku === selSku) || [...todasSobrasDisponiveis, ...todasFaltasDisponiveis].find(item => item.sku === selSku);
                    const master = productsMap?.get(selSku);
                    const desc = found?.descricao || master?.descricao || '';
                    const price = (found && found.valorUnitario > 0) ? found.valorUnitario : (master?.valorUnit || manualEditItemModal.valorUnitario);
                    const saldo = found?.saldoSkus ? Math.max(1, found.saldoSkus) : manualEditItemModal.quantidade;
                    setManualEditItemModal({
                      ...manualEditItemModal,
                      sku: selSku,
                      descricao: desc || manualEditItemModal.descricao,
                      valorUnitario: price > 0 ? price : manualEditItemModal.valorUnitario,
                      quantidade: saldo
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-1 cursor-pointer"
                >
                  <option value="">-- Escolha um item para preencher automaticamente --</option>
                  {(manualEditItemModal.tipo === 'SOBRA' ? todasSobrasDisponiveis : todasFaltasDisponiveis).map(item => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} - {item.descricao} ({manualEditItemModal.tipo === 'SOBRA' ? '+' : '-'}{item.saldoSkus} cx | {formatCurrency(item.valorUnitario)})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Ou digite o código SKU e a descrição manualmente abaixo:
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código SKU
                </label>
                <input
                  type="text"
                  value={manualEditItemModal.sku}
                  onChange={(e) => {
                    const newSku = e.target.value;
                    const pool = manualEditItemModal.tipo === 'SOBRA' ? todasSobrasDisponiveis : todasFaltasDisponiveis;
                    const found = pool.find(item => item.sku === newSku.trim()) || [...todasSobrasDisponiveis, ...todasFaltasDisponiveis].find(item => item.sku === newSku.trim());
                    const master = productsMap?.get(newSku.trim());
                    setManualEditItemModal({
                      ...manualEditItemModal,
                      sku: newSku,
                      descricao: found?.descricao || master?.descricao || manualEditItemModal.descricao,
                      valorUnitario: (found && found.valorUnitario > 0) ? found.valorUnitario : (master?.valorUnit || manualEditItemModal.valorUnitario)
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: 32528"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição do Produto
                </label>
                <input
                  type="text"
                  value={manualEditItemModal.descricao}
                  onChange={(e) => setManualEditItemModal({ ...manualEditItemModal, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: PETROPOLIS AGUA MINERAL 500ML"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantidade (Caixas)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualEditItemModal.quantidade === 0 ? '' : manualEditItemModal.quantidade}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setManualEditItemModal({ 
                        ...manualEditItemModal, 
                        quantidade: raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0) 
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      if (!manualEditItemModal.quantidade || manualEditItemModal.quantidade <= 0) {
                        setManualEditItemModal({ ...manualEditItemModal, quantidade: 1 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={manualEditItemModal.valorUnitario}
                    onChange={(e) => setManualEditItemModal({ ...manualEditItemModal, valorUnitario: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                <span>Total Estimado:</span>
                <strong className="font-mono text-sm text-slate-900">
                  {formatCurrency(manualEditItemModal.quantidade * manualEditItemModal.valorUnitario * 1)}
                </strong>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualEditItemModal(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveManualEditItem}
                className={`px-4 py-1.5 rounded-lg text-xs font-black text-white shadow-xs cursor-pointer active:scale-95 ${
                  manualEditItemModal.tipo === 'SOBRA'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULADOR FISCAL MODAL */}
      {isSimuladorModalOpen && (
        <SimuladorFiscalModal
          isOpen={isSimuladorModalOpen}
          onClose={() => setIsSimuladorModalOpen(false)}
          todasSobrasDisponiveis={todasSobrasDisponiveis}
          todasFaltasDisponiveis={todasFaltasDisponiveis}
          onApplySimulation={handleApplySimulation}
        />
      )}
    </div>
  );
};
