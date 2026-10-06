import React, { useState, useEffect } from 'react';
import { 
  ViewTab, 
  DepositoId, 
  ProductMaster, 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem,
  UserAccount,
  FrozenReconciliation
} from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_STOCK_POSITIONS, 
  INITIAL_QUEBRAS, 
  INITIAL_VALES, 
  INITIAL_TROCAS, 
  INITIAL_FALTAS_MAPEADAS,
  DEPOSITOS
} from './data/initialData';
import { QUEBRAS_SETEMBRO_08_12_2026 } from './data/quebrasSetembroData';
import { INITIAL_USERS } from './data/initialUsers';
import { sanitizeAndDeduplicateQuebras, ensureCompleteHistoricalQuebras, EXCLUDED_QUEBRA_IDS } from './utils/quebrasDeduplicator';
import { getSkuUnitMetrics } from './utils/productCatalog';
import { parseDateSafe } from './utils/quebrasReports';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ConciliacaoView } from './components/ConciliacaoView';
import { GradeEstoqueView } from './components/GradeEstoqueView';
import { CongeladasView } from './components/CongeladasView';
import { DifDiariaView } from './components/DifDiariaView';
import { DifMensalView } from './components/DifMensalView';
import { QuebrasView } from './components/QuebrasView';
import { SEED_FROZEN_RECONCILIATIONS } from './data/initialFrozenData';
import { ValesView } from './components/ValesView';
import { TrocasView } from './components/TrocasView';
import { FaltasView } from './components/FaltasView';
import { ProdutosView } from './components/ProdutosView';
import { LoginView } from './components/LoginView';
import { InitialLoginView } from './components/InitialLoginView';
import { InversaoView } from './components/InversaoView';
import { InversaoErrorBoundary } from './components/InversaoErrorBoundary';
import { ManualFaltaModal } from './components/ManualFaltaModal';
import { ManualCongelamentoModal, CongelamentoType } from './components/ManualCongelamentoModal';
import { ImportModal, ImportFileType } from './components/ImportModal';
import { SaveReconciliationModal } from './components/SaveReconciliationModal';
import { formatCurrency, formatHectoliters } from './utils/parsers';
import { exportConciliacaoExcel } from './utils/excelReconciliationExport';
import { auth, onAuthStateChanged } from './firebase';
import { 
  loadStockPositionsFromFirestore,
  loadGradePositionsFromFirestore,
  loadQuebrasFromFirestore,
  loadValesFromFirestore,
  loadTrocasFromFirestore,
  loadFaltasFromFirestore,
  loadFrozenReconciliationsFromFirestore,
  loadUsersFromFirestore,
  loadProductsFromFirestore,
  loadAppSettingsFromFirestore,
  saveStockPositionsToFirestore,
  saveGradePositionsToFirestore,
  saveQuebrasToFirestore,
  saveValesToFirestore,
  saveTrocasToFirestore,
  saveFaltasToFirestore,
  saveFrozenReconciliationToFirestore,
  saveUserToFirestore,
  saveProductsToFirestore,
  saveAppSettingsToFirestore,
  logoutFirebase
} from './services/firebaseSyncService';
import {
  persistData,
  retrieveData,
  retrieveSync,
  removePersistedData,
  safeLocalStorageSet,
  STORAGE_KEYS
} from './utils/persistentStorage';

