import { 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId 
} from '../types';
import { formatSkuUnit } from './parsers';
import { parseDateSafe } from './quebrasReports';

export interface DeviationDetail {
  units: number;         // Quantidade em unidades físicas (latas/garrafas avulsas)
  skus: number;          // Quantidade fracionária em caixas: units / fatorSku
  boxesInt: number;      // Caixas inteiras: Math.floor(units / fatorSku)
  looseUnits: number;    // Unidades soltas: units % fatorSku
  raw: string;           // Formato Ambev cx/un, ex: "35/05"
  valor: number;         // Valor financeiro total apurado (R$)
  volumeHl: number;      // Volume em hectolitros (HL)
  count: number;         // Quantidade de registros na respectiva guia
}

export interface SkuDeviationsResult {
  quebras: DeviationDetail;
  trocas: DeviationDetail;
  vales: DeviationDetail;
  faltas: DeviationDetail;
  total: DeviationDetail;
}

/**
 * Verifica se uma quebra já foi faturada (baixada no sistema financeiro).
 * Quebras faturadas NÃO entram na amortização de divergências de estoque na conciliação.
 * 
 * REGRA CRÍTICA DE NEGÓCIO AMBEV:
 * "Só tenho essa semana de quebras pendentes (31/08 - 05/09) então somente ela deve ser
 * considerada no congelamento de quebras que impacta a amortização no final das divergências,
 * além das que eu vou inserir para as datas restantes."
 * 
 * - Semanas anteriores a 31/08/2026 já foram faturadas e baixadas.
 * - A semana '31/08 - 05/09' e quaisquer datas inseridas >= 31/08/2026 são PENDENTES por padrão
 *   (a não ser que tenham sido baixadas explicitamente no sistema ou marcado faturado).
 */
export function isQuebraFaturada(
  q: QuebraItem, 
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  // 1. Marcação individual explícita
  if (q.faturado) return true;

  // 2. Se a semana possui status explícito no mapa gerenciado pelo usuário
  if (billingStatusMap && q.semanaRef && billingStatusMap[q.semanaRef]) {
    return billingStatusMap[q.semanaRef] === 'OK';
  }

  // 3. Regra temporal da logística Ambev:
  // Histórico anterior a 31/08/2026 já teve baixa contábil efetuada
  const dt = parseDateSafe(q.data);
  if (dt) {
    const cutoffPendingDate = new Date(2026, 7, 31, 0, 0, 0); // 31/08/2026 (Mês 7 = Agosto)
    if (dt < cutoffPendingDate) {
      return true; // Períodos anteriores a 31/08 já foram baixados
    }
  } else if (q.semanaRef && q.semanaRef !== '31/08 - 05/09') {
    // Sem data mas com identificador de semana anterior
    return true;
  }

  // A semana '31/08 - 05/09' e quaisquer novas datas inseridas (>= 31/08/2026) são PENDENTES
  return false;
}

/**
 * Verifica se uma quebra é pendente de faturamento (deve amortizar a conciliação).
 */
export function isQuebraPendente(
  q: QuebraItem, 
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  return !isQuebraFaturada(q, billingStatusMap);
}

/**
 * Verifica se uma troca/reposição já foi baixada / faturada no sistema.
 * Itens baixados NÃO amortizam divergências na conciliação atual.
 */
export function isTrocaFaturada(
  t: TrocaItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  // 1. Prioridade absoluta: status explícito do usuário no item
  if (t.faturado === true) return true;
  if (t.faturado === false) return false;

  // 2. Se o status textual indica explicitamente pendência
  const st = (t.statusPromax || '').toLowerCase().trim();
  if (st.includes('pendente') || st.includes('aberto') || st.includes('cadastrado') || st.includes('em aberto')) {
    return false;
  }

  // 3. Se o status textual indica liquidação/baixa
  if (st.includes('baixado') || st.includes('faturado') || st.includes('liquidado') || st.includes('concluido') || st.includes('resolvido')) {
    return true;
  }

  // 4. Semana com status no mapa
  if (billingStatusMap && t.semanaRef && billingStatusMap[t.semanaRef]) {
    return billingStatusMap[t.semanaRef] === 'OK';
  }

  // 5. Regra temporal de corte apenas se não houver nenhuma outra indicação
  const dt = parseDateSafe(t.data);
  if (dt) {
    const cutoffPendingDate = new Date(2026, 7, 31, 0, 0, 0); // 31/08/2026
    if (dt < cutoffPendingDate) {
      return true;
    }
  }
  return false;
}

