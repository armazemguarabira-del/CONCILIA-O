export interface ProductMaster {
  codigo: string;
  descricao: string;
  fatorSku: number; // units per box/case
  fatorPallet: number;
  lastro?: number;
  pallet?: number;
  valor: number; // case/box price
  valorUnit: number; // unit price
  valorCaixa?: number; // alias for case/box price
  valorUnitario?: number; // alias for unit price
  fatorHl: number; // hectoliters per SKU
  grupo: string; // CERVEJA, NAB, MARKETPLACE, MATCH, etc.
  embalagem: string;
  idade: number; // shelf life in days
}

export type DepositoId = '01' | '02' | '03' | '05' | '06' | '31';

export interface DepositoInfo {
  id: DepositoId;
  codigoNum: number;
  nome: string;
  descricao: string;
  cor: string;
}

export interface StockPositionItem {
  id: string; // unique key e.g. "01-347"
  armazem: string;
  deposito: DepositoId;
  produto: string;
  descricao: string;
  unidade: string; // cx, Dz, un
  saldoAnteriorRaw: string;
  entradasRaw: string;
  saidasRaw: string;
  saldoAtualRaw: string;
  transitoRaw: string;
  disponivelRaw: string; // e.g. "212/06"
  inventarioRaw: string; // e.g. "0/00" or from 01.11 recount
  
  // Normalized quantities
  disponivelSkus: number;
  disponivelLooseUnits: number;
  disponivelTotalUnits: number;
  
  inventarioSkus: number;
  inventarioLooseUnits: number;
  inventarioTotalUnits: number;
  
  // Divergence = Inventario - Disponivel
  diferencaTotalUnits: number;
  diferencaSkus: number;
  diferencaRaw: string;
  status: 'OK' | 'SOBRA' | 'FALTA';
  
  // Financial & HL metrics
  valorUnitario: number;
  valorCaixa: number;
  fatorSku: number;
  fatorHl: number;
  impactoFinanceiro: number; // Negative for loss/falta, positive for sobra
  prejuizoFinanceiro: number; // Positive magnitude of loss (0 if sobra or OK)
  sobraFinanceira: number; // Positive magnitude of surplus (0 if falta or OK)
  impactoHl: number; // Hectoliters divergence
  
  custoMedio: number;
  ultReposicao: number;
  grupo: string;
  recontado: boolean; // whether updated by 02.11.01 recount
  saldoNegativoDesconsiderado?: boolean; // if saldo disponivel is negative, differences are zeroed out
  dataAtualizacao?: string;
}

export interface RecountItem {
  id: string;
  deposito: DepositoId;
  area: string;
  produto: string;
  descricao: string;
  embalagem: string;
  unidadeVenda: string;
  qtdPallet: number;
  status: string;
  qtdadeSkus: number;
  avulsa: number;
  totalUnits: number;
  palletsCount: number;
  lastroCount: number;
}

export interface QuebraItem {
  id: string;
  data: string;
  sku: string;
  descricao: string;
  quantidade: number; // units or SKUs according to standard
  area: string;
  turno: string;
  codQuebra: string;
  motivo: string;
  colaborador: string;
  funcao?: string;
  mes?: string;
  origem?: string;
  valorTotal: number;
  volumeHl: number;
  deposito: DepositoId;
  faturado?: boolean;
  dataFaturamento?: string;
  semanaRef?: string;
}

export interface AreaLossSummary {
  setor: string;
  valor: number;
  percentual: number;
  hectolitro: number;
  quantidadeItens?: number;
}

export interface WeeklyLossSummary {
  id: string; // e.g. "13/07 - 17/07"
  label: string;
  startDate: string;
  endDate: string;
  somaValor: number;
  hectolitro: number;
  statusTrend: 'UP' | 'DOWN' | 'EQUAL';
  statusFaturamento: 'PENDENTE' | 'OK';
  valorDiff: number;
  percentDiff: number;
  quantidadeItens: number;
  quantidadeUnidades: number;
}

