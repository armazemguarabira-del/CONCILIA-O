import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  fbSignOut, 
  OperationType, 
  handleFirestoreError 
} from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  getDoc 
} from 'firebase/firestore';
import type { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  FrozenReconciliation, 
  UserAccount,
  ProductMaster 
} from '../types';

export interface InversaoSyncPayload {
  deposito: string;
  baseMode: string;
  fullPairs?: any[];
  customPairs?: Record<string, { qtdSobra: number; qtdSaida: number }>;
  deletedKeys?: string[];
  atualizadoEm?: string;
}

function sanitizeDocId(rawId: string, fallback: string = 'doc'): string {
  const sanitized = String(rawId || '').replace(/[^a-zA-Z0-9_\-\.:]/g, '_').substring(0, 120);
  return sanitized || `${fallback}_${Date.now()}`;
}

function cleanObjectForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj === 'number') {
    if (isNaN(obj) || !isFinite(obj)) return 0;
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => cleanObjectForFirestore(item));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // NEVER send undefined to Firestore
    }
    result[key] = cleanObjectForFirestore(value);
  }
  return result;
}

async function runInChunks<T>(items: T[], chunkSize: number, fn: (item: T) => Promise<any>): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(fn));
  }
}

/**
 * Authentication with Google via Firebase Auth
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Erro ao autenticar com Google:', error);
    throw error;
  }
}

export async function logoutFirebase() {
  try {
    await fbSignOut(auth);
  } catch (error) {
    console.error('Erro ao sair do Firebase:', error);
    throw error;
  }
}

/**
 * Cloud Sync for Stock Positions (Conciliação 02.05.02)
 */
