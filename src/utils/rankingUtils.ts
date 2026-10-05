import { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId 
} from '../types';
import { formatSkuUnit } from './parsers';
import { 
  calculateSkuDeviations, 
  isQuebraPendente, 
  isValePendente, 
  isTrocaPendente 
} from './desviosUtils';
import { DashboardRankingItem } from '../components/RecontagemRankingsModal';

export function computeDashboardRankingItems(
  stockPositions: StockPositionItem[],
  quebras: QuebraItem[] = [],
  vales: ValeItem[] = [],
  trocas: TrocaItem[] = [],
  faltasMapeadas: FaltaMapeadaItem[] = [],
  rankingAdjustmentMode: 'sem_ajuste' | 'com_ajuste',
  selectedDeposito: DepositoId | 'ALL',
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>
): DashboardRankingItem[] {
  // Filter stock by deposit
  const filteredStock = selectedDeposito === 'ALL'
    ? stockPositions
    : stockPositions.filter(s => s.deposito === selectedDeposito);

  const pendingQuebras = quebras.filter(q => {
    if (selectedDeposito !== 'ALL' && q.deposito !== selectedDeposito) return false;
    return isQuebraPendente(q, weeklyBillingStatus);
  });
  const filteredVales = (selectedDeposito === 'ALL' ? vales : vales.filter(v => v.deposito === selectedDeposito))
    .filter(v => isValePendente(v, weeklyBillingStatus));
  const filteredTrocas = (selectedDeposito === 'ALL' ? trocas : trocas.filter(t => t.deposito === selectedDeposito))
    .filter(t => isTrocaPendente(t, weeklyBillingStatus));
  const filteredFaltas = selectedDeposito === 'ALL' 
    ? faltasMapeadas 
    : faltasMapeadas.filter(f => !f.deposito || f.deposito === selectedDeposito);

  return filteredStock.map(item => {
    const fator = item.fatorSku || 1;
    const sku = item.produto;

    const dev = calculateSkuDeviations(
      sku,
      item.deposito,
      fator,
      item.valorUnitario,
      item.valorCaixa,
      item.fatorHl,
      pendingQuebras,
      filteredVales,
      filteredTrocas,
      filteredFaltas,
      weeklyBillingStatus
    );

    const totalDesviosSkus = dev.total.skus;
    const totalDesviosUnits = dev.total.units;
    const desviosRaw = dev.total.raw;

    const fisicoUnits = item.inventarioTotalUnits;
    const fisicoRaw = item.inventarioRaw || formatSkuUnit(fisicoUnits, fator);

    const finalUnits = fisicoUnits + totalDesviosUnits;
    const finalRaw = formatSkuUnit(finalUnits, fator);

    const fiscalUnits = item.disponivelTotalUnits;
    const fiscalRaw = item.disponivelRaw || formatSkuUnit(fiscalUnits, fator);

    let diferencaUnits = 0;
    let diferencaRaw = '0/00';
    let prejuizoFinanceiro = 0;
    let sobraFinanceira = 0;
    let impactoHl = 0;

    if (rankingAdjustmentMode === 'com_ajuste') {
      let diff = finalUnits - fiscalUnits;
      if (item.saldoNegativoDesconsiderado || fiscalUnits < 0) {
        diff = 0;
      }
      diferencaUnits = diff;
      diferencaRaw = formatSkuUnit(Math.abs(diff), fator);
      impactoHl = (diff / fator) * item.fatorHl;

      if (diff < 0) {
        prejuizoFinanceiro = Math.abs(diff) * item.valorUnitario;
        sobraFinanceira = 0;
      } else if (diff > 0) {
        prejuizoFinanceiro = 0;
        sobraFinanceira = diff * item.valorUnitario;
      }
    } else {
      diferencaUnits = item.diferencaTotalUnits;
      diferencaRaw = item.diferencaRaw.replace(/^[-+]/, '');
      prejuizoFinanceiro = item.prejuizoFinanceiro;
      sobraFinanceira = item.sobraFinanceira;
      impactoHl = item.impactoHl;
    }

    return {
      id: item.id,
      produto: item.produto,
      descricao: item.descricao,
      fatorSku: fator,
      fatorHl: item.fatorHl,
      valorUnitario: item.valorUnitario,
      deposito: item.deposito,

      fisicoUnits,
      fisicoRaw,

      totalDesviosSkus,
      totalDesviosUnits,
      desviosRaw,
      quebrasSkus: dev.quebras.skus,
      valesSkus: dev.vales.skus,
      trocasSkus: dev.trocas.skus,
      faltasSkus: dev.faltas.skus,

      finalUnits,
      finalRaw,

      fiscalUnits,
      fiscalRaw,

      diferencaUnits,
      diferencaRaw,
      diferencaSkus: Math.floor(Math.abs(diferencaUnits) / fator),
      prejuizoFinanceiro,
      sobraFinanceira,
      impactoHl,
    };
  });
}
