import { FrozenReconciliation, StockPositionItem, ItemConciliacaoAjustada } from '../types';

export interface SkuDailyDifference {
  sku: string;
  descricao: string;
  fatorHl: number;
  fatorSku: number;
  valorUnitario: number;
  valorCaixa: number;
  grupo: string;
  fechamento: number; // Saldo de fechamento do mês
  dias: Record<number, number>; // dia (1..31) -> quantidade em caixas/SKUs
}

// Matriz inicial de diferenças diárias estratificadas por dia do mês (Setembro/2026)
// Extraída fielmente da planilha operacional Ambev (DIF MENSAL e DIF DIÁRIA)
export const INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026: SkuDailyDifference[] = [
  {
    sku: '19227',
    descricao: 'SKOL PURO MALTE LT 473ML SH C/12 NPAL',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 3.15,
    valorCaixa: 37.84,
    grupo: 'CERVEJA',
    fechamento: 74,
    dias: { 1: 100, 2: 100, 4: 63, 10: 63, 11: 68, 12: 67, 14: 67, 16: 74 }
  },
  {
    sku: '3093',
    descricao: 'YPE AMACIANTE TRADICIONAL ACONCHEGO FRASCO PLASTI',
    fatorHl: 0.12,
    fatorSku: 12,
    valorUnitario: 2.54,
    valorCaixa: 30.48,
    grupo: 'MARKETPLACE',
    fechamento: -1,
    dias: { 1: 27, 2: 27, 4: 25, 10: 25, 11: 25, 12: 26, 14: 26, 16: -1 }
  },
  {
    sku: '32526',
    descricao: 'CERVEGELA PLASTICA SPATEN 1 UN P/ GFA 600ML CX3',
    fatorHl: 0.00,
    fatorSku: 3,
    valorUnitario: 8.50,
    valorCaixa: 25.50,
    grupo: 'MARKETPLACE',
    fechamento: 45,
    dias: { 1: 16, 2: 16, 4: 17, 10: 19, 11: 21, 12: 23, 14: 24, 16: 45 }
  },
  {
    sku: '34475',
    descricao: 'BOHEMIA NOVA EMBALAGEM LATA 350ML SH C/12 NPAL',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 2.77,
    valorCaixa: 33.26,
    grupo: 'CERVEJA',
    fechamento: 10,
    dias: { 1: 54, 2: 54, 4: -32, 10: 19, 11: 22, 12: 23, 14: 23, 16: 10 }
  },
  {
    sku: '3085',
    descricao: 'ELEVE AGUA MIN C GAS GFA PET 510ML FD C/12',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 1.45,
    valorCaixa: 17.40,
    grupo: 'NAB',
    fechamento: 18,
    dias: { 1: 26, 2: 26, 4: 13, 10: 18, 11: 19, 12: 22, 14: 22, 16: 18 }
  },
  {
    sku: '34830',
    descricao: 'SPATEN N LN 355ML SIXPACK SH C/4',
    fatorHl: 0.09,
    fatorSku: 24,
    valorUnitario: 3.85,
    valorCaixa: 92.40,
    grupo: 'CERVEJA',
    fechamento: 0,
    dias: { 1: 19, 2: 19, 4: 20, 10: 20, 11: 20, 12: 20, 14: 20, 16: 0 }
  },
  {
    sku: '23672',
    descricao: 'RED BULL BR LATA 250ML SIX PACK NPAL',
    fatorHl: 0.02,
    fatorSku: 6,
    valorUnitario: 6.50,
    valorCaixa: 39.00,
    grupo: 'MARKETPLACE',
    fechamento: -536,
    dias: { 1: 9, 2: 9, 4: 9, 10: 9, 11: 11, 12: 17, 14: 17, 16: -536 }
  },
  {
    sku: '25151',
    descricao: 'FUSION MELANCIA LT 473ML SH C/12 NPAL',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 4.10,
    valorCaixa: 49.20,
    grupo: 'NAB',
    fechamento: 4,
    dias: { 1: 42, 2: 42, 4: 15, 10: 15, 11: 15, 12: 15, 14: 16, 16: 4 }
  },
  {
    sku: '13061',
    descricao: 'SODA LIMONADA ANTARCTICA PET 1L CAIXA C/12',
    fatorHl: 0.12,
    fatorSku: 12,
    valorUnitario: 2.65,
    valorCaixa: 31.82,
    grupo: 'NAB',
    fechamento: 33,
    dias: { 1: 29, 2: 29, 4: 7, 10: 9, 11: 11, 12: 10, 14: 14, 16: 33 }
  },
  {
    sku: '13201',
    descricao: 'PATAGONIA AMB LAG NACIONAL LT SLEEK 350ML C 8 CX CAF',
    fatorHl: 0.03,
    fatorSku: 8,
    valorUnitario: 3.99,
    valorCaixa: 31.95,
    grupo: 'CERVEJA',
    fechamento: 3,
    dias: { 1: 35, 2: 35, 4: 0, 10: 11, 11: 12, 12: 14, 14: 13, 16: 3 }
  },
  {
    sku: '32528',
    descricao: 'JOHNNIE WALKER GOLD RES ICONS ED LIM GFA VD 750 ML',
    fatorHl: 0.01,
    fatorSku: 6,
    valorUnitario: 185.00,
    valorCaixa: 1110.00,
    grupo: 'MARKETPLACE',
    fechamento: 4,
    dias: { 1: 12, 2: 12, 4: 13, 10: 12, 11: 12, 12: 12, 14: 12, 16: 4 }
  },
  {
    sku: '1743',
    descricao: 'ANTARCTICA PILSEN GFA VD 1L COM TTC',
    fatorHl: 0.12,
    fatorSku: 12,
    valorUnitario: 3.40,
    valorCaixa: 40.76,
    grupo: 'CERVEJA',
    fechamento: 11,
    dias: { 1: 14, 2: 14, 4: 8, 10: 8, 11: 8, 12: 11, 14: 11, 16: 11 }
  },
  {
    sku: '34454',
    descricao: 'DREHER GARRAFA VIDRO 900ML',
    fatorHl: 0.01,
    fatorSku: 12,
    valorUnitario: 14.20,
    valorCaixa: 170.40,
    grupo: 'MARKETPLACE',
    fechamento: 0,
    dias: { 1: 4, 2: 4, 4: -6, 10: -1, 11: 0, 12: 11, 14: 11, 16: 0 }
  },
  {
    sku: '2538',
    descricao: 'ANTARCTICA PILSEN 600ML',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 4.02,
    valorCaixa: 48.22,
    grupo: 'CERVEJA',
    fechamento: -2,
    dias: { 1: 112, 2: 112, 4: -6, 10: -4, 11: -6, 12: 8, 14: 10, 16: -2 }
  },
  {
    sku: '27613',
    descricao: 'ORIGINAL LATA 350ML SHRINK C/12 MULTIPACK',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 4.10,
    valorCaixa: 49.20,
    grupo: 'CERVEJA',
    fechamento: 8,
    dias: { 1: 9, 2: 9, 4: 9, 10: 9, 11: 9, 12: 9, 14: 9, 16: 8 }
  },
  {
    sku: '37583',
    descricao: 'INDAIA AGUA MINERAL S/GAS GFA PET 500ML PACK C/12',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 1.15,
    valorCaixa: 13.80,
    grupo: 'MARKETPLACE',
    fechamento: 0,
    dias: { 1: 8, 2: 8, 4: 8, 10: 8, 11: 9, 12: 8, 14: 9, 16: 0 }
  },
  {
    sku: '24488',
    descricao: 'GUARANA CHP ANTARCTICA PET 1L PACK C/2 MULTIPACK',
    fatorHl: 0.02,
    fatorSku: 6,
    valorUnitario: 2.85,
    valorCaixa: 17.10,
    grupo: 'NAB',
    fechamento: 3,
    dias: { 1: 10, 2: 10, 4: -31, 10: 9, 11: -18, 12: 9, 14: 9, 16: 3 }
  },
  {
    sku: '35134',
    descricao: 'TRIDENT XFRESH 5S PRETO CEREJA ENVELOPE 8G CX C/21',
    fatorHl: 0.00,
    fatorSku: 21,
    valorUnitario: 1.80,
    valorCaixa: 37.80,
    grupo: 'MARKETPLACE',
    fechamento: 2,
    dias: { 1: 9, 2: 9, 4: 8, 10: 8, 11: 8, 12: 0, 14: 8, 16: 2 }
  },
  {
    sku: '24256',
    descricao: 'FUSION LT 473ML SH C/12 NPAL',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 4.10,
    valorCaixa: 49.20,
    grupo: 'NAB',
    fechamento: 3,
    dias: { 1: 4, 2: 4, 4: 4, 10: 4, 11: 4, 12: 7, 14: 7, 16: 3 }
  },
  {
    sku: '8791',
    descricao: 'H2OH LIMAO C/GAS PET 500ML CAIXA C/12',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 2.51,
    valorCaixa: 30.08,
    grupo: 'NAB',
    fechamento: -1,
    dias: { 1: 17, 2: 17, 4: 5, 10: 6, 11: 5, 12: 6, 14: 6, 16: -1 }
  },
  {
    sku: '9084',
    descricao: 'GUARANA CHP ANTARCTICA LATA 350ML SH C/12 NPAL',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 1.84,
    valorCaixa: 22.12,
    grupo: 'NAB',
    fechamento: 22,
    dias: { 1: 47, 2: 47, 4: 21, 10: 27, 11: 1, 12: 6, 14: 6, 16: 22 }
  },
  {
    sku: '34318',
    descricao: 'GUARANA CHP ANTARCTICA PET 200ML SH C/12',
    fatorHl: 0.02,
    fatorSku: 12,
    valorUnitario: 1.05,
    valorCaixa: 12.60,
    grupo: 'NAB',
    fechamento: 46,
    dias: { 1: 8, 2: 8, 4: 6, 10: 6, 11: 7, 12: 7, 14: 6, 16: 46 }
  },
  {
    sku: '13203',
    descricao: 'CORONA CERO SUNBREW N LONG NECK 330 ML SP BASKET C',
    fatorHl: 0.08,
    fatorSku: 24,
    valorUnitario: 4.80,
    valorCaixa: 115.20,
    grupo: 'CERVEJA',
    fechamento: 0,
    dias: { 1: 19, 2: 19, 4: 4, 10: 4, 11: 4, 12: 5, 14: 6, 16: 0 }
  },
  {
    sku: '23671',
    descricao: 'GARRAFEIRA PL PRETO BEES 1 UN P/24 GFA 600ML',
    fatorHl: 0.02,
    fatorSku: 1,
    valorUnitario: 15.00,
    valorCaixa: 15.00,
    grupo: 'MARKETPLACE',
    fechamento: -176,
    dias: { 1: 6, 2: 6, 4: 6, 10: 6, 11: 6, 12: 6, 14: 6, 16: -176 }
  },
  {
    sku: '35617',
    descricao: 'RED BULL BR LATA 473ML CX C 12',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 9.80,
    valorCaixa: 117.60,
    grupo: 'MARKETPLACE',
    fechamento: 0,
    dias: { 1: 5, 2: 5, 4: 3, 10: 3, 11: 3, 12: 5, 14: 5, 16: 0 }
  },
  {
    sku: '8313',
    descricao: 'QUINTA DO MORGADO VINHO TINTO SUAVE GFA VD 750 ML',
    fatorHl: 0.01,
    fatorSku: 6,
    valorUnitario: 14.50,
    valorCaixa: 87.00,
    grupo: 'MARKETPLACE',
    fechamento: 0,
    dias: { 1: 4, 2: 4, 4: 4, 10: 4, 11: 4, 12: 4, 14: 4, 16: 0 }
  },
  {
    sku: '33820',
    descricao: 'BRAHMA CHOPP LT 350ML SH C/12 NP MULTIPK',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 2.91,
    valorCaixa: 34.90,
    grupo: 'CERVEJA',
    fechamento: 3,
    dias: { 1: -18, 2: -18, 4: -51, 10: -51, 11: 6, 12: 5, 14: 4, 16: 3 }
  },
  {
    sku: '9083',
    descricao: 'SKOL LT 473ML SH C/12 NPAL',
    fatorHl: 0.06,
    fatorSku: 12,
    valorUnitario: 3.15,
    valorCaixa: 37.84,
    grupo: 'CERVEJA',
    fechamento: -2,
    dias: { 1: 61, 2: 61, 4: 43, 10: 44, 11: -1, 12: 4, 14: 4, 16: -2 }
  },
  {
    sku: '3320',
    descricao: 'GUARANA CHP ANTARCTICA PET 3,3 L SH C/04',
    fatorHl: 0.13,
    fatorSku: 4,
    valorUnitario: 6.89,
    valorCaixa: 27.55,
    grupo: 'NAB',
    fechamento: 0,
    dias: { 1: 1, 2: 1, 4: -3, 10: 0, 11: -1, 12: 2, 14: 4, 16: 0 }
  },
  {
    sku: '18807',
    descricao: 'PATAGONIA AMB LAG NACIONAL LN 355ML CX C/12',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 4.50,
    valorCaixa: 54.00,
    grupo: 'CERVEJA',
    fechamento: 1,
    dias: { 1: 8, 2: 8, 4: 5, 10: 3, 11: 3, 12: 4, 14: 4, 16: 1 }
  },
  {
    sku: '29207',
    descricao: 'ANTARCTICA SUBZERO 600ML',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 5.00,
    valorCaixa: 60.00,
    grupo: 'CERVEJA',
    fechamento: 0,
    dias: { 1: 4, 2: 4, 4: 4, 10: 4, 11: 4, 12: 4, 14: 4, 16: 0 }
  },
  {
    sku: '1388',
    descricao: 'SKOL GFA VD 1L 2,99',
    fatorHl: 0.12,
    fatorSku: 12,
    valorUnitario: 4.29,
    valorCaixa: 51.44,
    grupo: 'CERVEJA',
    fechamento: 3,
    dias: { 1: 8, 2: 8, 4: 1, 10: 1, 11: 3, 12: 3, 14: 3, 16: 3 }
  },
  {
    sku: '14135',
    descricao: 'ORIGINAL 600ML',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 5.09,
    valorCaixa: 61.02,
    grupo: 'CERVEJA',
    fechamento: 1,
    dias: { 1: 6, 2: 6, 4: 4, 10: -2, 11: 4, 12: 3, 14: 3, 16: 1 }
  },
  {
    sku: '18268',
    descricao: 'WALS TRIPPEL ONE WAY 375ML CX C/12 ARTE',
    fatorHl: 0.05,
    fatorSku: 12,
    valorUnitario: 12.50,
    valorCaixa: 150.00,
    grupo: 'CERVEJA',
    fechamento: 0,
    dias: { 1: 14, 2: 14, 4: 4, 10: 3, 11: 3, 12: 3, 14: 3, 16: 0 }
  },
  {
    sku: '19668',
    descricao: 'RED BULL BR LATA 250ML CX C 24 NPAL',
    fatorHl: 0.06,
    fatorSku: 24,
    valorUnitario: 6.50,
    valorCaixa: 156.00,
    grupo: 'MARKETPLACE',
    fechamento: 4,
    dias: { 1: 43, 2: 43, 4: 24, 10: 24, 11: 0, 12: 3, 14: 3, 16: 4 }
  },
  {
    sku: '20530',
    descricao: 'BECKS N ONE WAY 600ML CX C/12 NPAL',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 6.20,
    valorCaixa: 74.40,
    grupo: 'CERVEJA',
    fechamento: -2,
    dias: { 1: 12, 2: 12, 4: 5, 10: 5, 11: 3, 12: -3, 14: 3, 16: -2 }
  },
  {
    sku: '27177',
    descricao: 'TRELOSO BISCOITO RECHEADO MORANGO PCT 120G CX/36',
    fatorHl: 0.04,
    fatorSku: 36,
    valorUnitario: 1.65,
    valorCaixa: 59.40,
    grupo: 'MARKETPLACE',
    fechamento: -1,
    dias: { 1: 3, 2: 3, 4: 2, 10: 2, 11: 2, 12: 2, 14: 3, 16: -1 }
  },
  // Item exemplo explícito do usuário: SKU 9068 (SKOL LATA 350ML com -3 cx congeladas)
  {
    sku: '9068',
    descricao: 'SKOL LATA 350ML SH C/12 NPAL',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 2.38,
    valorCaixa: 28.52,
    grupo: 'CERVEJA',
    fechamento: -3,
    dias: { 1: -3, 2: -3, 4: -3, 10: -3, 11: -3, 12: -3, 14: -3, 16: -3 }
  },
  // SKUs da Imagem 1 (DIF DIARIA)
  {
    sku: '279',
    descricao: 'BRAHMA CHOPP LONG NECK 355ML SIX-PACK CAIXA C/4',
    fatorHl: 0.09,
    fatorSku: 24,
    valorUnitario: 3.26,
    valorCaixa: 78.24,
    grupo: 'CERVEJA',
    fechamento: 0,
    dias: { 16: 0 }
  },
  {
    sku: '347',
    descricao: 'SUKITA PET 1L CAIXA C/12',
    fatorHl: 0.12,
    fatorSku: 12,
    valorUnitario: 2.54,
    valorCaixa: 30.48,
    grupo: 'NAB',
    fechamento: -2,
    dias: { 16: -2 }
  },
  {
    sku: '503',
    descricao: 'SUKITA PET 2L CAIXA C/6',
    fatorHl: 0.12,
    fatorSku: 6,
    valorUnitario: 3.24,
    valorCaixa: 19.45,
    grupo: 'NAB',
    fechamento: -2,
    dias: { 16: -2 }
  },
  {
    sku: '504',
    descricao: 'PEPSI COLA PET 2L CAIXA C/6',
    fatorHl: 0.12,
    fatorSku: 6,
    valorUnitario: 4.50,
    valorCaixa: 26.97,
    grupo: 'NAB',
    fechamento: -6,
    dias: { 16: -6 }
  },
  {
    sku: '982',
    descricao: 'SKOL 600ML',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 4.45,
    valorCaixa: 53.35,
    grupo: 'CERVEJA',
    fechamento: 1,
    dias: { 16: 1 }
  },
  {
    sku: '988',
    descricao: 'BRAHMA CHOPP 600ML',
    fatorHl: 0.07,
    fatorSku: 12,
    valorUnitario: 4.35,
    valorCaixa: 52.23,
    grupo: 'CERVEJA',
    fechamento: -25,
    dias: { 16: -25 }
  },
  {
    sku: '1166',
    descricao: 'SUKITA UVA PET 2L CAIXA C/6',
    fatorHl: 0.12,
    fatorSku: 6,
    valorUnitario: 3.35,
    valorCaixa: 20.09,
    grupo: 'NAB',
    fechamento: -1,
    dias: { 16: -1 }
  },
  {
    sku: '1898',
    descricao: 'BRAHMA CHOPP LT 269ML SH C15 NPAL',
    fatorHl: 0.04,
    fatorSku: 15,
    valorUnitario: 2.06,
    valorCaixa: 30.92,
    grupo: 'CERVEJA',
    fechamento: -2,
    dias: { 16: -2 }
  },
  {
    sku: '2008',
    descricao: 'ANTARCTICA SUBZERO LATA 350ML SH C/12 NPAL',
    fatorHl: 0.04,
    fatorSku: 12,
    valorUnitario: 2.25,
    valorCaixa: 27.01,
    grupo: 'CERVEJA',
    fechamento: 1,
    dias: { 16: 1 }
  }
];

