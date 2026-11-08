// Loads the knowledge base (fact chunks) and the source list.
// createRequire keeps the JSON files bundled correctly on Vercel.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const corpus = require('../data/corpus.json');
export const sources = require('../data/sources.json');

export const SCHEMES = corpus.schemes;
export const LAST_UPDATED = corpus.last_updated;

export function sourceFor(id) {
  const s = sources[id];
  if (!s) throw new Error(`Unknown source id ${id}`);
  return { id: s.id, title: s.title, publisher: s.publisher, url: s.url };
}
