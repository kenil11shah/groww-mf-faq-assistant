// The full question -> answer pipeline.
//   1. understand  (PII, intent, scheme, topic)
//   2. decide      (answer / refuse / clarify)
//   3. retrieve    (BM25 over official-source fact chunks)
//   4. generate    (Gemini, grounded on the retrieved chunks)
//   5. verify      (one source, <= 3 sentences, no new numbers) else fall back to the source text
import { understand, SCHEME_SPECIFIC } from './understand.js';
import { retrieve } from './retrieve.js';
import { generate } from './llm.js';
import { corpus, sources, sourceFor, SCHEMES, LAST_UPDATED } from './data.js';

export const DISCLAIMER = 'Facts-only. No investment advice. Answers come only from official Groww Mutual Fund, SEBI and AMFI pages, and every answer shows its source.';

const SCHEME_LIST = Object.values(SCHEMES).map(s => s.name);
const SCHEME_LIST_TEXT = `${SCHEME_LIST.slice(0, -1).join(', ')} and ${SCHEME_LIST.at(-1)}`;
const MIN_SCORE = 3;
const MAX_QUESTION_LENGTH = 500;

function reply(type, answer, sourceId, extra = {}) {
  return { type, answer, source: sourceFor(sourceId), last_updated: LAST_UPDATED, ...extra };
}

const TEMPLATES = {
  pii: kind => reply('refusal',
    `For your safety, please don't share personal details such as your ${kind} here; nothing you type is stored. I can only answer general facts about Groww Mutual Fund schemes, and for help with your own account please contact Groww Mutual Fund investor support.`,
    'S07', { reason: 'pii' }),
  advice: () => reply('refusal',
    "I can only share facts, not investment advice, so I can't tell you whether to buy, sell or which fund suits you. I can tell you facts such as the expense ratio, exit load, lock-in or riskometer of a scheme. To learn how to read these facts, see Groww Mutual Fund's investor education page, and for personal advice please consult a SEBI-registered investment adviser.",
    'S08', { reason: 'advice' }),
  performance: () => reply('refusal',
    "I don't share, calculate or compare returns. Please check the official performance figures in the latest Groww Mutual Fund factsheet.",
    'S03', { reason: 'performance' }),
  compare: () => reply('refusal',
    "I don't compare schemes, but I can give you the facts for each scheme separately. For example, ask \"What is the expense ratio of Groww Multicap Fund?\" and then ask the same about the other scheme.",
    'S03', { reason: 'compare' }),
  account: () => reply('refusal',
    "I can't see or access any investor account, folio, SIP or transaction. For questions about your own investments, please contact Groww Mutual Fund investor support at support@growwmf.in or +91 80501 80222.",
    'S07', { reason: 'account' }),
  other_amc: () => reply('refusal',
    `I only cover four Groww Mutual Fund schemes: ${SCHEME_LIST_TEXT}. For schemes of other fund houses, please check that AMC's official website or factsheet.`,
    'S16', { reason: 'out_of_scope' }),
  other_scheme: () => reply('refusal',
    `I currently cover only four Groww Mutual Fund schemes: ${SCHEME_LIST_TEXT}. Documents for all other Groww schemes are in the Downloads section of the Groww Mutual Fund website.`,
    'S16', { reason: 'out_of_scope' }),
  clarify: () => reply('clarify',
    `Which scheme do you mean? I have facts for ${SCHEME_LIST_TEXT}.`,
    'S03', { options: SCHEME_LIST }),
  unsupported: sourceId => reply('not_found',
    "That figure changes often and is not part of my verified fact set, so I won't guess. Please check the latest value in the official monthly factsheet linked below.",
    sourceId, { reason: 'unsupported' }),
  not_found: () => reply('not_found',
    "I couldn't find that in my official sources, so I won't guess. You can check the scheme documents (KIM, SID and factsheet) in the Downloads section of the Groww Mutual Fund website.",
    'S16'),
  empty: () => reply('clarify', `Please type a question about one of these schemes: ${SCHEME_LIST_TEXT}.`, 'S03', { options: SCHEME_LIST }),
};

