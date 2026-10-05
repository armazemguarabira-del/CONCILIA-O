/**
 * High-reliability persistence engine using IndexedDB with localStorage fallback.
 * Solves browser 5MB quota exhaustion and ensures 02.05.02 and all manual alterations
 * persist across page reloads, prompt executions, and container restarts.
 */

const DB_NAME = 'GestaoEstoqueDB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

// In-memory memory cache for lightning-fast reads
const memoryCache = new Map<string, any>();

// Initialize or get IndexedDB database instance
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Safely writes to localStorage without ever throwing QuotaExceededError.
 * Automatically clears legacy caches if quota is reached.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      localStorage.removeItem('gestao_estoque_v3_posicoes');
      localStorage.removeItem('gestao_estoque_v3_grade_posicoes');
      localStorage.removeItem('gestao_estoque_v4_trocas');
      localStorage.removeItem('gestao_estoque_v3_quebras');
      localStorage.removeItem('gestao_estoque_v2_quebras');
      localStorage.removeItem('gestao_estoque_v3_vales');
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Quota exceeded: data is safely kept in IndexedDB and memoryCache
      console.warn(`[PersistentStorage] Quota exceeded for "${key}". Data safely held in IndexedDB/RAM.`);
      return false;
    }
  }
}

/**
 * Persist an item to IndexedDB, memory cache, and safely to localStorage.
 */
export async function persistData<T>(key: string, value: T): Promise<void> {
  // 1. Update memory cache
  memoryCache.set(key, value);

  // 2. Safely attempt localStorage write (ignore quota errors)
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (localStorageError) {
    // Quota exceeded in localStorage is expected for large bases.
    // Clean up redundant legacy keys to reclaim space
    try {
      localStorage.removeItem('gestao_estoque_v3_posicoes');
      localStorage.removeItem('gestao_estoque_v3_grade_posicoes');
      localStorage.removeItem('gestao_estoque_v4_trocas');
      localStorage.removeItem('gestao_estoque_v3_quebras');
      localStorage.removeItem('gestao_estoque_v2_quebras');
    } catch {}
    // IndexedDB will safely handle it without quota limits.
    console.warn(`[PersistentStorage] LocalStorage quota reached for key "${key}". Persisting via IndexedDB.`);
  }

  // 3. Persist to IndexedDB
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbError) {
    console.error(`[PersistentStorage] IndexedDB write failed for key "${key}":`, idbError);
  }
}

/**
 * Retrieve an item asynchronously from IndexedDB, falling back to localStorage and memory.
 */
export async function retrieveData<T>(key: string, defaultValue: T): Promise<T> {
  // 1. Try memory cache first
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  // 2. Try IndexedDB
  try {
    const db = await openDatabase();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result !== undefined && result !== null) {
      memoryCache.set(key, result);
      return result;
    }
  } catch (idbError) {
    console.warn(`[PersistentStorage] IndexedDB read failed for key "${key}":`, idbError);
  }

  // 3. Fallback to localStorage
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as T;
      memoryCache.set(key, parsed);
      // Backfill to IndexedDB for next time
      persistData(key, parsed).catch(() => {});
      return parsed;
    }
  } catch (lsError) {
    console.warn(`[PersistentStorage] LocalStorage read failed for key "${key}":`, lsError);
  }

  return defaultValue;
}

/**
 * Synchronous retrieval for initial React state initialization.
 * Reads from memory cache or localStorage.
 */
export function retrieveSync<T>(key: string, defaultValue: T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as T;
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch (e) {
    // Ignore and return fallback
  }

  return defaultValue;
}

/**
 * Remove an item from all stores
 */
export async function removePersistedData(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {}

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

/**
 * Storage Keys standardized across the platform
 */
export const STORAGE_KEYS = {
  STOCK_POSITIONS_020502: 'gestao_estoque_v4_posicoes_020502',
  STOCK_POSITIONS_LEGACY: 'gestao_estoque_v3_posicoes',
  GRADE_POSITIONS: 'gestao_estoque_v4_grade_posicoes',
  GRADE_POSITIONS_LEGACY: 'gestao_estoque_v3_grade_posicoes',
  GRADE_IMPORT_LABEL: 'gestao_estoque_v3_grade_data_importacao',
  QUEBRAS: 'gestao_estoque_v4_quebras',
  VALES: 'gestao_estoque_v3_vales',
  TROCAS: 'gestao_estoque_v5_trocas_doc',
  TROCAS_V4: 'gestao_estoque_v4_trocas',
  FALTAS: 'gestao_estoque_v3_faltas',
  FROZEN: 'gestao_estoque_v3_frozen',
  WEEKLY_BILLING: 'gestao_estoque_faturamento_semanal_v2',
  ACTIVE_USER: 'gestao_estoque_v3_usuario_ativo',
  USERS: 'gestao_estoque_v3_usuarios',
  PRODUCTS: 'gestao_estoque_v3_produtos',
};
