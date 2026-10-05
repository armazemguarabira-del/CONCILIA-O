import * as XLSX from 'xlsx';
import { 
  StockPositionItem, 
  ItemConciliacaoAjustada, 
  RankingItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId 
} from '../types';
import { formatCurrency, formatHectoliters, formatSkuUnit } from './parsers';
import { calculateSkuDeviations, isQuebraFaturada } from './desviosUtils';

export interface ExportReconciliationData {
  stockPositions: StockPositionItem[];
  adjustedItems: ItemConciliacaoAjustada[];
  rankingSobrasSemAjustes?: RankingItem[];
  rankingFaltasSemAjustes?: RankingItem[];
  rankingSobrasComAjustes?: RankingItem[];
  rankingFaltasComAjustes?: RankingItem[];
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  selectedDeposito: DepositoId | 'ALL';
  nomeConciliacao?: string;
  usuario?: string;
  dataRef?: string;
  includeAuditTabs?: boolean;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

/**
 * Calcula os itens da conciliação ajustada equalizada com todos os desvios
 */
export function computeAdjustedItems(
  stockPositions: StockPositionItem[],
  quebras: QuebraItem[] = [],
  vales: ValeItem[] = [],
  trocas: TrocaItem[] = [],
  faltasMapeadas: FaltaMapeadaItem[] = [],
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>
): ItemConciliacaoAjustada[] {
  return stockPositions.map(stockItem => {
    const dep = stockItem.deposito;
    const sku = String(stockItem.produto).trim();
    const fator = Math.max(1, stockItem.fatorSku || 1);

    const dev = calculateSkuDeviations(
      sku,
      dep,
      fator,
      stockItem.valorUnitario,
      stockItem.valorCaixa,
      stockItem.fatorHl,
      quebras,
      vales,
      trocas,
      faltasMapeadas,
      weeklyBillingStatus
    );

    const totalDesviosUnits = dev.total.units;
    const totalDesviosSkus = dev.total.skus;
    const desviosRaw = dev.total.raw;
    const valorDesvios = dev.total.valor;
    const hlDesvios = dev.total.volumeHl;

    const fisicoUnits = stockItem.inventarioTotalUnits;
    const fisicoSkus = Math.floor(fisicoUnits / fator);
    const valorFisico = fisicoUnits * stockItem.valorUnitario;

    const finalTotalUnits = fisicoUnits + totalDesviosUnits;
    const finalSkus = Math.floor(finalTotalUnits / fator);
    const finalRaw = formatSkuUnit(finalTotalUnits, fator);
    const valorFinal = finalTotalUnits * stockItem.valorUnitario;

    const fiscalUnits = stockItem.disponivelTotalUnits;
    const fiscalSkus = Math.floor(fiscalUnits / fator);
    const valorFiscal = fiscalUnits * stockItem.valorUnitario;

    let divergenciaUnits = finalTotalUnits - fiscalUnits;
    if (stockItem.saldoNegativoDesconsiderado || fiscalUnits < 0) {
      divergenciaUnits = 0;
    }

    const divergenciaSkus = divergenciaUnits / fator;
    const divergenciaRaw = formatSkuUnit(divergenciaUnits, fator);

    let statusAjustado: 'CONCILIADO' | 'FALTA_RESIDUAL' | 'SOBRA_RESIDUAL' = 'CONCILIADO';
    if (divergenciaUnits < 0) statusAjustado = 'FALTA_RESIDUAL';
    else if (divergenciaUnits > 0) statusAjustado = 'SOBRA_RESIDUAL';

    const impactoFinanceiroResidual = divergenciaUnits * stockItem.valorUnitario;
    const impactoHlResidual = (divergenciaUnits / fator) * stockItem.fatorHl;

    return {
      deposito: dep,
      produto: sku,
      descricao: stockItem.descricao,
      grupo: stockItem.grupo || 'GERAL',
      fatorSku: fator,
      fatorHl: stockItem.fatorHl,
      valorUnitario: stockItem.valorUnitario,
      valorCaixa: stockItem.valorCaixa,

      fiscalRaw: stockItem.disponivelRaw,
      fiscalSkus,
      fiscalUnits,
      fiscalTotalUnits: fiscalUnits,
      valorFiscal,

      desviosRaw,
      desviosSkus: totalDesviosSkus,
      desviosUnits: totalDesviosUnits,
      valorDesvios,
      hlDesvios,
      detalheDesvios: {
        quebrasSkus: dev.quebras.skus,
        quebrasUnits: dev.quebras.units,
        quebrasValor: dev.quebras.valor,
        quebrasRaw: dev.quebras.raw,

        valesSkus: dev.vales.skus,
        valesUnits: dev.vales.units,
        valesValor: dev.vales.valor,
        valesRaw: dev.vales.raw,

        trocasSkus: dev.trocas.skus,
        trocasUnits: dev.trocas.units,
        trocasValor: dev.trocas.valor,
        trocasRaw: dev.trocas.raw,

        faltasSkus: dev.faltas.skus,
        faltasUnits: dev.faltas.units,
        faltasValor: dev.faltas.valor,
        faltasRaw: dev.faltas.raw,
      },

      fisicoRaw: stockItem.inventarioRaw,
      fisicoSkus,
      fisicoUnits,
      fisicoTotalUnits: fisicoUnits,
      valorFisico,

      finalRaw,
      finalSkus,
      finalUnits: finalTotalUnits,
      finalTotalUnits,
      valorFinal,

      divergenciaResidualRaw: divergenciaRaw,
      divergenciaResidualSkus: divergenciaSkus,
      divergenciaResidualUnits: divergenciaUnits,
      statusAjustado,
      impactoFinanceiroResidual,
      impactoHlResidual,
      recontado: stockItem.recontado
    };
  });
}

/**
 * Cria a pasta de trabalho XLSX com formato de tabela organizada:
 * 1. Guia "Sem Ajustes": apenas Código, Descrição, Quantidade Fiscal, Quantidade Física, Diferença
 * 2. Guia "Com Ajustes": apenas Código, Descrição, Quantidade Fiscal, Quantidade Física, Diferença
 * Do mesmo jeito que é exibido na plataforma.
 */
export function buildReconciliationWorkbook(data: ExportReconciliationData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Filtragem por depósito se selecionado
  const stockPositionsFiltered = data.selectedDeposito === 'ALL'
    ? data.stockPositions
    : data.stockPositions.filter(s => s.deposito === data.selectedDeposito);

  const adjustedItemsFiltered = data.selectedDeposito === 'ALL'
    ? data.adjustedItems
    : data.adjustedItems.filter(item => item.deposito === data.selectedDeposito);

  // ----------------------------------------------------
  // GUIA 1: CONCILIAÇÃO SEM AJUSTES (02.05.02)
  // Colunas estritas: Código, Descrição, Quantidade Fiscal, Quantidade Física, Diferença
  // ----------------------------------------------------
  const headersSemAjustes = [
    'Código',
    'Descrição',
    'Quantidade Fiscal',
    'Quantidade Física',
    'Diferença'
  ];

  const rowsSemAjustes = stockPositionsFiltered.map(s => {
    const diferencaFormatada = (s.saldoNegativoDesconsiderado || s.disponivelTotalUnits < 0)
      ? '0/00'
      : s.diferencaRaw;

    return [
      s.produto,
      s.descricao,
      s.disponivelRaw,
      s.inventarioRaw,
      diferencaFormatada
    ];
  });

  const wsSemAjustes = XLSX.utils.aoa_to_sheet([headersSemAjustes, ...rowsSemAjustes]);
  wsSemAjustes['!cols'] = [
    { wch: 15 }, // Código
    { wch: 50 }, // Descrição
    { wch: 22 }, // Quantidade Fiscal
    { wch: 22 }, // Quantidade Física
    { wch: 18 }  // Diferença
  ];
  wsSemAjustes['!autofilter'] = { ref: `A1:E${Math.max(1, rowsSemAjustes.length + 1)}` };
  wsSemAjustes['!views'] = [{ state: 'frozen', ySplit: 1 }];
  XLSX.utils.book_append_sheet(wb, wsSemAjustes, 'Sem Ajustes');

  // ----------------------------------------------------
  // GUIA 2: CONCILIAÇÃO COM AJUSTES (EQUALIZADA COM DESVIOS)
  // Colunas estritas: Código, Descrição, Quantidade Fiscal, Quantidade Física, Diferença
  // ----------------------------------------------------
  const headersComAjustes = [
    'Código',
    'Descrição',
    'Quantidade Fiscal',
    'Quantidade Física',
    'Diferença'
  ];

  const rowsComAjustes = adjustedItemsFiltered.map(item => [
    item.produto,
    item.descricao,
    item.fiscalRaw,
    item.finalRaw, // Físico + Desvios (Quantidade Física com os ajustes equalizados)
    item.divergenciaResidualRaw // Diferença residual resultante
  ]);

  const wsComAjustes = XLSX.utils.aoa_to_sheet([headersComAjustes, ...rowsComAjustes]);
  wsComAjustes['!cols'] = [
    { wch: 15 }, // Código
    { wch: 50 }, // Descrição
    { wch: 22 }, // Quantidade Fiscal
    { wch: 22 }, // Quantidade Física
    { wch: 18 }  // Diferença
  ];
  wsComAjustes['!autofilter'] = { ref: `A1:E${Math.max(1, rowsComAjustes.length + 1)}` };
  wsComAjustes['!views'] = [{ state: 'frozen', ySplit: 1 }];
  XLSX.utils.book_append_sheet(wb, wsComAjustes, 'Com Ajustes');

  // ----------------------------------------------------
  // GUIAS ADICIONAIS OPCIONAIS (Apenas se includeAuditTabs for verdadeiro)
  // ----------------------------------------------------
  if (data.includeAuditTabs) {
    // ----------------------------------------------------
    // GUIA 3: RANKINGS DE SOBRAS E FALTAS DO DIA
    // ----------------------------------------------------
    const rankingAoa: any[][] = [];

    rankingAoa.push(['PAU BRASIL - DISTRIBUIDORA AMBEV | RANKING DIÁRIO DE SOBRAS E FALTAS DE ESTOQUE']);
    rankingAoa.push([`Referência: ${data.dataRef || new Date().toLocaleString('pt-BR')} | Depósito: ${data.selectedDeposito}`]);
    rankingAoa.push([]);

    // Bloco 1: Ranking Sem Ajustes (02.05.02)
    rankingAoa.push(['=== 1. RANKING SEM OS AJUSTES (02.05.02 PURA: FÍSICO VS SISTEMA) ===']);
    rankingAoa.push([]);

    rankingAoa.push(['--- TOP FALTAS DO DIA (SEM AJUSTES) ---']);
    rankingAoa.push(['Posição', 'Código SKU', 'Descrição do Produto', 'Grupo', 'Depósito', 'Qtd Unidades', 'Qtd Caixas', 'Prejuízo (R$)', 'Volume (HL)']);
    if (!data.rankingFaltasSemAjustes || data.rankingFaltasSemAjustes.length === 0) {
      rankingAoa.push(['-', 'Nenhuma falta registrada sem ajustes', '', '', '', 0, 0, 0, 0]);
    } else {
      data.rankingFaltasSemAjustes.forEach(r => {
        rankingAoa.push([
          `#${r.posicao}`,
          r.codigo,
          r.descricao,
          r.grupo,
          r.deposito,
          r.quantidadeUnidades,
          r.quantidadeRaw,
          Number(Math.abs(r.impactoFinanceiro).toFixed(2)),
          Number(Math.abs(r.impactoHl).toFixed(3))
        ]);
      });
    }

    rankingAoa.push([]);
    rankingAoa.push(['--- TOP SOBRAS DO DIA (SEM AJUSTES) ---']);
    rankingAoa.push(['Posição', 'Código SKU', 'Descrição do Produto', 'Grupo', 'Depósito', 'Qtd Unidades', 'Qtd Caixas', 'Sobra (R$)', 'Volume (HL)']);
    if (!data.rankingSobrasSemAjustes || data.rankingSobrasSemAjustes.length === 0) {
      rankingAoa.push(['-', 'Nenhuma sobra registrada sem ajustes', '', '', '', 0, 0, 0, 0]);
    } else {
      data.rankingSobrasSemAjustes.forEach(r => {
        rankingAoa.push([
          `#${r.posicao}`,
          r.codigo,
          r.descricao,
          r.grupo,
          r.deposito,
          r.quantidadeUnidades,
          r.quantidadeRaw,
          Number(r.impactoFinanceiro.toFixed(2)),
          Number(r.impactoHl.toFixed(3))
        ]);
      });
    }

    rankingAoa.push([]);
    rankingAoa.push(['=== 2. RANKING COM OS AJUSTES (EQUALIZADO: FÍSICO + DESVIOS VS SISTEMA) ===']);
    rankingAoa.push([]);

    rankingAoa.push(['--- TOP FALTAS RESIDUAIS DO DIA (COM AJUSTES) ---']);
    rankingAoa.push(['Posição', 'Código SKU', 'Descrição do Produto', 'Grupo', 'Depósito', 'Qtd Residual (Un)', 'Qtd Residual (Cx/Un)', 'Prejuízo Residual (R$)', 'HL Residual']);
    if (!data.rankingFaltasComAjustes || data.rankingFaltasComAjustes.length === 0) {
      rankingAoa.push(['-', 'Nenhuma falta residual após equalização de desvios', '', '', '', 0, 0, 0, 0]);
    } else {
      data.rankingFaltasComAjustes.forEach(r => {
        rankingAoa.push([
          `#${r.posicao}`,
          r.codigo,
          r.descricao,
          r.grupo,
          r.deposito,
          r.quantidadeUnidades,
          r.quantidadeRaw,
          Number(Math.abs(r.impactoFinanceiro).toFixed(2)),
          Number(Math.abs(r.impactoHl).toFixed(3))
        ]);
      });
    }

    rankingAoa.push([]);
    rankingAoa.push(['--- TOP SOBRAS RESIDUAIS DO DIA (COM AJUSTES) ---']);
    rankingAoa.push(['Posição', 'Código SKU', 'Descrição do Produto', 'Grupo', 'Depósito', 'Qtd Residual (Un)', 'Qtd Residual (Cx/Un)', 'Sobra Residual (R$)', 'HL Residual']);
    if (!data.rankingSobrasComAjustes || data.rankingSobrasComAjustes.length === 0) {
      rankingAoa.push(['-', 'Nenhuma sobra residual após equalização de desvios', '', '', '', 0, 0, 0, 0]);
    } else {
      data.rankingSobrasComAjustes.forEach(r => {
        rankingAoa.push([
          `#${r.posicao}`,
          r.codigo,
          r.descricao,
          r.grupo,
          r.deposito,
          r.quantidadeUnidades,
          r.quantidadeRaw,
          Number(r.impactoFinanceiro.toFixed(2)),
          Number(r.impactoHl.toFixed(3))
        ]);
      });
    }

  const wsRanking = XLSX.utils.aoa_to_sheet(rankingAoa);
  wsRanking['!cols'] = [
    { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 10 },
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRanking, '3. Rankings Sobras e Faltas');

  // ----------------------------------------------------
  // GUIA 4: TROCAS E REPOSIÇÕES
  // ----------------------------------------------------
  const headersTrocas = [
    'Depósito',
    'Data',
    'Código(s) SKU',
    'Descrição',
    'Quantidade',
    'Unidade de Medida',
    'Valor Total (R$)',
    'Volume (HL)',
    'Tipo de Processo',
    'Motorista',
    'Ajudantes',
    'Cliente',
    'Nota Fiscal',
    'Mapa de Carga',
    'Setor/Rota',
    'Motivo Declarado',
    'Status Promax',
    'Observações'
  ];

    const rowsTrocas = (data.trocas || []).map(t => [
      t.deposito,
      t.data,
      t.codigos,
      t.descricao,
      t.quantidade,
      t.unidadeMedida,
      Number(t.valorTotal.toFixed(2)),
      Number(t.volumeHl.toFixed(3)),
      t.tipoProcesso,
      t.motorista,
      t.ajudantes,
      t.cliente,
      t.notaFiscal,
      t.mapa,
      t.setorRota,
      t.motivoDeclarado,
      t.statusPromax,
      t.observacoes
    ]);

    const wsTrocas = XLSX.utils.aoa_to_sheet([headersTrocas, ...rowsTrocas]);
    wsTrocas['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 35 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 22 },
      { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 22 }, { wch: 14 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTrocas, '4. Trocas e Reposicoes');

    // ----------------------------------------------------
    // GUIA 5: VALES DE ROTA
    // ----------------------------------------------------
    const headersVales = [
      'Depósito',
      'Data',
      'Código SKU',
      'Descrição',
      'Quantidade',
      'Valor Total (R$)',
      'Volume (HL)',
      'Motorista',
      'Equipe Completa',
      'Total Integrantes',
      'Valor Rateado (R$)',
      'Cliente',
      'Nota Fiscal',
      'Mapa',
      'Rota/Setor',
      'Status Vale',
      'ID Vale SSTR',
      'Observações'
    ];

    const rowsVales = (data.vales || []).map(v => [
      v.deposito,
      v.data,
      v.codigo,
      v.descricao,
      v.quantidade,
      Number(v.valorTotal.toFixed(2)),
      Number(v.volumeHl.toFixed(3)),
      v.motorista,
      v.equipeCompleta,
      v.totalIntegrantes,
      Number(v.valorRateado.toFixed(2)),
      v.cliente,
      v.notaFiscal,
      v.mapa,
      v.rotaSetor,
      v.statusVale,
      v.idValeSstr,
      v.observacoes || ''
    ]);

    const wsVales = XLSX.utils.aoa_to_sheet([headersVales, ...rowsVales]);
    wsVales['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 12 },
      { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsVales, '5. Vales de Rota');

    // ----------------------------------------------------
    // GUIA 6: FALTAS MAPEADAS
    // ----------------------------------------------------
    const headersFaltas = [
      'Depósito',
      'Data',
      'Código SKU',
      'Descrição',
      'Quantidade',
      'Valor Total (R$)',
      'Volume (HL)',
      'Motivo / Categoria',
      'Observação / Justificativa',
      'Responsável',
      'Origem'
    ];

    const rowsFaltas = (data.faltasMapeadas || []).map(f => [
      f.deposito || '01',
      f.data || '',
      f.codigo || (f as any).produto,
      f.descricao,
      f.quantidade,
      Number(((f as any).valorTotal || 0).toFixed(2)),
      Number(((f as any).volumeHl || 0).toFixed(3)),
      f.motivo || 'FALTA OPERACIONAL',
      f.observacao,
      f.responsavel || '',
      f.origem || 'MANUAL'
    ]);

    const wsFaltas = XLSX.utils.aoa_to_sheet([headersFaltas, ...rowsFaltas]);
    wsFaltas['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 45 }, { wch: 18 },
      { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsFaltas, '6. Faltas Mapeadas');

    // ----------------------------------------------------
    // GUIA 7: QUEBRAS DE ARMAZÉM
    // ----------------------------------------------------
    const headersQuebras = [
      'Depósito',
      'Data',
      'Mês',
      'Código SKU',
      'Descrição',
      'Quantidade (Unidades)',
      'Valor Total (R$)',
      'Volume (HL)',
      'Área',
      'Turno',
      'Código da Quebra',
      'Motivo',
      'Colaborador',
      'Função',
      'Origem',
      'Semana Ref',
      'Status Contábil',
      'Amortiza Conciliação',
      'Data Faturamento'
    ];

    const rowsQuebras = (data.quebras || []).map(q => {
      const isFat = isQuebraFaturada(q, data.weeklyBillingStatus);
      return [
        q.deposito,
        q.data,
        q.mes || '',
        q.sku,
        q.descricao,
        q.quantidade,
        Number(q.valorTotal.toFixed(2)),
        Number(q.volumeHl.toFixed(3)),
        q.area,
        q.turno,
        q.codQuebra,
        q.motivo,
        q.colaborador,
        q.funcao || '',
        q.origem || '',
        q.semanaRef || '',
        isFat ? 'FATURADO (Já Baixado)' : 'PENDENTE DE FATURAMENTO',
        isFat ? 'NÃO' : 'SIM (Amortizando Estoque)',
        q.dataFaturamento || ''
      ];
    });

    const wsQuebras = XLSX.utils.aoa_to_sheet([headersQuebras, ...rowsQuebras]);
    wsQuebras['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 35 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 26 }, { wch: 26 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsQuebras, '7. Quebras de Armazem');
  }

  return wb;
}

/**
 * Exporta a planilha Excel organizada exatamente no formato solicitado pelo usuário:
 * Guia 1: "Sem Ajustes"
 * Guia 2: "Com Ajustes"
 * Ambas APENAS com as 5 colunas: Código, Descrição, Quantidade Fiscal, Quantidade Física, Diferença.
 * Abre seletor de pasta nativo no computador com fallback para download tradicional.
 */
export async function exportConciliacaoExcel(params: {
  stockPositions: StockPositionItem[];
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  adjustedItems?: ItemConciliacaoAjustada[];
  selectedDeposito?: DepositoId | 'ALL';
  filename?: string;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}): Promise<{ success: boolean; method: 'picker' | 'download'; filename: string }> {
  const selectedDeposito = params.selectedDeposito || 'ALL';
  const quebras = params.quebras || [];
  const vales = params.vales || [];
  const trocas = params.trocas || [];
  const faltasMapeadas = params.faltasMapeadas || [];

  const adjustedItems = params.adjustedItems || computeAdjustedItems(
    params.stockPositions,
    quebras,
    vales,
    trocas,
    faltasMapeadas,
    params.weeklyBillingStatus
  );

  const wb = buildReconciliationWorkbook({
    stockPositions: params.stockPositions,
    adjustedItems,
    selectedDeposito,
    includeAuditTabs: false,
    quebras,
    vales,
    trocas,
    faltasMapeadas,
    weeklyBillingStatus: params.weeklyBillingStatus
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
  const suggestedFilename = params.filename || `Relatorio_Conciliacao_Estoque_Dep_${selectedDeposito}_${dateStr}_${timeStr}.xlsx`;

  return await saveExcelWithFolderPicker(wb, suggestedFilename);
}

/**
 * Salva a pasta de trabalho Excel permitindo ao usuário escolher
 * exatamente a pasta no computador através da API File System Access (showSaveFilePicker).
 * Se o navegador não suportar ou se a permissão for cancelada, utiliza o download padrão do navegador.
 */
export async function saveExcelWithFolderPicker(
  wb: XLSX.WorkBook,
  suggestedFilename: string
): Promise<{ success: boolean; method: 'picker' | 'download'; filename: string }> {
  // Gerar o buffer binário do XLSX
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });

  // Tenta usar a File System Access API para abrir o seletor nativo do sistema operacional (Windows/Mac/Linux)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: suggestedFilename,
        types: [
          {
            description: 'Pasta de Trabalho do Excel (*.xlsx)',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
            }
          }
        ]
      });

      const writableStream = await handle.createWritable();
      await writableStream.write(blob);
      await writableStream.close();

      return {
        success: true,
        method: 'picker',
        filename: handle.name || suggestedFilename
      };
    } catch (err: any) {
      // Se o usuário simplesmente cancelou o diálogo de salvar do Windows, não faz download forçado
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'picker',
          filename: suggestedFilename
        };
      }
      console.warn('File System Access API falhou, utilizando download tradicional:', err);
    }
  }

  // Fallback padrão: cria link de download no navegador
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    success: true,
    method: 'download',
    filename: suggestedFilename
  };
}
