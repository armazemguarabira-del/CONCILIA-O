import { 
  StockPositionItem, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  DepositoId, 
  InversaoPair, 
  InversaoStockItem,
  SimuladorFiscalConfig,
  SimuladorFiscalResultado
} from '../types';
import { calculateSkuDeviations } from './desviosUtils';
import { formatSkuUnit } from './parsers';

export interface ProductClassification {
  marca: string;
  categoriaFiscal: 'CERVEJA' | 'NAB' | 'ISOTÔNICOS' | 'ENERGÉTICOS' | 'ÁGUA' | 'BEATS' | 'MARKETPLACE' | 'OUTROS';
  embalagem: string;
  embalagemTipo: 'LATA' | 'RGB' | 'LONG NECK' | 'PET' | 'BARRIL' | 'MARKETPLACE' | 'OUTROS';
  volume: string;
  formato: 'MULTIPACK' | 'AVULSO' | 'FARDO' | 'BARRIL';
  tierComercial: 'MAINSTREAM' | 'PURO_MALTE' | 'PREMIUM' | 'ZERO' | 'SABOR' | 'GERAL';
  grupoUnificado: string;
}

export interface CompatibilityAnalysis {
  score: number; // 0 a 100
  nivel: 'NIVEL_1_EMBALAGEM' | 'NIVEL_2_LINHA' | 'NIVEL_3_MARCA' | 'NIVEL_4_CATEGORIA' | 'INCOMPATIVEL';
  label: string;
  motivo: string;
  isPermitidoAutomatico: boolean;
}

/**
 * Inteligência de categorização de produtos Ambev.
 * Identifica Marcas, Categorias Fiscais, Embalagens, Volumes e Formatos a partir da descrição e SKU.
 */
