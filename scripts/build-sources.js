// Converts data/sources.csv into data/sources.json (the app reads the JSON).
// Run: node scripts/build-sources.js
import { readFileSync, writeFileSync } from 'node:fs';

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1);
}

const [header, ...rows] = parseCSV(readFileSync(new URL('../data/sources.csv', import.meta.url), 'utf8'));
const sources = {};
for (const r of rows) {
  const o = Object.fromEntries(header.map((h, i) => [h, r[i]]));
  sources[o.id] = o;
}
writeFileSync(new URL('../data/sources.json', import.meta.url), JSON.stringify(sources, null, 2) + '\n');
console.log(`Wrote ${Object.keys(sources).length} sources to data/sources.json`);