export interface TrocaItem {
  id: string;
  data: string;
  codigos: string; // e.g. "9083, 9068"
  sku?: string;
  descricao: string;
  quantidade: number; // units
  valorTotal: number;
  motorista: string;
  ajudantes: string;
  cliente: string;
  notaFiscal: string;
  mapa: string;
  setorRota: string;
  unidadeMedida: string;
  volumeHl: number;
  motivoDeclarado: string;
  motivo?: string;
  tipoProcesso: string; // Troca vs Reposição (Falta)
  statusPromax: string;
  observacoes: string;
  deposito: DepositoId;
  faturado?: boolean;
  dataFaturamento?: string;
  semanaRef?: string;
}

export interface ValeItem {
  id: string;
  data: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  motorista: string;
  cpfMotorista?: string;
  equipeCompleta: string;
  cliente: string;
  notaFiscal: string;
  mapa: string;
  rotaSetor: string;
  volumeHl: number;
  statusVale: string; // Assinado, Emitido, Baixado, etc.
  totalIntegrantes: number;
  valorRateado: number;
  idValeSstr: string;
  observacoes?: string;
  deposito: DepositoId;
  faturado?: boolean;
  dataFaturamento?: string;
  semanaRef?: string;
}

export interface FaltaMapeadaItem {
  id: string;
  codigo: string; // SKU code
  produto: string; // Alias for codigo
  descricao: string;
  quantidade: number; // Boxes / Units
  quantidadeSkus?: number;
  quantidadeUnidades?: number;
  observacao: string; // Custom observation/justification
  motivo?: string;
  data?: string;
  deposito?: DepositoId;
  valorTotal?: number;
  volumeHl?: number;
  responsavel?: string;
  origem?: 'MANUAL' | '02.11.01' | 'PLANILHA' | 'TRANSFERENCIA';
  status?: string;
  faturado?: boolean;
  dataFaturamento?: string;
  semanaRef?: string;
}

export interface FatoresAmortizacao {
  totalPrejuizoBruto: number; // Faltas físicas da conciliação 02.05.02
  totalQuebrasValor: number;
  totalValesValor: number;
  totalTrocasValor: number;
  totalFaltasValor: number;
  totalAmortizado: number; // Quebras + Vales + Trocas + Faltas
  divergenciaResidualLiquida: number; // Math.max(0, totalPrejuizoBruto - totalAmortizado)
  percentualAmortizado: number;
}

export interface ItemConciliacaoAjustada {
  deposito: DepositoId;
  produto: string;
  descricao: string;
  grupo: string;
  fatorSku: number;
  fatorHl: number;
  valorUnitario: number;
  valorCaixa: number;

  fiscalRaw: string;
  fiscalSkus: number;
  fiscalUnits: number;
  fiscalTotalUnits: number;
  valorFiscal: number;

  desviosRaw: string;
  desviosSkus: number;
  desviosUnits: number;
  valorDesvios: number;
  hlDesvios: number;
  detalheDesvios: {
    quebrasSkus: number;
    quebrasUnits: number;
    quebrasValor: number;
    quebrasRaw: string;

    valesSkus: number;
    valesUnits: number;
    valesValor: number;
    valesRaw: string;

    trocasSkus: number;
    trocasUnits: number;
    trocasValor: number;
    trocasRaw: string;

    faltasSkus: number;
    faltasUnits: number;
    faltasValor: number;
    faltasRaw: string;
  };

  fisicoRaw: string;
  fisicoSkus: number;
  fisicoUnits: number;
  fisicoTotalUnits: number;
  valorFisico: number;

  finalRaw: string;
  finalTotalUnits: number;
  finalSkus: number;
  valorFinal: number;

  divergenciaResidualUnits: number;
  divergenciaResidualSkus: number;
  divergenciaResidualRaw: string;
  statusAjustado: 'CONCILIADO' | 'FALTA_RESIDUAL' | 'SOBRA_RESIDUAL';

  impactoFinanceiroResidual: number;
  impactoHlResidual: number;
  recontado: boolean;
}

export type ImportFileType = '020502' | '021101' | '0111' | 'cadastro' | 'quebras' | 'vales' | 'trocas' | 'faltas';

export type ViewTab = 
  | 'dashboard' 
  | 'conciliacao' 
  | 'grade_estoque'
  | 'dif_diaria'
  | 'dif_mensal'
  | 'quebras' 
  | 'vales' 
  | 'trocas' 
  | 'faltas' 
  | 'produtos' 
  | 'conciliacao_ajustes'
  | 'congeladas'
  | 'inversao'
  | 'login';

