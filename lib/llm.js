// Step 3: generation with Google Gemini (free tier via Google AI Studio).
// The model only sees the retrieved chunks and must answer from one of them.

// '-latest' aliases always point at Google's current Flash models (older fixed names get retired).
const DEFAULT_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
const CALL_TIMEOUT_MS = 7000;
const TOTAL_BUDGET_MS = 24000;

export const SYSTEM_PROMPT = `You are a facts-only FAQ assistant for Groww Mutual Fund schemes.

Rules:
1. Answer ONLY from the numbered context passages. Never use outside knowledge.
2. Pick the ONE passage that answers the question best and answer from it alone. Return its id in "chunk_id".
3. Keep the answer to at most 3 short sentences. Copy numbers, percentages, dates and names exactly as written in the passage.
4. Always name the scheme (and plan, e.g. Direct or Regular) the fact belongs to. If the passage itself contains an "As on" date, keep it.
5. Never give investment advice, opinions, recommendations, predictions or return figures. Do not say whether a fund is good, bad, safe or suitable.
6. Do not add a source link or "Last updated" line; the app adds those.
7. If no passage answers the question, set "answerable" to false and leave "answer" empty.
Reply only in the JSON format requested.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answerable: { type: 'BOOLEAN' },
    chunk_id: { type: 'STRING' },
    answer: { type: 'STRING' },
  },
  required: ['answerable', 'chunk_id', 'answer'],
};

export function buildUserPrompt(question, hits) {
  const ctx = hits.map(h => `[${h.chunk.id}] ${h.chunk.text}`).join('\n');
  return `Context passages:\n${ctx}\n\nQuestion: ${question}`;
}

async function callModel(model, apiKey, question, hits, timeoutMs) {
  const generationConfig = {
    temperature: 0.1,
    maxOutputTokens: 400,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };
  if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(question, hits) }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`${model}: HTTP ${res.status} ${detail.slice(0, 220)}`.trim());
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return JSON.parse(text);
}

/** Returns {answerable, chunk_id, answer, model} or throws if every model failed. */
export async function generate(question, hits, { apiKey = process.env.GEMINI_API_KEY, models } = {}) {
  if (!apiKey) throw new Error('no_api_key');
  const list = models || (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS] : DEFAULT_MODELS);
  const started = Date.now();
  const errors = [];
  for (const model of list) {
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 1500) break;
    try {
      const out = await callModel(model, apiKey, question, hits, Math.min(CALL_TIMEOUT_MS, left));
      return { ...out, model };
    } catch (e) {
      // try the next model (busy / quota / timeout); keep a short reason for diagnosis (never the key)
      errors.push(e.name === 'TimeoutError' ? `${model}: timeout` : String(e.message).slice(0, 260));
      if (/HTTP (429|503)/.test(e.message)) await new Promise(r => setTimeout(r, 700)); // busy: short pause before the next try
    }
  }
  throw new Error(errors.join(' | ') || 'llm_failed');
}