export function isTrocaPendente(
  t: TrocaItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  return !isTrocaFaturada(t, billingStatusMap);
}

export function matchSku(skuA?: string, skuB?: string): boolean {
  if (!skuA || !skuB) return false;
  const a = String(skuA).trim();
  const b = String(skuB).trim();
  if (a === b) return true;
  const cleanA = a.replace(/^0+/, '');
  const cleanB = b.replace(/^0+/, '');
  return cleanA.length > 0 && cleanA === cleanB;
}

/**
 * Verifica se um vale de equipe já foi baixado / liquidado.
 * Vales são considerados pendentes por padrão até que sejam expressamente liquidados/baixados.
 */
export function isValeFaturado(
  v: ValeItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  if (v.faturado === true) return true;
  if (v.faturado === false) return false;
  const st = (v.statusVale || '').toLowerCase().trim();
  if (st.includes('pendente') || st.includes('aberto') || st.includes('emitido') || st.includes('assinado') || st.includes('em aberto')) {
    return false;
  }
  if (st.includes('baixado') || st.includes('faturado') || st.includes('liquidado') || st.includes('concluido') || st.includes('pago')) {
    return true;
  }
  if (billingStatusMap && v.semanaRef && billingStatusMap[v.semanaRef]) {
    return billingStatusMap[v.semanaRef] === 'OK';
  }
  return false;
}

export function isValePendente(
  v: ValeItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  return !isValeFaturado(v, billingStatusMap);
}

/**
 * Verifica se uma falta mapeada já foi baixada / resolvida.
 * Faltas resolvidas NÃO amortizam divergências na conciliação atual.
 */
export function isFaltaFaturada(
  f: FaltaMapeadaItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  if (f.faturado === true) return true;
  if (f.faturado === false) return false;
  const st = (f.status || f.motivo || '').toLowerCase().trim();
  if (st.includes('pendente') || st.includes('aberto') || st.includes('em aberto')) {
    return false;
  }
  if (st.includes('baixado') || st.includes('resolvido') || st.includes('liquidado') || st.includes('faturado') || st.includes('ajustado')) {
    return true;
  }
  if (billingStatusMap && f.semanaRef && billingStatusMap[f.semanaRef]) {
    return billingStatusMap[f.semanaRef] === 'OK';
  }
  const dt = parseDateSafe(f.data);
  if (dt) {
    const cutoffPendingDate = new Date(2026, 7, 31, 0, 0, 0); // 31/08/2026
    if (dt < cutoffPendingDate) {
      return true;
    }
  }
  return false;
}

export function isFaltaPendente(
  f: FaltaMapeadaItem,
  billingStatusMap?: Record<string, 'PENDENTE' | 'OK'>
): boolean {
  return !isFaltaFaturada(f, billingStatusMap);
}

/**
 * Calcula de forma 100% coerente e unificada todas as quantidades e valores dos desvios
 * para um SKU específico, respeitando a unidade de medida real de cada guia operacional.
 * REGRA CRÍTICA: Apenas desvios PENDENTES de baixa/faturamento amortizam o estoque físico.
 */