export interface GradeEstoqueItem {
  depositoLancamento: number; // Sempre 1
  depositoOrigem: DepositoId;
  produto: string;
  descricao: string;
  grupo: string;
  fatorSku: number;
  disponivelRaw: string;
  disponivelSkus: number; // Caixas fechadas da 02.05.02 (Disponível)
  disponivelLooseUnits: number; // Avulsos da 02.05.02
  difInventarioSkus: number; // Falta da última Dif Mensal congelada com ajuste (em caixas; sobras desconsideradas)
  difCongeladaSkus: number; // Desvios operacionais congelados (Trocas + Faltas + Quebras + Vales em caixas)
  divergenciaAnteriorSkus?: number; // Divergência/falta do último congelamento abatida
  divergenciaAnteriorUnits?: number; // Em unidades
  diferencaDiaSkus?: number; // Diferença do dia abatida na grade com ajuste (em cx)
  diferencaDiaUnits?: number; // Diferença do dia em unidades
  quebrasSkus: number; // Quebras congeladas deduzidas (em cx)
  quebrasUnits: number; // Quebras congeladas em unidades
  trocasSkus: number; // Trocas/reposições em caixas
  trocasUnits: number; // Trocas em unidades
  valesSkus: number; // Vales em caixas
  valesUnits: number; // Vales em unidades
  faltasSkus: number; // Faltas mapeadas em caixas
  faltasUnits: number; // Faltas mapeadas em unidades
  congeladosTotalSkus: number; // Total de congelamentos + divergências anteriores deduzidos em caixas
  congeladosTotalUnits: number; // Total de congelamentos deduzidos em unidades
  baseSkus: number; // Qtd base (sem ajuste = disponivelSkus, com ajuste = saldo líquido em caixas após deduzir todos os congelamentos)
  reservaSkus: number; // Quantidade reservada
  gradeFinalSkus: number; // baseSkus - reservaSkus
  aptoParaGrade: boolean; // gradeFinalSkus > 0
  motivoDescarte?: string;
  valorUnitario: number;
  valorCaixa: number;
  valorTotalGrade: number;
}

export interface InversaoPair {
  id: string;
  grupo: string;
  deposito: DepositoId;
  
  // SOBRA (Entrada)
  sobraSku: string;
  sobraDescricao: string;
  sobraDisponivelSkus: number;
  sobraDisponivelUnits: number;
  sobraValorUnitario: number;
  sobraFatorSku: number;
  sobraFatorHl: number;

  // FALTA (Saída)
  faltaSku: string;
  faltaDescricao: string;
  faltaApuradaSkus: number;
  faltaApuradaUnits: number;
  faltaValorUnitario: number;
  faltaFatorSku: number;
  faltaFatorHl: number;

  // Quantidade de Inversão Selecionada
  quantidadeInversaoSkus: number; // Quantidade de caixas da SOBRA (Entrada)
  quantidadeSaidaSkus?: number; // Quantidade de caixas/packs da FALTA (Saída)
  quantidadeInversaoUnits: number; // Unidades físicas equalizadas
  
  // Proporção de conversão de embalagem (Ex: 1 cx 2319 = 6 packs 19164)
  razaoConversao?: number; // Fator multiplicador de saída por entrada (ex: 6)
  proporcaoLabel?: string; // Descritivo legível da proporção
  isPersonalizadoProporcao?: boolean;

  // Valorações calculadas
  valorEntrada: number;
  valorSaida: number;
  diferencaValor: number;
  volumeHlInvertido: number;

  // Análise de Compatibilidade do Analista de Dados
  compatibilidadeScore?: number; // 0 - 100%
  compatibilidadeNivel?: 'NIVEL_1_EMBALAGEM' | 'NIVEL_2_LINHA' | 'NIVEL_3_MARCA' | 'NIVEL_4_CATEGORIA' | 'MANUAL' | 'INCOMPATIVEL';
  compatibilidadeLabel?: string; // Ex: 'Afinidade Máxima (100%): Multipack x Avulso'

  // Controle de seleção
  selected: boolean;
  justificativa?: string;
  isCustomQuantity?: boolean;
}

