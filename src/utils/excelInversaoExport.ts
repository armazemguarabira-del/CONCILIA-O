import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { InversaoPair, DepositoId } from '../types';
import { formatCurrency, formatHectoliters } from './parsers';
import { calculateQtdSaidaSkus } from './inversaoUtils';

export interface ExportInversaoParams {
  pares: InversaoPair[];
  selectedDeposito: DepositoId | 'ALL';
  usuario?: string;
  dataRef?: string;
  baseMode?: 'COM_AJUSTES' | 'SEM_AJUSTES';
}

/**
 * Salva ou baixa o arquivo Excel gerado via ExcelJS no navegador,
 * com suporte à File System Access API e fallback com <a> download.
 */
async function downloadExcelJsWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<{
  success: boolean;
  filename: string;
  method: string;
}> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
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
      return { success: true, method: 'picker', filename: handle.name || filename };
    } catch (err: any) {
      if (err.name === 'AbortError') return { success: false, method: 'picker', filename };
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { success: true, method: 'download', filename };
}

/**
 * Exporta a planilha IDÊNTICA ao modelo visual oficial de tabela solicitado pelo usuário (imagem):
 * - Cabeçalho Amarelo Ouro (#FFBF00) com faixa superior preta
 * - Linha 1: ENTRADA (A1:C1) mesclado | SAÍDA (D1:F1) mesclado
 * - Linha 2: CÓD | PROD | QTDE. | CÓD | PROD | QTDE.
 * - Linhas de Dados: CÓD, PROD, QTDE. da sobra e falta perfeitamente alinhados e estilizados
 * - Linhas extras reservadas com "0" na coluna PROD, idêntico ao modelo da imagem
 */