// ---------- verification helpers ----------
export function splitSentences(text) {
  // Split only at . ! ? followed by a space and a capital letter, so "1.27%", "mfcentral.com" and "No. is" stay intact.
  return String(text).trim().split(/(?<=[.!?])\s+(?=[A-Z"'(₹])/).map(s => s.trim()).filter(Boolean);
}
export function limitSentences(text, n = 3) {
  return splitSentences(text).slice(0, n).join(' ');
}
const numbersIn = t => (String(t).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
/** Every number in the answer must already be in the cited chunk (or the question). */
export function numbersAreGrounded(answer, chunkText, question = '') {
  const allowed = new Set([...numbersIn(chunkText), ...numbersIn(question)]);
  return numbersIn(answer).every(n => allowed.has(n));
}
const ADVICE_IN_OUTPUT = /\b(you should|i recommend|we recommend|i suggest|good investment|good choice|worth investing|better option|is safe|will (rise|grow|give))\b/i;

function answerFromChunk(chunk, mode, extra = {}) {
  return reply('answer', limitSentences(chunk.text, 3), chunk.source, { chunk_id: chunk.id, as_of: chunk.as_of, mode, ...extra });
}

export async function ask(question, opts = {}) {
  const q = understand(String(question || '').slice(0, MAX_QUESTION_LENGTH));
  if (!q.text) return TEMPLATES.empty();

  // 1. Safety first: personal data is refused before anything else happens.
  if (q.pii) return TEMPLATES.pii(q.pii);

  // 2. Refuse what a facts-only assistant must not do.
  if (q.intent === 'performance') return TEMPLATES.performance();
  if (q.intent === 'advice') return TEMPLATES.advice();
  if (q.intent === 'account') return TEMPLATES.account();
  if (q.outOfScope) return TEMPLATES[q.outOfScope]();
  if (q.intent === 'compare' || q.schemes.length > 1) return TEMPLATES.compare();

  // 3. Make sure we know exactly which fact is being asked for.
  let topic = q.topic;
  if (topic === 'unsupported') {
    return TEMPLATES.unsupported('S03'); // the monthly factsheet carries NAV, AUM and holdings
  }
  if (!topic && q.schemes.length === 1) topic = 'category'; // "Tell me about X" / "What is ELSS?"

  if (q.definition && q.schemes.length === 0 && ['expense_ratio', 'exit_load'].includes(topic)) topic = `${topic}_def`;
  if (q.definition && q.schemes.length === 0 && topic === 'riskometer') topic = /level|often|updat|evaluat|chang/i.test(q.text) ? 'riskometer' : 'riskometer_def';
  if (SCHEME_SPECIFIC.has(topic) && q.schemes.length === 0 && !q.definition) return TEMPLATES.clarify();

  // 4. Retrieve.
  let hits = retrieve(q.text, { schemes: q.schemes, topic, k: 4 });
  // A general definition question must be answered by a general source, never by one scheme's number.
  if (q.definition && q.schemes.length === 0) hits = hits.filter(h => h.chunk.scheme === 'general');
  if (!hits.length || hits[0].score < MIN_SCORE) return TEMPLATES.not_found();
  const debug = opts.debug ? { understood: { ...q, topic }, hits: hits.map(h => ({ id: h.chunk.id, score: h.score })) } : {};

  // 5. Generate with the LLM, then verify. Any doubt -> use the source sentence itself.
  if (opts.useLLM !== false) {
    try {
      const out = await (opts.generate || generate)(q.text, hits);
      const cited = hits.find(h => h.chunk.id === out.chunk_id)?.chunk;
      if (out.answerable && cited && out.answer) {
        const answer = limitSentences(out.answer, 3);
        if (numbersAreGrounded(answer, `${cited.text} ${cited.as_of}`, q.text) && !ADVICE_IN_OUTPUT.test(answer)) {
          return reply('answer', answer, cited.source, { chunk_id: cited.id, as_of: cited.as_of, mode: 'llm', model: out.model, ...debug });
        }
        return answerFromChunk(cited, 'extractive', { fallback: 'verification_failed', ...debug });
      }
      if (!out.answerable && !(topic && hits[0].chunk.topic === topic)) return { ...TEMPLATES.not_found(), ...debug };
    } catch (e) {
      // no key / model busy / timeout -> extractive mode below
      return answerFromChunk(hits[0].chunk, 'extractive', { fallback: e.message === 'no_api_key' ? 'no_api_key' : 'llm_unavailable', ...(e.message !== 'no_api_key' ? { llm_error: String(e.message).slice(0, 400) } : {}), ...debug });
    }
  }
  return answerFromChunk(hits[0].chunk, 'extractive', debug);
}

export const META = {
  amc: corpus.amc,
  schemes: SCHEME_LIST,
  last_updated: LAST_UPDATED,
  disclaimer: DISCLAIMER,
  sources: Object.values(sources).map(({ id, title, publisher, type, url }) => ({ id, title, publisher, type, url })),
};
