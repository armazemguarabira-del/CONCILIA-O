import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  HelpCircle,
  FileText,
  Building2,
  Download,
  Calendar
} from 'lucide-react';
import { DepositoId, ProductMaster, StockPositionItem, QuebraItem, TrocaItem, ValeItem, FaltaMapeadaItem, ImportFileType } from '../types';
import { 
  parse020502Csv, 
  parse021101Csv,
  apply021101Recounts,
  parse0111Csv, 
  apply0111Recounts, 
  parseCadastroCsv, 
  parseQuebrasCsv, 
  parseValesCsv, 
  parseTrocasCsv, 
  parseFaltasCsv,
  parseExcelWorkbookToCsv 
} from '../utils/parsers';
import { sanitizeAndDeduplicateQuebras, ensureCompleteHistoricalQuebras } from '../utils/quebrasDeduplicator';
import { DEPOSITOS } from '../data/initialData';
import { persistData, STORAGE_KEYS } from '../utils/persistentStorage';

export type { ImportFileType };

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFileType?: ImportFileType;
  lockedFileType?: ImportFileType | null;
  selectedDeposito: DepositoId;
  productsMap: Map<string, ProductMaster>;
  setProductsMap: React.Dispatch<React.SetStateAction<Map<string, ProductMaster>>>;
  stockPositions: StockPositionItem[];
  setStockPositions: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  gradeStockPositions?: StockPositionItem[];
  setGradeStockPositions?: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  setQuebras: React.Dispatch<React.SetStateAction<QuebraItem[]>>;
  setVales: React.Dispatch<React.SetStateAction<ValeItem[]>>;
  setTrocas: React.Dispatch<React.SetStateAction<TrocaItem[]>>;
  setFaltasMapeadas: React.Dispatch<React.SetStateAction<FaltaMapeadaItem[]>>;
  setIsRecountApplied: (applied: boolean) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  initialFileType = '020502',
  lockedFileType,
  selectedDeposito,
  productsMap,
  setProductsMap,
  stockPositions,
  setStockPositions,
  gradeStockPositions,
  setGradeStockPositions,
  setQuebras,
  setVales,
  setTrocas,
  setFaltasMapeadas,
  setIsRecountApplied,
}) => {
  const [fileType, setFileType] = useState<ImportFileType>(lockedFileType || initialFileType);
  const [targetDeposito, setTargetDeposito] = useState<DepositoId>(selectedDeposito === 'ALL' as any ? '01' : selectedDeposito);
  const [csvContent, setCsvContent] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'append' | 'replace'>('merge');
  const [quebraRefDate, setQuebraRefDate] = useState<string>('11/09/2026');

  const downloadQuebrasTemplateCsv = () => {
    const header = 'Código;Descrição;Quantidade;Valor Total (R$);Hecto Total (HL);Código Motivo;AREA;MOTIVO\r\n';
    const sampleRows = [
      '988;BRAHMA CHOPP 600ML;34;147,98;2,4480;577;PUXADA;QUEBRADA',
      '2353;GUARANA CHP ANTARCTICA DIET PET 2L CAIXA C/6;42;196,60;5,0400;578;PUXADA;VAZAMENTO',
      '2546;ORIGINAL 600ML;9;45,77;0,6480;539;ARMAZÉM;QUEBRA COM MOVIMENTAÇÃO',
      '7983;GATORADE MORANGO-MARACUJA PET 500ML SIXPACK;1;3,89;0,0300;578;PUXADA;VAZAMENTO',
      '9276;PEPSI ZERO PET 2L CAIXA C/6;90;391,96;10,8000;578;PUXADA;VAZAMENTO',
      '21632;SPATEN N LN 355ML SIXPACK SH C/4;36;141,88;3,0672;575;PUXADA;ESTUFADO',
      '33857;STELLA ARTOIS PURE GOLD 600ML;24;216,00;1,7280;577;PUXADA;QUEBRADA'
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_padrao_quebras_8_colunas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadDreQuebrasTemplateCsv = () => {
    const header = 'Data;Mês;Cód Produto;Descrição;Quantidade;Área;Turno;Cód Quebra;Motivo;Colaborador;Função;VALOR DA AVARIA;HECTO LITRO;HECTO PERDIDO;Origem\r\n';
    const sampleRows = [
      '22/06/2026;JUNHO;1166;SUKITA UVA P2;1;PUXADA;NOITE;578;VAZAMENTO;;;3,35;0,0200;0,0200;DRE Quebras',
      '22/06/2026;JUNHO;13061;H2OH LIMONETO PET500ML;1;PUXADA;NOITE;575;ESTUFADO;;;2,73;0,0050;0,0050;DRE Quebras',
      '22/06/2026;JUNHO;21020;BUDWEISER 350ML;10;PUXADA;MANHÃ;575;ESTUFADO;;;26,49;0,0035;0,0350;DRE Quebras',
      '23/06/2026;JUNHO;2349;GUARANÁ CHP P2;5;PUXADA;NOITE;578;VAZAMENTO;;;23,66;0,0200;0,1000;DRE Quebras',
      '24/06/2026;JUNHO;9068;SKOL 350ML;4;PUXADA;MANHÃ;578;VAZAMENTO;N/A;N/A;10,09;0,0035;0,0208;DRE Quebras',
      '25/06/2026;JUNHO;21658;SPATEN LT 350ML;2;PUXADA;NOITE;575;ESTUFADO;;;6,69;0,0035;0,0070;DRE Quebras',
      '26/06/2026;JUNHO;34608;SKOL MULTIPACK;10;ENTREGA;MANHÃ;548;VAZAMENTO;;;25,25;0,0035;0,0350;DRE Quebras'
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_dre_quebras_promax_detalhado.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sync fileType if lockedFileType changes
  React.useEffect(() => {
    if (lockedFileType) {
      setFileType(lockedFileType);
    } else if (initialFileType) {
      setFileType(initialFileType);
    }
  }, [lockedFileType, initialFileType, isOpen]);

  if (!isOpen) return null;

  const fileConfig: Record<string, { title: string; badge: string; desc: string; exampleHeader: string; exampleRow: string }> = {
    '020502': {
      title: 'Arquivo 02.05.02 (Posição de Estoque)',
      badge: 'Posição & Conciliação',
      desc: 'Atualiza o disponível sistêmico e a contagem física inicial no formato 5/02 (SKUs/Unidades) para o depósito selecionado.',
      exampleHeader: 'CODIGO;DESCRICAO;DISPONIVEL;INVENTARIO;GRUPO',
      exampleRow: '347;SKOL LATA 350ML 1X12;150/06;148/00;CERVEJA',
    },
    '021101': {
      title: 'Arquivo 02.11.01 (Recontagem de Estoque)',
      badge: 'Recontagem Seletiva',
      desc: 'Atualiza apenas a contagem física dos itens recontados no relatório 02.11.01 da Ambev. Os demais itens que não constam no arquivo permanecem intactos.',
      exampleHeader: 'DEPOSITO;AREA;PRODUTO;DESCRICAO;EMBALAGEM;UN;QTD_PALLET;STATUS;QTD_SKUS;PALLET;LASTRO;AVULSA',
      exampleRow: '01;1;347;SKOL LATA 350ML;LATA;CX;84;OK;149;1;4;4',
    },
    '0111': {
      title: 'Arquivo 02.11.01 (Recontagem de Estoque)',
      badge: 'Recontagem Seletiva',
      desc: 'Atualiza apenas a contagem física dos itens recontados no relatório 02.11.01 da Ambev. Os demais itens que não constam no arquivo permanecem intactos.',
      exampleHeader: 'DEPOSITO;AREA;PRODUTO;DESCRICAO;EMBALAGEM;UN;QTD_PALLET;STATUS;QTD_SKUS;PALLET;LASTRO;AVULSA',
      exampleRow: '01;1;347;SKOL LATA 350ML;LATA;CX;84;OK;149;1;4;4',
    },
    'cadastro': {
      title: 'Base de Cadastro de Produtos',
      badge: 'Parâmetros & Fatores',
      desc: 'Importa ou atualiza o Fator SKU (unidades por embalagem), Lastro, Pallet, Fator Hectolitro (HL) e Valores unitários.',
      exampleHeader: 'CODIGO;DESCRICAO;GRUPO;FATOR_SKU;LASTRO;PALLET;FATOR_HL;VALOR_CX',
      exampleRow: '347;SKOL LATA 350ML 1X12;CERVEJA;12;20;140;0.042;39.80',
    },
    'quebras': {
      title: 'Base de Quebras / DRE de Avarias (Excel / CSV)',
      badge: 'Duplo Formato Inteligente',
      desc: 'Compatível tanto com o Modelo Padrão Oficial (8 colunas) quanto com o Modelo DRE Quebras Promax / Ambev Detalhado (com Data, Turno, Código de Quebra, Avaria e Hecto Perdido). O sistema lê apenas as informações relevantes, filtra automaticamente linhas de média/subtotal e posiciona cada ocorrência na sua respectiva data.',
      exampleHeader: 'Formato Padrão (8 col.): Código;Descrição;Quantidade;Valor Total (R$);Hecto Total (HL);Código Motivo;AREA;MOTIVO\nFormato DRE Promax (15 col.): Data;Mês;Cód Produto;Descrição;Quantidade;Área;Turno;Cód Quebra;Motivo;Colaborador;Função;VALOR DA AVARIA;HECTO LITRO;HECTO PERDIDO;Origem',
      exampleRow: 'Exemplo DRE Promax: 22/06/2026;JUNHO;21020;BUDWEISER 350ML;10;PUXADA;MANHÃ;575;ESTUFADO;;;26,49;0,0035;0,0350;DRE Quebras',
    },
    'vales': {
      title: 'Base de Vales de Equipe de Rota',
      badge: 'Rateio de Perdas',
      desc: 'Importa débitos de rota com motorista, equipe, cliente, nota fiscal e status de cobrança.',
      exampleHeader: 'DATA;CODIGO;DESCRICAO;QUANTIDADE;MOTORISTA;CLIENTE;NF;VALE_STATUS;DEPOSITO',
      exampleRow: '24/02/2026;33820;BUDWEISER LNR 330ML;12;CARLOS EDUARDO;SUPERMERCADO DIA;44912;Assinado;01',
    },
    'trocas': {
      title: 'Base de Trocas & Reposições',
      badge: 'Atendimento Comercial',
      desc: 'Importa reposições feitas em clientes por avaria no transporte, vencimento ou defeito de fábrica.',
      exampleHeader: 'DATA;SKU;DESCRICAO;QUANTIDADE;CLIENTE;MOTIVO;MOTORISTA;PROTOCOLO;DEPOSITO',
      exampleRow: '23/02/2026;8821;STELLA ARTOIS LATA;6;BAR DO ZE;LATA AMASSADA;ROBERTO;TRC-9921;01',
    },
    'faltas': {
      title: 'Planilha de Faltas Mapeadas',
      badge: 'Faltas & Observações',
      desc: 'Importa faltas operacionais contendo apenas Código, Descrição, Quantidade e Observação/Justificativa.',
      exampleHeader: 'CODIGO;DESCRICAO;QUANTIDADE;OBSERVACAO',
      exampleRow: '347;SKOL LATA 350ML;12;Falta na conferência da doca 2 com nota emitida',
    },
  };

  const currentConfig = fileConfig[fileType];

  const handleFileUpload = async (file: File) => {
    try {
      setUploadedFileName(file.name);
      const lowerName = file.name.toLowerCase();
      const isExcel = lowerName.endsWith('.xlsx') || 
                      lowerName.endsWith('.xls') || 
                      lowerName.endsWith('.xlsm') || 
                      lowerName.endsWith('.xlsb') ||
                      file.type.includes('spreadsheet') ||
                      file.type.includes('excel');

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const result = parseExcelWorkbookToCsv(buffer);
        setCsvContent(result.csv);
        setStatusMessage({
          type: 'success',
          text: `Planilha Excel "${file.name}" carregada com sucesso! (${result.sheetNames.length} aba(s), aba ativa: "${result.sheetName}"). Clique em "Processar e Atualizar Base".`
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setCsvContent(text);
          setStatusMessage(null);
        };
        reader.readAsText(file, 'UTF-8');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erro ao processar arquivo: ${err.message || err}`
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleProcessImport = () => {
    if (!csvContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Cole ou selecione um arquivo CSV para continuar.' });
      return;
    }

    try {
      if (fileType === '020502') {
        const parsed = parse020502Csv(csvContent, productsMap, targetDeposito);
        if (parsed.length === 0) {
          throw new Error('Nenhum registro válido encontrado. Verifique o delimitador (; ou vírgula).');
        }

        // Substituição integral para 02.05.02 (NÃO MESCLAR SALDOS)
        setStockPositions(prev => {
          const others = prev.filter(p => p.deposito !== targetDeposito);
          const merged = [...others, ...parsed];
          persistData(STORAGE_KEYS.STOCK_POSITIONS_020502, merged);
          persistData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, merged);
          return merged;
        });

        // Atualiza e substitui também na GUIA DE GRADE DE ESTOQUE (substituição integral)
        if (setGradeStockPositions) {
          const parsedForGrade = parse020502Csv(csvContent, productsMap);
          const validGrade = parsedForGrade.length > 0 ? parsedForGrade : parsed;
          setGradeStockPositions(validGrade);
          const nowStr = new Date().toLocaleString('pt-BR');
          const fileLabel = uploadedFileName ? `${uploadedFileName} (${nowStr})` : `02.05.02 (${nowStr})`;
          persistData(STORAGE_KEYS.GRADE_IMPORT_LABEL, fileLabel);
          persistData(STORAGE_KEYS.GRADE_POSITIONS, validGrade);
          persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, validGrade);
        }

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! A base 02.05.02 foi substituída integralmente (${parsed.length} SKUs no Depósito ${targetDeposito}). A Grade de Estoque e a Conciliação foram atualizadas com os novos saldos!` 
        });
      } else if (fileType === '021101' || fileType === '0111') {
        const recounts = parse021101Csv(csvContent, productsMap);
        if (recounts.length === 0) {
          throw new Error('Nenhuma recontagem válida encontrada no arquivo 02.11.01.');
        }

        setStockPositions(prev => {
          const updated = apply021101Recounts(prev, recounts, targetDeposito);
          return updated;
        });
        setIsRecountApplied(true);

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${recounts.length} itens recontados da 02.11.01 aplicados no Depósito ${targetDeposito}. Demais itens preservados.` 
        });
      } else if (fileType === 'cadastro') {
        const parsedMap = parseCadastroCsv(csvContent);
        if (parsedMap.size === 0) {
          throw new Error('Nenhum produto cadastrado encontrado no CSV.');
        }

        let updatedCount = 0;
        let newCount = 0;
        const newProductsMap = new Map<string, ProductMaster>(productsMap);

        parsedMap.forEach((v: ProductMaster, k: string) => {
          const existing = newProductsMap.get(k);
          if (existing) {
            newProductsMap.set(k, {
              ...existing,
              descricao: v.descricao && !v.descricao.startsWith('Produto ') ? v.descricao : existing.descricao,
              fatorSku: v.fatorSku > 1 ? v.fatorSku : existing.fatorSku,
              fatorPallet: v.fatorPallet > 1 ? v.fatorPallet : existing.fatorPallet,
              valor: v.valor > 0 ? v.valor : existing.valor,
              valorUnit: v.valorUnit > 0 ? v.valorUnit : existing.valorUnit,
              fatorHl: v.fatorHl > 0 ? v.fatorHl : existing.fatorHl,
              grupo: v.grupo && v.grupo !== 'GERAL' ? v.grupo : existing.grupo,
              embalagem: v.embalagem || existing.embalagem,
              idade: v.idade || existing.idade,
            });
            updatedCount++;
          } else {
            newProductsMap.set(k, v);
            newCount++;
          }
        });

        setProductsMap(newProductsMap);
        persistData(STORAGE_KEYS.PRODUCTS, Array.from(newProductsMap.entries()));

        // Recalcula impactos financeiros em estoque com os novos preços
        setStockPositions(prev => {
          const updated = prev.map(item => {
            const p = newProductsMap.get(item.produto) as ProductMaster | undefined;
            if (!p) return item;
            const valorUnitario = p.valorUnit || item.valorUnitario;
            const valorCaixa = p.valor || (valorUnitario * item.fatorSku);
            const impactoFinanceiro = item.diferencaTotalUnits * valorUnitario;
            const prejuizoFinanceiro = item.diferencaTotalUnits < 0 ? Math.abs(item.diferencaTotalUnits * valorUnitario) : 0;
            const sobraFinanceira = item.diferencaTotalUnits > 0 ? item.diferencaTotalUnits * valorUnitario : 0;
            return {
              ...item,
              valorUnitario,
              valorCaixa,
              impactoFinanceiro,
              prejuizoFinanceiro,
              sobraFinanceira,
            };
          });
          persistData(STORAGE_KEYS.STOCK_POSITIONS_020502, updated);
          persistData(STORAGE_KEYS.STOCK_POSITIONS_LEGACY, updated);
          return updated;
        });

        if (setGradeStockPositions) {
          setGradeStockPositions(prev => {
            const updated = prev.map(item => {
              const p = newProductsMap.get(item.produto) as ProductMaster | undefined;
              if (!p) return item;
              const valorUnitario = p.valorUnit || item.valorUnitario;
              const valorCaixa = p.valor || (valorUnitario * item.fatorSku);
              const impactoFinanceiro = item.diferencaTotalUnits * valorUnitario;
              const prejuizoFinanceiro = item.diferencaTotalUnits < 0 ? Math.abs(item.diferencaTotalUnits * valorUnitario) : 0;
              const sobraFinanceira = item.diferencaTotalUnits > 0 ? item.diferencaTotalUnits * valorUnitario : 0;
              return {
                ...item,
                valorUnitario,
                valorCaixa,
                impactoFinanceiro,
                prejuizoFinanceiro,
                sobraFinanceira,
              };
            });
            persistData(STORAGE_KEYS.GRADE_POSITIONS, updated);
            persistData(STORAGE_KEYS.GRADE_POSITIONS_LEGACY, updated);
            return updated;
          });
        }

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${updatedCount} produto(s) atualizados com novos valores e ${newCount} novo(s) incluídos. Todos os demais produtos não listados foram preservados!` 
        });
      } else if (fileType === 'quebras') {
        const parsed = parseQuebrasCsv(csvContent, productsMap, targetDeposito, quebraRefDate);
        if (parsed.length === 0) throw new Error('Nenhuma quebra válida encontrada.');

        const totalVal = parsed.reduce((sum, q) => sum + (q.valorTotal || 0), 0);
        const totalHl = parsed.reduce((sum, q) => sum + (q.volumeHl || 0), 0);

        setQuebras(prev => {
          let updated: QuebraItem[];
          if (importMode === 'replace') {
            // Substitui APENAS o período/semana sendo importada para o depósito, preservando 100% de todas as demais semanas anteriores!
            const importedDates = new Set(parsed.map(p => p.data).filter(Boolean));
            const importedWeeks = new Set(parsed.map(p => p.semanaRef).filter(Boolean));
            const preserved = prev.filter(q => {
              if (q.deposito !== targetDeposito) return true;
              if (q.semanaRef && importedWeeks.has(q.semanaRef)) return false;
              if (q.data && importedDates.has(q.data)) return false;
              return true;
            });
            updated = [...preserved, ...parsed];
          } else if (importMode === 'merge') {
            // Modo Analista de Dados: Consolida preservando rigorosamente semanas e datas distintas
            const map = new Map<string, QuebraItem>();
            prev.forEach(q => {
              // Chave composta com semanaRef e data para JAMAIS mesclar semanas ou datas diferentes!
              const key = `${q.semanaRef || ''}_${q.data || ''}_${q.deposito}_${q.sku}_${(q.motivo || 'GERAL').trim().toUpperCase()}_${q.turno || ''}_${q.area || ''}`;
              map.set(key, { ...q });
            });

            parsed.forEach(newItem => {
              const key = `${newItem.semanaRef || ''}_${newItem.data || ''}_${newItem.deposito}_${newItem.sku}_${(newItem.motivo || 'GERAL').trim().toUpperCase()}_${newItem.turno || ''}_${newItem.area || ''}`;
              const existing = map.get(key);
              if (existing) {
                existing.quantidade += newItem.quantidade;
                existing.valorTotal += newItem.valorTotal;
                existing.volumeHl += newItem.volumeHl;
              } else {
                map.set(key, { ...newItem });
              }
            });

            updated = Array.from(map.values());
          } else {
            // Modo Append individual
            updated = [...prev, ...parsed];
          }

          // Garante a integridade inviolável de todas as semanas históricas auditadas
          const guaranteed = ensureCompleteHistoricalQuebras(updated);
          const { cleaned } = sanitizeAndDeduplicateQuebras(guaranteed);
          persistData(STORAGE_KEYS.QUEBRAS, cleaned);
          try {
            localStorage.setItem('gestao_estoque_v4_quebras', JSON.stringify(cleaned));
          } catch {}
          return cleaned;
        });

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${parsed.length} quebras processadas com valorização total de R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalHl.toFixed(4)} HL) para o Depósito ${targetDeposito}.` 
        });
      } else if (fileType === 'vales') {
        const parsed = parseValesCsv(csvContent, productsMap, targetDeposito);
        if (parsed.length === 0) throw new Error('Nenhum vale válido encontrado.');

        setVales(prev => {
          if (importMode === 'replace') {
            const others = prev.filter(v => v.deposito !== targetDeposito);
            return [...others, ...parsed];
          } else if (importMode === 'merge') {
            // Modo Analista de Dados: Consolida e soma vales por (depósito + código + motorista + NF/mapa)
            const map = new Map<string, ValeItem>();
            prev.forEach(v => {
              const key = `${v.deposito}_${v.codigo}_${(v.motorista || '').trim().toUpperCase()}_${(v.notaFiscal || v.mapa || '').trim().toUpperCase()}`;
              map.set(key, { ...v });
            });

            parsed.forEach(newItem => {
              const key = `${newItem.deposito}_${newItem.codigo}_${(newItem.motorista || '').trim().toUpperCase()}_${(newItem.notaFiscal || newItem.mapa || '').trim().toUpperCase()}`;
              const existing = map.get(key);
              if (existing) {
                existing.quantidade += newItem.quantidade;
                existing.valorTotal += newItem.valorTotal;
                existing.volumeHl += newItem.volumeHl;
                existing.valorRateado = existing.totalIntegrantes > 0 ? existing.valorTotal / existing.totalIntegrantes : existing.valorTotal;
              } else {
                map.set(key, { ...newItem });
              }
            });

            return Array.from(map.values());
          }
          return [...prev, ...parsed];
        });

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${parsed.length} vales processados com modo [${importMode.toUpperCase()}].` 
        });
      } else if (fileType === 'trocas') {
        const parsed = parseTrocasCsv(csvContent, productsMap, targetDeposito);
        if (parsed.length === 0) throw new Error('Nenhuma troca válida encontrada.');

        setTrocas(prev => {
          if (importMode === 'replace') {
            const others = prev.filter(t => t.deposito !== targetDeposito);
            return [...others, ...parsed];
          } else if (importMode === 'merge') {
            // Modo Analista de Dados: Consolida e soma trocas por (depósito + código + cliente)
            const map = new Map<string, TrocaItem>();
            prev.forEach(t => {
              const key = `${t.deposito}_${t.codigos}_${(t.cliente || '').trim().toUpperCase()}_${(t.notaFiscal || '').trim().toUpperCase()}`;
              map.set(key, { ...t });
            });

            parsed.forEach(newItem => {
              const key = `${newItem.deposito}_${newItem.codigos}_${(newItem.cliente || '').trim().toUpperCase()}_${(newItem.notaFiscal || '').trim().toUpperCase()}`;
              const existing = map.get(key);
              if (existing) {
                existing.quantidade += newItem.quantidade;
                existing.valorTotal += newItem.valorTotal;
                existing.volumeHl += newItem.volumeHl;
              } else {
                map.set(key, { ...newItem });
              }
            });

            return Array.from(map.values());
          }
          return [...prev, ...parsed];
        });

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${parsed.length} trocas processadas com modo [${importMode.toUpperCase()}].` 
        });
      } else if (fileType === 'faltas') {
        const parsed = parseFaltasCsv(csvContent, productsMap, targetDeposito);
        if (parsed.length === 0) throw new Error('Nenhuma falta válida encontrada no arquivo 02.11.01.');

        setFaltasMapeadas(prev => {
          if (importMode === 'replace') {
            const others = prev.filter(f => f.deposito !== targetDeposito);
            return [...others, ...parsed];
          } else if (importMode === 'merge') {
            // Modo Analista de Dados: Consolida faltas mapeadas por (depósito + código)
            const map = new Map<string, FaltaMapeadaItem>();
            prev.forEach(f => {
              const key = `${f.deposito || targetDeposito}_${f.codigo || f.produto}`;
              map.set(key, { ...f });
            });

            parsed.forEach(newItem => {
              const key = `${newItem.deposito || targetDeposito}_${newItem.codigo || newItem.produto}`;
              const existing = map.get(key);
              if (existing) {
                existing.quantidade += newItem.quantidade;
                existing.valorTotal = (existing.valorTotal || 0) + (newItem.valorTotal || 0);
                existing.volumeHl = (existing.volumeHl || 0) + (newItem.volumeHl || 0);
                if (newItem.observacao && !existing.observacao.includes(newItem.observacao)) {
                  existing.observacao += ` | ${newItem.observacao}`;
                }
              } else {
                map.set(key, { ...newItem });
              }
            });

            return Array.from(map.values());
          }
          return [...prev, ...parsed];
        });

        setStatusMessage({ 
          type: 'success', 
          text: `Sucesso! ${parsed.length} faltas mapeadas integradas com modo [${importMode.toUpperCase()}].` 
        });
      }

      setTimeout(() => {
        setCsvContent('');
        onClose();
      }, 1600);

    } catch (err: any) {
      setStatusMessage({ 
        type: 'error', 
        text: `Erro ao processar importação: ${err.message || 'Verifique o formato das colunas.'}` 
      });
    }
  };

  const isIndependent = Boolean(lockedFileType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs border ${
              isIndependent 
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isIndependent ? `Importação Independente: ${currentConfig.title}` : 'Central de Importação de Arquivos'}
                </h3>
                {isIndependent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                    Base Independente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIndependent 
                  ? `Atualização exclusiva para a guia de ${currentConfig.badge}. Nenhuma outra guia será afetada.`
                  : 'Selecione o arquivo desejado para atualizar estoque, conciliações ou perdas operacionais'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection (only visible if NOT locked/independent) */}
        {!isIndependent && (
          <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none px-5 pt-3 bg-slate-50 gap-1.5 text-xs">
            {[
              { id: '020502', label: '02.05.02 (Posição)' },
              { id: '021101', label: '02.11.01 (Recontagem)' },
              { id: 'cadastro', label: 'Cadastro Produtos' },
              { id: 'quebras', label: 'Quebras' },
              { id: 'vales', label: 'Vales' },
              { id: 'trocas', label: 'Trocas' },
              { id: 'faltas', label: 'Faltas Mapeadas' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setFileType(t.id as ImportFileType);
                  setStatusMessage(null);
                }}
                className={`pb-2.5 px-3 font-semibold whitespace-nowrap border-b-2 transition ${
                  fileType === t.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* File description card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{currentConfig.title}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {currentConfig.badge}
              </span>
            </div>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">
              {currentConfig.desc}
            </p>
            <div className="mt-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600">
              <div className="text-slate-400 font-sans text-[10px]">Formato de cabeçalho e exemplo:</div>
              <div className="text-blue-700 font-semibold truncate mt-0.5">{currentConfig.exampleHeader}</div>
              <div className="text-slate-700 truncate">{currentConfig.exampleRow}</div>
            </div>
          </div>

          {/* Import Mode: Para 02.05.02 é sempre Substituição Integral */}
          {fileType === '020502' ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200 gap-2">
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse flex-shrink-0" />
                  <span className="text-emerald-950 font-bold text-xs">Modo de Gravação: Substituição Integral Obrigatória</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Não Mesclar
                  </span>
                </div>
                <span className="text-emerald-800 text-[11px] mt-1 leading-relaxed">
                  O relatório 02.05.02 é o retrato físico/fiscal do estoque. Ao atualizar durante o dia, a nova carga <strong>substitui a base anterior</strong> na Conciliação e na <strong>Guia de Grade de Estoque</strong>, garantindo que não haja soma indevida de saldos.
                </span>
              </div>
              <div className="flex items-center flex-shrink-0">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Substituir Atual
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-800 font-bold text-xs">Modo de Gravação (Analista de Dados):</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                    {importMode === 'merge' ? 'Consolidação Automática' : importMode === 'append' ? 'Inserção em Lote' : 'Sobrescrita'}
                  </span>
                </div>
                <span className="text-slate-500 text-[11px] mt-0.5">
                  {importMode === 'merge' 
                    ? 'Soma quantidades e valores aos itens existentes na plataforma para o mesmo SKU/motivo.' 
                    : importMode === 'append' 
                    ? 'Adiciona cada linha do arquivo como uma entrada independente no sistema.' 
                    : 'Substitui todos os dados anteriores do depósito selecionado.'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    importMode === 'merge'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Mesclar e somar às informações já presentes na plataforma"
                >
                  <span>Mesclar & Somar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    importMode === 'append'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Adicionar novas linhas sem consolidar com existentes"
                >
                  Acrescentar
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    importMode === 'replace'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Sobrescrever a base existente deste depósito"
                >
                  Substituir
                </button>
              </div>
            </div>
          )}

          {/* Depósito Selection and Quebra Reference Date */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {(fileType === '020502' || fileType === '0111' || fileType === 'quebras' || fileType === 'vales' || fileType === 'trocas' || fileType === 'faltas') && (
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-slate-700 font-medium text-xs">Depósito de Destino:</span>
                <select
                  value={targetDeposito}
                  onChange={(e) => setTargetDeposito(e.target.value as DepositoId)}
                  className="bg-white border border-slate-200 text-slate-800 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  {DEPOSITOS.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {fileType === 'quebras' && (
              <div className="flex items-center space-x-2 sm:ml-auto">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700 font-medium text-xs">Data de Ref. (p/ arquivos sem data):</span>
                <input
                  type="text"
                  value={quebraRefDate}
                  onChange={(e) => setQuebraRefDate(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-28 bg-white border border-slate-200 text-slate-800 rounded-md px-2.5 py-1 text-xs text-center font-mono focus:outline-none focus:border-emerald-500 font-bold"
                  title="Data atribuída aos lançamentos quando o arquivo de quebras não possuir coluna de data"
                />
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {statusMessage && (
            <div className={`p-3 rounded-lg flex items-center space-x-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50'
            }`}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              type="file"
              id="fileInput"
              accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <FileSpreadsheet className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
            <div className="font-semibold text-slate-800 text-sm">
              Arraste sua planilha Excel (.xlsx, .xls) ou CSV aqui
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Compatível com todos os formatos do Excel (.xlsx, .xls, .xlsm) e arquivos de texto (.csv, .txt, .tsv)
            </p>
            <div className="mt-2 flex items-center justify-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Excel 97-365 (.xlsx, .xls)
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                CSV Promax (;)
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                Modelo 8 Colunas
              </span>
            </div>
          </div>

          {/* Or Paste CSV Directly */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <label className="font-medium text-slate-700 text-xs">
                Ou cole o conteúdo CSV / dados do Excel diretamente:
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {fileType === 'quebras' && (
                  <>
                    <button
                      type="button"
                      onClick={downloadQuebrasTemplateCsv}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 flex items-center gap-1 transition shadow-xs"
                      title="Baixar modelo padrão oficial com 8 colunas (.csv)"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Modelo Padrão (8 col)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadDreQuebrasTemplateCsv}
                      className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded border border-purple-200 flex items-center gap-1 transition shadow-xs"
                      title="Baixar modelo DRE Quebras Promax / Ambev detalhado com 15 colunas (.csv)"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-600" />
                      <span>Modelo DRE Quebras (15 col)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const standardSample = `Código;Descrição;Quantidade;Valor Total (R$);Hecto Total (HL);Código Motivo;AREA;MOTIVO
988;BRAHMA CHOPP 600ML;34;147,98;2,4480;577;PUXADA;QUEBRADA
2353;GUARANA CHP ANTARCTICA DIET PET 2L CAIXA C/6;42;196,60;5,0400;578;PUXADA;VAZAMENTO
2546;ORIGINAL 600ML;9;45,77;0,6480;539;ARMAZÉM;QUEBRA COM MOVIMENTAÇÃO
7983;GATORADE MORANGO-MARACUJA PET 500ML SIXPACK;1;3,89;0,0300;578;PUXADA;VAZAMENTO
9067;ANTARCTICA PILSEN LATA 350ML SH C/12 NPAL;1;2,41;0,0420;575;PUXADA;ESTUFADO
9087;SODA LIMONADA ANTARCTICA LATA 350ML SH C/12 NPAL;1;1,62;0,0420;575;PUXADA;ESTUFADO
9276;PEPSI ZERO PET 2L CAIXA C/6;90;391,96;10,8000;578;PUXADA;VAZAMENTO
9427;ANTARCTICA PILSEN LT 473ML SH C/12 NPAL;1;3,83;0,0568;575;PUXADA;ESTUFADO
19229;RED BULL BR LATA 250ML SIX PACK NPAL .;16;99,28;0,2400;575;PUXADA;ESTUFADO
19321;GUARANA ANTARCTICA ZERO PET 200ML SH C/12;1;1,07;0,0240;578;PUXADA;VAZAMENTO
20164;SKOL LT 473ML SH C/12 NPAL MULTPACK 12;1;3,12;0,0568;575;PUXADA;ESTUFADO
20651;CORONA EXTRA N LT SLEEK 350ML C 8 CX CARTAO;1;3,74;0,0280;575;PUXADA;ESTUFADO
21020;BUDWEISER LT SLEEK 350ML CX CART C 12;1;2,65;0,0420;575;PUXADA;ESTUFADO
21119;SKOL BEATS GT LT 269ML CX CARTAO C/8 NPAL;2;7,82;0,0430;575;PUXADA;ESTUFADO
21441;SUKITA LIMAO PET 2L CAIXA C/6;1;3,17;0,1200;578;PUXADA;VAZAMENTO
21632;SPATEN N LN 355ML SIXPACK SH C/4;36;141,88;3,0672;575;PUXADA;ESTUFADO
21666;RED BULL TROPICAL BR LATA 250ML FOUR PACK NPAL .;6;37,23;0,0600;575;PUXADA;ESTUFADO
26462;ORIGINAL LT 473ML CX CARTAO C/12;1;3,47;0,0568;575;PUXADA;ESTUFADO
29845;PEPSI BLACK PET 1 L SH C/12;1;2,87;0,1200;578;PUXADA;VAZAMENTO
30045;RED BULL BR LATA 473ML CX C 12;8;64,12;0,4541;575;PUXADA;ESTUFADO
31064;BUDWEISER LT 269ML SH C 15;1;2,25;0,0404;575;PUXADA;ESTUFADO
32067;GATORADE BERRY BLUE PET 500ML SIXPACK;1;3,79;0,0300;578;PUXADA;VAZAMENTO
32500;STELLA ARTOIS PURE GOLD LT SLEEK 350ML C 8 CX CARTAO;1;3,79;0,0280;575;PUXADA;ESTUFADO
33857;STELLA ARTOIS PURE GOLD 600ML;24;216,00;1,7280;577;PUXADA;QUEBRADA
34027;GUARANA CHP ANTARCTICA LATA 350ML SH C/12 NPAL MULTIPACK;1;2,54;0,0420;539;ARMAZÉM;QUEBRA COM MOVIMENTAÇÃO
34608;SKOL LATA 350ML SH C/12 NPAL MULTIPACK;1;3,25;0,0420;545;ENTREGA;ESTUFADO
37450;BUDWEISER LT SLEEK 350ML SH C 12 MULTIPACK;1;3,47;0,0420;545;ENTREGA;ESTUFADO`;
                        setCsvContent(standardSample);
                        setStatusMessage({
                          type: 'success',
                          text: 'Base oficial de 27 quebras (08/09 a 12/09) carregada no modelo padrão! Total: R$ 1.414,78 | 25,2851 HL.'
                        });
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition"
                      title="Carregar lote padrão oficial do período 08/09 a 12/09"
                    >
                      Lote 08/09 - 12/09
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `Data;Mês;Cód Produto;Descrição;Quantidade;Área;Turno;Cód Quebra;Motivo;Colaborador;Função;VALOR DA AVARIA;HECTO LITRO;HECTO PERDIDO;Origem
22/06/2026;JUNHO;1166;SUKITA UVA P2;1;PUXADA;NOITE;578;VAZAMENTO;;;3,35;0,0200;0,0200;DRE Quebras
22/06/2026;JUNHO;13061;H2OH LIMONETO PET500ML;1;PUXADA;NOITE;575;ESTUFADO;;;2,73;0,0050;0,0050;DRE Quebras
22/06/2026;JUNHO;21020;BUDWEISER 350ML;10;PUXADA;MANHÃ;575;ESTUFADO;;;26,49;0,0035;0,0350;DRE Quebras
23/06/2026;JUNHO;2349;GUARANÁ CHP P2;5;PUXADA;NOITE;578;VAZAMENTO;;;23,66;0,0200;0,1000;DRE Quebras
24/06/2026;JUNHO;9068;SKOL 350ML;4;PUXADA;MANHÃ;578;VAZAMENTO;N/A;N/A;10,09;0,0035;0,0208;DRE Quebras
25/06/2026;JUNHO;21658;SPATEN LT 350ML;2;PUXADA;NOITE;575;ESTUFADO;;;6,69;0,0035;0,0070;DRE Quebras
26/06/2026;JUNHO;34608;SKOL MULTIPACK;10;ENTREGA;MANHÃ;548;VAZAMENTO;;;25,25;0,0035;0,0350;DRE Quebras`;
                        setCsvContent(sample);
                        setStatusMessage({
                          type: 'success',
                          text: 'Exemplo do Modelo DRE Quebras Promax carregado! Cada linha será lida e posicionada na sua data exata.'
                        });
                      }}
                      className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 transition"
                      title="Carregar exemplo do Modelo DRE Quebras (Promax / Ambev detalhado)"
                    >
                      Exemplo DRE Quebras
                    </button>
                  </>
                )}
                {csvContent && (
                  <button
                    type="button"
                    onClick={() => setCsvContent('')}
                    className="text-[11px] text-rose-600 hover:underline px-1"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={5}
              placeholder={`Cole as linhas do CSV ou tabela Excel aqui...\nExemplo:\n${currentConfig.exampleHeader}\n${currentConfig.exampleRow}`}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {csvContent.trim() ? `${csvContent.trim().split('\n').length} linha(s) carregada(s)` : 'Aguardando arquivo ou texto'}
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md font-semibold transition text-xs"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleProcessImport}
              disabled={!csvContent.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-semibold transition shadow-sm active:scale-95 text-xs flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Processar e Atualizar Base</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