export interface SimuladorFiscalConfig {
  metaAbatimentoValor: number; // Ex: 5000 (R$ 5.000,00 de falta a abater)
  deposito: DepositoId | 'ALL';
  apenasMesmoGrupo: boolean;
  estrategia: 'META_PRECISA' | 'MAX_RETORNO' | 'MAIORES_FALTAS';
}

export interface SimuladorFiscalResultado {
  paresSugeridos: InversaoPair[];
  totalAbatidoFalta: number;
  totalValorEntrada: number;
  saldoLiquidoOperacao: number;
  percentualAtingido: number;
  totalCaixasEntrada: number;
  totalCaixasSaida: number;
  totalUnidadesFisicas: number;
}

export interface InversaoStockItem {
  sku: string;
  descricao: string;
  grupo: string;
  deposito: DepositoId;
  fatorSku: number;
  fatorHl: number;
  valorUnitario: number;
  valorCaixa: number;
  saldoSkus: number;
  saldoUnits: number;
  saldoRaw: string;
  valorTotal: number;
  tipo: 'SOBRA' | 'FALTA' | 'OK';

  // Metadados analíticos e de auditoria de compatibilidade
  categoriaFiscal?: string;
  embalagemTipo?: string;
  volumePadrao?: string;
  formato?: string;
  marca?: string;
  alocadoSkus?: number;
  saldoResidualSkus?: number;
  saldoResidualUnits?: number;
  statusAuditoria?: 'TOTALMENTE_EQUALIZADO' | 'PARCIALMENTE_EQUALIZADO' | 'PENDENTE';
  paresAssociadosIds?: string[];
  melhorCandidatoInversao?: {
    sku: string;
    descricao: string;
    score: number;
    motivo: string;
    deposito: DepositoId;
    saldoSkusDisponivel: number;
  };
}

export interface RankingItem {
  posicao: number;
  codigo: string;
  descricao: string;
  grupo: string;
  deposito: DepositoId;
  fatorSku: number;
  quantidadeUnidades: number;
  quantidadeSkus: number;
  quantidadeRaw: string;
  impactoFinanceiro: number;
  impactoHl: number;
  tipo: 'SOBRA' | 'FALTA';
  comAjustes: boolean;
}

export interface FrozenReconciliation {
  id: string;
  dataCongelamento: string;
  nome: string;
  dataReferencia?: string; // YYYY-MM-DD escolhida pelo colaborador
  horaReferencia?: string; // HH:mm
  name?: string;
  date?: string;
  time?: string;
  totalItems?: number;
  totalPrejuizo?: number;
  totalSobras?: number;
  acuraciaInventario?: number;
  usuario: string;
  deposito: DepositoId | 'ALL';
  totalSkus: number;
  
  // Totais sem ajustes
  totalFaltasSemAjustesValor: number;
  totalSobrasSemAjustesValor: number;
  saldoLiquidoSemAjustesValor: number;
  totalHlSemAjustes: number;
  
  // Totais com ajustes
  totalDesviosValor: number;
  totalQuebrasValor: number;
  totalValesValor: number;
  totalTrocasValor: number;
  totalFaltasValor: number;
  totalFaltasComAjustesValor: number;
  totalSobrasComAjustesValor: number;
  saldoLiquidoComAjustesValor: number;
  totalHlComAjustes: number;

  // Rankings de Sobras e Faltas
  rankingSobrasSemAjustes: RankingItem[];
  rankingFaltasSemAjustes: RankingItem[];
  rankingSobrasComAjustes: RankingItem[];
  rankingFaltasComAjustes: RankingItem[];

  // Posições congeladas completas
  itensSemAjustes: StockPositionItem[];
  itensComAjustes: ItemConciliacaoAjustada[];
}

export type UserRole = 'ADMIN' | 'GESTOR_DPO' | 'SUPERVISOR_ESTOQUE' | 'CONFERENTE';

export interface UserAccount {
  id: string;
  nome: string;
  matricula: string; // Matrícula do colaborador (ex: G1002) - principal login de acesso
  usuario: string; // Login / Matrícula (ex: G1002) ou e-mail
  email?: string;
  senha: string;
  perfil: UserRole;
  cargo: string;
  depositoPermitido: DepositoId | 'ALL';
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso?: string;
  avatarCor?: string;
}
