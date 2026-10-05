const fs = require('fs');
const path = require('path');

// 1. Carrega dados da nova tabela
const csvPath = path.join(__dirname, 'user_prices_20261002.csv');
const rawData = fs.readFileSync(csvPath, 'utf8');
const lines = rawData.split(/\r?\n/).filter(l => l.trim().length > 0);

const userUpdates = new Map();

for (const line of lines) {
  const parts = line.split(';');
  if (parts.length < 3) continue;
  const rawSku = parts[0].trim();
  const desc = parts[1].trim();
  const rawVal = parts[2].trim().replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(rawVal) || 0;
  const sku = String(parseInt(rawSku, 10));

  if (sku && !isNaN(parseInt(sku, 10))) {
    userUpdates.set(sku, { valor, desc });
  }
}

console.log('Total SKUs da nova tabela carregados:', userUpdates.size);

// 2. Função para deduzir Grupo
function deduceGrupo(desc, existingGrupo) {
  const u = (desc || '').toUpperCase();
  if (u.includes('SKOL BEATS') || u.includes('BEATS ') || u.includes('BRUTAL FRUIT') || u.includes('MIKES')) {
    return 'MATCH';
  }
  if (
    u.includes('SKOL') || u.includes('BRAHMA') || u.includes('ANTARCTICA PILSEN') ||
    u.includes('SUBZERO') || u.includes('BUDWEISER') || u.includes('STELLA') ||
    u.includes('SPATEN') || u.includes('CORONA') || u.includes('BOHEMIA') ||
    u.includes('ORIGINAL') || u.includes('CARACU') || u.includes('MICHELOB') ||
    u.includes('PATAGONIA') || u.includes('COLORADO') || u.includes('WALS') ||
    u.includes('BECKS') || u.includes('LEFFE') || u.includes('HOEGAARDEN') ||
    u.includes('CHOPP') || u.includes('QUILMES') || u.includes('KRONENBIER') || u.includes('LIBER')
  ) {
    return 'CERVEJA';
  }
  if (
    u.includes('GUARANA') || u.includes('GUARANÁ') || u.includes('PEPSI') ||
    u.includes('SUKITA') || u.includes('SODA') || u.includes('TONICA') ||
    u.includes('TÔNICA') || u.includes('H2OH') || u.includes('GATORADE') ||
    u.includes('RED BULL') || u.includes('FUSION') || u.includes('AGUA') ||
    u.includes('ÁGUA') || u.includes('MINALBA') || u.includes('INDAIA') ||
    u.includes('INDAIÁ') || u.includes('ELEVE') || u.includes('PETROPOLIS') ||
    u.includes('DIAS DAVILA') || u.includes('LIPTON') || u.includes('TANG') ||
    u.includes('DO BEM') || u.includes('CITRUS')
  ) {
    return 'NAB';
  }
  return existingGrupo || 'MARKETPLACE';
}

// 3. Função para deduzir Fator Hectolitro (HL)
function deduceHl(desc, fatorSku, existingHl) {
  const u = (desc || '').toUpperCase();
  let unitLitros = 0;

  if (u.includes('3,3 L') || u.includes('3.3 L') || u.includes('3,3L')) unitLitros = 3.3;
  else if (u.includes('2,5L') || u.includes('2.5L') || u.includes('2,5 L') || u.includes('2.5 L')) unitLitros = 2.5;
  else if (u.includes('2L') || u.includes('2 L') || u.includes('2000ML')) unitLitros = 2.0;
  else if (u.includes('1,5L') || u.includes('1.5L') || u.includes('1,5 L') || u.includes('1.5 L')) unitLitros = 1.5;
  else if (u.includes('1L') || u.includes('1 L') || u.includes('1000ML') || u.includes('LITRAO') || u.includes('LITRÃO')) unitLitros = 1.0;
  else if (u.includes('990ML') || u.includes('970ML') || u.includes('965ML') || u.includes('910ML') || u.includes('900ML') || u.includes('998ML')) unitLitros = 0.95;
  else if (u.includes('750ML') || u.includes('750 ML') || u.includes('740ML')) unitLitros = 0.75;
  else if (u.includes('700ML')) unitLitros = 0.70;
  else if (u.includes('600ML') || u.includes('600 ML') || u.includes('INTEIRA')) unitLitros = 0.60;
  else if (u.includes('550ML')) unitLitros = 0.55;
  else if (u.includes('510ML') || u.includes('500ML') || u.includes('500 ML')) unitLitros = 0.50;
  else if (u.includes('473ML') || u.includes('473 ML') || u.includes('LATAO') || u.includes('LATÃO')) unitLitros = 0.473;
  else if (u.includes('410ML') || u.includes('410 ML')) unitLitros = 0.410;
  else if (u.includes('375ML')) unitLitros = 0.375;
  else if (u.includes('355ML') || u.includes('355 ML')) unitLitros = 0.355;
  else if (u.includes('350ML') || u.includes('350 ML')) unitLitros = 0.350;
  else if (u.includes('340ML') || u.includes('343ML')) unitLitros = 0.340;
  else if (u.includes('330ML') || u.includes('330 ML')) unitLitros = 0.330;
  else if (u.includes('313ML') || u.includes('310ML')) unitLitros = 0.310;
  else if (u.includes('300ML') || u.includes('300 ML') || u.includes('LITRINHO') || u.includes('ROMARINHO')) unitLitros = 0.300;
  else if (u.includes('290ML') || u.includes('284ML')) unitLitros = 0.290;
  else if (u.includes('275ML') || u.includes('269ML') || u.includes('260ML')) unitLitros = 0.269;
  else if (u.includes('250ML') || u.includes('250 ML')) unitLitros = 0.250;
  else if (u.includes('237ML')) unitLitros = 0.237;
  else if (u.includes('210ML') || u.includes('207ML')) unitLitros = 0.210;
  else if (u.includes('200ML') || u.includes('200 ML')) unitLitros = 0.200;
  else if (u.includes('100ML')) unitLitros = 0.100;
  else if (u.includes('50L')) unitLitros = 50.0;
  else if (u.includes('30L')) unitLitros = 30.0;
  else if (u.includes('18L')) unitLitros = 18.0;

  if (unitLitros > 0) {
    const totalLitros = unitLitros * (fatorSku || 1);
    const hl = totalLitros / 100;
    return hl;
  }
  return existingHl !== undefined ? existingHl : 0;
}