// Gera reconciliação congelada sintética do dia anterior (16/09/2026)
// para alimentar o histórico de congeladas e a comparação do dia atual
export const SEED_FROZEN_RECONCILIATIONS: FrozenReconciliation[] = [
  {
    id: 'rec-congelada-2026-09-16-dep-01',
    dataCongelamento: '2026-09-16T18:00:00.000Z',
    nome: 'Conciliação Congelada Diária - 16/09/2026 Depósito 01',
    usuario: 'Supervisor Estoque Ambev',
    deposito: '01',
    totalSkus: INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.length,
    totalFaltasSemAjustesValor: 35136.41,
    totalSobrasSemAjustesValor: 8450.20,
    saldoLiquidoSemAjustesValor: -26686.21,
    totalHlSemAjustes: -42.8,

    totalDesviosValor: 12540.30,
    totalQuebrasValor: 4210.50,
    totalValesValor: 3120.00,
    totalTrocasValor: 2180.80,
    totalFaltasValor: 3029.00,
    totalFaltasComAjustesValor: 22596.11,
    totalSobrasComAjustesValor: 8450.20,
    saldoLiquidoComAjustesValor: -14145.91,
    totalHlComAjustes: -27.5,

    rankingSobrasSemAjustes: [],
    rankingFaltasSemAjustes: [],
    rankingSobrasComAjustes: [],
    rankingFaltasComAjustes: [],

    itensSemAjustes: INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.map(item => {
      const qtdDia16 = item.dias[16] ?? item.fechamento;
      const units = qtdDia16 * item.fatorSku;
      const status: 'OK' | 'SOBRA' | 'FALTA' = qtdDia16 < 0 ? 'FALTA' : qtdDia16 > 0 ? 'SOBRA' : 'OK';
      const impacto = qtdDia16 * item.valorCaixa;
      return {
        id: `01-${item.sku}`,
        armazem: '1',
        deposito: '01' as const,
        produto: item.sku,
        descricao: item.descricao,
        unidade: 'cx',
        saldoAnteriorRaw: '0/00',
        entradasRaw: '0/00',
        saidasRaw: '0/00',
        saldoAtualRaw: '0/00',
        transitoRaw: '0/00',
        disponivelRaw: `${Math.abs(qtdDia16)}/00`,
        inventarioRaw: '0/00',
        disponivelSkus: Math.abs(qtdDia16),
        disponivelLooseUnits: 0,
        disponivelTotalUnits: Math.abs(units),
        inventarioSkus: 0,
        inventarioLooseUnits: 0,
        inventarioTotalUnits: 0,
        diferencaTotalUnits: units,
        diferencaSkus: qtdDia16,
        diferencaRaw: `${qtdDia16}/00`,
        status,
        valorUnitario: item.valorUnitario,
        valorCaixa: item.valorCaixa,
        fatorSku: item.fatorSku,
        fatorHl: item.fatorHl,
        impactoFinanceiro: impacto,
        prejuizoFinanceiro: status === 'FALTA' ? Math.abs(impacto) : 0,
        sobraFinanceira: status === 'SOBRA' ? impacto : 0,
        impactoHl: qtdDia16 * item.fatorHl,
        custoMedio: item.valorUnitario,
        ultReposicao: item.valorUnitario,
        grupo: item.grupo,
        recontado: false
      } as StockPositionItem;
    }),

    itensComAjustes: INITIAL_MONTHLY_DIFFERENCES_SETEMBRO_2026.map(item => {
      const qtdDia16 = item.dias[16] ?? item.fechamento;
      const units = qtdDia16 * item.fatorSku;
      const statusAjustado = qtdDia16 < 0 ? 'FALTA_RESIDUAL' as const : qtdDia16 > 0 ? 'SOBRA_RESIDUAL' as const : 'CONCILIADO' as const;
      return {
        deposito: '01' as const,
        produto: item.sku,
        descricao: item.descricao,
        grupo: item.grupo,
        fatorSku: item.fatorSku,
        fatorHl: item.fatorHl,
        valorUnitario: item.valorUnitario,
        valorCaixa: item.valorCaixa,
        fiscalRaw: `${Math.abs(qtdDia16)}/00`,
        fiscalSkus: Math.abs(qtdDia16),
        fiscalUnits: 0,
        fiscalTotalUnits: Math.abs(units),
        valorFiscal: Math.abs(units) * item.valorUnitario,
        desviosRaw: '0/00',
        desviosSkus: 0,
        desviosUnits: 0,
        valorDesvios: 0,
        hlDesvios: 0,
        detalheDesvios: {
          quebrasSkus: 0, quebrasUnits: 0, quebrasValor: 0, quebrasRaw: '0/00',
          valesSkus: 0, valesUnits: 0, valesValor: 0, valesRaw: '0/00',
          trocasSkus: 0, trocasUnits: 0, trocasValor: 0, trocasRaw: '0/00',
          faltasSkus: 0, faltasUnits: 0, faltasValor: 0, faltasRaw: '0/00'
        },
        fisicoRaw: '0/00',
        fisicoSkus: 0,
        fisicoUnits: 0,
        fisicoTotalUnits: 0,
        valorFisico: 0,
        finalRaw: '0/00',
        finalTotalUnits: 0,
        finalSkus: 0,
        valorFinal: 0,
        divergenciaResidualUnits: units,
        divergenciaResidualSkus: qtdDia16,
        divergenciaResidualRaw: `${qtdDia16}/00`,
        statusAjustado,
        impactoFinanceiroResidual: qtdDia16 * item.valorCaixa,
        impactoHlResidual: qtdDia16 * item.fatorHl,
        recontado: false
      } as ItemConciliacaoAjustada;
    })
  }
];
