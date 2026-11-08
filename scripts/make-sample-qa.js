// Generates SAMPLE_QA.md from the assistant's real answers.
//   node scripts/make-sample-qa.js                 -> runs the pipeline locally (uses GEMINI_API_KEY if set)
//   node scripts/make-sample-qa.js https://x.app   -> asks a deployed copy instead
import { writeFileSync } from 'node:fs';
import { ask } from '../lib/assistant.js';

const QUESTIONS = [
  'What is the expense ratio of Groww Large Cap Fund?',
  'What is the lock-in period of Groww ELSS Tax Saver Fund?',
  'What is the exit load of Groww Multicap Fund?',
  'What is the minimum SIP amount for Groww Nifty Total Market Index Fund?',
  'What is the riskometer level and benchmark of Groww Large Cap Fund?',
  'How do I download my capital-gains statement?',
  'How do I download my ELSS tax statement on Groww?',
  'Should I invest in Groww ELSS Tax Saver Fund or Groww Large Cap Fund?',
  'What returns has Groww Multicap Fund given in the last 1 year?',
  'My PAN is ABCDE1234F. Can you check my SIP?',
];

const base = process.argv[2];
async function getAnswer(q) {
  if (!base) return ask(q);
  const res = await fetch(`${base.replace(/\/$/, '')}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) });
  return res.json();
}

const LABEL = { answer: 'Answered', refusal: 'Refused (facts-only)', clarify: 'Asked which scheme', not_found: 'Not in sources' };
let md = `# Sample Q&A\n\nReal answers produced by the assistant${base ? ` at ${base}` : ''}. Each answer is at most 3 sentences, carries exactly one source link and the "Last updated from sources" date.\n\n`;
let i = 0;
for (const q of QUESTIONS) {
  const r = await getAnswer(q);
  i++;
  md += `### ${i}. ${q}\n\n`;
  md += `**Result:** ${LABEL[r.type] || r.type}${r.reason ? ` (${r.reason})` : ''}\n\n`;
  md += `> ${r.answer}\n>\n> Source: [${r.source.title}](${r.source.url})  \n> Last updated from sources: ${r.last_updated}\n\n`;
}
writeFileSync(new URL('../SAMPLE_QA.md', import.meta.url), md);
console.log(`Wrote SAMPLE_QA.md with ${i} questions`);