export default function App() {
  // Navigation and Filters
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [selectedDeposito, setSelectedDeposito] = useState<DepositoId | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('2026-02-01');
  const [endDate, setEndDate] = useState('2026-02-28');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInitialType, setImportInitialType] = useState<ImportFileType>('020502');
  const [importLockedType, setImportLockedType] = useState<ImportFileType | undefined>(undefined);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [isManualFaltaModalOpen, setIsManualFaltaModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isRecountApplied, setIsRecountApplied] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Data States with High-Reliability Persistent Storage (IndexedDB + localStorage)
  const [productsMap, setProductsMap] = useState<Map<string, ProductMaster>>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v3_produtos');
      if (saved) {
        const arr = JSON.parse(saved) as [string, ProductMaster][];
        const merged = new Map(arr);
        INITIAL_PRODUCTS.forEach((prod, sku) => {
          const existing = merged.get(sku);
          if (!existing) {
            merged.set(sku, prod);
          } else {
            merged.set(sku, {
              ...existing,
              valor: prod.valor > 0 ? prod.valor : existing.valor,
              valorUnit: prod.valorUnit > 0 ? prod.valorUnit : existing.valorUnit,
              fatorHl: prod.fatorHl > 0 ? prod.fatorHl : (existing.fatorHl || 0),
              grupo: prod.grupo && prod.grupo !== 'GERAL' ? prod.grupo : (existing.grupo || prod.grupo || 'GERAL'),
              descricao: prod.descricao || existing.descricao,
              embalagem: prod.embalagem || existing.embalagem
            });
          }
        });
        return merged;
      }
    } catch (e) {
      console.error('Error loading products from storage:', e);
    }
    return new Map(INITIAL_PRODUCTS);
  });

  const [stockPositions, setStockPositions] = useState<StockPositionItem[]>(() => {
    try {
      const v4 = retrieveSync<StockPositionItem[]>(STORAGE_KEYS.STOCK_POSITIONS_020502, []);
      if (v4 && v4.length > 0) return v4;
      const v3 = retrieveSync<StockPositionItem[]>(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, []);
      if (v3 && v3.length > 0) return v3;
    } catch (e) {
      console.error('Error loading stock positions:', e);
    }
    return [];
  });

  // Base 02.05.02 INDEPENDENTE E EXCLUSIVA para a Grade de Estoque
  // A Grade de Estoque é a primeira do dia (antes da conciliação física)
  // e NUNCA é sobreposta pelas 02.05.02 importadas posteriormente na conciliação.
  const [gradeStockPositions, setGradeStockPositions] = useState<StockPositionItem[]>(() => {
    try {
      const v4 = retrieveSync<StockPositionItem[]>(STORAGE_KEYS.GRADE_POSITIONS, []);
      if (v4 && v4.length > 0) return v4;
      const v3 = retrieveSync<StockPositionItem[]>(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, []);
      if (v3 && v3.length > 0) return v3;
      // Fallback inicial: se a grade ainda não tiver sua 02.05.02 própria mas houver posições na conciliação
      const regular = retrieveSync<StockPositionItem[]>(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, []);
      if (regular && regular.length > 0) return regular;
    } catch (e) {
      console.error('Error loading grade stock positions:', e);
    }
    return [];
  });

  // Função auxiliar para garantir a regra Ambev: datas anteriores a 31/08/2026 são faturadas (não amortizam)
  const markHistoricalQuebrasAsBilled = (items: QuebraItem[]): QuebraItem[] => {
    return items.map(q => {
      if (q.data) {
        const dt = parseDateSafe(q.data);
        if (dt && dt < new Date(2026, 7, 31)) {
          return {
            ...q,
            faturado: true,
            dataFaturamento: q.dataFaturamento || '30/08/2026'
          };
        }
      }
      return q;
    });
  };

  const [quebras, setQuebras] = useState<QuebraItem[]>(() => {
    try {
      // 1. Prioriza a base higienizada e auditada v4
      const savedV4 = localStorage.getItem('gestao_estoque_v4_quebras');
      let baseList: QuebraItem[] = INITIAL_QUEBRAS;

      if (savedV4) {
        const parsed = JSON.parse(savedV4);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasDreRaw = parsed.some((q: QuebraItem) => q.id?.startsWith('q-raw-') || q.data === '22/06/2026');
          if (hasDreRaw && parsed.length >= INITIAL_QUEBRAS.length * 0.8) {
            baseList = parsed;
          } else {
            const filteredOld = parsed.filter((q: QuebraItem) => !q.id?.startsWith('q-jul-') && q.id !== 'q-sem-2906' && q.id !== 'q-sem-2306');
            const existingIds = new Set(filteredOld.map((q: QuebraItem) => q.id));
            const missingFromInitial = INITIAL_QUEBRAS.filter(q => !existingIds.has(q.id));
            baseList = [...filteredOld, ...missingFromInitial];
          }
        }
      } else {
        const savedV3 = localStorage.getItem('gestao_estoque_v3_quebras');
        if (savedV3) {
          const parsedV3 = JSON.parse(savedV3);
          if (Array.isArray(parsedV3) && parsedV3.length > 0) {
            baseList = parsedV3;
          }
          localStorage.removeItem('gestao_estoque_v3_quebras');
        }
      }

      // Garante integridade absoluta do histórico completo + nova semana 08/09 a 12/09
      const completeData = ensureCompleteHistoricalQuebras(baseList);
      const { cleaned } = sanitizeAndDeduplicateQuebras(completeData);
      const billedCleaned = markHistoricalQuebrasAsBilled(cleaned);

      safeLocalStorageSet('gestao_estoque_v4_quebras', JSON.stringify(billedCleaned));
      safeLocalStorageSet('gestao_estoque_v4_initialized', 'true');

      persistData(STORAGE_KEYS.QUEBRAS, billedCleaned).catch(() => {});

      return billedCleaned;
    } catch (e) {
      console.error('Error loading quebras:', e);
      return markHistoricalQuebrasAsBilled(INITIAL_QUEBRAS);
    }
  });

  const [vales, setVales] = useState<ValeItem[]>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v3_vales');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading vales:', e);
    }
    return INITIAL_VALES;
  });

  const [trocas, setTrocas] = useState<TrocaItem[]>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v5_trocas_doc');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize trocas to ensure sku, motivo, and faturado status are preserved
          return parsed.map((t: TrocaItem) => ({
            ...t,
            sku: t.sku || t.codigos,
            motivo: t.motivo || t.motivoDeclarado || 'Produto Avariado',
          }));
        }
      }
    } catch (e) {
      console.error('Error loading trocas:', e);
    }
    // Clean older caches and initialize with new 118-item base
    try {
      localStorage.removeItem('gestao_estoque_v3_trocas');
      localStorage.removeItem('gestao_estoque_v4_trocas');
      localStorage.setItem('gestao_estoque_v5_trocas_doc', JSON.stringify(INITIAL_TROCAS));
    } catch (e) {}
    return INITIAL_TROCAS;
  });

  const [faltasMapeadas, setFaltasMapeadas] = useState<FaltaMapeadaItem[]>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v3_faltas');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading faltas:', e);
    }
    return INITIAL_FALTAS_MAPEADAS;
  });

  const [frozenReconciliations, setFrozenReconciliations] = useState<FrozenReconciliation[]>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v3_frozen');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading frozen reconciliations:', e);
    }
    return SEED_FROZEN_RECONCILIATIONS;
  });

  // Mapa persistido de faturamento semanal de quebras ('PENDENTE' | 'OK')
  // Regra Ambev solicitada pelo usuário: apenas a semana corrente de quebras (31/08 - 05/09)
  // e datas restantes inseridas são pendentes. Todo o histórico anterior já foi faturado.
  const [weeklyBillingStatus, setWeeklyBillingStatus] = useState<Record<string, 'PENDENTE' | 'OK'>>(() => {
    const defaultStatus: Record<string, 'PENDENTE' | 'OK'> = {
      '07/09 - 11/09': 'PENDENTE',
      '31/08 - 05/09': 'PENDENTE',
      '24/08 - 28/08': 'OK',
      '17/08 - 21/08': 'OK',
      '10/08 - 14/08': 'OK',
      '03/08 - 07/08': 'OK',
      '27/07 - 31/07': 'OK',
      '20/07 - 24/07': 'OK',
      '13/07 - 17/07': 'OK',
      '06/07 - 10/07': 'OK',
      '29/06 - 03/07': 'OK',
      '23/06 - 28/06': 'OK',
      '15/06 - 20/06': 'OK',
      '08/06 - 12/06': 'OK',
      '01/06 - 05/06': 'OK',
      '25/05 - 30/05': 'OK',
    };

    try {
      const saved = localStorage.getItem('gestao_estoque_faturamento_semanal_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          const merged: Record<string, 'PENDENTE' | 'OK'> = { ...defaultStatus, ...parsed };
          // Força estritamente que semanas anteriores a 31/08/2026 sejam 'OK' (já faturadas/baixadas)
          const historicalWeeks = [
            '24/08 - 28/08', '17/08 - 21/08', '10/08 - 14/08', '03/08 - 07/08',
            '27/07 - 31/07', '20/07 - 24/07', '13/07 - 17/07', '06/07 - 10/07',
            '29/06 - 03/07', '23/06 - 28/06', '15/06 - 20/06', '08/06 - 12/06',
            '01/06 - 05/06', '25/05 - 30/05'
          ];
          historicalWeeks.forEach(w => {
            merged[w] = 'OK';
          });
          merged['31/08 - 05/09'] = parsed['31/08 - 05/09'] || 'PENDENTE';
          return merged;
        }
      }
    } catch (e) {
      console.error('Error loading weekly billing status:', e);
    }
    return defaultStatus;
  });

  // User Accounts & Authentication Session
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gestao_estoque_v3_usuarios');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasG1002 = parsed.some(
            (u: any) =>
              (u.matricula && u.matricula.toUpperCase() === 'G1002') ||
              (u.usuario && u.usuario.toUpperCase() === 'G1002')
          );
          const normalized = parsed.map((u: any) => ({
            ...u,
            matricula: u.matricula || (u.usuario?.includes('@') ? 'G1002' : u.usuario) || 'G1002',
            usuario: u.usuario || u.matricula || 'G1002',
          }));
          if (!hasG1002) {
            normalized.unshift(INITIAL_USERS[0]);
          }
          return normalized;
        }
      }
    } catch (e) {
      console.error('Error loading users from storage:', e);
    }
    return INITIAL_USERS;
  });

  const [showLogoutNotice, setShowLogoutNotice] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      // Check active user session (localStorage first for persistence across reloads/prompts)
      const savedLocal = localStorage.getItem('gestao_estoque_v3_usuario_ativo');
      if (savedLocal) return JSON.parse(savedLocal);
      const savedSession = sessionStorage.getItem('gestao_estoque_v3_usuario_ativo');
      if (savedSession) return JSON.parse(savedSession);
    } catch (e) {
      console.error('Error loading active user from storage:', e);
    }
    return null;
  });

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setShowLogoutNotice(false);
    try {
      sessionStorage.setItem('gestao_estoque_v3_usuario_ativo', JSON.stringify(user));
      localStorage.setItem('gestao_estoque_v3_usuario_ativo', JSON.stringify(user));
      persistData(STORAGE_KEYS.ACTIVE_USER, user);
    } catch (e) {}
  };

  const handleLogout = () => {
    if (auth.currentUser) {
      logoutFirebase().catch(() => {});
    }
    setCurrentUser(null);
    setShowLogoutNotice(true);
    try {
      sessionStorage.removeItem('gestao_estoque_v3_usuario_ativo');
      localStorage.removeItem('gestao_estoque_v3_usuario_ativo');
      removePersistedData(STORAGE_KEYS.ACTIVE_USER);
    } catch (e) {}
  };

  // 1. Startup Hydration from high-capacity IndexedDB
  // Guarantees 02.05.02, manual alterations and state persist across prompt changes and container reboots
  useEffect(() => {
    let isMounted = true;
    async function hydrateFromPersistentStorage() {
      try {
        const [
          savedStock, 
          savedGrade, 
          savedQuebras, 
          savedVales, 
          savedTrocas, 
          savedFaltas, 
          savedFrozen, 
          savedUser, 
          savedBilling,
          savedProducts
        ] = await Promise.all([
          retrieveData<StockPositionItem[]>(STORAGE_KEYS.STOCK_POSITIONS_020502, []),
          retrieveData<StockPositionItem[]>(STORAGE_KEYS.GRADE_POSITIONS, []),
          retrieveData<QuebraItem[]>(STORAGE_KEYS.QUEBRAS, []),
          retrieveData<ValeItem[]>(STORAGE_KEYS.VALES, []),
          retrieveData<TrocaItem[]>(STORAGE_KEYS.TROCAS, []),
          retrieveData<FaltaMapeadaItem[]>(STORAGE_KEYS.FALTAS, []),
          retrieveData<FrozenReconciliation[]>(STORAGE_KEYS.FROZEN, []),
          retrieveData<UserAccount | null>(STORAGE_KEYS.ACTIVE_USER, null),
          retrieveData<Record<string, 'PENDENTE' | 'OK'> | null>(STORAGE_KEYS.WEEKLY_BILLING, null),
          retrieveData<[string, ProductMaster][]>(STORAGE_KEYS.PRODUCTS, [])
        ]);

        if (!isMounted) return;

        if (savedProducts && savedProducts.length > 0) {
          const merged = new Map(savedProducts);
          INITIAL_PRODUCTS.forEach((prod, sku) => {
            const existing = merged.get(sku);
            if (!existing) {
              merged.set(sku, prod);
            } else if (prod.valor > 0 && prod.valor !== existing.valor) {
              merged.set(sku, {
                ...existing,
                valor: prod.valor,
                valorUnit: prod.valorUnit,
                descricao: prod.descricao || existing.descricao
              });
            }
          });
          setProductsMap(merged);
        } else {
          setProductsMap(new Map(INITIAL_PRODUCTS));
        }

        if (savedStock && savedStock.length > 0) {
          setStockPositions(savedStock);
        }
        if (savedGrade && savedGrade.length > 0) {
          setGradeStockPositions(savedGrade);
        }
        if (savedQuebras && savedQuebras.length > 0) {
          const hasDreRaw = savedQuebras.some((q: QuebraItem) => q.id?.startsWith('q-raw-') || q.data === '22/06/2026');
          if (hasDreRaw && savedQuebras.length >= INITIAL_QUEBRAS.length * 0.8) {
            setQuebras(savedQuebras);
          } else {
            const filteredOld = savedQuebras.filter((q: QuebraItem) => !q.id?.startsWith('q-jul-') && q.id !== 'q-sem-2906' && q.id !== 'q-sem-2306');
            const existingIds = new Set(filteredOld.map((q: QuebraItem) => q.id));
            const missing = INITIAL_QUEBRAS.filter(q => !existingIds.has(q.id));
            const merged = [...filteredOld, ...missing];
            const guaranteed = ensureCompleteHistoricalQuebras(merged);
            const { cleaned } = sanitizeAndDeduplicateQuebras(guaranteed);
            const billedCleaned = markHistoricalQuebrasAsBilled(cleaned);
            setQuebras(billedCleaned);
            persistData(STORAGE_KEYS.QUEBRAS, billedCleaned);
            safeLocalStorageSet('gestao_estoque_v4_quebras', JSON.stringify(billedCleaned));
          }
        }
        if (savedVales && savedVales.length > 0) {
          setVales(savedVales);
        }
        if (savedTrocas && savedTrocas.length > 0) {
          setTrocas(savedTrocas);
        }
        if (savedFaltas && savedFaltas.length > 0) {
          setFaltasMapeadas(savedFaltas);
        }
        if (savedFrozen && savedFrozen.length > 0) {
          setFrozenReconciliations(savedFrozen);
        }
        if (savedUser && !currentUser) {
          setCurrentUser(savedUser);
        }
        if (savedBilling) {
          setWeeklyBillingStatus(prev => ({ ...prev, ...savedBilling }));
        }
      } catch (err) {
        console.warn('[PersistentStorage] Hydration completed with notes:', err);
      }
    }

    hydrateFromPersistentStorage();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save to persistent storage and cloud
  useEffect(() => {
    try {
      localStorage.setItem('gestao_estoque_v3_usuarios', JSON.stringify(users));
      persistData(STORAGE_KEYS.USERS, users);
    } catch (e) {}
  }, [users]);

  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem('gestao_estoque_v3_usuario_ativo', JSON.stringify(currentUser));
        localStorage.setItem('gestao_estoque_v3_usuario_ativo', JSON.stringify(currentUser));
        persistData(STORAGE_KEYS.ACTIVE_USER, currentUser);
      } else {
        sessionStorage.removeItem('gestao_estoque_v3_usuario_ativo');
        localStorage.removeItem('gestao_estoque_v3_usuario_ativo');
        removePersistedData(STORAGE_KEYS.ACTIVE_USER);
      }
    } catch (e) {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('gestao_estoque_v3_produtos', JSON.stringify(Array.from(productsMap.entries())));
    } catch (e) {}
    persistData(STORAGE_KEYS.PRODUCTS, Array.from(productsMap.entries()));
  }, [productsMap]);

  // Persist 02.05.02 (Conciliação) with alterations immediately
  useEffect(() => {
    persistData(STORAGE_KEYS.STOCK_POSITIONS_020502, stockPositions);
    persistData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, stockPositions);
    if (stockPositions.length > 0) {
      const timer = setTimeout(() => {
        saveStockPositionsToFirestore(stockPositions).catch((err) => 
          console.warn('[Firebase] Sync stockPositions warning:', err)
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stockPositions]);

  // Persist 02.05.02 (Grade de Estoque) immediately
  useEffect(() => {
    persistData(STORAGE_KEYS.GRADE_POSITIONS, gradeStockPositions);
    persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, gradeStockPositions);
    if (gradeStockPositions.length > 0) {
      const timer = setTimeout(() => {
        saveGradePositionsToFirestore(gradeStockPositions).catch((err) => 
          console.warn('[Firebase] Sync gradePositions warning:', err)
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gradeStockPositions]);

  useEffect(() => {
    persistData(STORAGE_KEYS.QUEBRAS, quebras);
    if (quebras.length > 0) {
      const timer = setTimeout(() => {
        saveQuebrasToFirestore(quebras).catch((err) => 
          console.warn('[Firebase] Sync quebras warning:', err)
        );
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [quebras]);

  useEffect(() => {
    persistData(STORAGE_KEYS.WEEKLY_BILLING, weeklyBillingStatus);
    if (weeklyBillingStatus) {
      const timer = setTimeout(() => {
        saveAppSettingsToFirestore('weeklyBillingStatus', weeklyBillingStatus).catch((err) =>
          console.warn('[Firebase] Sync weeklyBilling warning:', err)
        );
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [weeklyBillingStatus]);

  useEffect(() => {
    persistData(STORAGE_KEYS.VALES, vales);
    if (vales.length > 0) {
      const timer = setTimeout(() => {
        saveValesToFirestore(vales).catch((err) => 
          console.warn('[Firebase] Sync vales warning:', err)
        );
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [vales]);

  useEffect(() => {
    persistData(STORAGE_KEYS.TROCAS, trocas);
    persistData(STORAGE_KEYS.TROCAS_V4, trocas);
    if (trocas.length > 0) {
      const timer = setTimeout(() => {
        saveTrocasToFirestore(trocas).catch((err) => 
          console.warn('[Firebase] Sync trocas warning:', err)
        );
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [trocas]);

  useEffect(() => {
    persistData(STORAGE_KEYS.FALTAS, faltasMapeadas);
    if (faltasMapeadas.length > 0) {
      const timer = setTimeout(() => {
        saveFaltasToFirestore(faltasMapeadas).catch((err) => 
          console.warn('[Firebase] Sync faltas warning:', err)
        );
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [faltasMapeadas]);

  useEffect(() => {
    persistData(STORAGE_KEYS.FROZEN, frozenReconciliations);
  }, [frozenReconciliations]);

  // Sincronização automática contínua com o Firebase Firestore
  // Permite que qualquer alteração do Studio IA suba para a nuvem
  // e que o link do GitHub Pages puxe 100% dos dados na inicialização
  useEffect(() => {
    let isMounted = true;

    async function executeCloudSync() {
      try {
        const [
          cloudStock, 
          cloudGrade, 
          cloudQuebras, 
          cloudVales, 
          cloudTrocas, 
          cloudFaltas, 
          cloudFrozen, 
          cloudUsers,
          cloudProducts,
          cloudBilling
        ] = await Promise.all([
          loadStockPositionsFromFirestore().catch(() => []),
          loadGradePositionsFromFirestore().catch(() => []),
          loadQuebrasFromFirestore().catch(() => []),
          loadValesFromFirestore().catch(() => []),
          loadTrocasFromFirestore().catch(() => []),
          loadFaltasFromFirestore().catch(() => []),
          loadFrozenReconciliationsFromFirestore().catch(() => []),
          loadUsersFromFirestore().catch(() => []),
          loadProductsFromFirestore().catch(() => []),
          loadAppSettingsFromFirestore<Record<string, 'PENDENTE' | 'OK'>>('weeklyBillingStatus').catch(() => null)
        ]);

        if (!isMounted) return;

        // 1. Posições de Estoque (02.05.02)
        if (cloudStock && cloudStock.length > 0) {
          setStockPositions(cloudStock);
        } else if (stockPositions.length > 0) {
          saveStockPositionsToFirestore(stockPositions).catch(() => {});
        }

        // 2. Grade de Estoque (02.05.02)
        if (cloudGrade && cloudGrade.length > 0) {
          setGradeStockPositions(cloudGrade);
        } else if (gradeStockPositions.length > 0) {
          saveGradePositionsToFirestore(gradeStockPositions).catch(() => {});
        }

        // 3. Quebras
        if (cloudQuebras && cloudQuebras.length > 0) {
          const { cleaned } = sanitizeAndDeduplicateQuebras(cloudQuebras);
          setQuebras(cleaned);
        } else if (quebras.length > 0) {
          saveQuebrasToFirestore(quebras).catch(() => {});
        }

        // 4. Vales
        if (cloudVales && cloudVales.length > 0) {
          setVales(cloudVales);
        } else if (vales.length > 0) {
          saveValesToFirestore(vales).catch(() => {});
        }

        // 5. Trocas
        if (cloudTrocas && cloudTrocas.length > 0) {
          setTrocas(cloudTrocas);
        } else if (trocas.length > 0) {
          saveTrocasToFirestore(trocas).catch(() => {});
        }

        // 6. Faltas
        if (cloudFaltas && cloudFaltas.length > 0) {
          setFaltasMapeadas(cloudFaltas);
        } else if (faltasMapeadas.length > 0) {
          saveFaltasToFirestore(faltasMapeadas).catch(() => {});
        }

        // 7. Fechamentos Congelados
        if (cloudFrozen && cloudFrozen.length > 0) {
          setFrozenReconciliations(cloudFrozen);
        } else if (frozenReconciliations.length > 0) {
          frozenReconciliations.forEach(fr => {
            saveFrozenReconciliationToFirestore(fr).catch(() => {});
          });
        }

        // 8. Usuários
        if (cloudUsers && cloudUsers.length > 0) {
          setUsers(prev => {
            const merged = [...prev];
            cloudUsers.forEach(cu => {
              if (!merged.some(m => m.id === cu.id || m.matricula === cu.matricula)) {
                merged.push(cu);
              }
            });
            return merged;
          });
        } else if (users.length > 0) {
          users.forEach(u => saveUserToFirestore(u).catch(() => {}));
        }

        // 9. Produtos
        if (cloudProducts && cloudProducts.length > 0) {
          setProductsMap(prev => {
            const nextMap = new Map(prev);
            cloudProducts.forEach(cp => {
              const code = cp?.codigo || (cp as any)?.sku;
              if (code) {
                const existing = nextMap.get(code);
                nextMap.set(code, { ...existing, ...cp, codigo: code });
              }
            });
            return nextMap;
          });
        } else if (productsMap.size > 0) {
          saveProductsToFirestore(Array.from(productsMap.values())).catch(() => {});
        }

        // 10. Status de Faturamento Semanal
        if (cloudBilling && Object.keys(cloudBilling).length > 0) {
          setWeeklyBillingStatus(prev => ({ ...prev, ...cloudBilling }));
        } else if (weeklyBillingStatus) {
          saveAppSettingsToFirestore('weeklyBillingStatus', weeklyBillingStatus).catch(() => {});
        }
      } catch (err) {
        console.warn('[Firebase] Automatic cloud sync notice:', err);
      }
    }

    executeCloudSync();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmSaveAndReset = (savedInfo: { filename: string; frozenRecord: FrozenReconciliation; method: string }) => {
    // 1. Salva a conciliação no histórico de congeladas
    setFrozenReconciliations(prev => [savedInfo.frozenRecord, ...prev]);

    // Salva cópia na nuvem Firestore
    saveFrozenReconciliationToFirestore(savedInfo.frozenRecord).catch(e => {
      console.warn('[Firebase] Erro ao salvar reconciliação na nuvem:', e);
    });

    // 2. Regra solicitada: Zerar a guia de conciliação 02.05.02 para receber a nova, mantendo todas as demais
    setStockPositions([]);
    localStorage.removeItem('gestao_estoque_v3_posicoes');
    removePersistedData(STORAGE_KEYS.STOCK_POSITIONS_020502);
    removePersistedData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY);

    // 3. Fecha modal e avisa o usuário
    setIsSaveModalOpen(false);
    setToastMessage({
      type: 'success',
      text: `Conciliação "${savedInfo.frozenRecord.nome}" salva com sucesso! A diferença foi congelada na Diferença Diária e na Diferença Congelada/Mensal. A base 02.05.02 foi zerada e está pronta para a próxima contagem.`
    });

    // 4. Navega para a guia de Diferença Diária para conferência imediata
    setCurrentTab('dif_diaria');
  };

  // Reset to initial clean state (Zerar Base)
  const handleResetData = () => {
    if (confirm('Deseja limpar todos os dados manuais da plataforma? Todas as posições de estoque, quebras, vales, trocas e faltas serão zeradas para que você possa importar sua própria base do zero.')) {
      setStockPositions([]);
      setQuebras([]);
      setVales([]);
      setTrocas([]);
      setFaltasMapeadas([]);
      setIsRecountApplied(false);
      localStorage.removeItem('gestao_estoque_v3_posicoes');
      localStorage.removeItem('gestao_estoque_v3_quebras');
      localStorage.removeItem('gestao_estoque_v3_vales');
      localStorage.removeItem('gestao_estoque_v5_trocas_doc');
      localStorage.removeItem('gestao_estoque_v4_trocas');
      localStorage.removeItem('gestao_estoque_v3_trocas');
      localStorage.removeItem('gestao_estoque_v3_faltas');
      removePersistedData(STORAGE_KEYS.STOCK_POSITIONS_020502);
      removePersistedData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY);
      removePersistedData(STORAGE_KEYS.GRADE_POSITIONS);
      removePersistedData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY);
      removePersistedData(STORAGE_KEYS.QUEBRAS);
      removePersistedData(STORAGE_KEYS.VALES);
      removePersistedData(STORAGE_KEYS.TROCAS);
      removePersistedData(STORAGE_KEYS.FALTAS);
      alert('Plataforma zerada com sucesso! Base limpa para novas importações manuais.');
    }
  };

  // Open import modal strictly locked to the requested file type and mode
  const handleOpenImportModal = (
    fileType: ImportFileType = '020502', 
    locked: boolean = true, 
    mode: 'replace' | 'append' = 'replace'
  ) => {
    setImportInitialType(fileType);
    setImportLockedType(locked ? fileType : undefined);
    setImportMode(mode);
    setIsImportModalOpen(true);
  };

  // State and handlers for all manual congelamentos (quebras, vales, trocas, faltas)
  const [isManualCongelamentoModalOpen, setIsManualCongelamentoModalOpen] = useState(false);
  const [manualCongelamentoType, setManualCongelamentoType] = useState<CongelamentoType>('quebra');

  const handleOpenManualCongelamentoModal = (type: CongelamentoType = 'quebra') => {
    setManualCongelamentoType(type);
    setIsManualCongelamentoModalOpen(true);
  };

  const handleSaveManualQuebra = (novaQuebra: QuebraItem) => {
    setQuebras(prev => [novaQuebra, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Quebra (${novaQuebra.quantidade} cx de SKU ${novaQuebra.sku}) lançada com sucesso no depósito ${novaQuebra.deposito}.`
    });
  };

  const handleSaveManualVale = (novoVale: ValeItem) => {
    setVales(prev => [novoVale, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Vale (${novoVale.quantidade} cx de SKU ${novoVale.codigo}) lançado com sucesso no depósito ${novoVale.deposito}.`
    });
  };

  const handleSaveManualTroca = (novaTroca: TrocaItem) => {
    setTrocas(prev => [novaTroca, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Troca (${novaTroca.quantidade} cx de SKU ${novaTroca.sku}) lançada com sucesso no depósito ${novaTroca.deposito}.`
    });
  };

  // Handler for adding a new manual falta
  const handleSaveManualFalta = (novaFalta: FaltaMapeadaItem) => {
    setFaltasMapeadas(prev => [novaFalta, ...prev]);
    setToastMessage({
      type: 'success',
      text: `Falta de doca (${novaFalta.quantidade} cx de SKU ${novaFalta.codigo || novaFalta.produto}) lançada com sucesso.`
    });
  };

  // Exportação oficial do Relatório de Conciliação em Excel (Sem Ajustes e Com Ajustes)
  const handleExportConsolidatedReport = async () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `Relatorio_Conciliacao_Estoque_Ambev_Dep_${selectedDeposito}_${dateStr}_${timeStr}.xlsx`;

      const result = await exportConciliacaoExcel({
        stockPositions,
        quebras,
        vales,
        trocas,
        faltasMapeadas,
        selectedDeposito,
        filename,
        weeklyBillingStatus
      });

      if (result.success) {
        setToastMessage({
          type: 'success',
          text: `Relatório Excel exportado com sucesso! Arquivo: ${result.filename}`
        });
      }
    } catch (err) {
      console.error('Erro ao exportar conciliação em Excel:', err);
      alert('Ocorreu um erro ao gerar a planilha Excel da conciliação.');
    }
  };

  // Dedicated Initial Screen for Log In when user is not authenticated
  if (!currentUser) {
    return (
      <InitialLoginView
        users={users}
        onLogin={handleLogin}
        logoutNotice={showLogoutNotice}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F3F4F6] font-sans text-slate-800 overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* Geometric Balance Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isRecountApplied={isRecountApplied}
        onResetData={handleResetData}
        onExportReport={handleExportConsolidatedReport}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F3F4F6]">
        {/* Geometric Balance Top Header */}
        <Header
          selectedDeposito={selectedDeposito}
          setSelectedDeposito={setSelectedDeposito}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onOpenImportModal={() => handleOpenImportModal('020502')}
          onOpenManualFaltaModal={() => setIsManualFaltaModalOpen(true)}
          onOpenManualModal={handleOpenManualCongelamentoModal}
          onResetData={handleResetData}
          onExportReport={handleExportConsolidatedReport}
          isRecountApplied={isRecountApplied}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          currentUser={currentUser}
          onNavigateLogin={() => setCurrentTab('login')}
          onLogout={handleLogout}
        />

        {/* Scrollable Main Views Section */}
        <main className={`flex-1 overflow-y-auto space-y-6 ${currentTab === 'inversao' ? 'p-3 sm:p-5 lg:p-6' : 'p-4 sm:p-6 lg:p-8'}`}>
          <div className={`${currentTab === 'inversao' ? 'max-w-[1780px]' : 'max-w-7xl'} mx-auto w-full`}>
            {currentTab === 'dashboard' && (
              <DashboardView
                stockPositions={stockPositions}
                quebras={quebras}
                vales={vales}
                trocas={trocas}
                faltasMapeadas={faltasMapeadas}
                selectedDeposito={selectedDeposito}
                onNavigateTab={setCurrentTab}
                onOpenManualFaltaModal={() => setIsManualFaltaModalOpen(true)}
                onOpenManualModal={handleOpenManualCongelamentoModal}
                weeklyBillingStatus={weeklyBillingStatus}
                frozenReconciliations={frozenReconciliations}
              />
            )}

            {(currentTab === 'conciliacao' || currentTab === 'conciliacao_ajustes') && (
              <ConciliacaoView
                stockPositions={stockPositions}
                setStockPositions={setStockPositions}
                selectedDeposito={selectedDeposito}
                setSelectedDeposito={setSelectedDeposito}
                onOpenImportModal={(initial) => handleOpenImportModal(initial || '020502')}
                productsMap={productsMap}
                isRecountApplied={isRecountApplied}
                quebras={quebras}
                vales={vales}
                trocas={trocas}
                faltasMapeadas={faltasMapeadas}
                initialSubTab={currentTab === 'conciliacao_ajustes' ? 'ajustes' : 'padrao'}
                onNavigateTab={(tab) => {
                  if (tab === 'conciliacao_ajustes') {
                    setCurrentTab('conciliacao');
                  } else {
                    setCurrentTab(tab);
                  }
                }}
                onOpenSaveModal={() => setIsSaveModalOpen(true)}
                onOpenManualModal={handleOpenManualCongelamentoModal}
                weeklyBillingStatus={weeklyBillingStatus}
              />
            )}

            {currentTab === 'grade_estoque' && (
              <GradeEstoqueView
                stockPositions={gradeStockPositions}
                setStockPositions={setGradeStockPositions}
                generalStockPositions={stockPositions}
                setGeneralStockPositions={setStockPositions}
                productsMap={productsMap}
                quebras={quebras}
                vales={vales}
                trocas={trocas}
                faltasMapeadas={faltasMapeadas}
                weeklyBillingStatus={weeklyBillingStatus}
                frozenReconciliations={frozenReconciliations}
                onNavigateTab={setCurrentTab}
                onOpenImportModal={handleOpenImportModal}
              />
            )}

            {(currentTab === 'dif_diaria' || currentTab === 'congeladas') && (
              <DifDiariaView
                stockPositions={stockPositions}
                selectedDeposito={selectedDeposito}
                setSelectedDeposito={setSelectedDeposito}
                productsMap={productsMap}
                frozenReconciliations={frozenReconciliations}
                onOpenSaveModal={() => setIsSaveModalOpen(true)}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'dif_mensal' && (
              <DifMensalView
                stockPositions={stockPositions}
                selectedDeposito={selectedDeposito}
                setSelectedDeposito={setSelectedDeposito}
                productsMap={productsMap}
                frozenReconciliations={frozenReconciliations}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'inversao' && (
              <InversaoErrorBoundary>
                <InversaoView
                  stockPositions={stockPositions}
                  quebras={quebras}
                  vales={vales}
                  trocas={trocas}
                  faltasMapeadas={faltasMapeadas}
                  selectedDeposito={selectedDeposito}
                  setSelectedDeposito={setSelectedDeposito}
                  currentUser={currentUser}
                  productsMap={productsMap}
                  onUpdateProductsMap={setProductsMap}
                  onUpdateStockPositions={setStockPositions}
                  onUpdateGradeStockPositions={setGradeStockPositions}
                  onOpenImportModal={handleOpenImportModal}
                />
              </InversaoErrorBoundary>
            )}

            {currentTab === 'quebras' && (
              <QuebrasView
                quebras={quebras}
                selectedDeposito={selectedDeposito}
                onOpenImportModal={() => handleOpenImportModal('quebras')}
                onOpenManualQuebra={() => handleOpenManualCongelamentoModal('quebra')}
                onUpdateQuebras={setQuebras}
                weeklyBillingStatus={weeklyBillingStatus}
                onUpdateWeeklyBillingStatus={setWeeklyBillingStatus}
              />
            )}

            {currentTab === 'vales' && (
              <ValesView
                vales={vales}
                selectedDeposito={selectedDeposito}
                onOpenImportModal={() => handleOpenImportModal('vales')}
                onOpenManualVale={() => handleOpenManualCongelamentoModal('vale')}
                onUpdateVales={setVales}
                weeklyBillingStatus={weeklyBillingStatus}
              />
            )}

            {currentTab === 'trocas' && (
              <TrocasView
                trocas={trocas}
                selectedDeposito={selectedDeposito}
                onOpenImportModal={() => handleOpenImportModal('trocas')}
                onOpenManualTroca={() => handleOpenManualCongelamentoModal('troca')}
                onUpdateTrocas={setTrocas}
                weeklyBillingStatus={weeklyBillingStatus}
              />
            )}

            {currentTab === 'faltas' && (
              <FaltasView
                faltasMapeadas={faltasMapeadas}
                setFaltasMapeadas={setFaltasMapeadas}
                selectedDeposito={selectedDeposito}
                onOpenManualFaltaModal={() => handleOpenManualCongelamentoModal('falta')}
                onOpenImportModal={() => handleOpenImportModal('faltas')}
                weeklyBillingStatus={weeklyBillingStatus}
              />
            )}

            {currentTab === 'produtos' && (
              <ProdutosView
                productsMap={productsMap}
                setProductsMap={setProductsMap}
                stockPositions={stockPositions}
                setStockPositions={setStockPositions}
                onOpenImportModal={() => handleOpenImportModal('cadastro')}
              />
            )}

            {currentTab === 'login' && (
              <LoginView
                users={users}
                setUsers={setUsers}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                onNavigateTab={setCurrentTab}
                onLogout={handleLogout}
              />
            )}
          </div>
        </main>
      </div>

      {/* Universal Manual Congelamento Modal (Quebras, Vales, Trocas, Faltas) */}
      <ManualCongelamentoModal
        isOpen={isManualCongelamentoModalOpen}
        onClose={() => setIsManualCongelamentoModalOpen(false)}
        initialType={manualCongelamentoType}
        defaultDeposito={selectedDeposito === 'ALL' ? '01' : selectedDeposito}
        productsMap={productsMap}
        onSaveQuebra={handleSaveManualQuebra}
        onSaveVale={handleSaveManualVale}
        onSaveTroca={handleSaveManualTroca}
        onSaveFalta={handleSaveManualFalta}
      />

      {/* Manual Falta Modal (Backward Compatibility) */}
      <ManualFaltaModal
        isOpen={isManualFaltaModalOpen}
        onClose={() => setIsManualFaltaModalOpen(false)}
        productsMap={productsMap}
        onSaveFalta={handleSaveManualFalta}
        defaultDeposito={selectedDeposito === 'ALL' ? '01' : selectedDeposito}
      />

      {/* Universal Import Modal for 02.05.02, 01.11, Cadastro, Quebras, Vales, Trocas, Faltas */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialFileType={importInitialType}
        lockedFileType={importLockedType}
        selectedDeposito={selectedDeposito === 'ALL' ? '01' : selectedDeposito}
        productsMap={productsMap}
        setProductsMap={setProductsMap}
        stockPositions={stockPositions}
        setStockPositions={setStockPositions}
        gradeStockPositions={gradeStockPositions}
        setGradeStockPositions={setGradeStockPositions}
        setQuebras={setQuebras}
        setVales={setVales}
        setTrocas={setTrocas}
        setFaltasMapeadas={setFaltasMapeadas}
        setIsRecountApplied={setIsRecountApplied}
      />

      {/* Save Reconciliation & Freeze Confirmation Modal */}
      <SaveReconciliationModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirmSaveAndReset={handleConfirmSaveAndReset}
        stockPositions={stockPositions}
        quebras={quebras}
        vales={vales}
        trocas={trocas}
        faltasMapeadas={faltasMapeadas}
        selectedDeposito={selectedDeposito}
        productsMap={productsMap}
        currentUser={currentUser}
        weeklyBillingStatus={weeklyBillingStatus}
      />

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0 animate-pulse" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-slate-200">Notificação do Sistema</div>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{toastMessage.text}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
