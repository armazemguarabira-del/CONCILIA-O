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
  deleteDoc 
} from 'firebase/firestore';
import type { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  FrozenReconciliation, 
  UserAccount 
} from '../types';

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
  if (!auth.currentUser || !items || items.length === 0) return false;
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
  }
}

export async function loadStockPositionsFromFirestore(): Promise<StockPositionItem[]> {
  if (!auth.currentUser) return [];
  const path = 'stockPositions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: StockPositionItem[] = [];
    snap.forEach(docSnap => {
      list.push(docSnap.data() as StockPositionItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Grade de Estoque Positions (02.05.02 da Grade)
 */
export async function saveGradePositionsToFirestore(items: StockPositionItem[]) {
  if (!auth.currentUser || !items || items.length === 0) return false;
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
  }
}

export async function loadGradePositionsFromFirestore(): Promise<StockPositionItem[]> {
  if (!auth.currentUser) return [];
  const path = 'gradePositions';
  try {
    const snap = await getDocs(collection(db, path));
    const list: StockPositionItem[] = [];
    snap.forEach(docSnap => {
      list.push(docSnap.data() as StockPositionItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Quebras
 */
export async function saveQuebrasToFirestore(quebras: QuebraItem[]) {
  if (!auth.currentUser || !quebras || quebras.length === 0) return false;
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
  }
}

export async function loadQuebrasFromFirestore(): Promise<QuebraItem[]> {
  if (!auth.currentUser) return [];
  const path = 'quebras';
  try {
    const snap = await getDocs(collection(db, path));
    const list: QuebraItem[] = [];
    snap.forEach(d => list.push(d.data() as QuebraItem));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Vales
 */
export async function saveValesToFirestore(vales: ValeItem[]) {
  if (!auth.currentUser || !vales || vales.length === 0) return false;
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
  }
}

export async function loadValesFromFirestore(): Promise<ValeItem[]> {
  if (!auth.currentUser) return [];
  const path = 'vales';
  try {
    const snap = await getDocs(collection(db, path));
    const list: ValeItem[] = [];
    snap.forEach(d => list.push(d.data() as ValeItem));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Trocas
 */
export async function saveTrocasToFirestore(trocas: TrocaItem[]) {
  if (!auth.currentUser || !trocas || trocas.length === 0) return false;
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
  }
}

export async function loadTrocasFromFirestore(): Promise<TrocaItem[]> {
  if (!auth.currentUser) return [];
  const path = 'trocas';
  try {
    const snap = await getDocs(collection(db, path));
    const list: TrocaItem[] = [];
    snap.forEach(d => list.push(d.data() as TrocaItem));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Faltas Mapeadas
 */
export async function saveFaltasToFirestore(faltas: FaltaMapeadaItem[]) {
  if (!auth.currentUser || !faltas || faltas.length === 0) return false;
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
  }
}

export async function deleteFaltaFromFirestore(id: string) {
  if (!auth.currentUser) return false;
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
  if (!auth.currentUser || ids.length === 0) return false;
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
  if (!auth.currentUser) return [];
  const path = 'faltasMapeadas';
  try {
    const snap = await getDocs(collection(db, path));
    const list: FaltaMapeadaItem[] = [];
    snap.forEach(d => list.push(d.data() as FaltaMapeadaItem));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Cloud Sync for Frozen Reconciliations
 */
export async function saveFrozenReconciliationToFirestore(item: FrozenReconciliation) {
  if (!auth.currentUser) return false;
  const path = 'frozenReconciliations';
  try {
    const docId = sanitizeDocId(item.id, 'fr');
    const docRef = doc(db, path, docId);
    const cleaned = cleanObjectForFirestore(item);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadFrozenReconciliationsFromFirestore(): Promise<FrozenReconciliation[]> {
  if (!auth.currentUser) return [];
  const path = 'frozenReconciliations';
  try {
    const snap = await getDocs(collection(db, path));
    const list: FrozenReconciliation[] = [];
    snap.forEach(d => list.push(d.data() as FrozenReconciliation));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteFrozenReconciliationFromFirestore(id: string) {
  if (!auth.currentUser) return false;
  const path = 'frozenReconciliations';
  try {
    const docId = sanitizeDocId(id, 'fr');
    await deleteDoc(doc(db, path, docId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Cloud Sync for User Profiles
 */
export async function saveUserToFirestore(user: UserAccount) {
  if (!auth.currentUser) return false;
  const path = 'users';
  try {
    const docId = sanitizeDocId(user.id, 'u');
    const docRef = doc(db, path, docId);
    const cleaned = cleanObjectForFirestore(user);
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUsersFromFirestore(): Promise<UserAccount[]> {
  if (!auth.currentUser) return [];
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const list: UserAccount[] = [];
    snap.forEach(d => list.push(d.data() as UserAccount));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
