const fs = require('fs');

// Read user table text
const userText = fs.readFileSync('user_prices.txt', 'utf8');
const lines = userText.split(/\r?\n/).filter(l => l.trim().length > 0);

const updates = new Map(); // sku -> { valor, valorUnit, descricao }

// Skip header (line 0)
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  if (parts.length < 10) continue;
  const rawSku = (parts[5] || '').trim();
  const desc = (parts[6] || '').trim();
  const rawValor = (parts[8] || '').trim().replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(rawValor) || 0;

  const sku = String(parseInt(rawSku, 10));
  if (sku && !isNaN(parseInt(sku, 10))) {
    updates.set(sku, { valor, desc });
  }
}

console.log('Total SKUs in uploaded table:', updates.size);

// Read initialData.ts
const initFilePath = 'src/data/initialData.ts';
let initContent = fs.readFileSync(initFilePath, 'utf8');

// Match RAW_CADASTRO_CSV
const match = initContent.match(/export const RAW_CADASTRO_CSV = `([\s\S]*?)`;/);
if (!match) {
  console.error('RAW_CADASTRO_CSV not found');
  process.exit(1);
}

const rawCsvLines = match[1].trim().split(/\r?\n/);
const header = rawCsvLines[0];
const dataLines = rawCsvLines.slice(1);

let updatedCount = 0;
let preservedCount = 0;

const newDataLines = dataLines.map(line => {
  const cols = line.split(';');
  if (cols.length < 6) return line;
  const sku = cols[0].trim();
  const fatorSku = parseInt(cols[2], 10) || 1;

  if (updates.has(sku)) {
    const upd = updates.get(sku);
    if (upd.valor > 0) {
      updatedCount++;
      const newValor = upd.valor;
      const newValorUnit = newValor / fatorSku;

      const valorFmt = ` R$ ${newValor.toFixed(2).replace('.', ',')} `;
      const valorUnitFmt = ` R$ ${newValorUnit.toFixed(2).replace('.', ',')} `;

      cols[4] = valorFmt;
      cols[5] = valorUnitFmt;
      return cols.join(';');
    } else {
      preservedCount++;
      return line; // keep existing when 0 or not listed
    }
  } else {
    preservedCount++;
    return line;
  }
});

console.log(`Updated ${updatedCount} products, preserved ${preservedCount} products.`);

const newCsv = [header, ...newDataLines].join('\n') + '\n';
initContent = initContent.replace(match[0], `export const RAW_CADASTRO_CSV = \`\n${newCsv}\`;`);
fs.writeFileSync(initFilePath, initContent, 'utf8');
console.log('src/data/initialData.ts updated successfully.');
