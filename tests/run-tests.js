// Offline test suite: node tests/run-tests.js
// Runs every case twice: (1) extractive mode (no LLM), (2) with a fake LLM, to test
// the guardrails around the model (wrong chunk ids, invented numbers, advice, >3 sentences).
import { readFileSync } from 'node:fs';
import { ask, splitSentences } from '../lib/assistant.js';
import { corpus, sources } from '../lib/data.js';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };

// ---------- 1. Corpus integrity ----------
const ids = new Set();
for (const c of corpus.chunks) {
  ok(!ids.has(c.id), `duplicate chunk id ${c.id}`); ids.add(c.id);
  ok(!!sources[c.source], `chunk ${c.id} cites unknown source ${c.source}`);
  ok(splitSentences(c.text).length <= 3, `chunk ${c.id} is longer than 3 sentences`);
  ok(c.as_of && c.topic && c.scheme, `chunk ${c.id} missing metadata`);
}
const srcCount = Object.keys(sources).length;
ok(srcCount >= 15 && srcCount <= 25, `source count ${srcCount} outside 15-25`);
for (const s of Object.values(sources)) ok(/^https:\/\/(www\.)?(growwmf\.in|assets-netstorage\.growwmf\.in|portal\.amfiindia\.com|amfiindia\.com|www\.amfiindia\.com|sebi\.gov\.in|www\.sebi\.gov\.in|mutualfundssahihai\.com|www\.mutualfundssahihai\.com|groww\.in)\//.test(s.url), `non-official source ${s.url}`);
const used = new Set(corpus.chunks.map(c => c.source));
for (const id of Object.keys(sources)) if (!['S08', 'S10'].includes(id)) ok(used.has(id), `source ${id} is never used by a chunk`);

// ---------- 2. Behaviour (extractive mode) ----------
async function check(c, opts, label) {
  const r = await ask(c.q, opts);
  const tag = `[${label}] "${c.q}"`;
  ok(r.type === c.type, `${tag} expected type ${c.type}, got ${r.type} (${r.answer})`);
  ok(r.source && r.source.url && r.source.url.startsWith('https://'), `${tag} has no source link`);
  ok(splitSentences(r.answer).length <= 3, `${tag} answer longer than 3 sentences`);
  ok(r.last_updated === corpus.last_updated, `${tag} missing last_updated`);
  if (c.chunk) ok(r.chunk_id === c.chunk, `${tag} expected chunk ${c.chunk}, got ${r.chunk_id}`);
  if (c.source) ok(r.source.id === c.source, `${tag} expected source ${c.source}, got ${r.source.id}`);
  if (c.reason) ok(r.reason === c.reason, `${tag} expected reason ${c.reason}, got ${r.reason}`);
  if (c.contains) ok(r.answer.toLowerCase().includes(c.contains.toLowerCase()), `${tag} answer should contain "${c.contains}": ${r.answer}`);
  if (r.type === 'answer') ok(!/\b(should|recommend|suggest)\b/i.test(r.answer), `${tag} answer sounds like advice`);
  return r;
}
for (const c of cases) await check(c, { useLLM: false }, 'extractive');

// ---------- 3. Fake LLM: a well-behaved model is used as-is ----------
const goodLLM = async (q, hits) => ({ answerable: true, chunk_id: hits[0].chunk.id, answer: hits[0].chunk.text, model: 'fake-good' });
for (const c of cases) {
  const r = await check(c, { generate: goodLLM }, 'llm-good');
  if (c.type === 'answer') ok(r.mode === 'llm', `[llm-good] "${c.q}" should use LLM mode`);
}

// ---------- 4. Fake LLM misbehaving: guardrails must catch it ----------
const q = 'What is the expense ratio of Groww Large Cap Fund?';
let r = await ask(q, { generate: async (_, h) => ({ answerable: true, chunk_id: h[0].chunk.id, answer: 'The expense ratio of Groww Large Cap Fund is 0.95%.', model: 'fake' }) });
ok(r.mode === 'extractive' && r.answer.includes('1.27%'), 'invented number must be rejected and replaced by the source text');
r = await ask('What is the expense ratio of Groww Large Cap Fund regular plan?', { generate: async (_, h) => ({ answerable: true, chunk_id: 'LC-ER-2', answer: 'As on 30 Sep 2026, the base expense ratio of Groww Large Cap Fund (Regular Plan) was 2.09%.', model: 'fake' }) });
ok(r.mode === 'llm', 'the chunk\'s own as-of date is allowed in an answer');
r = await ask(q, { generate: async () => ({ answerable: true, chunk_id: 'NOT-A-CHUNK', answer: 'It is 1.27%.', model: 'fake' }) });
ok(r.mode === 'extractive' && r.chunk_id === 'LC-ER-1', 'unknown chunk id must fall back to the top retrieved chunk');
r = await ask(q, { generate: async (_, h) => ({ answerable: true, chunk_id: h[0].chunk.id, answer: 'It is 1.27%, so you should invest now.', model: 'fake' }) });
ok(r.mode === 'extractive', 'advice inside a model answer must be rejected');
r = await ask(q, { generate: async (_, h) => ({ answerable: true, chunk_id: h[0].chunk.id, answer: 'One. Two. Three. Four. Five.', model: 'fake' }) });
ok(splitSentences(r.answer).length <= 3, 'model answers are cut to 3 sentences');
r = await ask(q, { generate: async () => { throw new Error('HTTP 503'); } });
ok(r.type === 'answer' && r.mode === 'extractive' && r.fallback === 'llm_unavailable', 'LLM outage falls back to extractive answer');
r = await ask('What is the weather in Mumbai?', { generate: async () => { throw new Error('should not be called'); } });
ok(r.type === 'not_found', 'off-topic questions never reach the model');
r = await ask('My PAN is ABCDE1234F', { generate: async () => { throw new Error('should not be called'); } });
ok(r.reason === 'pii', 'PII never reaches the model');

console.log(`\n${pass} passed, ${fail} failed (${cases.length} question cases x 2 modes + corpus and guardrail checks)`);
process.exit(fail ? 1 : 0);
