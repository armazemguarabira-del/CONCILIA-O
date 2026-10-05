import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileCheck2, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Search, 
  TrendingDown,
  TrendingUp,
  ClipboardPaste,
  RefreshCw,
  HelpCircle,
  PackageCheck,
  PackageX,
  Boxes
} from 'lucide-react';
import { GradeEstoqueItem } from '../types';
import { parse020304Csv, Item020304 } from '../utils/parsers';
import * as XLSX from 'xlsx';

export const SAMPLE_020304_DATA = `Grade;Cod;Descricao;UN;Inicial;Ent.;Ent.MCDD;Reserva;Trans.;Saidas;Sai.MCDD;Disp.;Res.Magali;Inic.Agend.;Ent.Agend.;Sai.Agend.;Disp.Agend.
01;000347;SU PT1 CX12    ;cx  ;0000101;0000000;0000000;0000000;000000; 000017; 000000; 0000084; 0000000;0000000;0000000;0000000; 0000000
01;000371;MZBR LN355 SP B;cx  ;0000002;0000000;0000000;0000000;000000; 000000; 000000; 0000002; 0000000;0000000;0000000;0000000; 0000000
01;000503;SU PT2 CX6     ;cx  ;0000152;0000600;0000000;0000000;000000; 000075; 000000; 0000677; 0000000;0000000;0000000;0000000; 0000000
01;000504;PC PT2 CX6     ;cx  ;0000096;0000000;0000000;0000000;000000; 000053; 000000; 0000043; 0000000;0000000;0000000;0000000; 0000000
01;000982;SK 600         ;Dz  ;0000607;0000000;0000000;0000000;000000; 000252; 000000; 0000355; 0000000;0000000;0000000;0000000; 0000000
01;000988;BC 600         ;Dz  ;0000269;0000000;0000000;0000000;000000; 000108; 000000; 0000161; 0000000;0000000;0000000;0000000; 0000000
01;001164;SUKITA UVA LT35;cx  ;0000208;0000000;0000000;0000000;000000; 000013; 000000; 0000195; 0000000;0000000;0000000;0000000; 0000000
01;001166;SUKITA UVA PT2 ;cx  ;0000173;0000000;0000000;0000000;000000; 000048; 000000; 0000125; 0000000;0000000;0000000;0000000; 0000000
01;001388;SK GFAVD1L 2,99;Dz  ;0000360;0000000;0000000;0000000;000000; 000047; 000000; 0000313; 0000000;0000000;0000000;0000000; 0000000
01;001695;BC GFAVD1L COM ;Dz  ;0000436;0000000;0000000;0000000;000000; 000027; 000000; 0000409; 0000000;0000000;0000000;0000000; 0000000
01;001708;GAZR PET2,5CX6 ;cx  ;0000000;0000064;0000000;0000000;000000; 000000; 000000; 0000064; 0000000;0000000;0000000;0000000; 0000000
01;001743;AP GFAVD1L COM ;Dz  ;0001692;0000000;0000000;0000000;000000; 000314; 000000; 0001378; 0000000;0000000;0000000;0000000; 0000000
01;001898;BC L269SH15NP  ;cx  ;0000002;0000000;0000000;0000000;000000; 000000; 000000; 0000002; 0000000;0000000;0000000;0000000; 0000000
01;002008;ASUBZERO LT350S;cx  ;0000134;0000000;0000000;0000000;000000; 000011; 000000; 0000123; 0000000;0000000;0000000;0000000; 0000000
01;002319;GCA PT1 CX12   ;cx  ;0000610;0000000;0000000;0000000;000000; 000080; 000000; 0000530; 0000000;0000000;0000000;0000000; 0000000
01;002320;SLA PT1 CX12   ;cx  ;0000248;0000000;0000000;0000000;000000; 000016; 000000; 0000232; 0000000;0000000;0000000;0000000; 0000000
01;002349;GCA PT2 CX6    ;cx  ;0001541;0000000;0000000;0000000;000000; 000274; 000000; 0001266; 0000000;0000000;0000000;0000000; 0000000
01;002350;SLA PT2 CX6    ;cx  ;0000039;0000000;0000000;0000000;000000; 000029; 000000; 0000009; 0000000;0000000;0000000;0000000; 0000000
01;002353;GCAD PT2 CX6   ;cx  ;0000600;0000000;0000000;0000000;000000; 000064; 000000; 0000536; 0000000;0000000;0000000;0000000; 0000000
01;002354;SLA DI PT2 CX6 ;cx  ;0000178;0000000;0000000;0000000;000000; 000003; 000000; 0000175; 0000000;0000000;0000000;0000000; 0000000
01;002538;AP 600         ;Dz  ;0000826;0000504;0000000;0000000;000000; 000370; 000000; 0000960; 0000000;0000000;0000000;0000000; 0000000
01;002546;ORIGINAL 600   ;Dz  ;0000074;0000504;0000000;0000000;000000; 000060; 000000; 0000517; 0000000;0000000;0000000;0000000; 0000000
01;002548;BUD 600        ;Dz  ;0000789;0000000;0000000;0000000;000000; 000294; 000000; 0000494; 0000000;0000000;0000000;0000000; 0000000
01;004262;MICULTN LTSL350;cx  ;0000900;0000000;0000000;0000000;000000; 000070; 000000; 0000830; 0000000;0000000;0000000;0000000; 0000000
01;004293;PEBL PT200MLSH1;cx  ;0001001;0000000;0000000;0000000;000000; 000029; 000000; 0000972; 0000000;0000000;0000000;0000000; 0000000
01;004367;INAMSG GFPET1,5;cx  ;0000273;0000000;0000000;0000000;000000; 000011; 000000; 0000262; 0000000;0000000;0000000;0000000; 0000000
01;004409;PC TW PT2 SHRK6;cx  ;0000357;0000000;0000000;0000000;000000; 000030; 000000; 0000326; 0000000;0000000;0000000;0000000; 0000000
01;006181;D DAV S/G PT500;cx  ;0000008;0000000;0000000;0000008;000000; 000000; 000000; 0000000; 0000000;0000000;0000000;0000000; 0000000
01;007325;PC PT1 CX12    ;cx  ;0000116;0000000;0000000;0000000;000000; 000045; 000000; 0000071; 0000000;0000000;0000000;0000000; 0000000
01;007945;PC PET2,5CX6   ;cx  ;0000240;0000000;0000000;0000000;000000; 000015; 000000; 0000225; 0000000;0000000;0000000;0000000; 0000000
01;007947;GCA PET2,5CX6  ;cx  ;0000137;0000000;0000000;0000000;000000; 000054; 000000; 0000083; 0000000;0000000;0000000;0000000; 0000000
01;007977;GT UVA PET500 6;cx  ;0000234;0000000;0000000;0000000;000000; 000010; 000000; 0000224; 0000000;0000000;0000000;0000000; 0000000
01;007980;GTTANG PET500 6;cx  ;0000530;0000000;0000000;0000000;000000; 000009; 000000; 0000521; 0000000;0000000;0000000;0000000; 0000000
01;007981;GT LAR PET500 6;cx  ;0000231;0000000;0000000;0000000;000000; 000020; 000000; 0000211; 0000000;0000000;0000000;0000000; 0000000
01;007982;GT LM PET500 6 ;cx  ;0000373;0000000;0000000;0000000;000000; 000016; 000000; 0000357; 0000000;0000000;0000000;0000000; 0000000
01;007983;GT MO-MA PET500;cx  ;0000068;0000000;0000000;0000000;000000; 000014; 000000; 0000054; 0000000;0000000;0000000;0000000; 0000000
01;008791;H2OH PT500 CX12;cx  ;0000164;0000000;0000000;0000000;000000; 000017; 000000; 0000147; 0000000;0000000;0000000;0000000; 0000000
01;008793;H2OH PET1,5 CX6;cx  ;0000005;0000000;0000000;0000005;000000; 000000; 000000; 0000000; 0000000;0000000;0000000;0000000; 0000000
01;009067;AP LT350SH12NP ;cx  ;0020874;0000000;0000000;0000000;000000; 001968; 000000; 0018905; 0000000;0000000;0000000;0000000; 0000000
01;009068;SK LT350SH12NP ;cx  ;0000446;0000000;0000000;0000000;000000; 000218; 000000; 0000227; 0000000;0000000;0000000;0000000; 0000000
01;009069;BC LT350SH12NP ;cx  ;0001560;0000000;0000000;0000000;000000; 000132; 000000; 0001428; 0000000;0000000;0000000;0000000; 0000000
01;009072;BONOV LT350SH12;cx  ;0000040;0000000;0000000;0000000;000000; 000025; 000000; 0000015; 0000000;0000000;0000000;0000000; 0000000
01;009081;MZBR LT350SH12N;cx  ;0000108;0000000;0000000;0000000;000000; 000011; 000000; 0000097; 0000000;0000000;0000000;0000000; 0000000
01;009083;SK LT473SH12NP ;cx  ;0000289;0000000;0000000;0000000;000000; 000029; 000000; 0000259; 0000000;0000000;0000000;0000000; 0000000
01;009084;GCA LT350SH12NP;cx  ;0000750;0000000;0000000;0000000;000000; 000136; 000000; 0000613; 0000000;0000000;0000000;0000000; 0000000
01;009085;GCAD LT350SH12N;cx  ;0000490;0000858;0000000;0000000;000000; 000050; 000000; 0001297; 0000000;0000000;0000000;0000000; 0000000
01;009087;SLA LT350SH12NP;cx  ;0000084;0000000;0000000;0000000;000000; 000014; 000000; 0000069; 0000000;0000000;0000000;0000000; 0000000
01;009088;SLA DI LT350SH1;cx  ;0000448;0000000;0000000;0000000;000000; 000005; 000000; 0000443; 0000000;0000000;0000000;0000000; 0000000
01;009089;SU LT350SH12NP ;cx  ;0000000;0000286;0000000;0000000;000000; 000000; 000000; 0000286; 0000000;0000000;0000000;0000000; 0000000
01;009091;TA LT350SH12NP ;cx  ;0000448;0000000;0000000;0000000;000000; 000023; 000000; 0000424; 0000000;0000000;0000000;0000000; 0000000
01;009092;TAD LT350SH12NP;cx  ;0000239;0000000;0000000;0000000;000000; 000003; 000000; 0000236; 0000000;0000000;0000000;0000000; 0000000
01;009093;PC TW LT350SH12;cx  ;0000186;0000000;0000000;0000000;000000; 000004; 000000; 0000182; 0000000;0000000;0000000;0000000; 0000000
01;009096;PC LT350SH12NP ;cx  ;0000425;0000000;0000000;0000000;000000; 000035; 000000; 0000390; 0000000;0000000;0000000;0000000; 0000000`;

