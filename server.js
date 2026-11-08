// Local development server: node server.js  ->  http://localhost:3000
// Serves /public and the same /api/ask handler that runs on Vercel.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/ask.js';

// Optional: load GEMINI_API_KEY from a local .env file (never committed).
try {
  const env = await readFile(new URL('./.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env file - extractive mode */ }

const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/ask')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.body = raw;
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    return handler(req, res);
  }
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, path.endsWith('/') ? 'index.html' : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(PORT, () => console.log(`Running on http://localhost:${PORT} (${process.env.GEMINI_API_KEY ? 'Gemini on' : 'no API key: extractive mode'})`));