export async function exportPlanilhaModeloFiscalExcel(params: ExportInversaoParams): Promise<{
  success: boolean;
  filename: string;
  method: string;
}> {
  const { pares, selectedDeposito, dataRef } = params;
  
  // Pares selecionados com quantidade válida (se nenhum selecionado individualmente, usa todos com quantidade > 0)
  const selecionados = pares.filter(p => p.selected && p.quantidadeInversaoSkus > 0);
  const paresParaExportar = selecionados.length > 0
    ? selecionados
    : pares.filter(p => p.quantidadeInversaoSkus > 0);

  const dataHoje = dataRef || new Date().toLocaleDateString('pt-BR');
  const safeDep = selectedDeposito === 'ALL' ? 'TODOS' : selectedDeposito;
  const safeDate = dataHoje.replace(/\//g, '-');
  const filename = `Tabela_Inversao_Fiscal_Dep_${safeDep}_${safeDate}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pau Brasil Distribuidora Ambev - Logística e Fiscal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Inversão', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Configuração das larguras exatas das 6 colunas do modelo
  worksheet.columns = [
    { key: 'sobraCod', width: 12 },    // A: CÓD Entrada
    { key: 'sobraProd', width: 50 },   // B: PROD Entrada
    { key: 'sobraQtd', width: 12 },    // C: QTDE. Entrada
    { key: 'faltaCod', width: 12 },    // D: CÓD Saída
    { key: 'faltaProd', width: 50 },   // E: PROD Saída
    { key: 'faltaQtd', width: 12 }     // F: QTDE. Saída
  ];

  // =========================================================================
  // LINHA 1: ENTRADA (A1:C1) | SAÍDA (D1:F1)
  // Fundo Amarelo Ouro (#FFBF00), faixa preta no topo, texto centralizado negrito
  // =========================================================================
  worksheet.mergeCells('A1:C1');
  worksheet.mergeCells('D1:F1');

  const row1 = worksheet.getRow(1);
  row1.height = 28;

  const cellA1 = worksheet.getCell('A1');
  cellA1.value = 'ENTRADA';

  const cellD1 = worksheet.getCell('D1');
  cellD1.value = 'SAÍDA';

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFBF00' } // Amarelo Ouro oficial
  };

  const headerFont1: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: 'FF000000' }
  };

  // Aplica estilos nas 6 células da Linha 1 (com faixa superior preta marcante)
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].forEach((ref, idx) => {
    const cell = worksheet.getCell(ref);
    cell.fill = headerFill;
    cell.font = headerFont1;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } }, // Faixa preta no topo idêntica à imagem
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  });

  // =========================================================================
  // LINHA 2: CÓD | PROD | QTDE. | CÓD | PROD | QTDE.
  // Fundo Amarelo Ouro (#FFBF00), divisórias brancas, texto centralizado negrito
  // =========================================================================
  const row2 = worksheet.getRow(2);
  row2.height = 24;
  row2.values = ['CÓD', 'PROD', 'QTDE.', 'CÓD', 'PROD', 'QTDE.'];

  const headerFont2: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF000000' }
  };

  ['A2', 'B2', 'C2', 'D2', 'E2', 'F2'].forEach(ref => {
    const cell = worksheet.getCell(ref);
    cell.fill = headerFill;
    cell.font = headerFont2;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  });

  // =========================================================================
  // LINHAS DE DADOS (LINHA 3 EM DIANTE): ITENS DE INVERSÃO
  // =========================================================================
  const dataBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  paresParaExportar.forEach(p => {
    const qtdSaida = p.quantidadeSaidaSkus ?? calculateQtdSaidaSkus(p.sobraSku, p.faltaSku, p.quantidadeInversaoSkus);
    
    const row = worksheet.addRow([
      p.sobraSku,
      p.sobraDescricao,
      p.quantidadeInversaoSkus,
      p.faltaSku,
      p.faltaDescricao,
      qtdSaida
    ]);
    row.height = 21;

    // Coluna A: CÓD Entrada
    const cA = row.getCell(1);
    cA.alignment = { vertical: 'middle', horizontal: 'center' };
    cA.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cA.border = dataBorder;

    // Coluna B: PROD Entrada
    const cB = row.getCell(2);
    cB.alignment = { vertical: 'middle', horizontal: 'center' };
    cB.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cB.border = dataBorder;

    // Coluna C: QTDE. Entrada
    const cC = row.getCell(3);
    cC.alignment = { vertical: 'middle', horizontal: 'center' };
    cC.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cC.numFmt = '#,##0';
    cC.border = dataBorder;

    // Coluna D: CÓD Saída
    const cD = row.getCell(4);
    cD.alignment = { vertical: 'middle', horizontal: 'center' };
    cD.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cD.border = dataBorder;

    // Coluna E: PROD Saída
    const cE = row.getCell(5);
    cE.alignment = { vertical: 'middle', horizontal: 'center' };
    cE.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cE.border = dataBorder;

    // Coluna F: QTDE. Saída
    const cF = row.getCell(6);
    cF.alignment = { vertical: 'middle', horizontal: 'center' };
    cF.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF000000' } };
    cF.numFmt = '#,##0';
    cF.border = dataBorder;
  });

  // =========================================================================
  // LINHAS RESERVADAS COM "0" NA COLUNA PROD (IDÊNTICO À IMAGEM DO MODELO)
  // A imagem mostra 6 a 8 linhas reservadas com "0" em PROD abaixo dos dados
  // =========================================================================
  const totalTargetRows = Math.max(16, paresParaExportar.length + 6);
  const extraRowsCount = totalTargetRows - paresParaExportar.length;

  for (let i = 0; i < extraRowsCount; i++) {
    const row = worksheet.addRow(['', 0, '', '', 0, '']);
    row.height = 20;

    for (let col = 1; col <= 6; col++) {
      const cell = row.getCell(col);
      cell.border = dataBorder;
      if (col === 2 || col === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF444444' } };
      }
    }
  }

  return await downloadExcelJsWorkbook(workbook, filename);
}
export async function exportChamadoInversaoExcel(params: ExportInversaoParams): Promise<{
  success: boolean;
  filename: string;
  method: string;
}> {
  const { pares, selectedDeposito, usuario = 'Djeanderson Soares', dataRef, baseMode = 'COM_AJUSTES' } = params;
  
  // Apenas pares de fato selecionados pelo analista com quantidade > 0
  const selecionados = pares.filter(p => p.selected && p.quantidadeInversaoSkus > 0);

  const dataHoje = dataRef || new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const depNome = selectedDeposito === 'ALL' ? 'Geral (Todos os Depósitos)' : `Depósito ${selectedDeposito}`;
  const protocolo = `CH-INV-${Date.now().toString().slice(-6)}`;

  const wb = XLSX.utils.book_new();

  // =========================================================================
  // GUIA 1: CHAMADO DE INVERSÃO (PARES LADO A LADO)
  // =========================================================================
  const rowsGuia1: any[] = [];
  rowsGuia1.push(['PAU BRASIL DISTRIBUIDORA AMBEV - CHAMADO DE INVERSÃO DE PRODUTOS']);
  rowsGuia1.push([`Protocolo: ${protocolo}`, `Data: ${dataHoje} ${horaHoje}`, `Depósito: ${depNome}`, `Analista: ${usuario}`]);
  rowsGuia1.push([`Base de Cálculo: ${baseMode === 'COM_AJUSTES' ? 'Conciliação com Ajustes Operacionais' : 'Conciliação Padrão (Físico Puro)'}`]);
  rowsGuia1.push([]); // linha em branco

  // Cabeçalhos da Tabela
  rowsGuia1.push([
    'ID Par',
    'Grupo / Categoria',
    'Dep.',
    // ENTRADA (SOBRA)
    '[ENTRADA] Cód. SKU',
    '[ENTRADA] Descrição Sobra',
    '[ENTRADA] Sobra Disp. (SKU)',
    '[ENTRADA] Qtd Inverter (SKU)',
    '[ENTRADA] Qtd Inverter (un)',
    '[ENTRADA] Preço Unit. (R$)',
    '[ENTRADA] Valor Total (R$)',
    // SAÍDA (FALTA)
    '[SAÍDA] Cód. SKU',
    '[SAÍDA] Descrição Falta',
    '[SAÍDA] Falta Apurada (SKU)',
    '[SAÍDA] Qtd Inverter (SKU)',
    '[SAÍDA] Qtd Inverter (un)',
    '[SAÍDA] Preço Unit. (R$)',
    '[SAÍDA] Valor Total (R$)',
    // BALANÇO
    '[BALANÇO] Dif. Valor (R$)',
    '[VOLUME] HL Invertido',
    'Justificativa do Chamado'
  ]);

  let somaQtdSkus = 0;
  let somaValorEntrada = 0;
  let somaValorSaida = 0;
  let somaHl = 0;

  selecionados.forEach((p, idx) => {
    somaQtdSkus += p.quantidadeInversaoSkus;
    somaValorEntrada += p.valorEntrada;
    somaValorSaida += p.valorSaida;
    somaHl += p.volumeHlInvertido;

    rowsGuia1.push([
      `PAR-${String(idx + 1).padStart(2, '0')}`,
      p.grupo,
      p.deposito,
      p.sobraSku,
      p.sobraDescricao,
      p.sobraDisponivelSkus,
      p.quantidadeInversaoSkus,
      p.quantidadeInversaoUnits,
      p.sobraValorUnitario,
      p.valorEntrada,
      p.faltaSku,
      p.faltaDescricao,
      p.faltaApuradaSkus,
      p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus,
      (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus) * p.faltaFatorSku,
      p.faltaValorUnitario,
      p.valorSaida,
      p.diferencaValor,
      p.volumeHlInvertido,
      p.justificativa || 'Inversão do mesmo grupo'
    ]);
  });

  // Linha de Totais
  rowsGuia1.push([
    'TOTAIS DO CHAMADO',
    `${selecionados.length} Pares`,
    '',
    '',
    '',
    '',
    somaQtdSkus,
    '',
    '',
    somaValorEntrada,
    '',
    '',
    '',
    somaQtdSkus,
    '',
    '',
    somaValorSaida,
    somaValorEntrada - somaValorSaida,
    somaHl,
    ''
  ]);

  const wsGuia1 = XLSX.utils.aoa_to_sheet(rowsGuia1);
  wsGuia1['!cols'] = [
    { wch: 10 }, // ID Par
    { wch: 28 }, // Grupo
    { wch: 6 },  // Dep
    { wch: 18 }, // Sobra SKU
    { wch: 35 }, // Sobra Desc
    { wch: 18 }, // Sobra Disp
    { wch: 18 }, // Qtd Inverter cx
    { wch: 18 }, // Qtd Inverter un
    { wch: 18 }, // Preço Unit Sobra
    { wch: 20 }, // Valor Entrada
    { wch: 18 }, // Falta SKU
    { wch: 35 }, // Falta Desc
    { wch: 18 }, // Falta Apurada cx
    { wch: 18 }, // Qtd Inverter cx
    { wch: 18 }, // Qtd Inverter un
    { wch: 18 }, // Preço Unit Falta
    { wch: 20 }, // Valor Saida
    { wch: 20 }, // Dif Valor
    { wch: 16 }, // HL
    { wch: 32 }  // Justificativa
  ];
  XLSX.utils.book_append_sheet(wb, wsGuia1, '1. Chamado Inversao (Pares)');

  // =========================================================================
  // GUIA 2: ITENS DE ENTRADA (SOBRAS FÍSICAS)
  // =========================================================================
  const rowsGuia2: any[] = [];
  rowsGuia2.push(['RELATÓRIO DE ITENS PARA ENTRADA FISCAL (SOBRAS REGULARIZADAS)']);
  rowsGuia2.push([`Protocolo: ${protocolo}`, `Data: ${dataHoje}`, `Depósito: ${depNome}`, `Total Itens: ${selecionados.length}`]);
  rowsGuia2.push([]);

  rowsGuia2.push([
    'Operação',
    'Cód. SKU',
    'Descrição do Produto',
    'Depósito',
    'Grupo / Categoria',
    'Qtd Entrada (Caixas / SKUs)',
    'Qtd Entrada (Unidades)',
    'Fator SKU (un/cx)',
    'Preço Unitário (R$)',
    'Valor Total Entrada (R$)',
    'SKU de Saída Vinculado (Falta)'
  ]);

  selecionados.forEach(p => {
    rowsGuia2.push([
      'ENTRADA',
      p.sobraSku,
      p.sobraDescricao,
      p.deposito,
      p.grupo,
      p.quantidadeInversaoSkus,
      p.quantidadeInversaoUnits,
      p.sobraFatorSku,
      p.sobraValorUnitario,
      p.valorEntrada,
      `${p.faltaSku} - ${p.faltaDescricao}`
    ]);
  });

  rowsGuia2.push([
    'TOTAL ENTRADAS',
    '',
    '',
    '',
    '',
    somaQtdSkus,
    '',
    '',
    '',
    somaValorEntrada,
    ''
  ]);

  const wsGuia2 = XLSX.utils.aoa_to_sheet(rowsGuia2);
  wsGuia2['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 36 }, { wch: 10 }, { wch: 26 },
    { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsGuia2, '2. Entradas (Sobras)');

  // =========================================================================
  // GUIA 3: ITENS DE SAÍDA (FALTAS FISCAIS)
  // =========================================================================
  const rowsGuia3: any[] = [];
  rowsGuia3.push(['RELATÓRIO DE ITENS PARA BAIXA / SAÍDA FISCAL (FALTAS REGULARIZADAS)']);
  rowsGuia3.push([`Protocolo: ${protocolo}`, `Data: ${dataHoje}`, `Depósito: ${depNome}`, `Total Itens: ${selecionados.length}`]);
  rowsGuia3.push([]);

  rowsGuia3.push([
    'Operação',
    'Cód. SKU',
    'Descrição do Produto',
    'Depósito',
    'Grupo / Categoria',
    'Qtd Saída (Caixas / SKUs)',
    'Qtd Saída (Unidades)',
    'Fator SKU (un/cx)',
    'Preço Unitário (R$)',
    'Valor Total Saída (R$)',
    'SKU de Entrada Vinculado (Sobra)'
  ]);

  selecionados.forEach(p => {
    rowsGuia3.push([
      'SAÍDA',
      p.faltaSku,
      p.faltaDescricao,
      p.deposito,
      p.grupo,
      p.quantidadeInversaoSkus,
      p.quantidadeInversaoSkus * p.faltaFatorSku,
      p.faltaFatorSku,
      p.faltaValorUnitario,
      p.valorSaida,
      `${p.sobraSku} - ${p.sobraDescricao}`
    ]);
  });

  rowsGuia3.push([
    'TOTAL SAÍDAS',
    '',
    '',
    '',
    '',
    somaQtdSkus,
    '',
    '',
    '',
    somaValorSaida,
    ''
  ]);

  const wsGuia3 = XLSX.utils.aoa_to_sheet(rowsGuia3);
  wsGuia3['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 36 }, { wch: 10 }, { wch: 26 },
    { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsGuia3, '3. Saidas (Faltas)');

  // =========================================================================
  // GUIA 4: RESUMO & PARECER CONTÁBIL DPO
  // =========================================================================
  const rowsGuia4: any[] = [];
  rowsGuia4.push(['PAU BRASIL DISTRIBUIDORA AMBEV - PARECER DPO E VALORAÇÃO DO CHAMADO']);
  rowsGuia4.push([]);
  rowsGuia4.push(['PARÂMETRO', 'VALOR APURADO']);
  rowsGuia4.push(['Protocolo do Chamado', protocolo]);
  rowsGuia4.push(['Data e Hora de Geração', `${dataHoje} às ${horaHoje}`]);
  rowsGuia4.push(['Depósito Operacional', depNome]);
  rowsGuia4.push(['Analista Responsável', usuario]);
  rowsGuia4.push(['Base da Conciliação', baseMode === 'COM_AJUSTES' ? 'Conciliação com Ajustes (Físico + Desvios)' : 'Conciliação Padrão']);
  rowsGuia4.push(['Total de Pares Invertidos', selecionados.length]);
  rowsGuia4.push(['Total de Caixas (SKUs) Invertidas', somaQtdSkus]);
  rowsGuia4.push(['Volume Total Regularizado (HL)', formatHectoliters(somaHl)]);
  rowsGuia4.push(['Valoração Total das Entradas (Sobras)', formatCurrency(somaValorEntrada)]);
  rowsGuia4.push(['Valoração Total das Saídas (Faltas)', formatCurrency(somaValorSaida)]);
  rowsGuia4.push(['Diferença Financeira Líquida', formatCurrency(somaValorEntrada - somaValorSaida)]);
  rowsGuia4.push([]);
  rowsGuia4.push(['PARECER DO ANALISTA DPO:']);
  rowsGuia4.push(['As inversões selecionadas acima referem-se a produtos homologados do mesmo grupo e apresentação comercial.']);
  rowsGuia4.push(['A emissão do presente chamado visa equalizar o estoque físico e fiscal, neutralizando distorções operacionais']);
  rowsGuia4.push(['decorrentes de contagem física ou conferência de carga sem prejuízo financeiro para a unidade Pau Brasil Ambev.']);

  const wsGuia4 = XLSX.utils.aoa_to_sheet(rowsGuia4);
  wsGuia4['!cols'] = [{ wch: 35 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsGuia4, '4. Resumo & Parecer DPO');

  // =========================================================================
  // SALVAR OU DISPARAR DOWNLOAD
  // =========================================================================
  const safeDep = selectedDeposito === 'ALL' ? 'TODOS' : selectedDeposito;
  const safeDate = dataHoje.replace(/\//g, '-');
  const filename = `Chamado_Inversao_Ambev_Dep_${safeDep}_${safeDate}.xlsx`;

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });

  // Tenta File System Access API
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
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
        filename: handle.name || filename
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'picker', filename };
      }
      console.warn('File System Picker falhou, utilizando download tradicional:', err);
    }
  }

  // Fallback padrão
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    success: true,
    method: 'download',
    filename
  };
}
