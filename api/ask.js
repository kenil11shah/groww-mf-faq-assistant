// Vercel serverless function: POST /api/ask  { "question": "..." }
// Privacy: questions are never logged or stored.
import { ask, META } from '../lib/assistant.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json(META);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = typeof body?.question === 'string' ? body.question : '';
  if (question.length > 500) return res.status(400).json({ error: 'Please keep questions under 500 characters.' });

  try {
    const result = await ask(question);
    return res.status(200).json(result);
  } catch (e) {
    console.error('ask failed:', e.message); // error type only, never the question
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
