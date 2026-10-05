import { QuebraItem } from '../types';
import { parseDateSafe } from './quebrasReports';
import { INITIAL_QUEBRAS } from '../data/initialData';
import { getSkuUnitMetrics } from './productCatalog';
import { 
  QUEBRAS_SETEMBRO_08_12_2026, 
  QUEBRAS_SETEMBRO_14_19_2026, 
  QUEBRAS_SETEMBRO_21_25_2026 
} from '../data/quebrasSetembroData';

export const EXCLUDED_QUEBRA_IDS = new Set([
  'q-20260831-1',
  'q-20260831-12',
  'q-20260901-33',
  'q-20260902-56',
  'q-20260902-62',
  'q-20260904-98',
  'q-20260905-121'
]);

/**
 * Normaliza data para formato DD/MM/YYYY
 */
export function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const clean = d.trim();
  const dt = parseDateSafe(clean);
  if (!dt) return clean;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Gera uma assinatura única para detectar duplicidades reais de lançamento
 */
export function getQuebraSignature(q: QuebraItem): string {
  const normDate = normalizeDateStr(q.data);
  const sku = (q.sku || '').trim().replace(/^0+/, '');
  const qtd = Number(q.quantidade || 0).toFixed(0);
  const valor = Number(q.valorTotal || 0).toFixed(2);
  const motivo = (q.motivo || '').trim().toUpperCase();
  const area = (q.area || '').trim().toUpperCase();
  const turno = (q.turno || '').trim().toUpperCase();
  const codQuebra = (q.codQuebra || '').trim();
  const deposito = (q.deposito || '01').trim();
  return `${normDate}|${sku}|${qtd}|${valor}|${motivo}|${area}|${turno}|${codQuebra}|${deposito}`;
}

/**
 * Identifica se um registro é um placeholder sintético de resumo semanal
 */
export function isSyntheticSummaryItem(q: QuebraItem): boolean {
  if (!q.id) return false;
  const idLower = q.id.toLowerCase();
  // Apenas os IDs sintéticos legados que representavam a semana inteira somada
  if (
    q.id === 'q-jul-27-1' ||
    q.id === 'q-jul-20-1' ||
    (q.id === 'q-jul-13-1' && (q.quantidade > 200 || q.valorTotal > 1000))
  ) {
    return true;
  }
  return false;
}

/**
 * Verifica se o lançamento está no intervalo das 8 semanas oficiais (06/07/2026 a 28/08/2026)
 */
export function isInOfficial8WeeksRange(dataStr: string): boolean {
  const dt = parseDateSafe(dataStr);
  if (!dt) return false;
  const d06Jul = new Date(2026, 6, 6, 0, 0, 0);
  const d28Aug = new Date(2026, 7, 28, 23, 59, 59);
  return dt >= d06Jul && dt <= d28Aug;
}

/**
 * Detecta se a base de dados acumulou duplicidades que inflaram o valor das 8 semanas (ex: R$ 16.901,19)
 */
export function isCorruptedOrInflatedDataset(items: QuebraItem[]): boolean {
  if (!items || items.length === 0) return false;
  let sum8Weeks = 0;
  for (const q of items) {
    if (isInOfficial8WeeksRange(q.data)) {
      sum8Weeks += Number(q.valorTotal) || 0;
    }
  }
  // Se o total acumulado das 8 semanas passar de R$ 14.000 (o oficial com detalhamento DRE é R$ 10.665,15), está inflado com duplicações
  return sum8Weeks > 14000;
}

/**
 * Sanitiza e remove duplicidades da base de Quebras:
 * 1. Remove duplicidades exatas de ID
 * 2. Remove duplicidades lógicas (mesmo dia, produto, quantidade, motivo, valor e área)
 * 3. Remove placeholders sintéticos se já existirem itens reais detalhados para a semana
 * 4. Garante coerência numérica nos relatórios, restaurando a base oficial se corrompida/duplicada
 */
