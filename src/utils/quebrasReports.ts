import * as XLSX from 'xlsx';
import { QuebraItem, AreaLossSummary, WeeklyLossSummary } from '../types';
import { formatCurrency, formatHectoliters } from './parsers';
import { isSyntheticSummaryItem, getQuebraSignature } from './quebrasDeduplicator';

/**
 * Converte string de data no formato DD/MM/AAAA ou AAAA-MM-DD em objeto Date
 */
export function parseDateSafe(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // Formato DD/MM/AAAA ou DD/MM/AA
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (brMatch) {
    const d = parseInt(brMatch[1], 10);
    const m = parseInt(brMatch[2], 10) - 1;
    let y = parseInt(brMatch[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Formato ISO AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(y, m, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

/**
 * Retorna o nome do mês em maiúsculo (ex: JULHO, AGOSTO)
 */
export function getMonthName(dateStr: string | undefined | null): string {
  const dt = parseDateSafe(dateStr);
  if (!dt) return '';
  const months = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  return months[dt.getMonth()];
}

/**
 * Retorna o rótulo de semana da logística (ex: "13/07 - 17/07" ou "04/07 - 09/07")
 */
export function getWeekRangeInfo(date: Date): { id: string; label: string; startDate: Date; endDate: Date } {
  // Ajusta para segunda-feira como início da semana operacional
  const dt = new Date(date);
  const day = dt.getDay(); // 0: Dom, 1: Seg, ..., 6: Sab
  // Em operação logística, semanas vão de Segunda a Sábado/Domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // Sexta
  friday.setHours(23, 59, 59, 999);

  const formatShort = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  };

  const id = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const label = `${formatShort(monday)} - ${formatShort(friday)}`;

  return { id, label, startDate: monday, endDate: friday };
}

/**
 * 1. RELATÓRIO: PERCAS POR ÁREA (Conforme Imagem 1)
 * Setores: ARMAZEM, ENTREGA, PUXADA, MERCADO (sempre presentes) + quaisquer outros
 */
export function calculateAreaLosses(quebras: QuebraItem[]): {
  areas: AreaLossSummary[];
  totalGeral: AreaLossSummary;
} {
  const standardSectors = ['ARMAZEM', 'ENTREGA', 'PUXADA', 'MERCADO'];
  const sectorMap = new Map<string, { valor: number; hl: number; count: number }>();

  // Inicializa com os setores padrão zerados para garantir a estrutura do relatório
  standardSectors.forEach(s => sectorMap.set(s, { valor: 0, hl: 0, count: 0 }));

  let totalValor = 0;
  let totalHl = 0;
  let totalCount = 0;

  quebras.forEach(q => {
    const rawArea = (q.area || 'ARMAZEM').trim().toUpperCase();
    let normArea = rawArea;
    if (rawArea.includes('ARMAZ') || rawArea.includes('DEP')) normArea = 'ARMAZEM';
    else if (rawArea.includes('ENTREG') || rawArea.includes('ROTA')) normArea = 'ENTREGA';
    else if (rawArea.includes('PUXAD') || rawArea.includes('MOVIMENT')) normArea = 'PUXADA';
    else if (rawArea.includes('MERCAD') || rawArea.includes('TRADE')) normArea = 'MERCADO';

    const curr = sectorMap.get(normArea) || { valor: 0, hl: 0, count: 0 };
    curr.valor += q.valorTotal || 0;
    curr.hl += q.volumeHl || 0;
    curr.count += 1;
    sectorMap.set(normArea, curr);

    totalValor += q.valorTotal || 0;
    totalHl += q.volumeHl || 0;
    totalCount += 1;
  });

  const areas: AreaLossSummary[] = [];

  // Primeiro adiciona os setores padrão na ordem da foto
  standardSectors.forEach(s => {
    const data = sectorMap.get(s) || { valor: 0, hl: 0, count: 0 };
    const percentual = totalValor > 0 ? (data.valor / totalValor) * 100 : 0;
    areas.push({
      setor: s,
      valor: data.valor,
      percentual,
      hectolitro: data.hl,
      quantidadeItens: data.count,
    });
    sectorMap.delete(s);
  });

  // Em seguida adiciona quaisquer outros setores eventuais
  sectorMap.forEach((data, s) => {
    const percentual = totalValor > 0 ? (data.valor / totalValor) * 100 : 0;
    areas.push({
      setor: s,
      valor: data.valor,
      percentual,
      hectolitro: data.hl,
      quantidadeItens: data.count,
    });
  });

  const totalGeral: AreaLossSummary = {
    setor: 'Total Geral',
    valor: totalValor,
    percentual: totalValor > 0 ? 100 : 0,
    hectolitro: totalHl,
    quantidadeItens: totalCount,
  };

  return { areas, totalGeral };
}

/**
 * 2. RELATÓRIO: 8 ÚLTIMAS SEMANAS COM STATUS E FATURAMENTO (Conforme Imagem 2)
 * As 8 últimas semanas cobrem as 8 semanas consecutivas anteriores e até a data filtrada.
 */
export function calculateWeeklyLosses(
  quebras: QuebraItem[],
  statusFaturamentoMap: Record<string, 'PENDENTE' | 'OK'> = {},
  maxWeeks: number = 8,
  referenceDateInput?: Date | string | null
): {
  weeks: WeeklyLossSummary[];
  total: { somaValor: number; hectolitro: number; quantidadeItens?: number; quantidadeUnidades?: number };
} {
  // 1. Determina a data de referência (data filtrada / máxima)
  let refDate: Date;
  if (referenceDateInput) {
    if (typeof referenceDateInput === 'string') {
      refDate = parseDateSafe(referenceDateInput) || new Date(2026, 7, 28);
    } else {
      refDate = referenceDateInput;
    }
  } else {
    // Procura a maior data entre os itens de quebras
    let maxTime = 0;
    quebras.forEach(q => {
      const dt = parseDateSafe(q.data);
      if (dt && dt.getTime() > maxTime) {
        maxTime = dt.getTime();
      }
    });
    refDate = maxTime > 0 ? new Date(maxTime) : new Date(2026, 7, 28);
  }

  // 2. Calcula a Segunda-feira base da semana de referência
  const day = refDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const baseMonday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + diffToMonday);
  baseMonday.setHours(0, 0, 0, 0);

  const formatShort = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  };

  const formatDateLong = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // 3. Gera os 8 intervalos semanais anteriores (k = 0 até k = maxWeeks - 1)
  interface WeekSlot {
    index: number;
    wMon: Date;
    wFri: Date;
    wSun: Date;
    displayLabel: string;
    items: QuebraItem[];
  }

  const weekSlots: WeekSlot[] = [];
  const globalAssignedIds = new Set<string>();
  const globalAssignedSignatures = new Set<string>();

  for (let k = 0; k < maxWeeks; k++) {
    const wMon = new Date(baseMonday.getTime() - k * 7 * 86400000);
    const wFri = new Date(wMon.getTime() + 4 * 86400000);
    const wSun = new Date(wMon.getTime() + 6 * 86400000 + 86399999);
    const standardLabel = `${formatShort(wMon)} - ${formatShort(wFri)}`;

    let displayLabel = standardLabel;
    const itemsForWeek: QuebraItem[] = [];
    const localSignatures = new Set<string>();

    // 1. Busca primeiro os lançamentos com data exata dentro do intervalo semanal [wMon, wSun]
    const dateMatchedItems = quebras.filter(q => {
      if (globalAssignedIds.has(q.id)) return false;
      const qDate = parseDateSafe(q.data);
      return qDate && qDate >= wMon && qDate <= wSun;
    });

    const hasRealDetailedItems = dateMatchedItems.some(q => !isSyntheticSummaryItem(q));

    if (hasRealDetailedItems) {
      // Se a semana contém lançamentos detalhados reais, adiciona apenas os detalhados (descarta placeholders sintéticos)
      dateMatchedItems.forEach(q => {
        if (isSyntheticSummaryItem(q)) return; // Evita somar placeholder sintético com itens reais
        const sig = getQuebraSignature(q);
        if (!localSignatures.has(sig) && !globalAssignedSignatures.has(sig)) {
          localSignatures.add(sig);
          globalAssignedSignatures.add(sig);
          globalAssignedIds.add(q.id);
          itemsForWeek.push(q);
        }
      });
      const explicitSemanaRef = itemsForWeek.find(q => q.semanaRef)?.semanaRef;
      if (explicitSemanaRef) {
        displayLabel = explicitSemanaRef;
      }
    } else {
      // 2. Se não houver itens detalhados por data, busca por semanaRef exata ou aproximada
      const refMatches = quebras.filter(q => {
        if (globalAssignedIds.has(q.id)) return false;
        if (q.semanaRef === standardLabel) return true;
        if (q.semanaRef) {
          const parts = q.semanaRef.split('-').map(p => p.trim());
          if (parts.length === 2) {
            const [startStr] = parts;
            const [dStr, mStr] = startStr.split('/');
            if (dStr && mStr) {
              const semStartDay = parseInt(dStr, 10);
              const semStartMonth = parseInt(mStr, 10) - 1;
              const declaredDate = new Date(wMon.getFullYear(), semStartMonth, semStartDay);
              const diffDays = Math.abs((declaredDate.getTime() - wMon.getTime()) / 86400000);
              if (diffDays <= 2.5) {
                return true;
              }
            }
          }
        }
        return false;
      });

      refMatches.forEach(q => {
        const sig = getQuebraSignature(q);
        if (!localSignatures.has(sig) && !globalAssignedSignatures.has(sig)) {
          localSignatures.add(sig);
          globalAssignedSignatures.add(sig);
          globalAssignedIds.add(q.id);
          itemsForWeek.push(q);
          if (q.semanaRef && !displayLabel.includes('/')) {
            displayLabel = q.semanaRef;
          }
        }
      });

      // Se ainda houver itens correspondentes por data, inclui-os
      dateMatchedItems.forEach(q => {
        if (globalAssignedIds.has(q.id)) return;
        const sig = getQuebraSignature(q);
        if (!localSignatures.has(sig) && !globalAssignedSignatures.has(sig)) {
          localSignatures.add(sig);
          globalAssignedSignatures.add(sig);
          globalAssignedIds.add(q.id);
          itemsForWeek.push(q);
        }
      });
    }

    weekSlots.push({
      index: k,
      wMon,
      wFri,
      wSun,
      displayLabel,
      items: itemsForWeek,
    });
  }

  // Ordena cronologicamente para calcular os deltas
  const chronologicalSlots = weekSlots.slice().reverse();

  // Calcula totais de cada semana
  const computedList: WeeklyLossSummary[] = chronologicalSlots.map(slot => {
    const somaValor = slot.items.reduce((acc, q) => acc + (q.valorTotal || 0), 0);
    const hectolitro = slot.items.reduce((acc, q) => acc + (q.volumeHl || 0), 0);
    const quantidadeItens = slot.items.length;
    const quantidadeUnidades = slot.items.reduce((acc, q) => acc + (q.quantidade || 0), 0);

    // Status de faturamento: prioriza o mapa persistido, depois itens, default 'PENDENTE'
    let statusFaturamento: 'PENDENTE' | 'OK' = statusFaturamentoMap[slot.displayLabel] || 'PENDENTE';
    if (!statusFaturamentoMap[slot.displayLabel] && slot.items.length > 0 && slot.items.every(item => item.faturado)) {
      statusFaturamento = 'OK';
    }

    return {
      id: slot.displayLabel,
      label: slot.displayLabel,
      startDate: formatDateLong(slot.wMon),
      endDate: formatDateLong(slot.wFri),
      somaValor,
      hectolitro,
      statusTrend: 'EQUAL',
      statusFaturamento,
      valorDiff: 0,
      percentDiff: 0,
      quantidadeItens,
      quantidadeUnidades,
    };
  });

  // Calcula a comparação com a semana anterior (semana cronologicamente anterior)
  for (let i = 0; i < computedList.length; i++) {
    if (i === 0) {
      computedList[i].statusTrend = 'DOWN';
    } else {
      const prevVal = computedList[i - 1].somaValor;
      const currVal = computedList[i].somaValor;
      const diff = currVal - prevVal;
      computedList[i].valorDiff = diff;
      computedList[i].percentDiff = prevVal > 0 ? (diff / prevVal) * 100 : 0;
      computedList[i].statusTrend = currVal > prevVal ? 'UP' : 'DOWN';
    }
  }

  // Ordena para exibição: mais recente no topo (como na foto do usuário)
  const displayWeeks = computedList.slice().reverse();

  const totalSoma = displayWeeks.reduce((acc, w) => acc + w.somaValor, 0);
  const totalHl = displayWeeks.reduce((acc, w) => acc + w.hectolitro, 0);
  const totalItens = displayWeeks.reduce((acc, w) => acc + (w.quantidadeItens || 0), 0);
  const totalUnidades = displayWeeks.reduce((acc, w) => acc + (w.quantidadeUnidades || 0), 0);

  return {
    weeks: displayWeeks,
    total: { somaValor: totalSoma, hectolitro: totalHl, quantidadeItens: totalItens, quantidadeUnidades: totalUnidades },
  };
}

/**
 * 3. RELATÓRIO: COMPARATIVO DIÁRIO PARA O GRÁFICO (Conforme Imagem 3)
 */
export function calculateDailyLosses(quebras: QuebraItem[]): Array<{
  data: string;
  dataObj: Date | null;
  valor: number;
  hectolitro: number;
  itens: number;
}> {
  const dayMap = new Map<string, { valor: number; hl: number; count: number; dt: Date | null }>();

  quebras.forEach(q => {
    const dStr = q.data || 'Sem Data';
    const dt = parseDateSafe(q.data);
    const curr = dayMap.get(dStr) || { valor: 0, hl: 0, count: 0, dt };
    curr.valor += q.valorTotal || 0;
    curr.hl += q.volumeHl || 0;
    curr.count += 1;
    dayMap.set(dStr, curr);
  });

  return Array.from(dayMap.entries())
    .map(([data, v]) => ({
      data,
      dataObj: v.dt,
      valor: v.valor,
      hectolitro: v.hl,
      itens: v.count,
    }))
    .sort((a, b) => {
      if (!a.dataObj || !b.dataObj) return 0;
      return a.dataObj.getTime() - b.dataObj.getTime();
    });
}

/**
 * 4. EXPORTAÇÃO EXCEL: PERCAS POR ÁREA (Imagem 1)
 */
export function exportAreaLossesToExcel(areas: AreaLossSummary[], totalGeral: AreaLossSummary, filename = 'relatorio_percas_por_area.xlsx') {
  const wb = XLSX.utils.book_new();

  // Matriz de dados formatada
  const sheetData: (string | number)[][] = [
    ['PERCAS POR ÁREA'],
    ['SETOR', 'VALOR', 'PERCENTUAL', 'HECTOLITRO'],
  ];

  areas.forEach(a => {
    sheetData.push([
      a.setor,
      `R$ ${a.valor.toFixed(2).replace('.', ',')}`,
      `${Math.round(a.percentual)}%`,
      Number(a.hectolitro.toFixed(2)),
    ]);
  });

  sheetData.push([
    totalGeral.setor,
    `R$ ${totalGeral.valor.toFixed(2).replace('.', ',')}`,
    '100%',
    Number(totalGeral.hectolitro.toFixed(2)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Define larguras das colunas
  ws['!cols'] = [
    { wch: 22 }, // SETOR
    { wch: 18 }, // VALOR
    { wch: 16 }, // PERCENTUAL
    { wch: 16 }, // HECTOLITRO
  ];

  // Mescla título na primeira linha A1:D1
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Percas por Área');
  XLSX.writeFile(wb, filename);
}

/**
 * 5. EXPORTAÇÃO EXCEL: 8 ÚLTIMAS SEMANAS COM STATUS E FATURAMENTO (Imagem 2)
 */
export function exportWeeklyLossesToExcel(
  weeks: WeeklyLossSummary[],
  total: { somaValor: number; hectolitro: number },
  filename = 'relatorio_8_ultimas_semanas.xlsx'
) {
  const wb = XLSX.utils.book_new();

  const sheetData: (string | number)[][] = [
    ['8 ÚLTIMAS SEMANAS'],
    ['DATA', 'SOMA', 'HECTOLITRO', 'STATUS', 'STATUS FATURAMENTO'],
  ];

  weeks.forEach(w => {
    const statusArrow = w.statusTrend === 'UP' ? '↑ (Superior)' : '↓ (Redução)';
    sheetData.push([
      w.label,
      `R$ ${w.somaValor.toFixed(2).replace('.', ',')}`,
      Number(w.hectolitro.toFixed(2)),
      statusArrow,
      w.statusFaturamento,
    ]);
  });

  sheetData.push([
    'TOTAL',
    `R$ ${total.somaValor.toFixed(2).replace('.', ',')}`,
    Number(total.hectolitro.toFixed(2)),
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 20 }, // DATA
    { wch: 18 }, // SOMA
    { wch: 16 }, // HECTOLITRO
    { wch: 16 }, // STATUS
    { wch: 24 }, // STATUS FATURAMENTO
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '8 Últimas Semanas');
  XLSX.writeFile(wb, filename);
}

/**
 * 6. EXPORTAÇÃO EXCEL: RELATÓRIO DETALHADO DE QUEBRAS (Imagem 3)
 */
export function exportDetailedQuebrasToExcel(
  items: QuebraItem[],
  filename = 'relatorio_detalhado_quebras.xlsx'
) {
  const wb = XLSX.utils.book_new();

  const sheetData: (string | number)[][] = [
    [
      'DATA',
      'MÊS',
      'PRODUTO',
      'DESCRIÇÃO',
      'QUANT. UND.',
      'TURNO',
      'CÓD',
      'ÁREA',
      'MOTIVO',
      'COLABORADOR',
      'VALOR TOTAL',
      'HECTO',
      'STATUS FATURAMENTO'
    ]
  ];

  items.forEach(q => {
    const mes = q.mes || getMonthName(q.data);
    sheetData.push([
      q.data,
      mes,
      q.sku,
      q.descricao,
      q.quantidade,
      q.turno,
      q.codQuebra,
      q.area,
      q.motivo,
      q.colaborador || '-',
      `R$ ${q.valorTotal.toFixed(2).replace('.', ',')}`,
      Number(q.volumeHl.toFixed(3)),
      q.faturado ? 'OK' : 'PENDENTE'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 12 }, // DATA
    { wch: 12 }, // MÊS
    { wch: 12 }, // PRODUTO
    { wch: 45 }, // DESCRIÇÃO
    { wch: 14 }, // QUANT. UND.
    { wch: 10 }, // TURNO
    { wch: 8 },  // CÓD
    { wch: 14 }, // ÁREA
    { wch: 16 }, // MOTIVO
    { wch: 22 }, // COLABORADOR
    { wch: 16 }, // VALOR TOTAL
    { wch: 12 }, // HECTO
    { wch: 18 }, // STATUS FATURAMENTO
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Detalhamento Quebras');
  XLSX.writeFile(wb, filename);
}

/**
 * 7. EXPORTAÇÃO COMPLETA: PASTA DE TRABALHO COM AS 3 ABAS OPERACIONAIS
 */
export function exportCompleteWorkbookToExcel(
  areas: AreaLossSummary[],
  totalGeralArea: AreaLossSummary,
  weeks: WeeklyLossSummary[],
  totalWeeks: { somaValor: number; hectolitro: number },
  items: QuebraItem[],
  filename = `gestao_quebras_completo_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const wb = XLSX.utils.book_new();

  // 1. Aba 8 Últimas Semanas
  const weeksData: (string | number)[][] = [
    ['8 ÚLTIMAS SEMANAS'],
    ['DATA', 'SOMA', 'HECTOLITRO', 'STATUS', 'STATUS FATURAMENTO'],
  ];
  weeks.forEach(w => {
    const statusArrow = w.statusTrend === 'UP' ? '↑' : '↓';
    weeksData.push([
      w.label,
      `R$ ${w.somaValor.toFixed(2).replace('.', ',')}`,
      Number(w.hectolitro.toFixed(2)),
      statusArrow,
      w.statusFaturamento,
    ]);
  });
  weeksData.push([
    'TOTAL',
    `R$ ${totalWeeks.somaValor.toFixed(2).replace('.', ',')}`,
    Number(totalWeeks.hectolitro.toFixed(2)),
    '',
    '',
  ]);
  const wsWeeks = XLSX.utils.aoa_to_sheet(weeksData);
  wsWeeks['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
  wsWeeks['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, wsWeeks, '8 Últimas Semanas');

  // 2. Aba Percas por Área
  const areasData: (string | number)[][] = [
    ['PERCAS POR ÁREA'],
    ['SETOR', 'VALOR', 'PERCENTUAL', 'HECTOLITRO'],
  ];
  areas.forEach(a => {
    areasData.push([
      a.setor,
      `R$ ${a.valor.toFixed(2).replace('.', ',')}`,
      `${Math.round(a.percentual)}%`,
      Number(a.hectolitro.toFixed(2)),
    ]);
  });
  areasData.push([
    totalGeralArea.setor,
    `R$ ${totalGeralArea.valor.toFixed(2).replace('.', ',')}`,
    '100%',
    Number(totalGeralArea.hectolitro.toFixed(2)),
  ]);
  const wsAreas = XLSX.utils.aoa_to_sheet(areasData);
  wsAreas['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  wsAreas['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, wsAreas, 'Percas por Área');

  // 3. Aba Detalhamento
  const detailData: (string | number)[][] = [
    [
      'DATA', 'MÊS', 'PRODUTO', 'DESCRIÇÃO', 'QUANT. UND.',
      'TURNO', 'CÓD', 'ÁREA', 'MOTIVO', 'COLABORADOR',
      'VALOR TOTAL', 'HECTO', 'STATUS FATURAMENTO'
    ]
  ];
  items.forEach(q => {
    const mes = q.mes || getMonthName(q.data);
    detailData.push([
      q.data,
      mes,
      q.sku,
      q.descricao,
      q.quantidade,
      q.turno,
      q.codQuebra,
      q.area,
      q.motivo,
      q.colaborador || '-',
      `R$ ${q.valorTotal.toFixed(2).replace('.', ',')}`,
      Number(q.volumeHl.toFixed(3)),
      q.faturado ? 'OK' : 'PENDENTE'
    ]);
  });
  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  wsDetail['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 45 }, { wch: 14 },
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
    { wch: 16 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalhamento Quebras');

  XLSX.writeFile(wb, filename);
}