export async function saveStockPositionsToFirestore(items: StockPositionItem[]) {
  if (!items || items.length === 0) return false;
  const path = 'stockPositions';
  try {
    await runInChunks(items, 30, async (item) => {
      const docId = sanitizeDocId(item.id, `sp_${item.deposito}_${item.produto}`);
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: item.id,
        deposito: String(item.deposito || '01').substring(0, 10),
        produto: String(item.produto || '').substring(0, 50),
        descricao: String(item.descricao || '').substring(0, 200),
        disponivelRaw: String(item.disponivelRaw || '').substring(0, 50),
        inventarioRaw: String(item.inventarioRaw || '').substring(0, 50),
        disponivelTotalUnits: Number(item.disponivelTotalUnits || 0),
        inventarioTotalUnits: Number(item.inventarioTotalUnits || 0),
        diferencaTotalUnits: Number(item.diferencaTotalUnits || 0),
        diferencaRaw: String(item.diferencaRaw || '').substring(0, 50),
        status: item.status || 'OK',
        prejuizoFinanceiro: Number(item.prejuizoFinanceiro || 0),
        sobraFinanceira: Number(item.sobraFinanceira || 0),
        impactoHl: Number(item.impactoHl || 0),
        fatorSku: Number(item.fatorSku || 1),
        valorUnitario: Number(item.valorUnitario || 0),
        recontado: !!item.recontado,
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadStockPositionsFromFirestore(): Promise<StockPositionItem[]> {
  const path = 'stockPositions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: StockPositionItem[] = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d && d.produto) {
        list.push(d as StockPositionItem);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Grade de Estoque Positions (02.05.02 da Grade)
 */
export async function saveGradePositionsToFirestore(items: StockPositionItem[]) {
  if (!items || items.length === 0) return false;
  const path = 'gradePositions';
  try {
    await runInChunks(items, 30, async (item) => {
      const docId = sanitizeDocId(item.id, `gp_${item.deposito}_${item.produto}`);
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: item.id,
        deposito: String(item.deposito || '01').substring(0, 10),
        produto: String(item.produto || '').substring(0, 50),
        descricao: String(item.descricao || '').substring(0, 200),
        disponivelRaw: String(item.disponivelRaw || '').substring(0, 50),
        inventarioRaw: String(item.inventarioRaw || '').substring(0, 50),
        disponivelTotalUnits: Number(item.disponivelTotalUnits || 0),
        inventarioTotalUnits: Number(item.inventarioTotalUnits || 0),
        diferencaTotalUnits: Number(item.diferencaTotalUnits || 0),
        diferencaRaw: String(item.diferencaRaw || '').substring(0, 50),
        status: item.status || 'OK',
        prejuizoFinanceiro: Number(item.prejuizoFinanceiro || 0),
        sobraFinanceira: Number(item.sobraFinanceira || 0),
        impactoHl: Number(item.impactoHl || 0),
        fatorSku: Number(item.fatorSku || 1),
        valorUnitario: Number(item.valorUnitario || 0),
        recontado: !!item.recontado,
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadGradePositionsFromFirestore(): Promise<StockPositionItem[]> {
  const path = 'gradePositions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: StockPositionItem[] = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d && d.produto) {
        list.push(d as StockPositionItem);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Quebras
 */
export async function saveQuebrasToFirestore(quebras: QuebraItem[]) {
  if (!quebras || quebras.length === 0) return false;
  const path = 'quebras';
  try {
    await runInChunks(quebras, 25, async (q) => {
      const docId = sanitizeDocId(q.id, 'q');
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: q.id || docId,
        data: String(q.data || ''),
        sku: String(q.sku || ''),
        descricao: String(q.descricao || '').substring(0, 250),
        quantidade: Number(q.quantidade || 0),
        area: String(q.area || 'PUXADA'),
        turno: String(q.turno || 'GERAL'),
        codQuebra: String(q.codQuebra || ''),
        motivo: String(q.motivo || 'Avaria'),
        colaborador: String(q.colaborador || '-'),
        funcao: q.funcao ? String(q.funcao) : null,
        mes: String(q.mes || 'SETEMBRO'),
        origem: String(q.origem || 'DRE Quebras'),
        valorTotal: Number(q.valorTotal || 0),
        volumeHl: Number(q.volumeHl || 0),
        deposito: String(q.deposito || '01'),
        faturado: Boolean(q.faturado),
        dataFaturamento: q.dataFaturamento ? String(q.dataFaturamento) : null,
        semanaRef: q.semanaRef ? String(q.semanaRef) : null,
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadQuebrasFromFirestore(): Promise<QuebraItem[]> {
  const path = 'quebras';
  try {
    const snap = await getDocs(collection(db, path));
    const list: QuebraItem[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && item.sku) list.push(item as QuebraItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Vales
 */
export async function saveValesToFirestore(vales: ValeItem[]) {
  if (!vales || vales.length === 0) return false;
  const path = 'vales';
  try {
    await runInChunks(vales, 25, async (v) => {
      const docId = sanitizeDocId(v.id, 'v');
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: v.id || docId,
        data: String(v.data || ''),
        codigo: String(v.codigo || ''),
        descricao: String(v.descricao || '').substring(0, 250),
        quantidade: Number(v.quantidade || 0),
        valorTotal: Number(v.valorTotal || 0),
        motorista: String(v.motorista || '-'),
        cpfMotorista: v.cpfMotorista ? String(v.cpfMotorista) : null,
        equipeCompleta: String(v.equipeCompleta || ''),
        cliente: String(v.cliente || ''),
        notaFiscal: String(v.notaFiscal || ''),
        mapa: String(v.mapa || ''),
        rotaSetor: String(v.rotaSetor || ''),
        statusVale: String(v.statusVale || 'PENDENTE'),
        idValeSstr: String(v.idValeSstr || ''),
        deposito: String(v.deposito || '01'),
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadValesFromFirestore(): Promise<ValeItem[]> {
  const path = 'vales';
  try {
    const snap = await getDocs(collection(db, path));
    const list: ValeItem[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && (item.codigo || item.id)) list.push(item as ValeItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Trocas
 */
export async function saveTrocasToFirestore(trocas: TrocaItem[]) {
  if (!trocas || trocas.length === 0) return false;
  const path = 'trocas';
  try {
    await runInChunks(trocas, 25, async (t) => {
      const docId = sanitizeDocId(t.id, 't');
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: t.id || docId,
        data: String(t.data || ''),
        codigos: String(t.codigos || ''),
        sku: t.sku ? String(t.sku) : null,
        descricao: String(t.descricao || '').substring(0, 250),
        quantidade: Number(t.quantidade || 0),
        valorTotal: Number(t.valorTotal || 0),
        motorista: String(t.motorista || '-'),
        ajudantes: String(t.ajudantes || ''),
        cliente: String(t.cliente || ''),
        notaFiscal: String(t.notaFiscal || ''),
        mapa: String(t.mapa || ''),
        setorRota: String(t.setorRota || ''),
        unidadeMedida: String(t.unidadeMedida || 'UN'),
        volumeHl: Number(t.volumeHl || 0),
        motivoDeclarado: String(t.motivoDeclarado || ''),
        motivo: t.motivo ? String(t.motivo) : null,
        tipoProcesso: String(t.tipoProcesso || 'Troca'),
        statusPromax: String(t.statusPromax || ''),
        observacoes: String(t.observacoes || ''),
        deposito: String(t.deposito || '01'),
        faturado: Boolean(t.faturado),
        dataFaturamento: t.dataFaturamento ? String(t.dataFaturamento) : null,
        semanaRef: t.semanaRef ? String(t.semanaRef) : null,
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadTrocasFromFirestore(): Promise<TrocaItem[]> {
  const path = 'trocas';
  try {
    const snap = await getDocs(collection(db, path));
    const list: TrocaItem[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && (item.codigos || item.sku || item.id)) list.push(item as TrocaItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Faltas Mapeadas
 */
export async function saveFaltasToFirestore(faltas: FaltaMapeadaItem[]) {
  if (!faltas || faltas.length === 0) return false;
  const path = 'faltasMapeadas';
  try {
    await runInChunks(faltas, 25, async (f) => {
      const docId = sanitizeDocId(f.id, 'f');
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        id: f.id || docId,
        codigo: String(f.codigo || ''),
        descricao: String(f.descricao || '').substring(0, 250),
        quantidade: Number(f.quantidade || 0),
        observacao: String(f.observacao || ''),
        deposito: String(f.deposito || '01'),
        data: String(f.data || ''),
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function deleteFaltaFromFirestore(id: string) {
  const path = 'faltasMapeadas';
  try {
    const docRef = doc(db, path, id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export async function deleteFaltasBatchFromFirestore(ids: string[]) {
  if (!ids || ids.length === 0) return false;
  const path = 'faltasMapeadas';
  try {
    const promises = ids.map(id => deleteDoc(doc(db, path, id)));
    await Promise.all(promises);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export async function loadFaltasFromFirestore(): Promise<FaltaMapeadaItem[]> {
  const path = 'faltasMapeadas';
  try {
    const snap = await getDocs(collection(db, path));
    const list: FaltaMapeadaItem[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && (item.codigo || item.id)) list.push(item as FaltaMapeadaItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Frozen Reconciliations
 */
export async function saveFrozenReconciliationToFirestore(item: FrozenReconciliation) {
  const path = 'frozenReconciliations';
  try {
    const docId = sanitizeDocId(item.id, 'fr');
    const docRef = doc(db, path, docId);
    const cleaned = cleanObjectForFirestore(item);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadFrozenReconciliationsFromFirestore(): Promise<FrozenReconciliation[]> {
  const path = 'frozenReconciliations';
  try {
    const snap = await getDocs(collection(db, path));
    const list: FrozenReconciliation[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && (item.nome || item.id)) list.push(item as FrozenReconciliation);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteFrozenReconciliationFromFirestore(id: string) {
  const path = 'frozenReconciliations';
  try {
    const docId = sanitizeDocId(id, 'fr');
    await deleteDoc(doc(db, path, docId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Cloud Sync for User Profiles
 */
export async function saveUserToFirestore(user: UserAccount) {
  const path = 'users';
  try {
    const docId = sanitizeDocId(user.id, 'u');
    const docRef = doc(db, path, docId);
    const cleaned = cleanObjectForFirestore(user);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function loadUsersFromFirestore(): Promise<UserAccount[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const list: UserAccount[] = [];
    snap.forEach(d => {
      const item = d.data();
      if (item && (item.nome || item.matricula || item.usuario)) list.push(item as UserAccount);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Cloud Sync for Inversão (Table of Inversions, Custom Quantities & Excluded Pairs)
 */
export async function saveInversoesToFirestore(payload: InversaoSyncPayload): Promise<boolean> {
  const path = 'inversoes';
  const docId = sanitizeDocId(`${payload.deposito || 'ALL'}_${payload.baseMode || 'conciliacao'}`, 'inversao_state');
  try {
    const docRef = doc(db, path, docId);
    const cleaned = cleanObjectForFirestore({
      id: docId,
      deposito: String(payload.deposito || 'ALL'),
      baseMode: String(payload.baseMode || 'conciliacao'),
      deletedKeys: Array.isArray(payload.deletedKeys) ? payload.deletedKeys : [],
      customPairs: payload.customPairs ? JSON.stringify(payload.customPairs) : '{}',
      fullPairs: payload.fullPairs ? JSON.stringify(payload.fullPairs) : '[]',
      atualizadoEm: new Date().toISOString()
    });
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firebase] Warning saving inversoes to Firestore:', error);
    return false;
  }
}

export async function loadInversoesFromFirestore(
  deposito: string = 'ALL', 
  baseMode: string = 'conciliacao'
): Promise<InversaoSyncPayload | null> {
  const path = 'inversoes';
  const docId = sanitizeDocId(`${deposito || 'ALL'}_${baseMode || 'conciliacao'}`, 'inversao_state');
  try {
    const docRef = doc(db, path, docId);
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data();
      let customPairs = {};
      let fullPairs = [];
      try {
        if (typeof data.customPairs === 'string') customPairs = JSON.parse(data.customPairs);
      } catch {}
      try {
        if (typeof data.fullPairs === 'string') fullPairs = JSON.parse(data.fullPairs);
      } catch {}
      return {
        deposito: data.deposito,
        baseMode: data.baseMode,
        deletedKeys: Array.isArray(data.deletedKeys) ? data.deletedKeys : [],
        customPairs,
        fullPairs,
        atualizadoEm: data.atualizadoEm
      };
    }
  } catch (error) {
    console.warn('[Firebase] Warning loading inversoes from Firestore:', error);
  }
  return null;
}

export async function loadAllInversoesFromFirestore(): Promise<InversaoSyncPayload[]> {
  const path = 'inversoes';
  try {
    const snap = await getDocs(collection(db, path));
    const list: InversaoSyncPayload[] = [];
    snap.forEach(d => {
      const data = d.data();
      let customPairs = {};
      let fullPairs = [];
      try {
        if (typeof data.customPairs === 'string') customPairs = JSON.parse(data.customPairs);
      } catch {}
      try {
        if (typeof data.fullPairs === 'string') fullPairs = JSON.parse(data.fullPairs);
      } catch {}
      list.push({
        deposito: data.deposito,
        baseMode: data.baseMode,
        deletedKeys: Array.isArray(data.deletedKeys) ? data.deletedKeys : [],
        customPairs,
        fullPairs,
        atualizadoEm: data.atualizadoEm
      });
    });
    return list;
  } catch (error) {
    console.warn('[Firebase] Warning loading all inversoes from Firestore:', error);
    return [];
  }
}

/**
 * Cloud Sync for Products Master Catalog
 */
export async function saveProductsToFirestore(products: ProductMaster[]): Promise<boolean> {
  if (!products || products.length === 0) return false;
  const path = 'products';
  try {
    await runInChunks(products, 30, async (prod) => {
      const code = prod.codigo || (prod as any).sku || '';
      const docId = sanitizeDocId(code, 'sku');
      const docRef = doc(db, path, docId);
      const cleaned = cleanObjectForFirestore({
        codigo: code,
        descricao: prod.descricao,
        fatorSku: Number(prod.fatorSku || 1),
        fatorPallet: Number(prod.fatorPallet || 1),
        embalagem: prod.embalagem || '',
        grupo: prod.grupo || 'GERAL',
        valor: Number(prod.valor || 0),
        valorUnit: Number(prod.valorUnit || 0),
        fatorHl: Number(prod.fatorHl || 0),
        idade: Number(prod.idade || 180),
        atualizadoEm: new Date().toISOString()
      });
      return setDoc(docRef, cleaned, { merge: true });
    });
    return true;
  } catch (err) {
    console.warn('[Firebase] Warning saving products to Firestore:', err);
    return false;
  }
}

export async function loadProductsFromFirestore(): Promise<ProductMaster[]> {
  const path = 'products';
  try {
    const snap = await getDocs(collection(db, path));
    const list: ProductMaster[] = [];
    snap.forEach(d => {
      const data = d.data() as any;
      if (data && (data.codigo || data.sku)) {
        list.push({
          codigo: data.codigo || data.sku,
          descricao: data.descricao || '',
          fatorSku: Number(data.fatorSku || 1),
          fatorPallet: Number(data.fatorPallet || 1),
          embalagem: data.embalagem || '',
          grupo: data.grupo || 'GERAL',
          valor: Number(data.valor || 0),
          valorUnit: Number(data.valorUnit || 0),
          fatorHl: Number(data.fatorHl || 0),
          idade: Number(data.idade || 180)
        });
      }
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Warning loading products from Firestore:', err);
    return [];
  }
}

/**
 * Cloud Sync for App Settings (e.g. Weekly Billing Status)
 */
export async function saveAppSettingsToFirestore(key: string, data: any): Promise<boolean> {
  const path = 'appSettings';
  try {
    const docRef = doc(db, path, sanitizeDocId(key, 'setting'));
    const cleaned = cleanObjectForFirestore({
      key,
      payload: typeof data === 'object' ? JSON.stringify(data) : data,
      atualizadoEm: new Date().toISOString()
    });
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Warning saving appSettings to Firestore:', err);
    return false;
  }
}

export async function loadAppSettingsFromFirestore<T>(key: string): Promise<T | null> {
  const path = 'appSettings';
  try {
    const snap = await getDocs(collection(db, path));
    const target = snap.docs.find(d => d.id === sanitizeDocId(key, 'setting'));
    if (target && target.exists()) {
      const d = target.data();
      if (typeof d.payload === 'string') {
        try {
          return JSON.parse(d.payload) as T;
        } catch {
          return d.payload as unknown as T;
        }
      }
      return d.payload as T;
    }
  } catch (err) {
    console.warn('[Firebase] Warning loading appSettings from Firestore:', err);
  }
  return null;
}
