// Kleiner Vorschau-Server für den eigenen Rechner (nur zum Ausprobieren, nicht Teil der App).
// Aufruf: npm start  →  http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT) || 5173;
const WURZEL = resolve('.');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
// Nur die App-Dateien ausliefern – niemals persönliche Daten aus dem Projektordner.
const ERLAUBT = /^(index\.html|manifest\.webmanifest|sw\.js|(css|js|icons)[\\/].+)$/;

createServer(async (anfrage, antwort) => {
  let pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname).replace(/^\/+/, '');
  if (pfad === '') pfad = 'index.html';
  pfad = normalize(pfad);
  if (!ERLAUBT.test(pfad) || pfad.includes('..')) { antwort.writeHead(404).end('Nicht gefunden'); return; }
  try {
    const inhalt = await readFile(join(WURZEL, pfad));
    antwort.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(inhalt);
  } catch {
    antwort.writeHead(404).end('Nicht gefunden');
  }
}).listen(PORT, () => console.log(`Vorschau läuft: http://localhost:${PORT}`));