export function calculateSkuDeviations(
  sku: string,
  deposito: DepositoId | 'ALL',
  fatorSku: number,
  valorUnitario: number,
  valorCaixa: number,
  fatorHl: number,
  quebras: QuebraItem[] = [],
  vales: ValeItem[] = [],
  trocas: TrocaItem[] = [],
  faltasMapeadas: FaltaMapeadaItem[] = [],
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>
): SkuDeviationsResult {
  const normSku = String(sku).trim();
  const fator = Math.max(1, fatorSku || 1);
  const unitPrice = valorUnitario > 0 ? valorUnitario : (valorCaixa > 0 ? valorCaixa / fator : 0);
  const boxPrice = valorCaixa > 0 ? valorCaixa : unitPrice * fator;
  const hlFactor = fatorHl || 0;

  // 1. QUEBRAS OPERACIONAIS (Sempre registradas em UNIDADES de latas/garrafas avulsas)
  // REGRA DE NEGÓCIO: Apenas quebras PENDENTES amortizam o estoque físico na conciliação.
  const itemQuebras = quebras.filter(q => {
    if (isQuebraFaturada(q, weeklyBillingStatus)) return false;
    const depOk = deposito === 'ALL' ? true : q.deposito === deposito;
    return matchSku(q.sku, normSku) && depOk;
  });

  let quebrasUnits = 0;
  let quebrasValor = 0;
  let quebrasHl = 0;

  itemQuebras.forEach(q => {
    const qQty = Math.abs(q.quantidade || 0);
    // Em quebras, a quantidade é sempre em unidades físicas
    const units = Math.round(qQty);
    const val = (q.valorTotal != null && q.valorTotal > 0) 
      ? q.valorTotal 
      : (units * unitPrice);
    const hl = (q.volumeHl != null && q.volumeHl > 0) 
      ? q.volumeHl 
      : ((units / fator) * hlFactor);

    quebrasUnits += units;
    quebrasValor += val;
    quebrasHl += hl;
  });

  // 2. TROCAS & REPOSIÇÕES (Apenas pendentes amortizam)
  const itemTrocas = trocas.filter(t => {
    if (isTrocaFaturada(t, weeklyBillingStatus)) return false;
    const codes = (t.codigos || '').split(/[,;|\s]+/).map(c => c.trim()).filter(Boolean);
    const depOk = deposito === 'ALL' ? true : (!t.deposito || t.deposito === deposito);
    return (codes.some(c => matchSku(c, normSku)) || matchSku(t.sku, normSku)) && depOk;
  });

  let trocasUnits = 0;
  let trocasValor = 0;
  let trocasHl = 0;

  itemTrocas.forEach(t => {
    const qty = Math.abs(t.quantidade || 0);
    const um = String(t.unidadeMedida || '').trim().toUpperCase();
    const isBoxUnit = ['CX', 'CAIXA', 'CAIXAS', 'SKU', 'SKUS', 'FD', 'FARDO', 'FARDOS', 'PAL', 'PALETE', 'PALETES'].includes(um);
    const isLooseUnit = ['UND', 'UN', 'UNIDADE', 'UNIDADES', 'LATA', 'LATAS', 'GFA', 'GARRAFA', 'GARRAFAS', 'PET', 'LONG NECK', 'VD'].includes(um);

    let units = 0;
    if (isBoxUnit) {
      // Se marcado CX mas o valor financeiro for claramente de latas avulsas (inconsistência de preenchimento)
      if (boxPrice > unitPrice * 1.5 && t.valorTotal > 0 && Math.abs(t.valorTotal - qty * unitPrice) < Math.abs(t.valorTotal - qty * boxPrice) * 0.2) {
        units = Math.round(qty);
      } else {
        units = Math.round(qty * fator);
      }
    } else if (isLooseUnit) {
      units = Math.round(qty);
    } else {
      // Unidade ambígua: compara proximidade com preço de caixa vs preço de unidade
      if (boxPrice > unitPrice * 1.5 && t.valorTotal > 0) {
        const distCaixa = Math.abs(t.valorTotal - qty * boxPrice);
        const distUnit = Math.abs(t.valorTotal - qty * unitPrice);
        units = distCaixa < distUnit ? Math.round(qty * fator) : Math.round(qty);
      } else {
        units = Math.round(qty);
      }
    }

    const val = (t.valorTotal != null && t.valorTotal > 0) 
      ? t.valorTotal 
      : (units * unitPrice);
    const hl = (t.volumeHl != null && t.volumeHl > 0) 
      ? t.volumeHl 
      : ((units / fator) * hlFactor);

    trocasUnits += units;
    trocasValor += val;
    trocasHl += hl;
  });

  // 3. VALES DE ROTA (Apenas pendentes amortizam)
  const itemVales = vales.filter(v => {
    if (isValeFaturado(v, weeklyBillingStatus)) return false;
    const depOk = deposito === 'ALL' ? true : (!v.deposito || v.deposito === deposito);
    const skuCandidate = (v as any).sku || (v as any).codigos || v.codigo;
    return matchSku(skuCandidate, normSku) && depOk;
  });

  let valesUnits = 0;
  let valesValor = 0;
  let valesHl = 0;

  itemVales.forEach(v => {
    const qty = Math.abs(v.quantidade || 0);
    const uMed = String((v as any).unidadeMedida || '').toLowerCase().trim();
    const isLoose = uMed === 'un' || uMed === 'und' || uMed === 'unidade' || uMed === 'unidades' || uMed === 'lt' || uMed === 'gf';
    const isCaixa = uMed === 'cx' || uMed === 'dz' || uMed === 'cx.' || uMed === 'caixa' || uMed === 'sku';

    let units = 0;
    if (isLoose) {
      units = Math.round(qty);
    } else if (isCaixa) {
      units = Math.round(qty * fator);
    } else {
      // Padrão em vale de rota: caixas fechadas, exceto se valor total ou quantidade bater com unidades avulsas
      units = Math.round(qty * fator);
      if (boxPrice > unitPrice * 1.5 && v.valorTotal > 0) {
        const distCaixa = Math.abs(v.valorTotal - qty * boxPrice);
        const distUnit = Math.abs(v.valorTotal - qty * unitPrice);
        if (distUnit < distCaixa * 0.3) {
          units = Math.round(qty);
        }
      }
    }

    const val = (v.valorTotal != null && v.valorTotal > 0) 
      ? v.valorTotal 
      : (units * unitPrice);
    const hl = (v.volumeHl != null && v.volumeHl > 0) 
      ? v.volumeHl 
      : ((units / fator) * hlFactor);

    valesUnits += units;
    valesValor += val;
    valesHl += hl;
  });

  // 4. FALTAS MAPEADAS (Doca / WMS - Apenas pendentes amortizam)
  const itemFaltas = faltasMapeadas.filter(f => {
    if (isFaltaFaturada(f, weeklyBillingStatus)) return false;
    const depOk = deposito === 'ALL' ? true : (!f.deposito || f.deposito === deposito);
    return matchSku(f.codigo || f.produto, normSku) && depOk;
  });

  let faltasUnits = 0;
  let faltasValor = 0;
  let faltasHl = 0;

  itemFaltas.forEach(f => {
    let units = 0;
    if (f.quantidadeUnidades != null && f.quantidadeUnidades > 0) {
      units = Math.round(f.quantidadeUnidades);
    } else if (f.quantidadeSkus != null && f.quantidadeSkus > 0) {
      units = Math.round(f.quantidadeSkus * fator);
    } else {
      // Padrão em falta de doca é quantidade em caixas (SKUs)
      units = Math.round((f.quantidade || 0) * fator);
    }

    const val = (f.valorTotal != null && f.valorTotal > 0) 
      ? f.valorTotal 
      : (units * unitPrice);
    const hl = (f.volumeHl != null && f.volumeHl > 0) 
      ? f.volumeHl 
      : ((units / fator) * hlFactor);

    faltasUnits += units;
    faltasValor += val;
    faltasHl += hl;
  });

  // Função auxiliar para formatar os detalhes
  const createDetail = (units: number, valor: number, hl: number, count: number): DeviationDetail => {
    return {
      units,
      skus: units / fator,
      boxesInt: Math.floor(units / fator),
      looseUnits: units % fator,
      raw: formatSkuUnit(units, fator),
      valor,
      volumeHl: hl,
      count,
    };
  };

  const totalUnits = quebrasUnits + trocasUnits + valesUnits + faltasUnits;
  const totalValor = quebrasValor + trocasValor + valesValor + faltasValor;
  const totalHl = quebrasHl + trocasHl + valesHl + faltasHl;
  const totalCount = itemQuebras.length + itemTrocas.length + itemVales.length + itemFaltas.length;

  return {
    quebras: createDetail(quebrasUnits, quebrasValor, quebrasHl, itemQuebras.length),
    trocas: createDetail(trocasUnits, trocasValor, trocasHl, itemTrocas.length),
    vales: createDetail(valesUnits, valesValor, valesHl, itemVales.length),
    faltas: createDetail(faltasUnits, faltasValor, faltasHl, itemFaltas.length),
    total: createDetail(totalUnits, totalValor, totalHl, totalCount),
  };
}