export function classifyAmbevProduct(descricao: string, sku: string, grupoOriginal?: string): ProductClassification {
  const upper = (descricao || '').toUpperCase();
  const skuStr = String(sku || '').trim();
  const grpUpper = (grupoOriginal || '').toUpperCase().trim();

  // 1. Identificação da Marca
  let marca = 'OUTROS';
  let tierComercial: ProductClassification['tierComercial'] = 'GERAL';

  if (upper.includes('SKOL BEATS') || upper.includes('BEATS ') || grpUpper === 'MATCH') {
    marca = 'BEATS';
    tierComercial = 'SABOR';
  } else if (upper.includes('SKOL ZERO') || skuStr === '36024' || skuStr === '36028') {
    marca = 'SKOL ZERO';
    tierComercial = 'ZERO';
  } else if (upper.includes('SKOL') || skuStr === '9068' || skuStr === '34608' || skuStr === '9083' || skuStr === '20164' || skuStr === '982' || skuStr === '1388' || skuStr === '1745') {
    marca = 'SKOL';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('BRAHMA DUPLO MALTE') || upper.includes('B.DUPLO MALTE') || upper.includes('DUPLO MALTE') || skuStr === '20498') {
    marca = 'BRAHMA DUPLO MALTE';
    tierComercial = 'PURO_MALTE';
  } else if (upper.includes('BRAHMA CHOPP ZERO') || upper.includes('BRAHMA ZERO') || skuStr === '12948' || skuStr === '12951') {
    marca = 'BRAHMA ZERO';
    tierComercial = 'ZERO';
  } else if (upper.includes('MALZBIER BRAHMA') || upper.includes('MALZBIER') || skuStr === '9081') {
    marca = 'BRAHMA MALZBIER';
    tierComercial = 'SABOR';
  } else if (upper.includes('BRAHMA CHOPP') || upper.includes('BRAHMA') || upper.includes('B.CHOPP') || skuStr === '9069' || skuStr === '33820' || skuStr === '9320' || skuStr === '988' || skuStr === '1695' || skuStr === '1898' || skuStr === '13201') {
    marca = 'BRAHMA CHOPP';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('ANTARCTICA SUBZERO') || upper.includes('SUB ZERO') || upper.includes('SUBZERO') || skuStr === '2006' || skuStr === '2008' || skuStr === '10175' || skuStr === '10530') {
    marca = 'ANTARCTICA SUBZERO';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('ANTARCTICA PILSEN') || upper.includes('ANTARCTICA BOA') || upper.includes('ANTARCTICA') && !upper.includes('GUARANA') && !upper.includes('TONICA') && !upper.includes('SODA')) {
    marca = 'ANTARCTICA PILSEN';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('SPATEN') || skuStr === '21632' || skuStr === '21658' || skuStr === '21668' || skuStr === '23186' || skuStr === '25837') {
    marca = 'SPATEN';
    tierComercial = 'PURO_MALTE';
  } else if (upper.includes('CORONA CERO') || upper.includes('SUNBREW') || skuStr === '27866' || skuStr === '34263') {
    marca = 'CORONA CERO';
    tierComercial = 'ZERO';
  } else if (upper.includes('CORONA') || upper.includes('CORONITA') || skuStr === '18836' || skuStr === '18780' || skuStr === '20651') {
    marca = 'CORONA';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('BUDWEISER ZERO') || skuStr === '22177' || skuStr === '22180' || skuStr === '35338') {
    marca = 'BUDWEISER ZERO';
    tierComercial = 'ZERO';
  } else if (upper.includes('BUDWEISER') || upper.includes('BUD') || skuStr === '21020' || skuStr === '37450' || skuStr === '2548' || skuStr === '14135' || skuStr === '17808' || skuStr === '31064' || skuStr === '35331' || skuStr === '36034') {
    marca = 'BUDWEISER';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('STELLA ARTOIS PURE GOLD') || upper.includes('PURE GOLD') || skuStr === '29580' || skuStr === '32500' || skuStr === '33857') {
    marca = 'STELLA PURE GOLD';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('STELLA ARTOIS') || upper.includes('STELLA') || skuStr === '1699' || skuStr === '18807' || skuStr === '19729' || skuStr === '20530' || skuStr === '20535') {
    marca = 'STELLA ARTOIS';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('BOHEMIA') || skuStr === '3733' || skuStr === '9072' || skuStr === '17266') {
    marca = 'BOHEMIA';
    tierComercial = 'PURO_MALTE';
  } else if (upper.includes('ORIGINAL') || skuStr === '2546' || skuStr === '19668' || skuStr === '20217' || skuStr === '26462' || skuStr === '29253' || skuStr === '33818') {
    marca = 'ORIGINAL';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('CARACU') || skuStr === '620' || skuStr === '9071') {
    marca = 'CARACU';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('MICHELOB ULTRA') || upper.includes('MICHELOB') || skuStr === '4262' || skuStr === '24168') {
    marca = 'MICHELOB ULTRA';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('PATAGONIA') || skuStr === '4141' || skuStr === '4143' || skuStr === '4198') {
    marca = 'PATAGONIA';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('COLORADO')) {
    marca = 'COLORADO';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('GUARANA') || upper.includes('GUARANÁ')) {
    if (upper.includes('ZERO') || upper.includes('DIET') || skuStr === '2353' || skuStr === '9085' || skuStr === '9795' || skuStr === '19321' || skuStr === '34320') {
      marca = 'GUARANÁ ANTARCTICA ZERO';
      tierComercial = 'ZERO';
    } else {
      marca = 'GUARANÁ ANTARCTICA';
      tierComercial = 'MAINSTREAM';
    }
  } else if (upper.includes('PEPSI')) {
    if (upper.includes('BLACK') || upper.includes('ZERO') || skuStr === '4293' || skuStr === '9274' || skuStr === '9276' || skuStr === '29845') {
      marca = 'PEPSI BLACK/ZERO';
      tierComercial = 'ZERO';
    } else if (upper.includes('TWIST') || skuStr === '4409' || skuStr === '9093') {
      marca = 'PEPSI TWIST';
      tierComercial = 'SABOR';
    } else {
      marca = 'PEPSI';
      tierComercial = 'MAINSTREAM';
    }
  } else if (upper.includes('SUKITA')) {
    if (upper.includes('UVA') || skuStr === '1166' || skuStr === '1164') {
      marca = 'SUKITA UVA';
      tierComercial = 'SABOR';
    } else if (upper.includes('LIMAO') || upper.includes('LIMÃO') || skuStr === '21441') {
      marca = 'SUKITA LIMÃO';
      tierComercial = 'SABOR';
    } else {
      marca = 'SUKITA LARANJA';
      tierComercial = 'MAINSTREAM';
    }
  } else if (upper.includes('SODA LIMONADA') || upper.includes('SODA') || skuStr === '2320' || skuStr === '2350' || skuStr === '2354' || skuStr === '9087' || skuStr === '9088') {
    marca = 'SODA LIMONADA';
    tierComercial = upper.includes('DIET') ? 'ZERO' : 'MAINSTREAM';
  } else if (upper.includes('TONICA') || upper.includes('TÔNICA') || skuStr === '9091' || skuStr === '9092') {
    marca = 'TÔNICA ANTARCTICA';
    tierComercial = upper.includes('DIET') ? 'ZERO' : 'MAINSTREAM';
  } else if (upper.includes('H2OH') || upper.includes('LIMONETO') || skuStr === '8791' || skuStr === '8793' || skuStr === '13061' || skuStr === '13065' || skuStr === '34454') {
    marca = 'H2OH!';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('GATORADE') || skuStr === '7977' || skuStr === '7979' || skuStr === '7980' || skuStr === '7981' || skuStr === '7982' || skuStr === '7983' || skuStr === '7985' || skuStr === '32067') {
    marca = 'GATORADE';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('RED BULL') || skuStr === '19225' || skuStr === '19227' || skuStr === '19229' || skuStr === '19231' || skuStr === '21666' || skuStr === '24306' || skuStr === '30045' || skuStr === '32969' || skuStr === '34420' || skuStr === '34429' || skuStr === '34770') {
    marca = 'RED BULL';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('FUSION') || skuStr === '25700') {
    marca = 'FUSION';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('INDAIA') || upper.includes('INDAIÁ') || skuStr === '4367' || skuStr === '23546' || skuStr === '23552' || skuStr === '29323' || skuStr === '29326') {
    marca = 'ÁGUA INDAIÁ';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('DIAS DAVILA') || upper.includes("DIAS D'AVILA") || skuStr === '6185' || skuStr === '34918' || skuStr === '34920' || skuStr === '34923') {
    marca = "ÁGUA DIAS D'ÁVILA";
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('PETROPOLIS') || upper.includes('PETRÓPOLIS') || skuStr === '24256' || skuStr === '32526' || skuStr === '32528') {
    marca = 'ÁGUA PETRÓPOLIS';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('ELEVE') || skuStr === '34325' || skuStr === '34475' || skuStr === '34479') {
    marca = 'ÁGUA ELEVE';
    tierComercial = 'MAINSTREAM';
  } else if (upper.includes('MINALBA') || skuStr === '24609') {
    marca = 'ÁGUA MINALBA';
    tierComercial = 'PREMIUM';
  } else if (upper.includes('YPE') || upper.includes('YPÊ') || upper.includes('TIXAN')) {
    marca = 'LIMPEZA YPÊ';
    tierComercial = 'GERAL';
  } else if (upper.includes('DOCES VIEIRA') || upper.includes('TRIDENT') || upper.includes('HALLS') || upper.includes('BUBBALOO') || upper.includes('MENDORATO') || upper.includes('AMINDUS') || upper.includes('TODDYNHO')) {
    marca = 'CONFEITARIA / DOCES';
    tierComercial = 'GERAL';
  } else if (upper.includes('WHISKY') || upper.includes('VODKA') || upper.includes('GIN') || upper.includes('VINHO') || upper.includes('CACHACA') || upper.includes('CACHAÇA') || upper.includes('CONHAQUE') || upper.includes('RUM') || upper.includes('ESPUMANTE')) {
    marca = 'DESTILADOS & VINHOS';
    tierComercial = 'PREMIUM';
  } else if (grpUpper && grpUpper !== 'GERAL') {
    marca = grpUpper;
  }

  // 2. Identificação da Categoria Fiscal
  let categoriaFiscal: ProductClassification['categoriaFiscal'] = 'CERVEJA';
  if (marca === 'BEATS' || grpUpper === 'MATCH') {
    categoriaFiscal = 'BEATS';
  } else if (marca.startsWith('ÁGUA')) {
    categoriaFiscal = 'ÁGUA';
  } else if (marca === 'GATORADE') {
    categoriaFiscal = 'ISOTÔNICOS';
  } else if (marca === 'RED BULL' || marca === 'FUSION') {
    categoriaFiscal = 'ENERGÉTICOS';
  } else if (marca.includes('GUARANÁ') || marca.includes('PEPSI') || marca.includes('SUKITA') || marca.includes('SODA') || marca.includes('TÔNICA') || marca.includes('H2OH') || grpUpper === 'NAB') {
    categoriaFiscal = 'NAB';
  } else if (grpUpper === 'MARKETPLACE' || marca === 'LIMPEZA YPÊ' || marca === 'CONFEITARIA / DOCES' || marca === 'DESTILADOS & VINHOS') {
    categoriaFiscal = 'MARKETPLACE';
  } else {
    categoriaFiscal = 'CERVEJA';
  }

  // 3. Identificação do Volume
  let volume = '';
  if (upper.includes('350ML') || upper.includes('350 ML') || upper.includes(' 350')) volume = '350ML';
  else if (upper.includes('473ML') || upper.includes('473 ML') || upper.includes(' 473') || upper.includes('LATAO') || upper.includes('LATÃO')) volume = '473ML';
  else if (upper.includes('269ML') || upper.includes('269 ML') || upper.includes(' 269')) volume = '269ML';
  else if (upper.includes('600ML') || upper.includes('600 ML') || upper.includes(' 600') || upper.includes('INTEIRA')) volume = '600ML';
  else if (upper.includes('1L') || upper.includes('1 L') || upper.includes('1000ML') || upper.includes('LITRAO') || upper.includes('LITRÃO')) volume = '1L';
  else if (upper.includes('2L') || upper.includes('2 L') || upper.includes('2000ML')) volume = '2L';
  else if (upper.includes('2,5L') || upper.includes('2.5L') || upper.includes('2,5 L') || upper.includes('2.5 L')) volume = '2.5L';
  else if (upper.includes('3,3 L') || upper.includes('3,3L') || upper.includes('3.3L')) volume = '3.3L';
  else if (upper.includes('500ML') || upper.includes('500 ML') || upper.includes(' 500')) volume = '500ML';
  else if (upper.includes('510ML') || upper.includes('510 ML')) volume = '510ML';
  else if (upper.includes('1,5L') || upper.includes('1.5L') || upper.includes('1,5 L') || upper.includes('1.5 L')) volume = '1.5L';
  else if (upper.includes('300ML') || upper.includes('300 ML') || upper.includes('ROMARINHO') || upper.includes('LITRINHO')) volume = '300ML';
  else if (upper.includes('330ML') || upper.includes('330 ML') || upper.includes('355ML') || upper.includes('355 ML')) volume = '330ML/355ML';
  else if (upper.includes('200ML') || upper.includes('200 ML')) volume = '200ML';
  else if (upper.includes('250ML') || upper.includes('250 ML')) volume = '250ML';
  else if (upper.includes('210ML') || upper.includes('210 ML')) volume = '210ML';
  else if (upper.includes('275ML') || upper.includes('275 ML')) volume = '275ML';
  else if (upper.includes('750ML') || upper.includes('750 ML')) volume = '750ML';
  else if (upper.includes('50L') || upper.includes('50 L')) volume = '50L';

  // 4. Identificação do Tipo de Embalagem
  let embalagemTipo: ProductClassification['embalagemTipo'] = 'LATA';
  let embalagemNome = 'LATA';

  if (upper.includes('BARRIL') || upper.includes('CHOPP') && upper.includes('KEG')) {
    embalagemTipo = 'BARRIL';
    embalagemNome = 'BARRIL KEG';
  } else if (upper.includes('PET') || upper.includes(' P2') || upper.includes(' P1') || upper.includes('GARRAFA PET')) {
    embalagemTipo = 'PET';
    embalagemNome = volume ? `PET ${volume}` : 'PET';
  } else if (upper.includes('LN') || upper.includes('LONG NECK') || upper.includes('LONGNECK') || upper.includes('OW') || upper.includes('ONE WAY')) {
    embalagemTipo = 'LONG NECK';
    embalagemNome = volume ? `LONG NECK ${volume}` : 'LONG NECK';
  } else if (upper.includes('RGB') || upper.includes('RET') || upper.includes('RETORNÁVEL') || upper.includes('INTEIRA') || upper.includes('LITRINHO') || (upper.includes('GFA VD') && (volume === '600ML' || volume === '1L' || volume === '300ML'))) {
    embalagemTipo = 'RGB';
    embalagemNome = volume ? `GARRAFA RETORNÁVEL ${volume}` : 'GARRAFA VIDRO';
  } else if (categoriaFiscal === 'MARKETPLACE' && (upper.includes('LIMPEZA') || upper.includes('FRASCO') || upper.includes('DISPLAY') || upper.includes('POTE') || upper.includes('SACHE') || upper.includes('SACHÊ'))) {
    embalagemTipo = 'MARKETPLACE';
    embalagemNome = 'MARKETPLACE';
  } else {
    embalagemTipo = 'LATA';
    embalagemNome = volume ? `LATA ${volume}` : 'LATA';
  }

  // 5. Identificação do Formato (Multipack vs Avulso / Standard)
  let formato: ProductClassification['formato'] = 'AVULSO';
  if (upper.includes('MULTIPACK') || upper.includes('MULTPACK') || upper.includes('MULTIPK') || upper.includes('MULTI') || skuStr === '34608' || skuStr === '33820' || skuStr === '37450' || skuStr === '20164' || skuStr === '33818' || skuStr === '36034' || skuStr === '34027' || skuStr === '34320') {
    formato = 'MULTIPACK';
  } else if (upper.includes('FARDO') || upper.includes('FD C/')) {
    formato = 'FARDO';
  } else if (embalagemTipo === 'BARRIL') {
    formato = 'BARRIL';
  }

  // Grupo unificado padronizado para agrupamento gerencial
  const grupoUnificado = `${marca} • ${embalagemNome}${formato === 'MULTIPACK' ? ' (MULTIPACK)' : ''}`;

  return {
    marca,
    categoriaFiscal,
    embalagem: embalagemNome,
    embalagemTipo,
    volume,
    formato,
    tierComercial,
    grupoUnificado
  };
}

/**
 * Avaliação da compatibilidade entre um produto de Sobra (Entrada) e um de Falta (Saída).
 * Aplica as diretrizes de governança e inteligência logística Ambev / DPO.
 */
