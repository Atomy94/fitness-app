import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pkce, anmeldeUrl, tauscheCode, erneuereToken, dropbox, DropboxFehler } from '../js/core/dropbox.js';
import { standDatei, rezepteDatei, liesmichDatei, sicherungText, exportDaten, exportText, DATEI, ORDNER } from '../js/core/claude-dateien.js';
import { leseImport, FELDER } from '../js/core/import.js';
import { ZIEL_INFO } from '../js/core/ziele.js';
import { demoState } from '../js/core/demo.js';
import { createHash } from 'node:crypto';

// Nachgebautes fetch: merkt sich alle Anfragen und antwortet nach Vorgabe.
function falschesFetch(antworten) {
  const anfragen = [];
  const f = async (url, optionen = {}) => {
    anfragen.push({ url, ...optionen });
    const a = antworten.shift();
    if (a instanceof Error) throw a;
    const { status = 200, json = {}, text } = a || {};
    const inhalt = text !== undefined ? text : JSON.stringify(json);
    return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(inhalt), text: async () => inhalt };
  };
  return { f, anfragen };
}
const token = async () => 'TOKEN';

test('Dropbox: PKCE-Geheimnis und Anmeldeadresse (ohne Weiterleitung, mit dauerhaftem Token)', async () => {
  const { verifier, challenge } = await pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  const url = new URL(anmeldeUrl('abc123', challenge));
  assert.equal(url.origin + url.pathname, 'https://www.dropbox.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), 'abc123');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('token_access_type'), 'offline');
  assert.equal(url.searchParams.has('redirect_uri'), false);
  assert.notEqual((await pkce()).verifier, verifier);
});

test('Dropbox: Code einlösen und Token erneuern', async () => {
  let m = falschesFetch([{ json: { access_token: 'A1', refresh_token: 'R1', expires_in: 14400 } }]);
  const t = await tauscheCode(m.f, { appKey: 'key', code: ' CODE \n', verifier: 'VER' });
  assert.equal(t.refreshToken, 'R1');
  assert.equal(t.accessToken, 'A1');
  assert.ok(t.ablauf > Date.now() + 14000 * 1000);
  const body = new URLSearchParams(m.anfragen[0].body);
  assert.equal(m.anfragen[0].url, 'https://api.dropboxapi.com/oauth2/token');
  assert.deepEqual(Object.fromEntries(body), { grant_type: 'authorization_code', code: 'CODE', code_verifier: 'VER', client_id: 'key' });

  m = falschesFetch([{ json: { access_token: 'A2', expires_in: 100 } }]);
  const n = await erneuereToken(m.f, { appKey: 'key', refreshToken: 'R1' });
  assert.equal(n.accessToken, 'A2');
  assert.equal(new URLSearchParams(m.anfragen[0].body).get('grant_type'), 'refresh_token');

  // Abgelehnter Code: verständlicher Grund plus die Original-Antwort von Dropbox
  m = falschesFetch([{ status: 400, json: { error: 'invalid_grant', error_description: "code doesn't exist or has expired" } }]);
  await assert.rejects(tauscheCode(m.f, { appKey: 'key', code: 'x', verifier: 'v' }), (e) => e.status === 400 && /abgelaufen oder wurde schon einmal benutzt/.test(e.message) && /code doesn't exist or has expired/.test(e.message));
  m = falschesFetch([{ status: 400, json: { error: 'invalid_grant', error_description: 'invalid code verifier' } }]);
  await assert.rejects(tauscheCode(m.f, { appKey: 'key', code: 'x', verifier: 'v' }), /passt nicht zu diesem Anmeldelink/);
  m = falschesFetch([{ status: 400, json: { error: 'invalid_client', error_description: 'Invalid client_id or client_secret' } }]);
  await assert.rejects(tauscheCode(m.f, { appKey: 'key', code: 'x', verifier: 'v' }), /App key wird von Dropbox nicht erkannt/);
  m = falschesFetch([{ status: 400, json: { error: 'invalid_grant' } }]);
  await assert.rejects(erneuereToken(m.f, { appKey: 'key', refreshToken: 'alt' }), (e) => e instanceof DropboxFehler && e.status === 401);
});

test('Dropbox: Dateien hochladen, auflisten, herunterladen, verschieben', async () => {
  const m = falschesFetch([
    {}, // upload
    { json: { entries: [{ '.tag': 'file', name: 'import-1.md', path_lower: '/eingang/import-1.md', size: 120, server_modified: '2026-11-15T18:00:00Z' }, { '.tag': 'folder', name: 'alt' }] } },
    { text: 'FITNESS-IMPORT v1\n{"eintraege":[]}' },
    {}, // move
  ]);
  const d = dropbox(m.f, token);
  await d.hochladen('/stand.md', 'Größe: 5 – ok');
  const up = m.anfragen[0];
  assert.equal(up.url, 'https://content.dropboxapi.com/2/files/upload');
  assert.equal(up.headers.Authorization, 'Bearer TOKEN');
  assert.deepEqual(JSON.parse(up.headers['Dropbox-API-Arg']), { path: '/stand.md', mode: 'overwrite', mute: true });
  assert.equal(new TextDecoder().decode(up.body), 'Größe: 5 – ok'); // UTF-8 bleibt erhalten

  const liste = await d.liste('/eingang');
  assert.deepEqual(liste, [{ name: 'import-1.md', pfad: '/eingang/import-1.md', groesse: 120, geaendert: '2026-11-15T18:00:00Z' }]);
  assert.equal(await d.herunterladen('/eingang/import-1.md'), 'FITNESS-IMPORT v1\n{"eintraege":[]}');
  assert.equal(m.anfragen[2].url, 'https://content.dropboxapi.com/2/files/download');
  await d.verschiebe('/eingang/import-1.md', '/erledigt/import-1.md');
  assert.deepEqual(JSON.parse(m.anfragen[3].body), { from_path: '/eingang/import-1.md', to_path: '/erledigt/import-1.md', autorename: true });
});

test('Dropbox: Umlaute im Pfad werden für den Anfragekopf maskiert', async () => {
  const m = falschesFetch([{}]);
  await dropbox(m.f, token).hochladen('/erledigt/müsli.md', 'x');
  const arg = m.anfragen[0].headers['Dropbox-API-Arg'];
  assert.match(arg, /^[\x20-\x7e]+$/);
  assert.equal(JSON.parse(arg).path, '/erledigt/müsli.md');
});

test('Dropbox: fehlender Eingangsordner wird angelegt, Fehler sind verständlich', async () => {
  let m = falschesFetch([{ status: 409, json: { error_summary: 'path/not_found/..' } }, {}]);
  assert.deepEqual(await dropbox(m.f, token).liste('/eingang'), []);
  assert.equal(m.anfragen[1].url, 'https://api.dropboxapi.com/2/files/create_folder_v2');

  m = falschesFetch([new TypeError('Failed to fetch')]);
  await assert.rejects(dropbox(m.f, token).liste('/eingang'), (e) => e instanceof DropboxFehler && e.offline && /Keine Verbindung/.test(e.message));
  m = falschesFetch([{ status: 401, json: { error_summary: 'expired_access_token/' } }]);
  await assert.rejects(dropbox(m.f, token).herunterladen('/x'), (e) => e.status === 401 && /neu verbinden/.test(e.message));
  m = falschesFetch([{ status: 409, json: { error_summary: 'path/conflict/folder/' } }]);
  await dropbox(m.f, token).ordner('/erledigt'); // vorhandener Ordner ist kein Fehler
  m = falschesFetch([{ status: 500, text: 'kaputt' }]);
  await assert.rejects(dropbox(m.f, token).hochladen('/x', 'y'), /Fehler \(500/);
});

test('Dateien für Claude: Stand, Rezepte, Sicherung', () => {
  const heute = '2026-11-25';
  const s = demoState(heute);
  const stand = standDatei(s, heute, '19:32', '1.2.0');
  assert.match(stand, /Erzeugt am 25\.11\.2026 um 19:32 Uhr/);
  assert.match(stand, /Laufende Woche \(KW 48\)/);
  const json = JSON.parse(stand.split('```json\n')[1].split('\n```')[0]);
  assert.equal(json.tage.length, 17);
  assert.ok(json.tage[0].status.ernaehrung);
  assert.equal(json.ziele_heute.kcal_mo_sa_ziel, 2200);
  assert.ok(json.wochenwertungen.length >= 3);
  assert.equal(json.rezepte, undefined); // Rezepte stehen in eigener Datei
  assert.ok(json.trainings.every((t) => t.id === undefined));
  // Zeitfenster: nur die letzten 8 Wochen im Detail
  s.tage['2026-01-05'] = { datum: '2026-01-05', kcal: 2000 };
  assert.equal(exportDaten(s, heute, 56).tage.some((t) => t.datum === '2026-01-05'), false);
  assert.equal(exportDaten(s, heute, 0).tage.some((t) => t.datum === '2026-01-05'), true);
  assert.match(exportText(s, heute, 28), /^FITNESS-EXPORT v1/);

  const rez = rezepteDatei(s, heute);
  for (const k of ['## Frühstück', '## Mittagessen', '## Abendessen', '## Snacks', '### Overnight Oats', '- 60 g Haferflocken', 'pro 100 g']) assert.ok(rez.includes(k), k);

  const sich = JSON.parse(sicherungText(s, '2026-11-25T18:32:00Z'));
  assert.equal(sich.format, 'fitness-sicherung');
  assert.equal(sich.daten.rezepte.length, 5);
  assert.match(DATEI.sicherung, /sicherung/);
  assert.equal(ORDNER.eingang, '/eingang');
});

test('Anleitung für Claude: nennt alle Typen, Felder und Zielschlüssel; das Beispiel ist ein gültiger Import', () => {
  const text = liesmichDatei();
  for (const typ of Object.keys(FELDER)) assert.ok(text.includes(`"typ": "${typ}"`), `Beispiel für ${typ} fehlt`);
  for (const [typ, felder] of Object.entries(FELDER)) for (const feld of Object.keys(felder)) assert.ok(text.includes(feld), `Feld ${typ}.${feld} fehlt`);
  for (const k of Object.keys(ZIEL_INFO)) assert.ok(text.includes(`\`${k}\``), `Zielschlüssel ${k} fehlt`);
  const beispiel = text.split('```\n')[1].split('\n```')[0];
  const r = leseImport(beispiel);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  assert.equal(r.eintraege.length, 7);
});