interface ConfirmarGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  gradeItems: GradeEstoqueItem[];
  modoAjuste: 'sem_ajuste' | 'com_ajuste';
}

export type TipoDivergencia = 'OK' | 'SOBRA' | 'FALTA';

export interface ItemConciliado {
  cod: string;
  cleanCod: string;
  descricao: string;
  un: string;
  saldoInicial020304: number;
  qtdFinalGrade: number;
  diferenca: number; // qtdFinalGrade - saldoInicial020304
  tipoDivergencia: TipoDivergencia;
  status: 'OK' | 'DIVERGENTE';
}

export const ConfirmarGradeModal: React.FC<ConfirmarGradeModalProps> = ({
  isOpen,
  onClose,
  gradeItems,
  modoAjuste,
}) => {
  const [rawText, setRawText] = useState<string>(SAMPLE_020304_DATA);
  const [showInputDrawer, setShowInputDrawer] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'OK' | 'FALTAS' | 'SOBRAS' | 'DIVERGENTES'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapa da Grade da Plataforma para conferência instantânea
  const gradeMap = useMemo(() => {
    const map = new Map<string, GradeEstoqueItem>();
    gradeItems.forEach(item => {
      const clean = String(item.produto).trim().replace(/^0+/, '');
      map.set(clean, item);
      map.set(String(item.produto).trim(), item);
    });
    return map;
  }, [gradeItems]);

  // Itens parseados da 02.03.04
  const parsed020304 = useMemo<Item020304[]>(() => {
    return parse020304Csv(rawText);
  }, [rawText]);

  // Lista total de conciliação SKU a SKU (completude total)
  const conciliationList = useMemo<ItemConciliado[]>(() => {
    const list: ItemConciliado[] = [];
    const seenCleanSkus = new Set<string>();

    // 1. Processa todos os itens da 02.03.04
    parsed020304.forEach(row => {
      seenCleanSkus.add(row.cleanCod);

      const matchedGrade = gradeMap.get(row.cleanCod) || gradeMap.get(row.cod);
      const qtdFinalGrade = matchedGrade ? matchedGrade.gradeFinalSkus : 0;
      const diferenca = qtdFinalGrade - row.inicial;
      
      let tipoDivergencia: TipoDivergencia = 'OK';
      if (diferenca < 0) {
        tipoDivergencia = 'FALTA';
      } else if (diferenca > 0) {
        tipoDivergencia = 'SOBRA';
      }

      list.push({
        cod: row.cod,
        cleanCod: row.cleanCod,
        descricao: matchedGrade?.descricao || row.descricao,
        un: row.un,
        saldoInicial020304: row.inicial,
        qtdFinalGrade,
        diferenca,
        tipoDivergencia,
        status: diferenca === 0 ? 'OK' : 'DIVERGENTE',
      });
    });

    // 2. Garante inclusão de itens que foram lançados na grade mas que não constavam na 02.03.04
    gradeItems.forEach(item => {
      if (item.gradeFinalSkus <= 0) return;
      const clean = String(item.produto).trim().replace(/^0+/, '');

      if (!seenCleanSkus.has(clean)) {
        seenCleanSkus.add(clean);

        list.push({
          cod: item.produto,
          cleanCod: clean,
          descricao: item.descricao,
          un: 'cx',
          saldoInicial020304: 0,
          qtdFinalGrade: item.gradeFinalSkus,
          diferenca: item.gradeFinalSkus,
          tipoDivergencia: 'SOBRA',
          status: 'DIVERGENTE',
        });
      }
    });

    return list;
  }, [parsed020304, gradeMap, gradeItems]);

  // Estatísticas e KPIs analíticos solicitados pelo usuário
  const stats = useMemo(() => {
    // 1. Total de itens lançados na grade (aptos com qtdFinal > 0 na plataforma)
    const itensLancadosGrade = gradeItems.filter(i => i.gradeFinalSkus > 0);
    const totalItensLancadosGrade = itensLancadosGrade.length;
    const totalCaixasGradeLancadas = itensLancadosGrade.reduce((acc, i) => acc + i.gradeFinalSkus, 0);

    // 2. Total de itens da 02.03.04 importada
    const totalItens020304 = parsed020304.length;

    // 3. Lista total de itens conciliados
    const totalItensConciliados = conciliationList.length;

    // 4. Quantos estão OK (qtdFinalGrade === saldoInicial020304)
    const countOk = conciliationList.filter(i => i.tipoDivergencia === 'OK').length;

    // 5. Quantos estão com Sobras (qtdFinalGrade > saldoInicial020304)
    const countSobras = conciliationList.filter(i => i.tipoDivergencia === 'SOBRA').length;

    // 6. Quantos estão com Faltas (qtdFinalGrade < saldoInicial020304)
    const countFaltas = conciliationList.filter(i => i.tipoDivergencia === 'FALTA').length;

    const countDivergentes = countSobras + countFaltas;

    // Volumes de caixas
    const totalSaldoInicial = conciliationList.reduce((acc, i) => acc + i.saldoInicial020304, 0);
    const totalGradeFinal = conciliationList.reduce((acc, i) => acc + i.qtdFinalGrade, 0);
    const totalDiferenca = totalGradeFinal - totalSaldoInicial;

    const totalCaixasFaltas = conciliationList
      .filter(i => i.tipoDivergencia === 'FALTA')
      .reduce((acc, i) => acc + Math.abs(i.diferenca), 0);

    const totalCaixasSobras = conciliationList
      .filter(i => i.tipoDivergencia === 'SOBRA')
      .reduce((acc, i) => acc + i.diferenca, 0);

    const isAllOk = totalItensConciliados > 0 && countDivergentes === 0;

    return {
      totalItensLancadosGrade,
      totalCaixasGradeLancadas,
      totalItens020304,
      totalItensConciliados,
      countOk,
      countSobras,
      countFaltas,
      countDivergentes,
      totalSaldoInicial,
      totalGradeFinal,
      totalDiferenca,
      totalCaixasFaltas,
      totalCaixasSobras,
      isAllOk,
    };
  }, [conciliationList, gradeItems, parsed020304]);

  // Lista filtrada
  const filteredList = useMemo(() => {
    return conciliationList.filter(item => {
      if (filterMode === 'OK' && item.tipoDivergencia !== 'OK') return false;
      if (filterMode === 'FALTAS' && item.tipoDivergencia !== 'FALTA') return false;
      if (filterMode === 'SOBRAS' && item.tipoDivergencia !== 'SOBRA') return false;
      if (filterMode === 'DIVERGENTES' && item.status !== 'DIVERGENTE') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchSku = item.cod.toLowerCase().includes(term) || item.cleanCod.includes(term);
        const matchDesc = item.descricao.toLowerCase().includes(term);
        if (!matchSku && !matchDesc) return false;
      }
      return true;
    });
  }, [conciliationList, filterMode, searchTerm]);

  // Handler de upload de arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setRawText(content);
        setShowInputDrawer(false);
      }
    };
    reader.readAsText(file);
  };

  // Exportar Relatório de Conciliação em Excel com todas as colunas
  const handleExportExcel = () => {
    const exportData = conciliationList.map(item => ({
      'Código SKU': item.cod,
      'Descrição': item.descricao,
      'Unidade': item.un,
      'Qtd Final Grade (Plataforma)': item.qtdFinalGrade,
      'Saldo Inicial 02.03.04 (Caixas)': item.saldoInicial020304,
      'Diferença (Grade - Inicial)': item.diferenca,
      'Situação': item.tipoDivergencia === 'OK' ? 'OK (Equilibrado)' : item.tipoDivergencia === 'FALTA' ? 'FALTA NA GRADE' : 'SOBRA NA GRADE',
      'Status': item.status === 'OK' ? 'CONCILIADO (OK)' : 'DIVERGENTE',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conciliacao_020304');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Relatorio_Conciliacao_Grade_vs_020304_${dateStr}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Conciliação & Auditoria: Grade vs. 02.03.04
                </h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                  modoAjuste === 'com_ajuste' 
                    ? 'bg-teal-100 text-teal-800 border border-teal-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {modoAjuste === 'com_ajuste' ? 'Grade Com Ajuste Ativa' : 'Grade Sem Ajuste'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação analítica entre a <strong>Quantidade Final da Grade</strong> e o <strong>Saldo Inicial da 02.03.04</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              title="Exportar dados para Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar / Upload Options */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".txt,.csv,.prn,.xlsx" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Importar Arquivo 02.03.04</span>
            </button>

            <button
              onClick={() => setShowInputDrawer(prev => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
              <span>{showInputDrawer ? 'Ocultar Texto' : 'Colar / Ver Texto'}</span>
            </button>

            <button
              onClick={() => {
                setRawText(SAMPLE_020304_DATA);
                setShowInputDrawer(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              title="Restaura os dados de exemplo fornecidos"
            >
              <RefreshCw className="w-3 h-3 text-slate-500" />
              <span>Restaurar Exemplo</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span>Base 02.03.04 carregada: </span>
            <strong className="text-slate-800 font-mono">{parsed020304.length} linhas</strong>
          </div>
        </div>

        {/* Collapsible Text Area for Direct Paste */}
        {showInputDrawer && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Cole o conteúdo do arquivo 02.03.04 abaixo (separado por ponto e vírgula):</span>
              <button 
                onClick={() => setRawText('')}
                className="text-rose-600 hover:underline text-[11px]"
              >
                Limpar Campo
              </button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              placeholder="Grade;Cod;Descricao;UN;Inicial;..."
              className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        )}

        {/* Painel Executivo de Relatório de Conciliação */}
        <div className="px-6 pt-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-linear-to-r from-slate-50 via-teal-50/30 to-slate-50 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-teal-700 text-white font-black text-[10px] uppercase tracking-wider">
                    Relatório da Conciliação
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Grade Final da Plataforma vs. Saldo Inicial 02.03.04
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Foram lançados na grade <strong>{stats.totalItensLancadosGrade} itens</strong> ({stats.totalCaixasGradeLancadas.toLocaleString('pt-BR')} cx). O arquivo 02.03.04 possui <strong>{stats.totalItens020304} itens</strong> ({stats.totalSaldoInicial.toLocaleString('pt-BR')} cx).
                </p>
              </div>

              {/* Status Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{stats.countOk} Itens OK</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-1.5 font-bold">
                  <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{stats.countFaltas} Faltas</span>
                  <span className="text-[10px] font-mono text-rose-600">(-{stats.totalCaixasFaltas.toLocaleString('pt-BR')} cx)</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-300 text-blue-800 text-xs flex items-center gap-1.5 font-bold">
                  <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{stats.countSobras} Sobras</span>
                  <span className="text-[10px] font-mono text-blue-600">(+{stats.totalCaixasSobras.toLocaleString('pt-BR')} cx)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5 KPI Cards Essenciais */}
        <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          
          {/* Card 1: Itens Lançados na Grade */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lançados na Grade</span>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{stats.totalItensLancadosGrade}</span>
              <span className="text-xs text-slate-400 font-normal">itens</span>
            </div>
            <span className="text-[10px] text-slate-500 truncate block">
              {stats.totalCaixasGradeLancadas.toLocaleString('pt-BR')} cx na plataforma
            </span>
          </div>

          {/* Card 2: Total Itens Conciliados / 02.03.04 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Itens 02.03.04</span>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{stats.totalItens020304}</span>
              <span className="text-xs text-slate-400 font-normal">itens</span>
            </div>
            <span className="text-[10px] text-slate-500 truncate block">
              {stats.totalSaldoInicial.toLocaleString('pt-BR')} cx inicial
            </span>
          </div>

          {/* Card 3: Itens OK */}
          <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Conciliados (OK)</span>
            <div className="text-base font-bold text-emerald-700 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{stats.countOk}</span>
              <span className="text-xs text-emerald-600 font-normal">itens</span>
            </div>
            <span className="text-[10px] text-emerald-700 truncate block">
              Grade = Saldo Inicial
            </span>
          </div>

          {/* Card 4: Itens com Faltas */}
          <div className={`border rounded-xl p-3 ${
            stats.countFaltas > 0 ? 'bg-rose-50/80 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Com Faltas</span>
            <div className={`text-base font-bold font-mono mt-0.5 flex items-baseline gap-1 ${stats.countFaltas > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
              <span>{stats.countFaltas}</span>
              <span className="text-xs font-normal">itens</span>
            </div>
            <span className="text-[10px] text-rose-700 truncate block">
              {stats.countFaltas > 0 ? `-${stats.totalCaixasFaltas.toLocaleString('pt-BR')} cx falta` : 'Sem faltas'}
            </span>
          </div>

          {/* Card 5: Itens com Sobras */}
          <div className={`border rounded-xl p-3 ${
            stats.countSobras > 0 ? 'bg-blue-50/80 border-blue-300 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Com Sobras</span>
            <div className={`text-base font-bold font-mono mt-0.5 flex items-baseline gap-1 ${stats.countSobras > 0 ? 'text-blue-700' : 'text-slate-700'}`}>
              <span>{stats.countSobras}</span>
              <span className="text-xs font-normal">itens</span>
            </div>
            <span className="text-[10px] text-blue-700 truncate block">
              {stats.countSobras > 0 ? `+${stats.totalCaixasSobras.toLocaleString('pt-BR')} cx sobra` : 'Sem sobras'}
            </span>
          </div>

        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-2 border-y border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterMode === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Todos ({stats.totalItensConciliados})
            </button>

            <button
              onClick={() => setFilterMode('OK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filterMode === 'OK'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              <span>OK</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                {stats.countOk}
              </span>
            </button>

            <button
              onClick={() => setFilterMode('FALTAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filterMode === 'FALTAS'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              }`}
            >
              <span>Faltas</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-900 font-bold">
                {stats.countFaltas}
              </span>
            </button>

            <button
              onClick={() => setFilterMode('SOBRAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filterMode === 'SOBRAS'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              <span>Sobras</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200 text-blue-900 font-bold">
                {stats.countSobras}
              </span>
            </button>

            <button
              onClick={() => setFilterMode('DIVERGENTES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filterMode === 'DIVERGENTES'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span>Divergentes</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-bold">
                {stats.countDivergentes}
              </span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar SKU ou Descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Conciliation Table - Lista total de itens */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Descrição Produto</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">UN</th>
                  <th className="py-2.5 px-3 text-right bg-teal-50 text-teal-900 font-black whitespace-nowrap">
                    Qtd Final Grade (Plataforma)
                  </th>
                  <th className="py-2.5 px-3 text-right bg-slate-200/60 font-black whitespace-nowrap">
                    Saldo Inicial (02.03.04)
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Diferença
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">
                    Situação / Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      Nenhum item encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item, idx) => {
                    const isOk = item.tipoDivergencia === 'OK';
                    const isFalta = item.tipoDivergencia === 'FALTA';
                    const isSobra = item.tipoDivergencia === 'SOBRA';

                    return (
                      <tr 
                        key={`${item.cod}-${idx}`} 
                        className={`hover:bg-slate-50 transition ${
                          isFalta ? 'bg-rose-50/25' : isSobra ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {item.cod}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-800 truncate max-w-xs" title={item.descricao}>
                          {item.descricao}
                        </td>
                        <td className="py-2 px-2 text-center font-sans text-slate-500 uppercase text-[11px] whitespace-nowrap">
                          {item.un}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-teal-900 bg-teal-50/40 whitespace-nowrap">
                          {item.qtdFinalGrade.toLocaleString('pt-BR')} cx
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800 bg-slate-100/40 whitespace-nowrap">
                          {item.saldoInicial020304.toLocaleString('pt-BR')} cx
                        </td>
                        <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                          isOk
                            ? 'text-slate-400' 
                            : isSobra 
                              ? 'text-blue-700' 
                              : 'text-rose-700'
                        }`}>
                          {item.diferenca === 0 
                            ? '0' 
                            : `${item.diferenca > 0 ? '+' : ''}${item.diferenca.toLocaleString('pt-BR')} cx`}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {isOk && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              OK
                            </span>
                          )}
                          {isFalta && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <TrendingDown className="w-3 h-3 mr-1 text-rose-600" />
                              Falta ({item.diferenca.toLocaleString('pt-BR')} cx)
                            </span>
                          )}
                          {isSobra && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              <TrendingUp className="w-3 h-3 mr-1 text-blue-600" />
                              Sobra (+{item.diferenca.toLocaleString('pt-BR')} cx)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {stats.isAllOk ? (
              <span className="text-emerald-700 font-semibold flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                Grade conferida com 100% de sucesso contra a 02.03.04.
              </span>
            ) : (
              <span className="text-slate-700 font-medium">
                Auditoria concluída: <strong>{stats.countOk} OK</strong>, <strong>{stats.countFaltas} Faltas</strong> e <strong>{stats.countSobras} Sobras</strong> identificadas.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition shadow-xs cursor-pointer"
            >
              Fechar Conciliação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
