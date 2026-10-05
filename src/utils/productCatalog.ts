/**
 * Catálogo Oficial de Preços Unitários e Volumes por SKU
 * Derivado da base histórica de lançamentos oficiais de Perdas/Quebras Ambev
 */

export interface SkuUnitMetrics {
  sku: string;
  descricao: string;
  unitPrice: number; // Preço unitário por unidade (R$/un)
  unitHl: number;    // Volume unitário por unidade (HL/un)
}

export const SKU_CATALOG: Record<string, SkuUnitMetrics> = {
  '2349': { sku: '2349', descricao: 'GUARANA CHP ANTARCTICA PET 2L CAIXA C/6', unitPrice: 4.732, unitHl: 0.120 },
  '1743': { sku: '1743', descricao: 'ANTARCTICA PILSEN GFA VD 1L COM TTC', unitPrice: 3.398, unitHl: 0.120 },
  '34608': { sku: '34608', descricao: 'SKOL LATA 350ML SH C/12 NPAL MULTIPACK', unitPrice: 3.250, unitHl: 0.042 },
  '21020': { sku: '21020', descricao: 'BUDWEISER LT SLEEK 350ML CX CART C 12', unitPrice: 2.650, unitHl: 0.042 },
  '37450': { sku: '37450', descricao: 'BUDWEISER LT SLEEK 350ML SH C 12 MULTIPACK', unitPrice: 3.474, unitHl: 0.042 },
  '9067': { sku: '9067', descricao: 'ANTARCTICA PILSEN LATA 350ML SH C/12 NPAL', unitPrice: 2.412, unitHl: 0.042 },
  '29580': { sku: '29580', descricao: 'STELLA ARTOIS PURE GOLD LONG NECK 330ML SP SH C/4', unitPrice: 4.456, unitHl: 0.0792 },
  '24168': { sku: '24168', descricao: 'MICHELOB ULTRA N LONG NECK 330ML SIX-PACK SHRINK C/4', unitPrice: 5.452, unitHl: 0.0792 },
  '27866': { sku: '27866', descricao: 'CORONA CERO SUNBREW N LONG NECK 330 ML SP BASKET CX C4', unitPrice: 4.992, unitHl: 0.0792 },
  '20164': { sku: '20164', descricao: 'SKOL LT 473ML SH C/12 NPAL MULTPACK 12', unitPrice: 3.118, unitHl: 0.0568 },
  '2546': { sku: '2546', descricao: 'ORIGINAL 600ML', unitPrice: 5.085, unitHl: 0.0720 },
  '33857': { sku: '33857', descricao: 'STELLA ARTOIS PURE GOLD 600ML', unitPrice: 9.000, unitHl: 0.0720 },
  '2353': { sku: '2353', descricao: 'GUARANA CHP ANTARCTICA DIET PET 2L CAIXA C/6', unitPrice: 4.680, unitHl: 0.120 },
  '9276': { sku: '9276', descricao: 'PEPSI ZERO PET 2L CAIXA C/6', unitPrice: 4.357, unitHl: 0.120 },
  '32500': { sku: '32500', descricao: 'STELLA ARTOIS PURE GOLD LT SLEEK 350ML C 8 CX CARTAO', unitPrice: 3.790, unitHl: 0.028 },
  '34320': { sku: '34320', descricao: 'GUARANA ANTARCTICA ZERO LATA 350ML SH C/12 NPAL MULTIPACK', unitPrice: 2.990, unitHl: 0.042 },
  '34923': { sku: '34923', descricao: 'DIAS DAVILA AGUA MINERAL C GAS GFA PET 500ML PACK C/12', unitPrice: 1.630, unitHl: 0.060 },
  '19229': { sku: '19229', descricao: 'RED BULL BR LATA 250ML SIX PACK NPAL .', unitPrice: 6.205, unitHl: 0.015 },
  '988': { sku: '988', descricao: 'BRAHMA CHOPP 600ML', unitPrice: 4.352, unitHl: 0.072 },
  '23186': { sku: '23186', descricao: 'SPATEN N 600ML', unitPrice: 5.050, unitHl: 0.072 },
  '27560': { sku: '27560', descricao: 'CASILLERO DEL DIABLO VINH RESERVA MALBEC GFA VD 750 ML', unitPrice: 51.570, unitHl: 0.0075 },
  '26037': { sku: '26037', descricao: 'MONTILLA CARTA CRISTAL GFA VDR 1L', unitPrice: 22.970, unitHl: 0.010 },
  '9069': { sku: '9069', descricao: 'BRAHMA CHOPP LATA 350ML SH C/12 NPAL', unitPrice: 2.380, unitHl: 0.042 },
  '33820': { sku: '33820', descricao: 'BRAHMA CHOPP LATA 350ML SH C/12 NPAL MULTIPACK', unitPrice: 2.910, unitHl: 0.042 },
  '9068': { sku: '9068', descricao: 'SKOL LATA 350ML SH C/12 NPAL', unitPrice: 2.380, unitHl: 0.042 },
  '1388': { sku: '1388', descricao: 'SKOL GFA VD 1L 2,39', unitPrice: 4.290, unitHl: 0.120 },
  '2319': { sku: '2319', descricao: 'GUARANA CHP ANTARCTICA PET 1L', unitPrice: 2.850, unitHl: 0.060 },
  '21632': { sku: '21632', descricao: 'SPATEN LN 355', unitPrice: 3.940, unitHl: 0.0355 },
  '20498': { sku: '20498', descricao: 'BRAHMA DUPLO MALTE LT 350ML SH C/12', unitPrice: 3.050, unitHl: 0.042 },
  '30045': { sku: '30045', descricao: 'RED BULL BR LATA 473ML', unitPrice: 8.020, unitHl: 0.0284 }
};

/**
 * Retorna as métricas unitárias oficiais (preço unitário e volume por unidade) de um SKU
 */
export function getSkuUnitMetrics(sku: string | undefined | null, currentQty?: number, currentVal?: number, currentHl?: number): SkuUnitMetrics {
  const cleanSku = (sku || '').trim().replace(/^0+/, '');
  const catalogEntry = SKU_CATALOG[cleanSku];

  if (catalogEntry) {
    return catalogEntry;
  }

  // Se não estiver no catálogo pré-cadastrado, calcula a partir do item atual
  const qty = Number(currentQty) || 1;
  const val = Number(currentVal) || 0;
  const hl = Number(currentHl) || 0;

  const unitPrice = qty > 0 ? Number((val / qty).toFixed(4)) : val;
  const unitHl = qty > 0 ? Number((hl / qty).toFixed(6)) : hl;

  return {
    sku: cleanSku,
    descricao: 'PRODUTO NÃO CATALOGADO',
    unitPrice,
    unitHl
  };
}

/**
 * Calcula os valores proporcionais exatos dado uma quantidade
 */
export function calculateProportionalValues(sku: string, quantidade: number, customUnitPrice?: number, customUnitHl?: number) {
  const metrics = getSkuUnitMetrics(sku);
  const uPrice = customUnitPrice !== undefined && customUnitPrice > 0 ? customUnitPrice : metrics.unitPrice;
  const uHl = customUnitHl !== undefined && customUnitHl > 0 ? customUnitHl : metrics.unitHl;

  const valorTotal = Number((uPrice * quantidade).toFixed(2));
  const volumeHl = Number((uHl * quantidade).toFixed(4));

  return {
    unitPrice: uPrice,
    unitHl: uHl,
    valorTotal,
    volumeHl
  };
}