export function sanitizeAndDeduplicateQuebras(quebras: QuebraItem[]): {
  cleaned: QuebraItem[];
  duplicatesRemoved: number;
  syntheticRemoved: number;
  isCorrupted: boolean;
} {
  if (!Array.isArray(quebras) || quebras.length === 0) {
    return { cleaned: INITIAL_QUEBRAS, duplicatesRemoved: 0, syntheticRemoved: 0, isCorrupted: false };
  }

  let duplicatesRemoved = 0;
  let syntheticRemoved = 0;

  // 1. Deduplicação por ID e exclusão de itens espúrios removidos
  const seenIds = new Set<string>();
  const idDeduplicated: QuebraItem[] = [];
  for (const q of quebras) {
    if (!q || typeof q !== 'object') continue;
    const id = q.id || `q-${Math.random()}`;
    if (EXCLUDED_QUEBRA_IDS.has(id)) {
      continue;
    }
    if (!seenIds.has(id)) {
      seenIds.add(id);
      idDeduplicated.push(q);
    } else {
      duplicatesRemoved++;
    }
  }

  // 2. Agrupa por data para identificar semanas com registros detalhados
  const realDatesCount = new Map<string, number>();
  idDeduplicated.forEach(q => {
    if (!isSyntheticSummaryItem(q)) {
      const dt = parseDateSafe(q.data);
      if (dt) {
        // Encontra a segunda-feira da semana
        const day = dt.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diff);
        const weekKey = `${mon.getFullYear()}-${mon.getMonth() + 1}-${mon.getDate()}`;
        realDatesCount.set(weekKey, (realDatesCount.get(weekKey) || 0) + 1);
      }
    }
  });

  // 3. Filtra placeholders sintéticos redundantes
  const withoutRedundantSynthetics: QuebraItem[] = [];
  idDeduplicated.forEach(q => {
    if (isSyntheticSummaryItem(q)) {
      const dt = parseDateSafe(q.data);
      if (dt) {
        const day = dt.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diff);
        const weekKey = `${mon.getFullYear()}-${mon.getMonth() + 1}-${mon.getDate()}`;
        // Se a semana já tem mais de 3 itens reais detalhados, o resumo sintético é descartado
        if ((realDatesCount.get(weekKey) || 0) >= 3) {
          syntheticRemoved++;
          return;
        }
      }
    }
    withoutRedundantSynthetics.push(q);
  });

  // 4. Deduplicação por assinatura transacional lógica (mesmo lançamento duplicado por re-importação)
  const seenSignatures = new Map<string, QuebraItem>();
  const finalCleaned: QuebraItem[] = [];

  for (const q of withoutRedundantSynthetics) {
    const sig = getQuebraSignature(q);
    if (!seenSignatures.has(sig)) {
      seenSignatures.set(sig, q);
      finalCleaned.push(q);
    } else {
      // Se o item duplicado tiver status faturado 'OK' e o anterior não, atualiza
      const existing = seenSignatures.get(sig)!;
      if (q.faturado && !existing.faturado) {
        existing.faturado = true;
      }
      duplicatesRemoved++;
    }
  }

  // 5. Verificação de integridade e valor inflado
  const isCorrupted = isCorruptedOrInflatedDataset(finalCleaned);
  let safeBase = finalCleaned;
  if (isCorrupted) {
    // Analista de Dados: NUNCA descarta os lançamentos recentes de Setembro (>= 31/08/2026)!
    // Apenas higieniza a janela histórica antiga (06/07 a 28/08) para remover duplicações herdadas
    const recentOrImported = finalCleaned.filter(q => {
      const dt = parseDateSafe(q.data);
      return !dt || dt >= new Date(2026, 7, 31);
    });
    const historicalClean = INITIAL_QUEBRAS.filter(q => {
      const dt = parseDateSafe(q.data);
      return dt && dt < new Date(2026, 7, 31);
    });
    safeBase = [...historicalClean, ...recentOrImported];
  }
  const guaranteed = ensureCompleteHistoricalQuebras(safeBase);

  return {
    cleaned: guaranteed,
    duplicatesRemoved,
    syntheticRemoved,
    isCorrupted,
  };
}

/**
 * Garante a integridade inviolável do histórico de Quebras:
 * - Mantém integralmente todas as semanas históricas anteriores (22/06 a 05/09)
 * - Mantém a semana 07/09 a 11/09 (08/09 a 12/09/2026)
 * - Mantém e protege a semana 14/09 a 18/09 (lançamentos de 14/09/2026)
 * - Mantém e protege a semana 21/09 a 25/09 (planilha do dia 21/09/2026 a 21/09/2026)
 * - Restaura qualquer semana histórica que tenha sido truncada ou zerada por importações indevidas
 */
