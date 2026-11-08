// Front-end for Groww MF Facts. No cookies, no local storage, no analytics.
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('q');
const sendBtn = document.getElementById('send');
const hint = document.getElementById('hint');
const HINT_TEXT = hint.textContent;

// The same personal-data checks run on the server; checking here means the text never leaves the browser.
const PII = [
  ['PAN', /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i],
  ['Aadhaar number', /\b[2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/],
  ['email address', /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ['phone number', /(?:\+?91[\s-]?)?\b[6-9][0-9]{9}\b/],
  ['OTP', /\botp\b[^0-9]{0,15}\d{4,8}|\b\d{4,8}\b[^0-9a-z]{0,5}(?:is my|is the)?\s*otp\b/i],
  ['folio or account number', /\b(?:folio|account|a\/c|acct)\b[^0-9]{0,15}\d{5,}/i],
  ['account number', /\b\d{9,18}\b/],
];
const findPII = t => (PII.find(([, re]) => re.test(t)) || [])[0];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function scrollDown() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }

function addUser(text) { chat.appendChild(el('div', 'msg user', text)); scrollDown(); }

const TAGS = { refusal: 'Facts only', clarify: 'Which scheme?', not_found: 'Not in my sources' };

function addBot(r) {
  const box = el('div', 'msg bot' + (r.type === 'refusal' ? ' refusal' : ''));
  if (TAGS[r.type]) box.appendChild(el('span', 'tag', TAGS[r.type]));
  box.appendChild(el('p', 'answer', r.answer));
  if (r.options) {
    const opts = el('div', 'opts');
    for (const name of r.options) {
      const b = el('button', 'chip', name);
      b.type = 'button';
      b.addEventListener('click', () => ask(`${box.dataset.question || ''} (${name})`.trim()));
      opts.appendChild(b);
    }
    box.appendChild(opts);
  }
  if (r.source) {
    const meta = el('div', 'meta');
    const line = el('div');
    line.append('Source: ');
    const a = el('a', null, `${r.source.title} — ${r.source.publisher} ↗`);
    a.href = r.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    line.appendChild(a);
    meta.appendChild(line);
    meta.appendChild(el('div', null, `Last updated from sources: ${r.last_updated}`));
    box.appendChild(meta);
  }
  chat.appendChild(box);
  scrollDown();
  return box;
}

let busy = false;
async function ask(question) {
  question = question.trim();
  if (!question || busy) return;
  const kind = findPII(question);
  if (kind) {
    hint.textContent = `That looks like a ${kind}. Please remove it — personal details are not accepted.`;
    hint.classList.add('pii');
    return;
  }
  hint.textContent = HINT_TEXT; hint.classList.remove('pii');
  busy = true; sendBtn.disabled = true; input.value = '';
  addUser(question);
  const typing = el('div', 'msg bot typing');
  typing.innerHTML = '<i></i><i></i><i></i> Checking official sources';
  chat.appendChild(typing); scrollDown();
  try {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }), signal: AbortSignal.timeout(25000),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    const box = addBot(data);
    if (data.type === 'clarify') box.dataset.question = question;
  } catch (e) {
    typing.remove();
    addBot({ type: 'not_found', answer: 'Sorry, something went wrong while answering. Please try again in a moment.' });
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
  }
}

form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
input.addEventListener('input', () => { if (hint.classList.contains('pii') && !findPII(input.value)) { hint.textContent = HINT_TEXT; hint.classList.remove('pii'); } });
document.querySelectorAll('.examples .chip').forEach(b => b.addEventListener('click', () => ask(b.textContent)));

// Sources dialog
const dlg = document.getElementById('sources');
let loaded = false;
document.getElementById('openSources').addEventListener('click', async () => {
  dlg.showModal();
  if (loaded) return;
  try {
    const meta = await (await fetch('/api/ask')).json();
    document.getElementById('updated').textContent = `Last updated from sources: ${meta.last_updated}.`;
    const list = document.getElementById('sourceList');
    for (const s of meta.sources) {
      const li = el('li');
      const a = el('a', null, s.title); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      li.append(a, ` — ${s.publisher}`);
      list.appendChild(li);
    }
    loaded = true;
  } catch { /* leave the list empty */ }
});
document.getElementById('closeSources').addEventListener('click', () => dlg.close());
