// Step 2: retrieval. A small BM25 keyword index over the fact chunks.
// With ~60 short chunks, BM25 plus a scheme filter and a topic boost is
// accurate, fast and fully explainable (no embedding API needed).
import { corpus, SCHEMES } from './data.js';

const STOP = new Set('a an the of for to in on at is are was were be been it its this that these those what whats which who whom how do does did can could i me my we our you your and or as by with from about into than then there their please tell give show know want need much many any some groww fund funds scheme schemes mutual mf plan direct growth'.split(' '));

const SYNONYMS = {
  ter: ['expense', 'ratio'], expense: ['ratio'], charges: ['expense'], fee: ['expense'], fees: ['expense'],
  lockin: ['lock'], locked: ['lock'], sip: ['sip', 'minimum'], minimum: ['minimum'], lumpsum: ['lumpsum', 'minimum'],
  riskometer: ['risk', 'riskometer'], risky: ['risk'], benchmark: ['benchmark', 'index'], manager: ['managed'], managers: ['managed'],
  launched: ['launched', 'inception'], inception: ['inception', 'launched'], cas: ['consolidated', 'account', 'statement'],
  elss: ['elss', 'tax'], bluechip: ['large'], multicap: ['multicap', 'multi'],
};

export function tokenize(text) {
  const words = String(text).toLowerCase().replace(/₹/g, ' rs ').replace(/lock[\s-]*in/g, 'lock').replace(/[^a-z0-9%.]+/g, ' ').split(/\s+/);
  const out = [];
  for (let w of words) {
    w = w.replace(/^\.+|\.+$/g, '');
    if (!w || STOP.has(w)) continue;
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    out.push(w);
    if (SYNONYMS[w]) out.push(...SYNONYMS[w]);
  }
  return out;
}

// Build the index once (module scope = reused across warm serverless calls).
const docs = corpus.chunks.map(c => {
  const schemeName = c.scheme !== 'general' ? SCHEMES[c.scheme].name : '';
  const tokens = tokenize(`${c.text} ${c.topic.replace(/_/g, ' ')} ${schemeName}`);
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return { chunk: c, tf, len: tokens.length };
});
const N = docs.length;
const avgLen = docs.reduce((a, d) => a + d.len, 0) / N;
const df = new Map();
for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);

function bm25(queryTokens, d, k1 = 1.2, b = 0.75) {
  let score = 0;
  for (const t of new Set(queryTokens)) {
    const f = d.tf.get(t);
    if (!f) continue;
    const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
    score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avgLen));
  }
  return score;
}

/**
 * Returns the top-k chunks for a question.
 * - schemes: restricts to those schemes' chunks (+ general chunks)
 * - topic: chunks tagged with the asked-for fact get a strong boost
 */
export function retrieve(question, { schemes = [], topic = null, k = 4 } = {}) {
  const q = tokenize(question);
  const results = [];
  for (const d of docs) {
    const c = d.chunk;
    if (schemes.length && c.scheme !== 'general' && !schemes.includes(c.scheme)) continue;
    let score = bm25(q, d);
    if (topic && c.topic === topic) score += 6;
    if (topic && c.topic === `${topic}_def`) score += 3;
    if (schemes.length && schemes.includes(c.scheme)) score += 2;
    if (score > 0) results.push({ chunk: c, score: +score.toFixed(3) });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}