export function ensureCompleteHistoricalQuebras(quebras: QuebraItem[]): QuebraItem[] {
  if (!Array.isArray(quebras) || quebras.length === 0) {
    return INITIAL_QUEBRAS;
  }

  const targetWeeks = [
    '21/09 - 25/09',
    '14/09 - 18/09',
    '07/09 - 11/09',
    '31/08 - 05/09',
    '24/08 - 28/08',
    '17/08 - 21/08',
    '10/08 - 14/08',
    '03/08 - 07/08',
    '27/07 - 31/07',
    '20/07 - 24/07',
    '13/07 - 17/07',
    '06/07 - 10/07',
    '29/06 - 03/07',
    '22/06 - 26/06'
  ];

  // Mapa de IDs existentes para evitar duplicações
  const existingById = new Map<string, QuebraItem>();
  quebras.forEach(q => {
    if (q && q.id && !EXCLUDED_QUEBRA_IDS.has(q.id)) {
      existingById.set(q.id, q);
    }
  });

  // 1. Verifica cada semana histórica auditada
  for (const weekLabel of targetWeeks) {
    const historicalItemsForWeek = INITIAL_QUEBRAS.filter(q => q.semanaRef === weekLabel && !EXCLUDED_QUEBRA_IDS.has(q.id));
    const currentItemsForWeek = Array.from(existingById.values()).filter(q => q.semanaRef === weekLabel);

    const historicalSum = historicalItemsForWeek.reduce((acc, q) => acc + (q.valorTotal || 0), 0);
    const currentSum = currentItemsForWeek.reduce((acc, q) => acc + (q.valorTotal || 0), 0);

    // Se a semana histórica oficial estiver vazia ou com valor menor que 80% do oficial auditado, restaura os itens oficiais daquela semana
    if (historicalItemsForWeek.length > 0 && (currentItemsForWeek.length === 0 || currentSum < historicalSum * 0.8)) {
      currentItemsForWeek.forEach(q => existingById.delete(q.id));
      historicalItemsForWeek.forEach(q => existingById.set(q.id, q));
    }
  }

  // 2. Garante a presença dos itens oficiais da semana 07/09 - 11/09 (08/09 a 12/09/2026)
  const currentWeek0812 = Array.from(existingById.values()).filter(q =>
    q.semanaRef === '07/09 - 11/09' ||
    (q.data && (q.data === '08/09/2026' || q.data === '09/09/2026' || q.data === '10/09/2026' || q.data === '11/09/2026' || q.data === '12/09/2026'))
  );
  if (currentWeek0812.length === 0) {
    QUEBRAS_SETEMBRO_08_12_2026.forEach(q => existingById.set(q.id, q));
  }

  // 3. Garante a presença dos itens oficiais da semana 14/09 - 18/09 (14/09/2026 a 18/09/2026)
  const currentWeek1418 = Array.from(existingById.values()).filter(q =>
    q.semanaRef === '14/09 - 18/09' ||
    (q.data && (q.data === '14/09/2026' || q.data.startsWith('14/09/')))
  );
  const sum1418 = currentWeek1418.reduce((sum, q) => sum + (q.valorTotal || 0), 0);
  if (currentWeek1418.length === 0 || sum1418 < 100) {
    currentWeek1418.forEach(q => existingById.delete(q.id));
    QUEBRAS_SETEMBRO_14_19_2026.forEach(q => existingById.set(q.id, q));
  }

  // 4. Garante a presença dos itens oficiais da semana 21/09 - 25/09 (planilha do dia 21/09/2026 a 21/09/2026)
  const currentWeek2125 = Array.from(existingById.values()).filter(q =>
    q.semanaRef === '21/09 - 25/09' ||
    (q.data && (q.data === '21/09/2026' || q.data.startsWith('21/09/')))
  );
  const sum2125 = currentWeek2125.reduce((sum, q) => sum + (q.valorTotal || 0), 0);
  if (currentWeek2125.length === 0 || sum2125 < 100) {
    currentWeek2125.forEach(q => existingById.delete(q.id));
    QUEBRAS_SETEMBRO_21_25_2026.forEach(q => existingById.set(q.id, q));
  }

  // 5. Garante que NENHUM item de quebra existente fique com valorTotal 0 ou volumeHl 0
  for (const q of existingById.values()) {
    if (!q.valorTotal || q.valorTotal <= 0) {
      const metrics = getSkuUnitMetrics(q.sku);
      if (metrics && metrics.unitPrice > 0) {
        q.valorTotal = Math.round(q.quantidade * metrics.unitPrice * 100) / 100;
      }
    }
    if (!q.volumeHl || q.volumeHl <= 0) {
      const metrics = getSkuUnitMetrics(q.sku);
      if (metrics && metrics.unitHl > 0) {
        q.volumeHl = Math.round(q.quantidade * metrics.unitHl * 10000) / 10000;
      }
    }
  }

  return Array.from(existingById.values());
}