export function calculateProductCompatibility(
  sobra: InversaoStockItem,
  falta: InversaoStockItem
): CompatibilityAnalysis {
  const classSobra = classifyAmbevProduct(sobra.descricao, sobra.sku, sobra.grupo);
  const classFalta = classifyAmbevProduct(falta.descricao, falta.sku, falta.grupo);

  // 1. Bloqueios de Segurança Absolutos (Score 0)
  if (sobra.sku === falta.sku) {
    return {
      score: 0,
      nivel: 'INCOMPATIVEL',
      label: 'Mesmo Produto',
      motivo: 'Não é possível inverter um produto por ele mesmo.',
      isPermitidoAutomatico: false
    };
  }

  // Regra rígida: Não cruzar categorias fiscais antagônicas
  if (classSobra.categoriaFiscal !== classFalta.categoriaFiscal) {
    // Exceção muito restrita: Bebidas prontas RTD (Beats) com Cerveja em Long Neck se autorizado, mas não automaticamente
    return {
      score: 0,
      nivel: 'INCOMPATIVEL',
      label: 'Categorias Fiscais Distintas',
      motivo: `Bloqueio: ${classSobra.categoriaFiscal} não pode ser invertido automaticamente com ${classFalta.categoriaFiscal}.`,
      isPermitidoAutomatico: false
    };
  }

  // Bloqueio de embalagens radicalmente incompatíveis (ex: Barril x Lata)
  if (classSobra.embalagemTipo === 'BARRIL' && classFalta.embalagemTipo !== 'BARRIL') {
    return {
      score: 0,
      nivel: 'INCOMPATIVEL',
      label: 'Embalagem Incompatível',
      motivo: 'Bloqueio operacional: Barril Keg só pode ser invertido com outro Barril.',
      isPermitidoAutomatico: false
    };
  }

  // Bloqueio de Marketplace com formatos incompatíveis
  if (classSobra.categoriaFiscal === 'MARKETPLACE' && classSobra.marca !== classFalta.marca) {
    return {
      score: 0,
      nivel: 'INCOMPATIVEL',
      label: 'Marketplace Incompatível',
      motivo: 'Produtos de Marketplace só podem ser invertidos dentro da mesma linha/fornecedor.',
      isPermitidoAutomatico: false
    };
  }

  // 2. NÍVEL 1: GÊMEOS DE EMBALAGEM (Afinidade Máxima: Score 95 - 100)
  // Mesma marca e mesmo volume, variando apenas o formato (Multipack x Avulso) ou Regular x Zero
  const isMesmaMarcaBase = 
    classSobra.marca === classFalta.marca ||
    (classSobra.marca.startsWith('SKOL') && classFalta.marca.startsWith('SKOL')) ||
    (classSobra.marca.startsWith('BRAHMA') && classFalta.marca.startsWith('BRAHMA') && !classSobra.marca.includes('MALZBIER') && !classFalta.marca.includes('MALZBIER')) ||
    (classSobra.marca.startsWith('BUDWEISER') && classFalta.marca.startsWith('BUDWEISER')) ||
    (classSobra.marca.startsWith('CORONA') && classFalta.marca.startsWith('CORONA')) ||
    (classSobra.marca.startsWith('STELLA') && classFalta.marca.startsWith('STELLA')) ||
    (classSobra.marca.startsWith('GUARANÁ') && classFalta.marca.startsWith('GUARANÁ')) ||
    (classSobra.marca.startsWith('PEPSI') && classFalta.marca.startsWith('PEPSI'));

  const isMesmoVolume = classSobra.volume && classFalta.volume && classSobra.volume === classFalta.volume;
  const isMesmoTipoEmbalagem = classSobra.embalagemTipo === classFalta.embalagemTipo;

  // Caso especial: Guaraná 2319 (cx c/12) x 19164 (pack c/2)
  if ((sobra.sku === '2319' && falta.sku === '19164') || (sobra.sku === '19164' && falta.sku === '2319')) {
    return {
      score: 98,
      nivel: 'NIVEL_1_EMBALAGEM',
      label: '★ Afinidade Máxima (98%): Conversão Oficial Guaraná 1L',
      motivo: 'Par homologado com taxa de conversão autorizada (1 cx 2319 = 6 packs 19164).',
      isPermitidoAutomatico: true
    };
  }

  // 2.1 Multipack vs Avulso com mesma marca e mesmo volume
  if (isMesmaMarcaBase && isMesmoVolume && isMesmoTipoEmbalagem && (classSobra.formato !== classFalta.formato)) {
    return {
      score: 100,
      nivel: 'NIVEL_1_EMBALAGEM',
      label: '★ Afinidade Máxima (100%): Multipack x Avulso',
      motivo: `Mesmo produto físico (${classSobra.marca} ${classSobra.volume}), divergindo apenas no agrupamento de embalagem.`,
      isPermitidoAutomatico: true
    };
  }

  // 2.2 Mesma marca e mesma embalagem/formato (ex: Skol 350ml avulsa com Skol 350ml avulsa de outro lote/código)
  if (classSobra.marca === classFalta.marca && isMesmoVolume && isMesmoTipoEmbalagem && classSobra.formato === classFalta.formato) {
    return {
      score: 99,
      nivel: 'NIVEL_1_EMBALAGEM',
      label: '★ Afinidade Máxima (99%): Produto Idêntico',
      motivo: `Produto idêntico (${classSobra.marca} ${classSobra.volume}).`,
      isPermitidoAutomatico: true
    };
  }

  // 2.3 Regular vs Versão Zero da Mesma Marca e Embalagem (ex: Brahma Chopp 350ml x Brahma Chopp Zero 350ml)
  if (isMesmaMarcaBase && isMesmoVolume && isMesmoTipoEmbalagem && (classSobra.tierComercial === 'ZERO' || classFalta.tierComercial === 'ZERO')) {
    return {
      score: 95,
      nivel: 'NIVEL_1_EMBALAGEM',
      label: '★ Afinidade Alta (95%): Versão Regular x Zero',
      motivo: `Mesma linha de marca (${classSobra.marca} x ${classFalta.marca}) e mesma embalagem (${classSobra.volume}).`,
      isPermitidoAutomatico: true
    };
  }

  // 3. NÍVEL 2: MESMA CATEGORIA, MESMA EMBALAGEM E MESMO VOLUME (Score 80 - 90)
  // Substitutos Diretos de Mercado (Core Pilsen 350ml, Latão 473ml, Garrafa 600ml, Refrigerante PET 2L, etc.)
  if (isMesmoTipoEmbalagem && isMesmoVolume) {
    // 3.1 Cervejas Core Mainstream na mesma embalagem (Skol, Brahma Chopp, Antarctica Pilsen)
    const isCoreSobra = classSobra.categoriaFiscal === 'CERVEJA' && (classSobra.marca === 'SKOL' || classSobra.marca === 'BRAHMA CHOPP' || classSobra.marca === 'ANTARCTICA PILSEN' || classSobra.marca === 'ANTARCTICA SUBZERO');
    const isCoreFalta = classFalta.categoriaFiscal === 'CERVEJA' && (classFalta.marca === 'SKOL' || classFalta.marca === 'BRAHMA CHOPP' || classFalta.marca === 'ANTARCTICA PILSEN' || classFalta.marca === 'ANTARCTICA SUBZERO');

    if (isCoreSobra && isCoreFalta) {
      return {
        score: 90,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (90%): Cervejas Core Pilsen ${classSobra.volume}`,
        motivo: `Mesmo segmento de volume e valor comercial (${classSobra.marca} x ${classFalta.marca} ${classSobra.volume}).`,
        isPermitidoAutomatico: true
      };
    }

    // 3.2 Cervejas Puro Malte / Premium na mesma embalagem (Spaten, Brahma Duplo Malte, Budweiser, Stella, Corona, Original)
    const isPremiumSobra = classSobra.categoriaFiscal === 'CERVEJA' && (classSobra.tierComercial === 'PURO_MALTE' || classSobra.tierComercial === 'PREMIUM');
    const isPremiumFalta = classFalta.categoriaFiscal === 'CERVEJA' && (classFalta.tierComercial === 'PURO_MALTE' || classFalta.tierComercial === 'PREMIUM');

    if (isPremiumSobra && isPremiumFalta) {
      return {
        score: 86,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (86%): Cervejas Puro Malte/Premium ${classSobra.volume}`,
        motivo: `Segmento premium de mesma volumetria (${classSobra.marca} x ${classFalta.marca} ${classSobra.volume}).`,
        isPermitidoAutomatico: true
      };
    }

    // 3.3 Refrigerantes NAB na mesma embalagem e volume (Guaraná, Pepsi, Sukita, Soda Limonada)
    if (classSobra.categoriaFiscal === 'NAB' && classFalta.categoriaFiscal === 'NAB') {
      return {
        score: 88,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (88%): Refrigerantes ${classSobra.embalagemTipo} ${classSobra.volume}`,
        motivo: `Refrigerantes da mesma embalagem e volume (${classSobra.marca} x ${classFalta.marca}).`,
        isPermitidoAutomatico: true
      };
    }

    // 3.4 Gatorade entre sabores (PET 500ml)
    if (classSobra.categoriaFiscal === 'ISOTÔNICOS' && classFalta.categoriaFiscal === 'ISOTÔNICOS') {
      return {
        score: 92,
        nivel: 'NIVEL_2_LINHA',
        label: '★ Alta Afinidade (92%): Isotônicos Gatorade PET 500ml',
        motivo: 'Sabores intercambiáveis de Gatorade com mesmo fator e valor.',
        isPermitidoAutomatico: true
      };
    }

    // 3.5 Red Bull entre sabores/edições (Lata 250ml ou 473ml)
    if (classSobra.categoriaFiscal === 'ENERGÉTICOS' && classFalta.categoriaFiscal === 'ENERGÉTICOS' && classSobra.marca === 'RED BULL' && classFalta.marca === 'RED BULL') {
      return {
        score: 91,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (91%): Red Bull Edições ${classSobra.volume}`,
        motivo: `Variantes intercambiáveis de Red Bull na embalagem ${classSobra.volume}.`,
        isPermitidoAutomatico: true
      };
    }

    // 3.6 Águas Minerais no mesmo volume (500ml ou 1,5L)
    if (classSobra.categoriaFiscal === 'ÁGUA' && classFalta.categoriaFiscal === 'ÁGUA') {
      return {
        score: 87,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (87%): Água Mineral ${classSobra.volume}`,
        motivo: `Águas minerais com mesma capacidade (${classSobra.marca} x ${classFalta.marca}).`,
        isPermitidoAutomatico: true
      };
    }

    // 3.7 Beats entre sabores (Lata 269ml ou Long Neck)
    if (classSobra.categoriaFiscal === 'BEATS' && classFalta.categoriaFiscal === 'BEATS') {
      return {
        score: 90,
        nivel: 'NIVEL_2_LINHA',
        label: `★ Alta Afinidade (90%): Beats Sabores ${classSobra.volume}`,
        motivo: `Sabores de Beats na mesma embalagem (${classSobra.volume}).`,
        isPermitidoAutomatico: true
      };
    }

    // Outros itens da mesma categoria fiscal com mesma embalagem e volume
    return {
      score: 80,
      nivel: 'NIVEL_2_LINHA',
      label: `★ Compatibilidade Moderada (80%): ${classSobra.categoriaFiscal} ${classSobra.volume}`,
      motivo: `Mesma categoria fiscal e embalagem equivalente (${classSobra.volume}).`,
      isPermitidoAutomatico: true
    };
  }

  // 4. NÍVEL 3: MESMA MARCA COM EMBALAGEM EQUIVALENTE OU PROPORCIONAL (Score 65 - 75)
  if (isMesmaMarcaBase) {
    return {
      score: 72,
      nivel: 'NIVEL_3_MARCA',
      label: `Afinidade de Marca (72%): Família ${classSobra.marca}`,
      motivo: `Mesma marca (${classSobra.marca}), porém com volumes/embalagens diferentes (${classSobra.embalagem} x ${classFalta.embalagem}).`,
      isPermitidoAutomatico: true
    };
  }

  // 5. NÍVEL 4: MESMA CATEGORIA GERAL COM EMBALAGEM COMPATÍVEL (Score 50 - 64)
  if (classSobra.categoriaFiscal === classFalta.categoriaFiscal && isMesmoTipoEmbalagem) {
    return {
      score: 60,
      nivel: 'NIVEL_4_CATEGORIA',
      label: `Compatibilidade por Categoria (60%): ${classSobra.categoriaFiscal}`,
      motivo: `Mesma categoria fiscal e formato físico (${classSobra.embalagemTipo}), mas marcas distintas.`,
      isPermitidoAutomatico: true
    };
  }

  // Abaixo de 50: Incompatível para sugestão automática
  return {
    score: 30,
    nivel: 'INCOMPATIVEL',
    label: 'Baixa Compatibilidade (30%)',
    motivo: 'Produtos com perfis de consumo e formatos físicos divergentes.',
    isPermitidoAutomatico: false
  };
}

/**
 * Calcula a posição de conciliação do dia por SKU (com ou sem ajustes operacionais)
 * separando os itens que possuem SOBRA (entradas em potencial) e FALTA (saídas em potencial).
 */
export function buildInversaoStockItems(
  stockPositions: StockPositionItem[],
  quebras: QuebraItem[] = [],
  vales: ValeItem[] = [],
  trocas: TrocaItem[] = [],
  faltasMapeadas: FaltaMapeadaItem[] = [],
  selectedDeposito: DepositoId | 'ALL' = 'ALL',
  baseMode: 'COM_AJUSTES' | 'SEM_AJUSTES' = 'COM_AJUSTES'
): {
  sobras: InversaoStockItem[];
  faltas: InversaoStockItem[];
  todosItens: InversaoStockItem[];
} {
  const filteredStock = selectedDeposito === 'ALL'
    ? stockPositions
    : stockPositions.filter(p => p.deposito === selectedDeposito);

  const sobras: InversaoStockItem[] = [];
  const faltas: InversaoStockItem[] = [];
  const todosItens: InversaoStockItem[] = [];

  filteredStock.forEach(item => {
    const sku = String(item.produto).trim();
    const fator = Math.max(1, item.fatorSku || 1);
    const classification = classifyAmbevProduct(item.descricao, sku, item.grupo);

    let diffUnits = 0;

    if (baseMode === 'COM_AJUSTES') {
      // Conciliação Equalizada com Ajustes de Quebras, Vales, Trocas e Faltas
      const dev = calculateSkuDeviations(
        sku,
        item.deposito,
        fator,
        item.valorUnitario,
        item.valorCaixa,
        item.fatorHl,
        quebras,
        vales,
        trocas,
        faltasMapeadas
      );

      const totalDesviosUnits = dev.total.units;
      const finalUnits = item.inventarioTotalUnits + totalDesviosUnits;
      const fiscalUnits = item.disponivelTotalUnits;

      diffUnits = finalUnits - fiscalUnits;

      if (item.saldoNegativoDesconsiderado || fiscalUnits < 0) {
        diffUnits = 0;
      }
    } else {
      // Conciliação Padrão sem Ajustes (Físico Puro vs Fiscal)
      diffUnits = item.diferencaTotalUnits;
    }

    if (diffUnits === 0) return;

    const diffSkusRounded = Math.floor(Math.abs(diffUnits) / fator);
    const rawFormat = formatSkuUnit(Math.abs(diffUnits), fator);

    const stockItemData: InversaoStockItem = {
      sku,
      descricao: item.descricao,
      grupo: classification.grupoUnificado,
      deposito: item.deposito,
      fatorSku: fator,
      fatorHl: item.fatorHl || 0,
      valorUnitario: item.valorUnitario,
      valorCaixa: item.valorCaixa || item.valorUnitario * fator,
      saldoSkus: diffSkusRounded,
      saldoUnits: Math.abs(diffUnits),
      saldoRaw: rawFormat,
      valorTotal: Math.abs(diffUnits) * item.valorUnitario,
      tipo: diffUnits > 0 ? 'SOBRA' : 'FALTA',

      // Metadados analíticos enriquecidos
      categoriaFiscal: classification.categoriaFiscal,
      embalagemTipo: classification.embalagemTipo,
      volumePadrao: classification.volume,
      formato: classification.formato,
      marca: classification.marca,
      alocadoSkus: 0,
      saldoResidualSkus: diffSkusRounded,
      saldoResidualUnits: Math.abs(diffUnits),
      statusAuditoria: 'PENDENTE',
      paresAssociadosIds: []
    };

    todosItens.push(stockItemData);

    if (diffUnits > 0) {
      sobras.push(stockItemData);
    } else if (diffUnits < 0) {
      faltas.push(stockItemData);
    }
  });

  // Ordena sobras priorizando maior saldo em caixas fechadas para permitir inversões expressivas
  sobras.sort((a, b) => b.saldoSkus - a.saldoSkus || b.valorTotal - a.valorTotal);
  faltas.sort((a, b) => b.saldoSkus - a.saldoSkus || b.valorTotal - a.valorTotal);

  return { sobras, faltas, todosItens };
}

/**
 * Identifica a taxa de conversão / proporção entre dois produtos.
 * Regra: As quantidades coincidem (1:1) em SKUs fechados, exceto para 19164 x 2319 (1:6).
 */
export function getProductConversionRatio(
  sobraSku: string,
  faltaSku: string,
  _sobraFatorSku?: number,
  _faltaFatorSku?: number
): {
  ratio: number; // quantos SKUs de falta correspondem a 1 SKU de sobra
  label: string;
  isPersonalizado: boolean;
} {
  const sSku = String(sobraSku || '').trim();
  const fSku = String(faltaSku || '').trim();

  // 1. Única Exceção Homologada: Guaraná 2319 <-> Guaraná 19164 (1 2319 equivale a 6 19164)
  if (sSku === '2319' && fSku === '19164') {
    return {
      ratio: 6,
      label: '1 SKU (2319) = 6 SKUs (19164)',
      isPersonalizado: true
    };
  }
  if (sSku === '19164' && fSku === '2319') {
    return {
      ratio: 1 / 6,
      label: '6 SKUs (19164) = 1 SKU (2319)',
      isPersonalizado: true
    };
  }

  // 2. Regra Geral Absoluta: As quantidades de SKU fechado PRECISAM COINCIDIR (1:1)
  return {
    ratio: 1,
    label: '1 SKU = 1 SKU (1:1)',
    isPersonalizado: false
  };
}

/**
 * Retorna o teto máximo de SKUs de sobra viável para o par considerando
 * a disponibilidade física da sobra e da falta.
 */
export function calculateMaxViableSobraSkus(
  sobraSku: string,
  faltaSku: string,
  sobraSaldoSkus: number,
  faltaSaldoSkus: number
): number {
  const { ratio } = getProductConversionRatio(sobraSku, faltaSku);
  let maxSuportada = faltaSaldoSkus;
  if (ratio === 6) {
    maxSuportada = Math.floor(faltaSaldoSkus / 6);
  } else if (ratio === 1 / 6) {
    maxSuportada = faltaSaldoSkus * 6;
  }
  return Math.max(0, Math.min(sobraSaldoSkus, maxSuportada));
}

/**
 * Calcula a quantidade de SKUs de saída correspondente aos SKUs de entrada.
 */
export function calculateQtdSaidaSkus(
  sobraSku: string,
  faltaSku: string,
  qtdSobraSkus: number
): number {
  const { ratio } = getProductConversionRatio(sobraSku, faltaSku);
  if (ratio === 6) {
    return qtdSobraSkus * 6;
  }
  if (ratio === 1 / 6) {
    return Math.floor(qtdSobraSkus / 6);
  }
  return qtdSobraSkus;
}

/**
 * Cria um par de inversão manual a partir de qualquer sobra e falta selecionadas pelo analista.
 */
export function createManualInversaoPair(
  sobra: InversaoStockItem,
  falta: InversaoStockItem,
  quantidadeSkus?: number,
  justificativa?: string
): InversaoPair {
  const { ratio, label, isPersonalizado } = getProductConversionRatio(
    sobra.sku,
    falta.sku
  );

  const compat = calculateProductCompatibility(sobra, falta);

  const maxViableSobra = calculateMaxViableSobraSkus(
    sobra.sku,
    falta.sku,
    sobra.saldoSkus,
    falta.saldoSkus
  );

  const qtdSobraSkus = quantidadeSkus != null 
    ? Math.max(0, quantidadeSkus) 
    : Math.max(1, maxViableSobra > 0 ? maxViableSobra : 1);

  const qtdFaltaSkus = calculateQtdSaidaSkus(sobra.sku, falta.sku, qtdSobraSkus);
  const unitsSobra = qtdSobraSkus * sobra.fatorSku;
  const unitsFalta = qtdFaltaSkus * falta.fatorSku;

  const valorEntrada = unitsSobra * sobra.valorUnitario;
  const valorSaida = unitsFalta * falta.valorUnitario;
  const diferencaValor = valorEntrada - valorSaida;
  const volumeHlInvertido = qtdSobraSkus * (sobra.fatorHl || falta.fatorHl || 0);

  return {
    id: `INV-MANUAL-${sobra.deposito}-${sobra.sku}-${falta.sku}-${Date.now()}`,
    grupo: sobra.grupo === falta.grupo ? sobra.grupo : `${sobra.grupo} / ${falta.grupo}`,
    deposito: sobra.deposito,

    sobraSku: sobra.sku,
    sobraDescricao: sobra.descricao,
    sobraDisponivelSkus: sobra.saldoSkus,
    sobraDisponivelUnits: sobra.saldoUnits,
    sobraValorUnitario: sobra.valorUnitario,
    sobraFatorSku: sobra.fatorSku,
    sobraFatorHl: sobra.fatorHl,

    faltaSku: falta.sku,
    faltaDescricao: falta.descricao,
    faltaApuradaSkus: falta.saldoSkus,
    faltaApuradaUnits: falta.saldoUnits,
    faltaValorUnitario: falta.valorUnitario,
    faltaFatorSku: falta.fatorSku,
    faltaFatorHl: falta.fatorHl,

    quantidadeInversaoSkus: qtdSobraSkus,
    quantidadeSaidaSkus: qtdFaltaSkus,
    quantidadeInversaoUnits: unitsSobra,
    razaoConversao: ratio,
    proporcaoLabel: label,
    isPersonalizadoProporcao: isPersonalizado,

    valorEntrada,
    valorSaida,
    diferencaValor,
    volumeHlInvertido,

    compatibilidadeScore: compat.score,
    compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
    compatibilidadeLabel: compat.label,

    selected: true,
    justificativa: justificativa || (compat.score >= 80 ? compat.motivo : (isPersonalizado ? `Pareamento especial (${label}).` : 'Inversão manual entre SKUs fechados.'))
  };
}

/**
 * Encontra os parceiros mais compatíveis para um determinado item de sobra ou falta
 */
export function findTopCompatiblePartners(
  item: InversaoStockItem,
  candidates: InversaoStockItem[],
  limit = 5
): Array<{
  partner: InversaoStockItem;
  compatibility: CompatibilityAnalysis;
  maxViableSkus: number;
}> {
  const isSobra = item.tipo === 'SOBRA';

  return candidates
    .filter(c => c.sku !== item.sku && c.deposito === item.deposito && c.saldoSkus > 0)
    .map(partner => {
      const sobraItem = isSobra ? item : partner;
      const faltaItem = isSobra ? partner : item;
      const compatibility = calculateProductCompatibility(sobraItem, faltaItem);
      const maxViableSkus = calculateMaxViableSobraSkus(
        sobraItem.sku,
        faltaItem.sku,
        sobraItem.saldoSkus,
        faltaItem.saldoSkus
      );
      return { partner, compatibility, maxViableSkus };
    })
    .filter(res => res.compatibility.score > 0)
    .sort((a, b) => b.compatibility.score - a.compatibility.score || b.maxViableSkus - a.maxViableSkus)
    .slice(0, limit);
}

/**
 * Inteligência do Analista de Dados:
 * Inicia a inversão a partir dos itens que estão SOBRANDO no estoque (apuração física > fiscal após 02.05.02).
 * A partir desses itens em sobra, identifica e equaliza os itens compatíveis que estão FALTANDO,
 * garantindo que as quantidades invertidas correspondam rigorosamente aos saldos apurados na conciliação.
 */
export function generateInversionSuggestions(
  sobras: InversaoStockItem[],
  faltas: InversaoStockItem[]
): {
  sugestoesPares: InversaoPair[];
  sobrasSemPar: InversaoStockItem[];
  faltasSemPar: InversaoStockItem[];
} {
  const sugestoesPares: InversaoPair[] = [];

  const getKey = (dep: string, sku: string) => `${dep}-${sku}`;

  // Rastreamento dinâmico e estrito do saldo apurado restante em SKUs por depósito
  const sobraSaldoRestante = new Map<string, number>();
  const faltaSaldoRestante = new Map<string, number>();

  sobras.forEach(s => sobraSaldoRestante.set(getKey(s.deposito, s.sku), s.saldoSkus));
  faltas.forEach(f => faltaSaldoRestante.set(getKey(f.deposito, f.sku), f.saldoSkus));

  // Mapa de alocações para enriquecer os itens de estoque com 100% de rastreabilidade
  const sobraAlocada = new Map<string, number>();
  const faltaAlocada = new Map<string, number>();
  const itensParesIds = new Map<string, string[]>();

  const trackPairing = (dep: string, sobraSku: string, faltaSku: string, qtdSobraSkus: number, qtdFaltaSkus: number, pairId: string) => {
    const keySobra = getKey(dep, sobraSku);
    const keyFalta = getKey(dep, faltaSku);

    const sCurrent = sobraSaldoRestante.get(keySobra) || 0;
    const fCurrent = faltaSaldoRestante.get(keyFalta) || 0;

    sobraSaldoRestante.set(keySobra, Math.max(0, sCurrent - qtdSobraSkus));
    faltaSaldoRestante.set(keyFalta, Math.max(0, fCurrent - qtdFaltaSkus));

    sobraAlocada.set(keySobra, (sobraAlocada.get(keySobra) || 0) + qtdSobraSkus);
    faltaAlocada.set(keyFalta, (faltaAlocada.get(keyFalta) || 0) + qtdFaltaSkus);

    const sList = itensParesIds.get(keySobra) || [];
    sList.push(pairId);
    itensParesIds.set(keySobra, sList);

    const fList = itensParesIds.get(keyFalta) || [];
    fList.push(pairId);
    itensParesIds.set(keyFalta, fList);
  };

  // Separa o estoque por Depósito para garantir que as trocas ocorram estritamente no mesmo local
  const depositos = Array.from(new Set([...sobras.map(s => s.deposito), ...faltas.map(f => f.deposito)]));

  depositos.forEach(dep => {
    // 1. COMEÇA INVERTENDO O QUE HÁ DE SOBRA NO ESTOQUE (após importação da 02.05.02)
    // Ordena as sobras do depósito priorizando as maiores quantidades em caixas fechadas
    const sobrasDoDep = sobras
      .filter(s => s.deposito === dep && s.saldoSkus > 0)
      .sort((a, b) => b.saldoSkus - a.saldoSkus || b.valorTotal - a.valorTotal);

    const faltasDoDep = faltas.filter(f => f.deposito === dep && f.saldoSkus > 0);

    // Múltiplos passos de afinidade analítica (do mais compatível ao correlato):
    // Pass 1: Afinidade Máxima (Score >= 95 - Multipack x Avulso, 2319x19164, Idênticos, Regular x Zero)
    // Pass 2: Alta Afinidade de Linha (Score >= 85 - Core Pilsen 350ml, Puro Malte/Premium, NABs, Isotônicos, etc.)
    // Pass 3: Embalagem Equivalente na Categoria (Score >= 70)
    // Pass 4: Categoria Compatível Geral (Score >= 50)
    const tiersScore = [95, 85, 70, 50];

    tiersScore.forEach(minScore => {
      sobrasDoDep.forEach(sobra => {
        // Enquanto este item com sobra no estoque ainda possuir saldo residual disponível
        while ((sobraSaldoRestante.get(getKey(dep, sobra.sku)) || 0) > 0) {
          const sobraDisp = sobraSaldoRestante.get(getKey(dep, sobra.sku)) || 0;
          if (sobraDisp <= 0) break;

          // A partir do item que está sobrando, elabora e identifica itens compatíveis que estão faltando
          const faltasCandidatas = faltasDoDep
            .filter(falta => {
              if (falta.sku === sobra.sku) return false;
              const fDisp = faltaSaldoRestante.get(getKey(dep, falta.sku)) || 0;
              return fDisp > 0;
            })
            .map(falta => {
              const compat = calculateProductCompatibility(sobra, falta);
              const { ratio, label, isPersonalizado } = getProductConversionRatio(sobra.sku, falta.sku);
              const fDisp = faltaSaldoRestante.get(getKey(dep, falta.sku)) || 0;
              const maxViableSobra = calculateMaxViableSobraSkus(
                sobra.sku,
                falta.sku,
                sobraDisp,
                fDisp
              );
              return {
                falta,
                compat,
                ratio,
                label,
                isPersonalizado,
                fDisp,
                maxViableSobra
              };
            })
            .filter(cand => cand.compat.isPermitidoAutomatico && cand.compat.score >= minScore && cand.maxViableSobra > 0)
            .sort((a, b) => {
              // 1º critério: maior pontuação de afinidade de embalagem/marca
              if (b.compat.score !== a.compat.score) return b.compat.score - a.compat.score;
              // 2º critério: absorver o maior volume viável
              if (b.maxViableSobra !== a.maxViableSobra) return b.maxViableSobra - a.maxViableSobra;
              // 3º critério: menor diferença financeira
              const deltaA = Math.abs((sobra.valorCaixa || 0) - (a.falta.valorCaixa || 0));
              const deltaB = Math.abs((sobra.valorCaixa || 0) - (b.falta.valorCaixa || 0));
              return deltaA - deltaB;
            });

          // Se não encontrou nenhuma falta compatível neste nível de score, passa para o próximo item
          if (faltasCandidatas.length === 0) break;

          const chosen = faltasCandidatas[0];
          const qtdSobraSkus = chosen.maxViableSobra;
          const qtdFaltaSkus = calculateQtdSaidaSkus(sobra.sku, chosen.falta.sku, qtdSobraSkus);

          const unitsSobra = qtdSobraSkus * sobra.fatorSku;
          const unitsFalta = qtdFaltaSkus * chosen.falta.fatorSku;

          const valorEntrada = unitsSobra * sobra.valorUnitario;
          const valorSaida = unitsFalta * chosen.falta.valorUnitario;
          const diferencaValor = valorEntrada - valorSaida;
          const volumeHlInvertido = qtdSobraSkus * (sobra.fatorHl || chosen.falta.fatorHl || 0);

          const pairId = `INV-${dep}-${sobra.sku}-${chosen.falta.sku}-${sugestoesPares.length + 1}`;

          sugestoesPares.push({
            id: pairId,
            grupo: sobra.grupo === chosen.falta.grupo ? sobra.grupo : `${sobra.grupo} / ${chosen.falta.grupo}`,
            deposito: dep,

            sobraSku: sobra.sku,
            sobraDescricao: sobra.descricao,
            sobraDisponivelSkus: sobra.saldoSkus,
            sobraDisponivelUnits: sobra.saldoUnits,
            sobraValorUnitario: sobra.valorUnitario,
            sobraFatorSku: sobra.fatorSku,
            sobraFatorHl: sobra.fatorHl,

            faltaSku: chosen.falta.sku,
            faltaDescricao: chosen.falta.descricao,
            faltaApuradaSkus: chosen.falta.saldoSkus,
            faltaApuradaUnits: chosen.falta.saldoUnits,
            faltaValorUnitario: chosen.falta.valorUnitario,
            faltaFatorSku: chosen.falta.fatorSku,
            faltaFatorHl: chosen.falta.fatorHl,

            quantidadeInversaoSkus: qtdSobraSkus,
            quantidadeSaidaSkus: qtdFaltaSkus,
            quantidadeInversaoUnits: unitsSobra,
            razaoConversao: chosen.ratio,
            proporcaoLabel: chosen.label,
            isPersonalizadoProporcao: chosen.isPersonalizado,

            valorEntrada,
            valorSaida,
            diferencaValor,
            volumeHlInvertido,

            compatibilidadeScore: chosen.compat.score,
            compatibilidadeNivel: chosen.compat.nivel,
            compatibilidadeLabel: chosen.compat.label,

            selected: true,
            justificativa: chosen.compat.motivo
          });

          // Registra o consumo estrito na auditoria
          trackPairing(dep, sobra.sku, chosen.falta.sku, qtdSobraSkus, qtdFaltaSkus, pairId);
        }
      });
    });
  });

  // 4. Enriquecimento dos itens com dados de auditoria e cálculo do melhor parceiro compatível
  const enrichStockItem = (item: InversaoStockItem, isSobra: boolean): InversaoStockItem => {
    const key = getKey(item.deposito, item.sku);
    const alocado = (isSobra ? sobraAlocada.get(key) : faltaAlocada.get(key)) || 0;
    const residualSkus = Math.max(0, item.saldoSkus - alocado);
    const residualUnits = Math.max(0, item.saldoUnits - (alocado * item.fatorSku));

    let statusAuditoria: InversaoStockItem['statusAuditoria'] = 'PENDENTE';
    if (alocado >= item.saldoSkus && item.saldoSkus > 0) {
      statusAuditoria = 'TOTALMENTE_EQUALIZADO';
    } else if (alocado > 0) {
      statusAuditoria = 'PARCIALMENTE_EQUALIZADO';
    }

    const paresIds = itensParesIds.get(key) || [];

    // Localiza o melhor parceiro compatível com saldo disponível na ponta oposta
    const opposingList = isSobra ? faltas : sobras;
    const topMatches = findTopCompatiblePartners(item, opposingList, 1);
    let melhorCandidatoInversao: InversaoStockItem['melhorCandidatoInversao'];

    if (topMatches.length > 0) {
      const top = topMatches[0];
      melhorCandidatoInversao = {
        sku: top.partner.sku,
        descricao: top.partner.descricao,
        score: top.compatibility.score,
        motivo: top.compatibility.motivo,
        deposito: top.partner.deposito,
        saldoSkusDisponivel: top.partner.saldoSkus
      };
    }

    return {
      ...item,
      alocadoSkus: alocado,
      saldoResidualSkus: residualSkus,
      saldoResidualUnits: residualUnits,
      statusAuditoria,
      paresAssociadosIds: paresIds,
      melhorCandidatoInversao
    };
  };

  const sobrasEnriquecidas = sobras.map(s => enrichStockItem(s, true));
  const faltasEnriquecidas = faltas.map(f => enrichStockItem(f, false));

  const sobrasSemPar = sobrasEnriquecidas.filter(s => (s.saldoResidualSkus || 0) > 0);
  const faltasSemPar = faltasEnriquecidas.filter(f => (f.saldoResidualSkus || 0) > 0);

  return {
    sugestoesPares,
    sobrasSemPar,
    faltasSemPar
  };
}

/**
 * Garante 100% de coerência entre a lista de pares de inversão e a conciliação 02.05.02:
 * 1. ENTRADA deve ser estritamente um item apurado como SOBRA no mesmo depósito.
 * 2. SAÍDA deve ser estritamente um item apurado como FALTA no mesmo depósito.
 * 3. Quantidade invertida não pode exceder o saldo de sobra nem a capacidade da falta apurada.
 * 4. Remove ou ajusta pares divergentes para garantir que nenhum item liste inversão divergente.
 */
export function validateAndSanitizeInversionPairs(
  pares: InversaoPair[],
  sobras: InversaoStockItem[],
  faltas: InversaoStockItem[]
): InversaoPair[] {
  const sobraMap = new Map<string, InversaoStockItem>();
  const faltaMap = new Map<string, InversaoStockItem>();

  (sobras || []).forEach(s => {
    if (s && s.sku) {
      sobraMap.set(`${s.deposito}-${s.sku}`, s);
      sobraMap.set(s.sku, s); // Fallback direto por SKU
    }
  });
  (faltas || []).forEach(f => {
    if (f && f.sku) {
      faltaMap.set(`${f.deposito}-${f.sku}`, f);
      faltaMap.set(f.sku, f); // Fallback direto por SKU
    }
  });

  const paresValidos: InversaoPair[] = [];

  for (const pair of (pares || [])) {
    if (!pair || !pair.sobraSku || !pair.faltaSku) continue;
    if (pair.sobraSku === pair.faltaSku) continue;

    const keySobra = `${pair.deposito}-${pair.sobraSku}`;
    const keyFalta = `${pair.deposito}-${pair.faltaSku}`;

    const sobraReal = sobraMap.get(keySobra) || sobraMap.get(pair.sobraSku);
    const faltaReal = faltaMap.get(keyFalta) || faltaMap.get(pair.faltaSku);

    const sobraFator = sobraReal?.fatorSku || pair.sobraFatorSku || 1;
    const faltaFator = faltaReal?.fatorSku || pair.faltaFatorSku || 1;
    const sobraValorUnit = sobraReal?.valorUnitario || pair.sobraValorUnitario || 0;
    const faltaValorUnit = faltaReal?.valorUnitario || pair.faltaValorUnitario || 0;

    // Preserva quantidades customizadas pelo analista sem forçar recálculo ou sobreposição
    const isCustom = pair.isCustomQuantity || (pair.quantidadeSaidaSkus !== undefined && pair.quantidadeSaidaSkus !== calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, pair.quantidadeInversaoSkus));

    const maxViableSobra = calculateMaxViableSobraSkus(
      pair.sobraSku,
      pair.faltaSku,
      sobraReal?.saldoSkus ?? pair.sobraDisponivelSkus ?? 1,
      faltaReal?.saldoSkus ?? pair.faltaApuradaSkus ?? 1
    );

    const qtdSobra = isCustom
      ? Math.max(0, pair.quantidadeInversaoSkus ?? 1)
      : Math.max(1, Math.min(pair.quantidadeInversaoSkus || 1, maxViableSobra > 0 ? maxViableSobra : (pair.quantidadeInversaoSkus || 1)));

    const qtdFalta = pair.quantidadeSaidaSkus !== undefined
      ? Math.max(0, pair.quantidadeSaidaSkus)
      : calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, qtdSobra);

    const unitsSobra = qtdSobra * sobraFator;
    const unitsFalta = qtdFalta * faltaFator;
    const valorEntrada = unitsSobra * sobraValorUnit;
    const valorSaida = unitsFalta * faltaValorUnit;
    const diferencaValor = valorEntrada - valorSaida;
    const volumeHlInvertido = qtdSobra * (sobraReal?.fatorHl || pair.sobraFatorHl || faltaReal?.fatorHl || pair.faltaFatorHl || 0);

    const { ratio, label, isPersonalizado } = getProductConversionRatio(pair.sobraSku, pair.faltaSku);
    const compat = calculateProductCompatibility(
      sobraReal || { sku: pair.sobraSku, descricao: pair.sobraDescricao, grupo: pair.grupo } as any,
      faltaReal || { sku: pair.faltaSku, descricao: pair.faltaDescricao, grupo: pair.grupo } as any
    );

    paresValidos.push({
      ...pair,
      deposito: pair.deposito || sobraReal?.deposito || faltaReal?.deposito || '01',
      sobraSku: pair.sobraSku,
      sobraDescricao: sobraReal?.descricao || pair.sobraDescricao || `Produto SKU ${pair.sobraSku}`,
      sobraDisponivelSkus: sobraReal?.saldoSkus ?? pair.sobraDisponivelSkus ?? qtdSobra,
      sobraDisponivelUnits: sobraReal?.saldoUnits ?? pair.sobraDisponivelUnits ?? unitsSobra,
      sobraValorUnitario: sobraValorUnit,
      sobraFatorSku: sobraFator,
      sobraFatorHl: sobraReal?.fatorHl || pair.sobraFatorHl || 0,

      faltaSku: pair.faltaSku,
      faltaDescricao: faltaReal?.descricao || pair.faltaDescricao || `Produto SKU ${pair.faltaSku}`,
      faltaApuradaSkus: faltaReal?.saldoSkus ?? pair.faltaApuradaSkus ?? qtdFalta,
      faltaApuradaUnits: faltaReal?.saldoUnits ?? pair.faltaApuradaUnits ?? unitsFalta,
      faltaValorUnitario: faltaValorUnit,
      faltaFatorSku: faltaFator,
      faltaFatorHl: faltaReal?.fatorHl || pair.faltaFatorHl || 0,

      quantidadeInversaoSkus: qtdSobra,
      quantidadeSaidaSkus: qtdFalta,
      quantidadeInversaoUnits: unitsSobra,
      valorEntrada,
      valorSaida,
      diferencaValor,
      volumeHlInvertido,
      razaoConversao: ratio,
      proporcaoLabel: label,
      isPersonalizadoProporcao: isPersonalizado,
      compatibilidadeScore: compat.score,
      compatibilidadeNivel: compat.nivel === 'INCOMPATIVEL' ? 'MANUAL' : compat.nivel,
      compatibilidadeLabel: compat.label,
      justificativa: pair.justificativa || compat.motivo,
      isCustomQuantity: isCustom || pair.isCustomQuantity,
      selected: pair.selected !== false
    });
  }

  return paresValidos;
}

/**
 * Recalcula valores monetários e volumétricos de um par.
 * Permite alteração livre e independente das quantidades de Entrada (Sobra) e Saída (Falta),
 * garantindo total liberdade para o analista (ex: 4 na sobra e 1 na falta) sem bloqueios ou redefinições indesejadas.
 */
export function recalculatePairValues(
  pair: InversaoPair, 
  newQtdSobraSkus?: number,
  newQtdSaidaSkus?: number,
  forceRatioSync: boolean = false
): InversaoPair {
  const { ratio, label, isPersonalizado } = getProductConversionRatio(
    pair.sobraSku,
    pair.faltaSku
  );

  const sobraFator = Math.max(1, pair.sobraFatorSku || 1);
  const faltaFator = Math.max(1, pair.faltaFatorSku || 1);

  // Define a quantidade de sobra (Entrada): respeita o número digitado livremente
  const finalQtdSobra = newQtdSobraSkus !== undefined
    ? Math.max(0, newQtdSobraSkus)
    : Math.max(0, pair.quantidadeInversaoSkus ?? 1);

  // Define a quantidade de saída (Falta):
  // 1. Se informada diretamente em newQtdSaidaSkus, usa exatamente esse valor
  // 2. Se solicitou explicitamente força de proporção de embalagem (forceRatioSync), calcula pela razão
  // 3. Caso contrário, mantém estritamente o valor que já constava na saída
  let finalQtdSaida: number;
  if (newQtdSaidaSkus !== undefined) {
    finalQtdSaida = Math.max(0, newQtdSaidaSkus);
  } else if (forceRatioSync) {
    finalQtdSaida = calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, finalQtdSobra);
  } else if (pair.quantidadeSaidaSkus !== undefined) {
    finalQtdSaida = Math.max(0, pair.quantidadeSaidaSkus);
  } else {
    finalQtdSaida = calculateQtdSaidaSkus(pair.sobraSku, pair.faltaSku, finalQtdSobra);
  }

  const unitsSobra = finalQtdSobra * sobraFator;
  const unitsFalta = finalQtdSaida * faltaFator;

  const sUnit = isNaN(pair.sobraValorUnitario) ? 0 : (pair.sobraValorUnitario || 0);
  const fUnit = isNaN(pair.faltaValorUnitario) ? 0 : (pair.faltaValorUnitario || 0);

  const valorEntrada = unitsSobra * sUnit;
  const valorSaida = unitsFalta * fUnit;
  const diferencaValor = valorEntrada - valorSaida;
  const volumeHlInvertido = finalQtdSobra * (pair.sobraFatorHl || pair.faltaFatorHl || 0);

  return {
    ...pair,
    quantidadeInversaoSkus: finalQtdSobra,
    quantidadeSaidaSkus: finalQtdSaida,
    quantidadeInversaoUnits: unitsSobra,
    sobraValorUnitario: sUnit,
    faltaValorUnitario: fUnit,
    valorEntrada,
    valorSaida,
    diferencaValor,
    volumeHlInvertido,
    razaoConversao: ratio,
    proporcaoLabel: label,
    isPersonalizadoProporcao: isPersonalizado,
    isCustomQuantity: true
  };
}

/**
 * Totalizadores de valoração do cabeçalho da Inversão
 */
export function calculateInversionHeaderTotals(pares: InversaoPair[]): {
  totalParesSelecionados: number;
  totalSkusInvertidos: number;
  totalSaidaSkus: number;
  totalUnitsInvertidas: number;
  valorTotalEntrada: number;
  valorTotalSaida: number;
  saldoLiquido: number;
  totalHl: number;
} {
  const selecionados = (pares || []).filter(p => p && p.selected && (p.quantidadeInversaoSkus || 0) > 0);

  let totalSkusInvertidos = 0;
  let totalSaidaSkus = 0;
  let totalUnitsInvertidas = 0;
  let valorTotalEntrada = 0;
  let valorTotalSaida = 0;
  let totalHl = 0;

  selecionados.forEach(p => {
    const qSobra = Math.max(0, p.quantidadeInversaoSkus || 0);
    const qSaida = Math.max(0, p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus ?? 0);
    const uSobra = Math.max(0, p.quantidadeInversaoUnits || (qSobra * (p.sobraFatorSku || 1)));
    const vEntrada = isNaN(p.valorEntrada) ? 0 : (p.valorEntrada || 0);
    const vSaida = isNaN(p.valorSaida) ? 0 : (p.valorSaida || 0);
    const hl = isNaN(p.volumeHlInvertido) ? 0 : (p.volumeHlInvertido || 0);

    totalSkusInvertidos += qSobra;
    totalSaidaSkus += qSaida;
    totalUnitsInvertidas += uSobra;
    valorTotalEntrada += vEntrada;
    valorTotalSaida += vSaida;
    totalHl += hl;
  });

  const saldoLiquido = valorTotalEntrada - valorTotalSaida;

  return {
    totalParesSelecionados: selecionados.length,
    totalSkusInvertidos,
    totalSaidaSkus,
    totalUnitsInvertidas,
    valorTotalEntrada,
    valorTotalSaida,
    saldoLiquido,
    totalHl
  };
}

/**
 * Constrói o resumo analítico de auditoria e coerência com a conciliação
 */
export function buildInversaoAuditSummary(
  sobras: InversaoStockItem[],
  faltas: InversaoStockItem[],
  pares: InversaoPair[]
): {
  totalSobrasApuradasSkus: number;
  totalSobrasApuradasValor: number;
  totalSobrasInvertidasSkus: number;
  totalSobrasInvertidasValor: number;
  totalSobrasResiduaisSkus: number;
  totalSobrasResiduaisValor: number;

  totalFaltasApuradasSkus: number;
  totalFaltasApuradasValor: number;
  totalFaltasInvertidasSkus: number;
  totalFaltasInvertidasValor: number;
  totalFaltasResiduaisSkus: number;
  totalFaltasResiduaisValor: number;

  taxaEqualizacaoSobras: number;
  taxaEqualizacaoFaltas: number;
  deltaFinanceiroPlano: number;
} {
  const paresAtivos = pares.filter(p => p.selected && p.quantidadeInversaoSkus > 0);

  const totalSobrasApuradasSkus = sobras.reduce((sum, s) => sum + s.saldoSkus, 0);
  const totalSobrasApuradasValor = sobras.reduce((sum, s) => sum + s.valorTotal, 0);

  const totalSobrasInvertidasSkus = paresAtivos.reduce((sum, p) => sum + p.quantidadeInversaoSkus, 0);
  const totalSobrasInvertidasValor = paresAtivos.reduce((sum, p) => sum + p.valorEntrada, 0);

  const totalSobrasResiduaisSkus = Math.max(0, totalSobrasApuradasSkus - totalSobrasInvertidasSkus);
  const totalSobrasResiduaisValor = Math.max(0, totalSobrasApuradasValor - totalSobrasInvertidasValor);

  const totalFaltasApuradasSkus = faltas.reduce((sum, f) => sum + f.saldoSkus, 0);
  const totalFaltasApuradasValor = faltas.reduce((sum, f) => sum + f.valorTotal, 0);

  const totalFaltasInvertidasSkus = paresAtivos.reduce((sum, p) => sum + (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus), 0);
  const totalFaltasInvertidasValor = paresAtivos.reduce((sum, p) => sum + p.valorSaida, 0);

  const totalFaltasResiduaisSkus = Math.max(0, totalFaltasApuradasSkus - totalFaltasInvertidasSkus);
  const totalFaltasResiduaisValor = Math.max(0, totalFaltasApuradasValor - totalFaltasInvertidasValor);

  const taxaEqualizacaoSobras = totalSobrasApuradasSkus > 0 
    ? (totalSobrasInvertidasSkus / totalSobrasApuradasSkus) * 100 
    : 0;

  const taxaEqualizacaoFaltas = totalFaltasApuradasSkus > 0 
    ? (totalFaltasInvertidasSkus / totalFaltasApuradasSkus) * 100 
    : 0;

  const deltaFinanceiroPlano = totalSobrasInvertidasValor - totalFaltasInvertidasValor;

  return {
    totalSobrasApuradasSkus,
    totalSobrasApuradasValor,
    totalSobrasInvertidasSkus,
    totalSobrasInvertidasValor,
    totalSobrasResiduaisSkus,
    totalSobrasResiduaisValor,

    totalFaltasApuradasSkus,
    totalFaltasApuradasValor,
    totalFaltasInvertidasSkus,
    totalFaltasInvertidasValor,
    totalFaltasResiduaisSkus,
    totalFaltasResiduaisValor,

    taxaEqualizacaoSobras,
    taxaEqualizacaoFaltas,
    deltaFinanceiroPlano
  };
}

/**
 * SIMULADOR DE ABATIMENTO FISCAL / OTIMIZADOR FINANCEIRO
 */
export function simularAbatimentoFiscal(
  sobras: InversaoStockItem[],
  faltas: InversaoStockItem[],
  config: SimuladorFiscalConfig
): SimuladorFiscalResultado {
  const { metaAbatimentoValor, deposito, apenasMesmoGrupo, estrategia } = config;

  const filteredSobras = deposito === 'ALL'
    ? [...sobras]
    : sobras.filter(s => s.deposito === deposito);

  const filteredFaltas = deposito === 'ALL'
    ? [...faltas]
    : faltas.filter(f => f.deposito === deposito);

  interface CandidatePair {
    sobra: InversaoStockItem;
    falta: InversaoStockItem;
    ratio: number;
    label: string;
    isPersonalizado: boolean;
    compat: CompatibilityAnalysis;
    maxSobraDisponivel: number;
    maxFaltaDisponivel: number;
    maxSobraViavel: number;
    valorSaidaPorCaixaSobra: number;
    valorEntradaPorCaixaSobra: number;
    retornoRatio: number;
  }

  const candidatePairs: CandidatePair[] = [];

  filteredSobras.forEach(sobra => {
    if (sobra.saldoSkus <= 0) return;

    filteredFaltas.forEach(falta => {
      if (falta.saldoSkus <= 0 || falta.sku === sobra.sku) return;
      if (sobra.deposito !== falta.deposito) return;

      const compat = calculateProductCompatibility(sobra, falta);
      if (!compat.isPermitidoAutomatico || compat.score < 50) return;

      const isSameGroup = sobra.grupo.toLowerCase() === falta.grupo.toLowerCase();
      if (apenasMesmoGrupo && !isSameGroup && compat.score < 95) return;

      const { ratio, label, isPersonalizado } = getProductConversionRatio(
        sobra.sku,
        falta.sku
      );

      const maxSobraViavel = calculateMaxViableSobraSkus(
        sobra.sku,
        falta.sku,
        sobra.saldoSkus,
        falta.saldoSkus
      );

      if (maxSobraViavel <= 0) return;

      const qtdFaltaPorUmSobra = calculateQtdSaidaSkus(sobra.sku, falta.sku, 1);
      const valorEntradaPorCaixa = sobra.fatorSku * sobra.valorUnitario;
      const valorSaidaPorCaixa = qtdFaltaPorUmSobra * falta.fatorSku * falta.valorUnitario;
      const retornoRatio = valorEntradaPorCaixa > 0 ? (valorSaidaPorCaixa / valorEntradaPorCaixa) : 1;

      candidatePairs.push({
        sobra,
        falta,
        ratio,
        label,
        isPersonalizado,
        compat,
        maxSobraDisponivel: sobra.saldoSkus,
        maxFaltaDisponivel: falta.saldoSkus,
        maxSobraViavel,
        valorSaidaPorCaixaSobra: valorSaidaPorCaixa,
        valorEntradaPorCaixaSobra: valorEntradaPorCaixa,
        retornoRatio
      });
    });
  });

  // Ordenação de acordo com a estratégia
  if (estrategia === 'MAX_RETORNO') {
    candidatePairs.sort((a, b) => b.retornoRatio - a.retornoRatio || b.compat.score - a.compat.score);
  } else if (estrategia === 'MAIORES_FALTAS') {
    candidatePairs.sort((a, b) => (b.falta.valorTotal) - (a.falta.valorTotal) || b.compat.score - a.compat.score);
  } else {
    // META_PRECISA: prioriza produtos com maior afinidade de embalagem/marca, depois balanceamento
    candidatePairs.sort((a, b) => {
      if (b.compat.score !== a.compat.score) return b.compat.score - a.compat.score;
      return b.valorSaidaPorCaixaSobra - a.valorSaidaPorCaixaSobra;
    });
  }

  const usedSobraSkus = new Map<string, number>();
  const usedFaltaSkus = new Map<string, number>();

  const paresSugeridos: InversaoPair[] = [];
  let valorAbatidoTotal = 0;

  for (const candidate of candidatePairs) {
    if (valorAbatidoTotal >= metaAbatimentoValor) break;

    const sobraJaUsada = usedSobraSkus.get(candidate.sobra.sku) || 0;
    const sobraRestante = candidate.sobra.saldoSkus - sobraJaUsada;

    const faltaJaUsada = usedFaltaSkus.get(candidate.falta.sku) || 0;
    const faltaRestante = candidate.falta.saldoSkus - faltaJaUsada;

    if (sobraRestante <= 0 || faltaRestante <= 0) continue;

    const maxSobraPossivel = calculateMaxViableSobraSkus(
      candidate.sobra.sku,
      candidate.falta.sku,
      sobraRestante,
      faltaRestante
    );

    if (maxSobraPossivel <= 0) continue;

    const valorRestanteMeta = metaAbatimentoValor - valorAbatidoTotal;

    let caixasSobraAlocar = Math.ceil(valorRestanteMeta / Math.max(0.01, candidate.valorSaidaPorCaixaSobra));
    caixasSobraAlocar = Math.max(1, Math.min(caixasSobraAlocar, maxSobraPossivel));

    const qtdFaltaAlocar = calculateQtdSaidaSkus(candidate.sobra.sku, candidate.falta.sku, caixasSobraAlocar);
    const unitsSobra = caixasSobraAlocar * candidate.sobra.fatorSku;
    const unitsFalta = qtdFaltaAlocar * candidate.falta.fatorSku;

    const valorEntrada = unitsSobra * candidate.sobra.valorUnitario;
    const valorSaida = unitsFalta * candidate.falta.valorUnitario;
    const diferencaValor = valorEntrada - valorSaida;
    const volumeHlInvertido = caixasSobraAlocar * (candidate.sobra.fatorHl || candidate.falta.fatorHl || 0);

    paresSugeridos.push({
      id: `SIM-INV-${candidate.sobra.deposito}-${candidate.sobra.sku}-${candidate.falta.sku}-${paresSugeridos.length + 1}`,
      grupo: candidate.sobra.grupo,
      deposito: candidate.sobra.deposito,

      sobraSku: candidate.sobra.sku,
      sobraDescricao: candidate.sobra.descricao,
      sobraDisponivelSkus: candidate.sobra.saldoSkus,
      sobraDisponivelUnits: candidate.sobra.saldoUnits,
      sobraValorUnitario: candidate.sobra.valorUnitario,
      sobraFatorSku: candidate.sobra.fatorSku,
      sobraFatorHl: candidate.sobra.fatorHl,

      faltaSku: candidate.falta.sku,
      faltaDescricao: candidate.falta.descricao,
      faltaApuradaSkus: candidate.falta.saldoSkus,
      faltaApuradaUnits: candidate.falta.saldoUnits,
      faltaValorUnitario: candidate.falta.valorUnitario,
      faltaFatorSku: candidate.falta.fatorSku,
      faltaFatorHl: candidate.falta.fatorHl,

      quantidadeInversaoSkus: caixasSobraAlocar,
      quantidadeSaidaSkus: qtdFaltaAlocar,
      quantidadeInversaoUnits: unitsSobra,
      razaoConversao: candidate.ratio,
      proporcaoLabel: candidate.label,
      isPersonalizadoProporcao: candidate.isPersonalizado,

      valorEntrada,
      valorSaida,
      diferencaValor,
      volumeHlInvertido,

      compatibilidadeScore: candidate.compat.score,
      compatibilidadeNivel: candidate.compat.nivel,
      compatibilidadeLabel: candidate.compat.label,

      selected: true,
      justificativa: `Simulação Fiscal (${candidate.label}) - Abatendo ${formatCurrencySimple(valorSaida)} das faltas.`
    });

    usedSobraSkus.set(candidate.sobra.sku, sobraJaUsada + caixasSobraAlocar);
    usedFaltaSkus.set(candidate.falta.sku, faltaJaUsada + qtdFaltaAlocar);
    valorAbatidoTotal += valorSaida;
  }

  const totalAbatidoFalta = paresSugeridos.reduce((acc, p) => acc + p.valorSaida, 0);
  const totalValorEntrada = paresSugeridos.reduce((acc, p) => acc + p.valorEntrada, 0);
  const saldoLiquidoOperacao = totalValorEntrada - totalAbatidoFalta;
  const percentualAtingido = metaAbatimentoValor > 0 ? (totalAbatidoFalta / metaAbatimentoValor) * 100 : 0;
  const totalCaixasEntrada = paresSugeridos.reduce((acc, p) => acc + p.quantidadeInversaoSkus, 0);
  const totalCaixasSaida = paresSugeridos.reduce((acc, p) => acc + (p.quantidadeSaidaSkus ?? p.quantidadeInversaoSkus), 0);
  const totalUnidadesFisicas = paresSugeridos.reduce((acc, p) => acc + p.quantidadeInversaoUnits, 0);

  return {
    paresSugeridos,
    totalAbatidoFalta,
    totalValorEntrada,
    saldoLiquidoOperacao,
    percentualAtingido,
    totalCaixasEntrada,
    totalCaixasSaida,
    totalUnidadesFisicas
  };
}

function formatCurrencySimple(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}