// 4. Atualiza RAW_CADASTRO_CSV em initialData.ts
const initFilePath = path.join(__dirname, 'initialData.ts');
let initContent = fs.readFileSync(initFilePath, 'utf8');

const match = initContent.match(/export const RAW_CADASTRO_CSV = `([\s\S]*?)`;/);
if (!match) {
  console.error('RAW_CADASTRO_CSV não encontrado em initialData.ts');
  process.exit(1);
}

const rawCsvLines = match[1].trim().split(/\r?\n/);
const header = rawCsvLines[0];
const dataLines = rawCsvLines.slice(1);

const existingSkus = new Set();
let updatedCount = 0;

const newDataLines = dataLines.map(line => {
  const cols = line.split(';');
  if (cols.length < 6) return line;
  const sku = cols[0].trim();
  existingSkus.add(sku);

  let desc = cols[1] || '';
  const fatorSku = parseInt(cols[2], 10) || 1;
  let existingHl = parseFloat((cols[6] || '0').replace(',', '.')) || 0;
  let existingGrupo = cols[7] || 'GERAL';

  if (userUpdates.has(sku)) {
    const upd = userUpdates.get(sku);
    if (upd.desc) desc = upd.desc;

    // Atualiza preço se maior que 0
    if (upd.valor > 0) {
      updatedCount++;
      const newValor = upd.valor;
      const newValorUnit = newValor / fatorSku;
      cols[4] = ` R$ ${newValor.toFixed(2).replace('.', ',')} `;
      cols[5] = ` R$ ${newValorUnit.toFixed(2).replace('.', ',')} `;
    }

    // Atualiza HL
    const computedHl = deduceHl(desc, fatorSku, existingHl);
    if (computedHl > 0) {
      cols[6] = computedHl.toFixed(2).replace('.', ',');
    }

    // Atualiza Grupo
    cols[7] = deduceGrupo(desc, existingGrupo);
    cols[1] = desc;

    return cols.join(';');
  } else {
    // Atualiza HL e Grupo dos produtos existentes que faltavam
    const computedHl = deduceHl(desc, fatorSku, existingHl);
    if (computedHl > 0 && existingHl === 0) {
      cols[6] = computedHl.toFixed(2).replace('.', ',');
    }
    cols[7] = deduceGrupo(desc, existingGrupo);
    return cols.join(';');
  }
});

// Adiciona produtos da nova tabela que porventura não estavam em RAW_CADASTRO_CSV
let addedCount = 0;
for (const [sku, upd] of userUpdates.entries()) {
  if (!existingSkus.has(sku) && upd.valor > 0) {
    const fatorSku = 1; // default para novos
    const valorFmt = ` R$ ${upd.valor.toFixed(2).replace('.', ',')} `;
    const valorUnitFmt = ` R$ ${upd.valor.toFixed(2).replace('.', ',')} `;
    const computedHl = deduceHl(upd.desc, fatorSku, 0);
    const hlFmt = computedHl.toFixed(2).replace('.', ',');
    const grupo = deduceGrupo(upd.desc, 'MARKETPLACE');
    const newLine = `${sku};${upd.desc};${fatorSku};100;${valorFmt};${valorUnitFmt};${hlFmt};${grupo};NÃO IDENTIFICADA;180`;
    newDataLines.push(newLine);
    addedCount++;
  }
}

console.log(`Sucesso: ${updatedCount} produtos atualizados com novos preços, ${addedCount} novos produtos adicionados.`);

const newCsv = [header, ...newDataLines].join('\n') + '\n';
initContent = initContent.replace(match[0], `export const RAW_CADASTRO_CSV = \`\n${newCsv}\`;`);
fs.writeFileSync(initFilePath, initContent, 'utf8');
console.log('src/data/initialData.ts atualizado com sucesso.');
